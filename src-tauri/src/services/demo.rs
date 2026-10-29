//! Demo data for onboarding: a week of believable history for a small bakery.
//!
//! Built through the real services, so costs, stock, shifts and reports are consistent. Only the
//! timestamps of past shifts and sales are rewritten afterwards (the services always stamp "now").

use rusqlite::{Connection, params};

use crate::error::{AppResult, invalid};
use crate::models::*;
use crate::services::{backup, catalog, diesel, expenses, production, purchases, sales, settings, shifts, staff, suppliers};

/// Settings key marking that demo data is present.
const FLAG: &str = "demo_data";
/// History spans today and this many days before it.
const DAYS: i64 = 6;

struct Item {
    name: &'static str,
    price: i64,
    batch_yield: i64,
    recipe: &'static [(&'static str, f64)],
    pay_mode: &'static str,
    pay_rate: i64,
    overhead: i64,
    /// Typical units sold per day; always below one batch so stock never goes negative.
    daily: i64,
}

const ITEMS: &[Item] = &[
    Item { name: "صمون", price: 2000, batch_yield: 40, recipe: &[("دقيق", 5.0), ("خميرة", 0.1), ("ملح", 0.1)], pay_mode: "per_unit", pay_rate: 50, overhead: 2000, daily: 32 },
    Item { name: "كرواسون", price: 4000, batch_yield: 24, recipe: &[("دقيق", 2.0), ("زبدة", 1.0), ("سكر", 0.2), ("حليب", 0.5), ("خميرة", 0.05)], pay_mode: "per_unit", pay_rate: 150, overhead: 3000, daily: 18 },
    Item { name: "كوكيز", price: 3000, batch_yield: 30, recipe: &[("دقيق", 1.5), ("سكر", 0.8), ("زبدة", 0.7), ("بيض", 6.0)], pay_mode: "per_batch", pay_rate: 4000, overhead: 2500, daily: 22 },
    Item { name: "كعك", price: 1500, batch_yield: 40, recipe: &[("دقيق", 3.0), ("سمن", 0.3), ("سمسم", 0.2)], pay_mode: "per_unit", pay_rate: 50, overhead: 2000, daily: 30 },
    Item { name: "برازق", price: 2500, batch_yield: 30, recipe: &[("دقيق", 1.5), ("سمسم", 0.4), ("سكر", 0.3), ("زيت نباتي", 0.2)], pay_mode: "per_unit", pay_rate: 100, overhead: 2000, daily: 20 },
];

fn id_of(conn: &Connection, table: &str, name: &str) -> AppResult<i64> {
    Ok(conn.query_row(&format!("SELECT id FROM {table} WHERE name = ?1"), [name], |r| r.get(0))?)
}

/// Unix ms of `HH:MM` local time, `days_ago` days back.
fn at(conn: &Connection, days_ago: i64, hm: &str) -> AppResult<i64> {
    Ok(conn.query_row(
        "SELECT CAST(strftime('%s', date('now','localtime', ?1) || ' ' || ?2, 'utc') AS INTEGER) * 1000",
        params![format!("-{days_ago} days"), hm],
        |r| r.get(0),
    )?)
}

fn date_of(conn: &Connection, days_ago: i64) -> AppResult<String> {
    Ok(conn.query_row("SELECT date('now','localtime', ?1)", [format!("-{days_ago} days")], |r| r.get(0))?)
}

/// Adds the demo data. Needs a configured, still-empty database; on any failure everything is
/// rolled back to the empty starter state.
pub fn load_demo_data(conn: &mut Connection) -> AppResult<()> {
    if !settings::get_settings(conn)?.is_configured {
        return invalid("أكمل إعداد المخبز أولاً");
    }
    let used: i64 = conn.query_row(
        "SELECT (SELECT COUNT(*) FROM purchases) + (SELECT COUNT(*) FROM productions)
              + (SELECT COUNT(*) FROM sales) + (SELECT COUNT(*) FROM expenses)",
        [],
        |r| r.get(0),
    )?;
    if used > 0 {
        return invalid("البيانات التجريبية تُضاف على قاعدة بيانات فارغة فقط");
    }
    if let Err(e) = build(conn) {
        backup::reset_data(conn)?;
        return Err(e);
    }
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, '1')", [FLAG])?;
    Ok(())
}

