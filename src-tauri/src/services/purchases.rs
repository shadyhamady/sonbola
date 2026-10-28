use rusqlite::{Connection, params};

use crate::db::now_ms;
use crate::error::{AppError, AppResult, invalid, not_found};
use crate::models::*;
use crate::services::{drawer_link, ensure_shift_editable, opt_text, recompute_ingredient_avg, round, shift_is_closed};

fn purchase_status(paid: i64, balance: i64) -> &'static str {
    if balance <= 0 {
        "paid"
    } else if paid > 0 {
        "partial"
    } else {
        "unpaid"
    }
}

pub fn create_purchase(conn: &mut Connection, input: NewPurchase) -> AppResult<i64> {
    if input.items.is_empty() {
        return invalid("أضف مكوّناً واحداً على الأقل");
    }
    let mut total = 0i64;
    let mut lines = Vec::with_capacity(input.items.len());
    for item in &input.items {
        if !(item.qty > 0.0) || item.unit_cost_milli < 0 {
            return invalid("قيمة غير صالحة");
        }
        let line_total = round(item.qty * item.unit_cost_milli as f64);
        total += line_total;
        lines.push((item, line_total));
    }
    if input.paid_now_milli < 0 {
        return invalid("قيمة غير صالحة");
    }
    if input.paid_now_milli > total {
        return invalid("المبلغ أكبر من المتبقي");
    }

    let tx = conn.transaction()?;
    let shift_id =
        if input.paid_now_milli > 0 { drawer_link(&tx, &input.method, input.paid_from_drawer)? } else { None };
    let now = now_ms();
    tx.execute(
        "INSERT INTO purchases (supplier_id, invoice_no, purchased_at, total_milli, note, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![input.supplier_id, opt_text(input.invoice_no), input.purchased_at, total, opt_text(input.note), now],
    )?;
    let purchase_id = tx.last_insert_rowid();
    for (item, line_total) in lines {
        let n = tx.execute(
            "UPDATE ingredients SET stock_qty = stock_qty + ?1 WHERE id = ?2",
            params![item.qty, item.ingredient_id],
        )?;
        if n == 0 {
            return Err(AppError::NotFound);
        }
        tx.execute(
            "INSERT INTO purchase_items (purchase_id, ingredient_id, qty, unit_cost_milli, total_cost_milli, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![purchase_id, item.ingredient_id, item.qty, item.unit_cost_milli, line_total, now],
        )?;
        recompute_ingredient_avg(&tx, item.ingredient_id)?;
    }
    if input.paid_now_milli > 0 {
        tx.execute(
            "INSERT INTO purchase_payments (purchase_id, amount_milli, method, paid_at, paid_from_drawer, shift_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                purchase_id,
                input.paid_now_milli,
                input.method,
                input.purchased_at,
                shift_id.is_some(),
                shift_id,
                now
            ],
        )?;
    }
    tx.commit()?;
    Ok(purchase_id)
}

