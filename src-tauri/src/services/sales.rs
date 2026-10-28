use rusqlite::{Connection, OptionalExtension, params};

use crate::db::now_ms;
use crate::error::{AppError, AppResult, invalid, not_found};
use crate::models::*;
use crate::services::{catalog, date_bounds, open_shift_id, opt_text, shift_is_closed};

pub fn create_sale(conn: &mut Connection, input: SaleInput) -> AppResult<Sale> {
    if input.items.is_empty() {
        return invalid("السلة فارغة");
    }
    let mut merged: Vec<(i64, i64)> = Vec::new();
    for line in &input.items {
        if line.qty <= 0 {
            return invalid("قيمة غير صالحة");
        }
        match merged.iter_mut().find(|(id, _)| *id == line.product_id) {
            Some(entry) => entry.1 += line.qty,
            None => merged.push((line.product_id, line.qty)),
        }
    }
    let tx = conn.transaction()?;
    let Some(shift_id) = open_shift_id(&tx)? else {
        return invalid("افتح وردية قبل البيع");
    };
    struct Line {
        product_id: i64,
        name: String,
        qty: i64,
        price: i64,
        cost: i64,
        overhead: i64,
    }
    let mut lines = Vec::with_capacity(merged.len());
    for (product_id, qty) in merged {
        let row: Option<(String, i64, bool)> = tx
            .query_row("SELECT name, price_milli, archived FROM products WHERE id = ?1", [product_id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?))
            })
            .optional()?;
        let Some((name, price, false)) = row.filter(|(_, price, _)| *price > 0) else {
            return invalid("منتج غير متاح للبيع");
        };
        let (cost, overhead) = catalog::sale_costs(&tx, product_id)?;
        lines.push(Line { product_id, name, qty, price, cost, overhead });
    }
    let total: i64 = lines.iter().map(|l| l.qty * l.price).sum();
    let cost: i64 = lines.iter().map(|l| l.qty * l.cost).sum();
    let now = now_ms();
    tx.execute(
        "INSERT INTO sales (shift_id, total_milli, cost_milli, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![shift_id, total, cost, now],
    )?;
    let sale_id = tx.last_insert_rowid();
    for l in &lines {
        tx.execute(
            "INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price_milli, unit_cost_milli,
               unit_overhead_milli, line_total_milli, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![sale_id, l.product_id, l.name, l.qty, l.price, l.cost, l.overhead, l.qty * l.price, now],
        )?;
        tx.execute("UPDATE products SET stock_qty = stock_qty - ?1 WHERE id = ?2", params![l.qty, l.product_id])?;
    }
    let sale = load_sale(&tx, sale_id)?;
    tx.commit()?;
    Ok(sale)
}