/// Removes the demo data (and anything added since) by resetting to the empty starter state.
pub fn clear_demo_data(conn: &mut Connection) -> AppResult<()> {
    if !settings::get_settings(conn)?.is_demo {
        return invalid("لا توجد بيانات تجريبية لمسحها");
    }
    backup::reset_data(conn)
}

fn build(conn: &mut Connection) -> AppResult<()> {
    // Reorder levels first, so the dashboard shopping list has something to say.
    for (name, reorder) in [("دقيق", 40.0), ("زبدة", 4.0), ("سكر", 8.0), ("خميرة", 0.5)] {
        let id = id_of(conn, "ingredients", name)?;
        catalog::update_ingredient(
            conn,
            UpdateIngredient { id, name: name.into(), default_cost_milli: 0, opening_qty: 0.0, reorder_qty: reorder },
        )?;
    }

    // Suppliers and purchases (all before the first production so average costs exist).
    let supplier = |conn: &Connection, name: &str, person: &str, phone: &str, supplies: &str| {
        suppliers::create_supplier(
            conn,
            SupplierInput {
                id: None,
                name: name.into(),
                contact_person: Some(person.into()),
                phone: Some(phone.into()),
                supplies: Some(supplies.into()),
            },
        )
    };
    let flour_co = supplier(conn, "مطاحن الشمال", "أبو خالد", "0500000001", "دقيق، سميد")?;
    let dairy_co = supplier(conn, "مزرعة الوادي", "سامي", "0500000002", "زبدة، حليب، بيض")?;
    let wholesale = supplier(conn, "سوق الجملة", "أبو يوسف", "0500000003", "سكر، خميرة، زيوت")?;

    let buy = |conn: &mut Connection,
               supplier_id: Option<i64>,
               invoice: &str,
               lines: &[(&str, f64, i64)],
               paid_percent: i64|
     -> AppResult<()> {
        let mut items = Vec::new();
        let mut total = 0;
        for (name, qty, unit_cost) in lines {
            items.push(PurchaseItemInput { ingredient_id: id_of(conn, "ingredients", name)?, qty: *qty, unit_cost_milli: *unit_cost });
            total += (qty * *unit_cost as f64).round() as i64;
        }
        let purchased_at = at(conn, DAYS, "05:30")?;
        purchases::create_purchase(
            conn,
            NewPurchase {
                supplier_id,
                invoice_no: Some(invoice.into()),
                purchased_at,
                note: None,
                items,
                paid_now_milli: total * paid_percent / 100,
                method: "cash".into(),
                paid_from_drawer: false,
            },
        )?;
        Ok(())
    };
    buy(conn, Some(flour_co), "1001", &[("دقيق", 100.0, 4500)], 100)?;
    buy(conn, Some(dairy_co), "2001", &[("زبدة", 15.0, 28000), ("حليب", 20.0, 4000), ("بيض", 120.0, 500)], 50)?;
    buy(
        conn,
        Some(wholesale),
        "3001",
        &[("سكر", 25.0, 3000), ("خميرة", 2.0, 12000), ("ملح", 5.0, 1000), ("سمن", 5.0, 22000), ("سمسم", 6.0, 15000), ("زيت نباتي", 10.0, 6000)],
        100,
    )?;
    buy(conn, None, "", &[("ديزل", 150.0, 2000)], 100)?;

    // Products with recipes and baker pay.
    for it in ITEMS {
        let id = id_of(conn, "products", it.name)?;
        let category_id: i64 = conn.query_row("SELECT category_id FROM products WHERE id = ?1", [id], |r| r.get(0))?;
        let mut recipe = Vec::new();
        for (ing, qty) in it.recipe {
            recipe.push(RecipeInput { ingredient_id: id_of(conn, "ingredients", ing)?, qty: *qty });
        }
        catalog::save_product(
            conn,
            ProductInput {
                id: Some(id),
                name: it.name.into(),
                category_id,
                price_milli: it.price,
                batch_yield: it.batch_yield,
                low_stock_qty: 10,
                pay_mode: it.pay_mode.into(),
                pay_rate_milli: it.pay_rate,
                pay_basis_ingredient_id: None,
                overhead_per_batch_milli: it.overhead,
                recipe,
            },
        )?;
    }

    let ahmed = staff::create_staff(
        conn,
        StaffInput {
            id: None,
            name: "أحمد".into(),
            role: Some("خباز".into()),
            pay_type: "production".into(),
            rate_milli: 0,
            phone: None,
            start_date: None,
        },
    )?;
    let product_ids: Vec<i64> = ITEMS.iter().map(|it| id_of(conn, "products", it.name)).collect::<Result<_, _>>()?;

    // Day by day, oldest first: produce, then run the day's shift.
    for d in (0..=DAYS).rev() {
        let bakers = if d % 2 == 1 { vec![ahmed] } else { vec![] };
        for (it, pid) in ITEMS.iter().zip(&product_ids) {
            production::record_production(
                conn,
                RecordProductionInput {
                    product_id: *pid,
                    units: it.batch_yield,
                    staff_ids: bakers.clone(),
                    produced_at: at(conn, d, "06:30")?,
                    note: None,
                },
            )?;
        }
        run_shift(conn, d, &product_ids)?;
    }

    // Operating expenses, wages and the diesel log.
    let category = |conn: &Connection, name: &str| id_of(conn, "expense_categories", name);
    for (name, days_ago, amount) in [("كهرباء", 4, 120_000), ("تغليف", 2, 60_000)] {
        expenses::create_expense(
            conn,
            NewExpense {
                category_id: category(conn, name)?,
                description: None,
                amount_milli: amount,
                method: "cash".into(),
                spent_at: at(conn, days_ago, "11:00")?,
                paid_from_drawer: false,
                note: None,
            },
        )?;
    }
    staff::create_payroll_payment(
        conn,
        PayrollInput {
            staff_id: id_of(conn, "staff", "كاشير")?,
            paid_at: at(conn, 1, "18:00")?,
            period: Some("هذا الأسبوع".into()),
            base_milli: 150_000,
            bonus_milli: 0,
            deductions_milli: 0,
            method: "cash".into(),
            paid_from_drawer: false,
            note: None,
        },
    )?;
    for (days_ago, reading) in [(6, 150.0), (5, 138.0), (4, 127.0), (3, 115.0), (2, 104.0), (1, 93.0)] {
        diesel::create_diesel_log(
            conn,
            DieselLogInput {
                log_date: date_of(conn, days_ago)?,
                tank_reading_l: Some(reading),
                manual_liters: None,
                oven_hours: Some(8.0),
                note: None,
            },
        )?;
    }
    Ok(())
}