fn load_items(conn: &Connection, purchase_id: i64) -> AppResult<Vec<PurchaseItem>> {
    let mut stmt = conn.prepare(
        "SELECT pi.id, pi.ingredient_id, i.name, i.unit, pi.qty, pi.unit_cost_milli, pi.total_cost_milli
         FROM purchase_items pi JOIN ingredients i ON i.id = pi.ingredient_id
         WHERE pi.purchase_id = ?1 ORDER BY pi.id",
    )?;
    let rows = stmt.query_map([purchase_id], |r| {
        Ok(PurchaseItem {
            id: r.get(0)?,
            ingredient_id: r.get(1)?,
            ingredient_name: r.get(2)?,
            unit: r.get(3)?,
            qty: r.get(4)?,
            unit_cost_milli: r.get(5)?,
            total_cost_milli: r.get(6)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

fn load_payments(conn: &Connection, purchase_id: i64) -> AppResult<Vec<PurchasePayment>> {
    let mut stmt = conn.prepare(
        "SELECT pp.id, pp.purchase_id, pp.amount_milli, pp.method, pp.paid_at, pp.paid_from_drawer, pp.shift_id,
                (s.closed_at IS NOT NULL), pp.note
         FROM purchase_payments pp LEFT JOIN shifts s ON s.id = pp.shift_id
         WHERE pp.purchase_id = ?1 ORDER BY pp.paid_at, pp.id",
    )?;
    let rows = stmt.query_map([purchase_id], |r| {
        Ok(PurchasePayment {
            id: r.get(0)?,
            purchase_id: r.get(1)?,
            amount_milli: r.get(2)?,
            method: r.get(3)?,
            paid_at: r.get(4)?,
            paid_from_drawer: r.get(5)?,
            shift_id: r.get(6)?,
            locked: r.get::<_, Option<bool>>(7)?.unwrap_or(false),
            note: r.get(8)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn list_purchases(conn: &Connection, range: Range, supplier_id: Option<i64>) -> AppResult<Vec<Purchase>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.supplier_id, s.name, p.invoice_no, p.purchased_at, p.total_milli, p.note,
                COALESCE((SELECT SUM(amount_milli) FROM purchase_payments pp WHERE pp.purchase_id = p.id), 0)
         FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE p.purchased_at >= ?1 AND p.purchased_at < ?2 AND (?3 IS NULL OR p.supplier_id = ?3)
         ORDER BY p.purchased_at DESC, p.id DESC",
    )?;
    let rows = stmt.query_map(params![range.from, range.to, supplier_id], |r| {
        let total: i64 = r.get(5)?;
        let paid: i64 = r.get(7)?;
        Ok(Purchase {
            id: r.get(0)?,
            supplier_id: r.get(1)?,
            supplier_name: r.get(2)?,
            invoice_no: r.get(3)?,
            purchased_at: r.get(4)?,
            total_milli: total,
            paid_milli: paid,
            balance_milli: total - paid,
            status: purchase_status(paid, total - paid).to_string(),
            note: r.get(6)?,
            items: vec![],
            payments: vec![],
        })
    })?;
    let mut out: Vec<Purchase> = rows.collect::<Result<_, _>>()?;
    for p in &mut out {
        p.items = load_items(conn, p.id)?;
        p.payments = load_payments(conn, p.id)?;
    }
    Ok(out)
}

fn balance(conn: &Connection, purchase_id: i64) -> AppResult<i64> {
    conn.query_row(
        "SELECT p.total_milli - COALESCE((SELECT SUM(amount_milli) FROM purchase_payments WHERE purchase_id = p.id), 0)
         FROM purchases p WHERE p.id = ?1",
        [purchase_id],
        |r| r.get(0),
    )
    .map_err(not_found)
}

pub fn add_purchase_payment(conn: &mut Connection, input: PurchasePaymentInput) -> AppResult<i64> {
    if input.amount_milli <= 0 {
        return invalid("المبلغ يجب أن يكون أكبر من صفر");
    }
    let tx = conn.transaction()?;
    if input.amount_milli > balance(&tx, input.purchase_id)? {
        return invalid("المبلغ أكبر من المتبقي");
    }
    let shift_id = drawer_link(&tx, &input.method, input.paid_from_drawer)?;
    tx.execute(
        "INSERT INTO purchase_payments (purchase_id, amount_milli, method, paid_at, paid_from_drawer, shift_id, note, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            input.purchase_id,
            input.amount_milli,
            input.method,
            input.paid_at,
            shift_id.is_some(),
            shift_id,
            opt_text(input.note),
            now_ms()
        ],
    )?;
    let id = tx.last_insert_rowid();
    tx.commit()?;
    Ok(id)
}

pub fn delete_purchase_payment(conn: &Connection, id: i64) -> AppResult<()> {
    let shift_id: Option<i64> = conn
        .query_row("SELECT shift_id FROM purchase_payments WHERE id = ?1", [id], |r| r.get(0))
        .map_err(not_found)?;
    ensure_shift_editable(conn, shift_id)?;
    conn.execute("DELETE FROM purchase_payments WHERE id = ?1", [id])?;
    Ok(())
}

pub fn delete_purchase(conn: &mut Connection, id: i64) -> AppResult<()> {
    let tx = conn.transaction()?;
    tx.query_row("SELECT id FROM purchases WHERE id = ?1", [id], |r| r.get::<_, i64>(0)).map_err(not_found)?;
    let shifts: Vec<Option<i64>> = {
        let mut stmt = tx.prepare("SELECT shift_id FROM purchase_payments WHERE purchase_id = ?1")?;
        stmt.query_map([id], |r| r.get(0))?.collect::<Result<_, _>>()?
    };
    for s in shifts {
        if shift_is_closed(&tx, s)? {
            return invalid("لا يمكن تعديل أو حذف دفعة من وردية مغلقة");
        }
    }
    let items: Vec<(i64, f64)> = {
        let mut stmt = tx.prepare("SELECT ingredient_id, qty FROM purchase_items WHERE purchase_id = ?1")?;
        stmt.query_map([id], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<Result<_, _>>()?
    };
    for (ing, qty) in &items {
        tx.execute("UPDATE ingredients SET stock_qty = stock_qty - ?1 WHERE id = ?2", params![qty, ing])?;
    }
    tx.execute("DELETE FROM purchases WHERE id = ?1", [id])?;
    for (ing, _) in &items {
        recompute_ingredient_avg(&tx, *ing)?;
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::catalog;
    use crate::services::suppliers;
    use crate::services::testutil::*;

    #[test]
    fn ingredient_avg_and_payables() {
        let mut c = conn();
        let tamr = catalog::create_ingredient(
            &c,
            NewIngredient {
                name: "تمر".into(),
                unit: "kg".into(),
                default_cost_milli: 4000,
                opening_qty: 5.0,
                reorder_qty: 0.0,
            },
        )
        .unwrap();
        let i = ingredient(&c, "تمر");
        assert_eq!((i.stock_qty, i.avg_cost_milli), (5.0, 4000.0));

        let sup = suppliers::create_supplier(
            &c,
            SupplierInput { id: None, name: "مطاحن".into(), contact_person: None, phone: None, supplies: None },
        )
        .unwrap();
        let at = local_ms(&c, "2025-03-01 12:00");
        let buy = |c: &mut Connection, unit_cost: i64, paid: i64| {
            create_purchase(
                c,
                NewPurchase {
                    supplier_id: Some(sup),
                    invoice_no: None,
                    purchased_at: at,
                    note: None,
                    items: vec![PurchaseItemInput { ingredient_id: tamr, qty: 10.0, unit_cost_milli: unit_cost }],
                    paid_now_milli: paid,
                    method: "bank_transfer".into(),
                    paid_from_drawer: false,
                },
            )
            .unwrap()
        };
        let first = buy(&mut c, 5000, 50000);
        let second = buy(&mut c, 7000, 30000);
        let i = ingredient(&c, "تمر");
        assert_eq!((i.stock_qty, i.avg_cost_milli), (25.0, 6000.0));

        let list = list_purchases(&c, Range::all(), Some(sup)).unwrap();
        let p2 = list.iter().find(|p| p.id == second).unwrap();
        assert_eq!((p2.balance_milli, p2.status.as_str()), (40000, "partial"));
        let s = &suppliers::list_suppliers(&c, false).unwrap()[0];
        assert_eq!(
            (s.total_purchased_milli, s.total_paid_milli, s.balance_milli, s.unpaid_invoices),
            (120000, 80000, 40000, 1)
        );

        let pay = |amount| PurchasePaymentInput {
            purchase_id: second,
            amount_milli: amount,
            method: "cash".into(),
            paid_at: at,
            paid_from_drawer: false,
            note: None,
        };
        assert_eq!(err(add_purchase_payment(&mut c, pay(50000))), "المبلغ أكبر من المتبقي");
        add_purchase_payment(&mut c, pay(40000)).unwrap();
        let list = list_purchases(&c, Range::all(), None).unwrap();
        assert_eq!(list.iter().find(|p| p.id == second).unwrap().status, "paid");
        assert_eq!(suppliers::list_suppliers(&c, false).unwrap()[0].balance_milli, 0);

        delete_purchase(&mut c, first).unwrap();
        let i = ingredient(&c, "تمر");
        assert_eq!((i.stock_qty, i.avg_cost_milli), (15.0, 7000.0));
    }

    #[test]
    fn purchase_validation() {
        let mut c = conn();
        let flour = id_of(&c, "ingredients", "دقيق");
        let input = NewPurchase {
            supplier_id: None,
            invoice_no: None,
            purchased_at: 0,
            note: None,
            items: vec![],
            paid_now_milli: 0,
            method: "cash".into(),
            paid_from_drawer: false,
        };
        assert_eq!(err(create_purchase(&mut c, input.clone())), "أضف مكوّناً واحداً على الأقل");
        let mut drawer = input.clone();
        drawer.items = vec![PurchaseItemInput { ingredient_id: flour, qty: 1.0, unit_cost_milli: 1000 }];
        drawer.paid_now_milli = 1000;
        drawer.paid_from_drawer = true;
        assert_eq!(err(create_purchase(&mut c, drawer)), "لا توجد وردية مفتوحة");
    }
}