fn load_items(conn: &Connection, sale_id: i64) -> AppResult<Vec<SaleItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, product_id, product_name, qty, unit_price_milli, unit_cost_milli, unit_overhead_milli, line_total_milli
         FROM sale_items WHERE sale_id = ?1 ORDER BY id",
    )?;
    let rows = stmt.query_map([sale_id], |r| {
        Ok(SaleItem {
            id: r.get(0)?,
            product_id: r.get(1)?,
            product_name: r.get(2)?,
            qty: r.get(3)?,
            unit_price_milli: r.get(4)?,
            unit_cost_milli: r.get(5)?,
            unit_overhead_milli: r.get(6)?,
            line_total_milli: r.get(7)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

const SALE_COLS: &str = "id, shift_id, total_milli, cost_milli, created_at, voided_at";

fn sale_row(r: &rusqlite::Row) -> rusqlite::Result<Sale> {
    Ok(Sale {
        id: r.get(0)?,
        shift_id: r.get(1)?,
        total_milli: r.get(2)?,
        cost_milli: r.get(3)?,
        created_at: r.get(4)?,
        voided_at: r.get(5)?,
        items: vec![],
    })
}

fn load_sale(conn: &Connection, id: i64) -> AppResult<Sale> {
    let mut sale = conn
        .query_row(&format!("SELECT {SALE_COLS} FROM sales WHERE id = ?1"), [id], sale_row)
        .map_err(not_found)?;
    sale.items = load_items(conn, id)?;
    Ok(sale)
}

pub fn void_sale(conn: &mut Connection, id: i64) -> AppResult<()> {
    let tx = conn.transaction()?;
    let sale = load_sale(&tx, id)?;
    if sale.voided_at.is_some() {
        return invalid("الفاتورة ملغاة مسبقاً");
    }
    if shift_is_closed(&tx, Some(sale.shift_id))? {
        return invalid("لا يمكن إلغاء فاتورة من وردية مغلقة");
    }
    tx.execute("UPDATE sales SET voided_at = ?1 WHERE id = ?2", params![now_ms(), id])?;
    for item in &sale.items {
        tx.execute(
            "UPDATE products SET stock_qty = stock_qty + ?1 WHERE id = ?2",
            params![item.qty, item.product_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

pub fn list_sales(conn: &Connection, range: Range) -> AppResult<Vec<Sale>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {SALE_COLS} FROM sales WHERE created_at >= ?1 AND created_at < ?2 ORDER BY created_at DESC, id DESC"
    ))?;
    let mut sales: Vec<Sale> =
        stmt.query_map(params![range.from, range.to], sale_row)?.collect::<Result<_, _>>()?;
    for s in &mut sales {
        s.items = load_items(conn, s.id)?;
    }
    Ok(sales)
}

// ---------- manual daily sales ----------

fn validate_daily(conn: &Connection, input: &DailySaleInput) -> AppResult<()> {
    let amounts = [input.cash_milli, input.card_milli, input.online_milli, input.other_milli];
    if amounts.iter().any(|a| *a < 0) {
        return invalid("قيمة غير صالحة");
    }
    if amounts.iter().sum::<i64>() <= 0 {
        return invalid("أدخل مبلغاً واحداً على الأقل");
    }
    let valid: bool =
        conn.query_row("SELECT date(?1) IS NOT NULL AND date(?1) = ?1", [&input.sale_date], |r| r.get(0))?;
    if !valid {
        return invalid("تاريخ غير صالح");
    }
    let dup: Option<i64> = conn
        .query_row(
            "SELECT id FROM daily_sales WHERE sale_date = ?1 AND id IS NOT ?2",
            params![input.sale_date, input.id],
            |r| r.get(0),
        )
        .optional()?;
    if dup.is_some() {
        return invalid("يوجد إدخال لهذا اليوم");
    }
    Ok(())
}

pub fn create_daily_sale(conn: &Connection, input: DailySaleInput) -> AppResult<i64> {
    validate_daily(conn, &input)?;
    conn.execute(
        "INSERT INTO daily_sales (sale_date, cash_milli, card_milli, online_milli, other_milli, note, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            input.sale_date,
            input.cash_milli,
            input.card_milli,
            input.online_milli,
            input.other_milli,
            opt_text(input.note),
            now_ms()
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_daily_sale(conn: &Connection, input: DailySaleInput) -> AppResult<()> {
    let id = input.id.ok_or(AppError::NotFound)?;
    validate_daily(conn, &input)?;
    let n = conn.execute(
        "UPDATE daily_sales SET sale_date = ?1, cash_milli = ?2, card_milli = ?3, online_milli = ?4, other_milli = ?5,
           note = ?6 WHERE id = ?7",
        params![
            input.sale_date,
            input.cash_milli,
            input.card_milli,
            input.online_milli,
            input.other_milli,
            opt_text(input.note),
            id
        ],
    )?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn delete_daily_sale(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute("DELETE FROM daily_sales WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn list_daily_sales(conn: &Connection, range: Range) -> AppResult<Vec<DailySale>> {
    let (from, to) = date_bounds(conn, range)?;
    let mut stmt = conn.prepare(
        "SELECT id, sale_date, cash_milli, card_milli, online_milli, other_milli, note
         FROM daily_sales WHERE sale_date >= ?1 AND sale_date < ?2 ORDER BY sale_date DESC",
    )?;
    let rows = stmt.query_map(params![from, to], |r| {
        let (cash, card, online, other): (i64, i64, i64, i64) = (r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?);
        Ok(DailySale {
            id: r.get(0)?,
            sale_date: r.get(1)?,
            cash_milli: cash,
            card_milli: card,
            online_milli: online,
            other_milli: other,
            total_milli: cash + card + online + other,
            note: r.get(6)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::testutil::*;
    use crate::services::{expenses, shifts, staff};

    #[test]
    fn pos_shift_drawer() {
        let mut c = conn();
        let f = fixture(&mut c);
        produce(&mut c, f.product_id, 30, vec![f.ahmad, f.salem], "2025-03-02 08:00");
        let cart = || SaleInput { items: vec![CartLine { product_id: f.product_id, qty: 3 }] };

        assert_eq!(err(create_sale(&mut c, cart())), "افتح وردية قبل البيع");
        shifts::open_shift(&c, OpenShiftInput { opening_cash_milli: 100000 }).unwrap();
        let sale = create_sale(&mut c, cart()).unwrap();
        assert_eq!((sale.total_milli, sale.cost_milli), (6000, 2025));
        assert_eq!(sale.items[0].unit_overhead_milli, 100);
        assert_eq!(product(&c, "خبز عربي").stock_qty, 27);

        void_sale(&mut c, sale.id).unwrap();
        assert_eq!(product(&c, "خبز عربي").stock_qty, 30);
        assert_eq!(err(void_sale(&mut c, sale.id)), "الفاتورة ملغاة مسبقاً");
        let sale = create_sale(&mut c, cart()).unwrap();

        let elec = id_of(&c, "expense_categories", "كهرباء");
        let expense = |method: &str| NewExpense {
            category_id: elec,
            description: None,
            amount_milli: 10000,
            method: method.into(),
            spent_at: 1,
            paid_from_drawer: true,
            note: None,
        };
        let exp_id = expenses::create_expense(&c, expense("cash")).unwrap();
        staff::create_payroll_payment(
            &c,
            PayrollInput {
                staff_id: id_of(&c, "staff", "كاشير"),
                paid_at: 1,
                period: None,
                base_milli: 3000,
                bonus_milli: 0,
                deductions_milli: 0,
                method: "cash".into(),
                paid_from_drawer: true,
                note: None,
            },
        )
        .unwrap();
        assert_eq!(err(expenses::create_expense(&c, expense("card"))), "الدفع من الدرج متاح للنقد فقط");

        let closed = shifts::close_shift(&mut c, CloseShiftInput { counted_cash_milli: 80000, note: None }).unwrap();
        assert_eq!(closed.expected_cash_milli, 93000);
        assert_eq!(closed.shift.counted_cash_milli, Some(80000));
        assert_eq!(err(expenses::delete_expense(&c, exp_id)), "لا يمكن تعديل أو حذف دفعة من وردية مغلقة");
        assert_eq!(err(void_sale(&mut c, sale.id)), "لا يمكن إلغاء فاتورة من وردية مغلقة");
        assert_eq!(err(expenses::create_expense(&c, expense("cash"))), "لا توجد وردية مفتوحة");
        assert_eq!(list_sales(&c, Range::all()).unwrap().len(), 2);
    }

    #[test]
    fn unsellable_and_daily_sales() {
        let mut c = conn();
        shifts::open_shift(&c, OpenShiftInput { opening_cash_milli: 0 }).unwrap();
        let unpriced = id_of(&c, "products", "صمون");
        assert_eq!(
            err(create_sale(&mut c, SaleInput { items: vec![CartLine { product_id: unpriced, qty: 1 }] })),
            "منتج غير متاح للبيع"
        );
        assert_eq!(err(create_sale(&mut c, SaleInput { items: vec![] })), "السلة فارغة");

        let day = |date: &str, card| DailySaleInput {
            id: None,
            sale_date: date.into(),
            cash_milli: 0,
            card_milli: card,
            online_milli: 0,
            other_milli: 0,
            note: None,
        };
        assert_eq!(err(create_daily_sale(&c, day("2025-03-05", 0))), "أدخل مبلغاً واحداً على الأقل");
        let id = create_daily_sale(&c, day("2025-03-05", 4000)).unwrap();
        assert_eq!(err(create_daily_sale(&c, day("2025-03-05", 1000))), "يوجد إدخال لهذا اليوم");
        update_daily_sale(&c, DailySaleInput { id: Some(id), ..day("2025-03-05", 5000) }).unwrap();
        assert_eq!(list_daily_sales(&c, Range::all()).unwrap()[0].total_milli, 5000);
        delete_daily_sale(&c, id).unwrap();
    }
}