/// One day's cash shift. Past days are closed; today's stays open with a couple of sales so the
/// POS is ready to use.
fn run_shift(conn: &mut Connection, days_ago: i64, product_ids: &[i64]) -> AppResult<()> {
    let today = days_ago == 0;
    let shift = shifts::open_shift(conn, OpenShiftInput { opening_cash_milli: 100_000 })?;
    // Three receipts per product share the day's volume 40 / 35 / 25; today only the first two.
    let receipts: &[i64] = if today { &[40, 35] } else { &[40, 35, 25] };
    let base = at(conn, days_ago, "09:00")?;
    let mut remaining: Vec<i64> = ITEMS
        .iter()
        .enumerate()
        .map(|(pi, it)| it.daily + (days_ago * 3 + pi as i64 * 2) % 5)
        .collect();
    let totals = remaining.clone();
    for (k, share) in receipts.iter().enumerate() {
        let last = k == receipts.len() - 1 && !today;
        let mut items = Vec::new();
        for (pi, pid) in product_ids.iter().enumerate() {
            let qty = if last { remaining[pi] } else { totals[pi] * share / 100 };
            remaining[pi] -= qty;
            if qty > 0 {
                items.push(CartLine { product_id: *pid, qty });
            }
        }
        let sale = sales::create_sale(conn, SaleInput { items })?;
        if !today {
            conn.execute(
                "UPDATE sales SET created_at = ?1 WHERE id = ?2",
                params![base + (k as i64 + 1) * 3_600_000 * 3, sale.id],
            )?;
        }
    }
    if today {
        return Ok(());
    }
    // One day ends 5 short in the drawer, so the shifts page shows a difference.
    let expected = shifts::shift_summary(conn, shift.id)?.expected_cash_milli;
    let short = days_ago == 3;
    shifts::close_shift(
        conn,
        CloseShiftInput {
            counted_cash_milli: if short { expected - 5000 } else { expected },
            note: short.then(|| "فرق بسيط في الدرج".to_string()),
        },
    )?;
    conn.execute(
        "UPDATE shifts SET opened_at = ?1, closed_at = ?2, created_at = ?1 WHERE id = ?3",
        params![base, at(conn, days_ago, "20:00")?, shift.id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Range;
    use crate::services::testutil::*;
    use crate::services::reports;

    fn count(c: &Connection, table: &str) -> i64 {
        c.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0)).unwrap()
    }

    fn loaded() -> Connection {
        let mut c = conn();
        let input = base_settings(&c);
        settings::save_settings(&mut c, input).unwrap();
        load_demo_data(&mut c).unwrap();
        c
    }

    #[test]
    fn demo_history_is_consistent_and_usable() {
        let c = loaded();
        assert!(settings::get_settings(&c).unwrap().is_demo);

        // Nothing negative: the demo must not look broken.
        for p in catalog::list_products(&c, false).unwrap() {
            assert!(p.stock_qty >= 0, "{} stock {}", p.name, p.stock_qty);
        }
        for i in catalog::list_ingredients(&c, false).unwrap() {
            assert!(i.stock_qty >= -1e-9, "{} stock {}", i.name, i.stock_qty);
        }

        // Seven days of closed + open shifts; today's shift is open and the POS can sell.
        assert_eq!(count(&c, "shifts"), 7);
        let open = shifts::get_open_shift(&c).unwrap().expect("today's shift is open");
        let line = CartLine { product_id: crate::services::testutil::id_of(&c, "products", "صمون"), qty: 1 };
        let mut c = c;
        let sale = sales::create_sale(&mut c, SaleInput { items: vec![line] }).unwrap();
        assert_eq!(sale.shift_id, open.id);

        // Closed shifts are dated on their own days, not all "now".
        let distinct_days: i64 = c
            .query_row("SELECT COUNT(DISTINCT date(opened_at/1000,'unixepoch','localtime')) FROM shifts", [], |r| r.get(0))
            .unwrap();
        assert_eq!(distinct_days, 7);

        let r = reports::period_report(&c, Range::all()).unwrap();
        assert!(r.sales_milli > 1_500_000 && r.units_produced > 1000);
        assert!(r.wages_milli == 150_000 && r.operating_expenses_milli == 180_000);
        let snap = reports::dashboard_snapshot(&c).unwrap();
        assert!(snap.shopping_list.iter().any(|s| s.name == "دقيق"), "flour is below its reorder level");
        assert!(snap.owed_to_suppliers_milli > 0);
        assert!(snap.diesel_in_tank_l > 0.0);
    }

    #[test]
    fn clear_returns_to_empty_and_load_needs_empty_db() {
        let mut c = loaded();
        assert!(err(load_demo_data(&mut c)).contains("فارغة"));

        clear_demo_data(&mut c).unwrap();
        let s = settings::get_settings(&c).unwrap();
        assert!(!s.is_demo && s.is_configured);
        for t in ["purchases", "productions", "sales", "shifts", "expenses", "suppliers", "diesel_logs"] {
            assert_eq!(count(&c, t), 0, "{t}");
        }
        assert_eq!(count(&c, "ingredients"), 16);
        assert!(err(clear_demo_data(&mut c)).contains("لا توجد"));
        // And the demo can be loaded again after clearing.
        load_demo_data(&mut c).unwrap();
    }

    #[test]
    fn real_data_blocks_demo() {
        let mut c = conn();
        let input = base_settings(&c);
        settings::save_settings(&mut c, input).unwrap();
        purchase(&mut c, "دقيق", 10.0, 5000, "2025-03-01 10:00");
        assert!(err(load_demo_data(&mut c)).contains("فارغة"));
        assert_eq!(count(&c, "purchases"), 1);
    }
}
