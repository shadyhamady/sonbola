pub mod backup;
pub mod catalog;
pub mod demo;
pub mod diesel;
pub mod expenses;
pub mod inventory;
pub mod pin;
pub mod production;
pub mod purchases;
pub mod reports;
pub mod sales;
pub mod settings;
pub mod shifts;
pub mod staff;
pub mod suppliers;

use rusqlite::{Connection, OptionalExtension, params};

use crate::error::{AppResult, invalid};
use crate::models::Range;

pub const METHODS: &[&str] = &["cash", "card", "bank_transfer", "other"];
/// Units of measure for ingredients and products.
pub const UNITS: &[&str] = &["kg", "g", "l", "ml", "pcs", "pack", "tray"];

/// Weighted average of existing stock and newly added stock. Negative stock counts as zero.
pub fn weighted_avg(old_qty: f64, old_avg: f64, add_qty: f64, add_cost: f64) -> f64 {
    let old = old_qty.max(0.0);
    if old == 0.0 {
        return add_cost / add_qty;
    }
    (old * old_avg + add_cost) / (old + add_qty)
}

/// Weight in kg (litres count as kg); count units have no weight.
pub fn weight_kg(unit: &str, qty: f64) -> Option<f64> {
    match unit {
        "kg" | "l" => Some(qty),
        "g" | "ml" => Some(qty / 1000.0),
        _ => None,
    }
}

/// Count units (pieces, packs, trays) hold whole quantities; weight and volume units are fractional.
pub fn is_count_unit(unit: &str) -> bool {
    weight_kg(unit, 1.0).is_none()
}

/// A finite quantity that is whole when `unit` is a count unit.
pub fn fits_unit(unit: &str, qty: f64) -> bool {
    qty.is_finite() && (!is_count_unit(unit) || qty.fract() == 0.0)
}

/// Rounds to the unit's precision: whole for count units, grams/millilitres (3 decimals) otherwise.
pub fn round_qty(unit: &str, qty: f64) -> f64 {
    if is_count_unit(unit) { qty.round() } else { (qty * 1000.0).round() / 1000.0 }
}

/// SQL expression converting a unix-ms column/parameter to a local `YYYY-MM-DD` date.
pub fn local_date_sql(expr: &str) -> String {
    format!("date({expr}/1000,'unixepoch','localtime')")
}

/// Local `YYYY-MM-DD` bounds `[from, to)` of a ms range, for comparing against TEXT date columns.
/// Clamped so open-ended ranges (e.g. `to = i64::MAX`) stay within SQLite's date range.
pub fn date_bounds(conn: &Connection, range: Range) -> AppResult<(String, String)> {
    const MAX_MS: i64 = 253_402_214_400_000; // 9999-12-31T00:00:00Z
    Ok(conn.query_row(
        "SELECT date(?1/1000,'unixepoch','localtime'), date(?2/1000,'unixepoch','localtime')",
        params![range.from.clamp(0, MAX_MS), range.to.clamp(0, MAX_MS)],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?)
}

pub fn open_shift_id(conn: &Connection) -> AppResult<Option<i64>> {
    Ok(conn
        .query_row("SELECT id FROM shifts WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1", [], |r| r.get(0))
        .optional()?)
}

/// Validates the payment method and drawer flag; returns the open shift id when paid from the drawer.
pub fn drawer_link(conn: &Connection, method: &str, paid_from_drawer: bool) -> AppResult<Option<i64>> {
    if !METHODS.contains(&method) {
        return invalid("طريقة دفع غير صالحة");
    }
    if !paid_from_drawer {
        return Ok(None);
    }
    if method != "cash" {
        return invalid("الدفع من الدرج متاح للنقد فقط");
    }
    match open_shift_id(conn)? {
        Some(id) => Ok(Some(id)),
        None => invalid("لا توجد وردية مفتوحة"),
    }
}

pub fn shift_is_closed(conn: &Connection, shift_id: Option<i64>) -> AppResult<bool> {
    let Some(id) = shift_id else { return Ok(false) };
    let closed: Option<Option<i64>> =
        conn.query_row("SELECT closed_at FROM shifts WHERE id = ?1", [id], |r| r.get(0)).optional()?;
    Ok(matches!(closed, Some(Some(_))))
}

/// Rows tied to a closed shift are immutable.
pub fn ensure_shift_editable(conn: &Connection, shift_id: Option<i64>) -> AppResult<()> {
    if shift_is_closed(conn, shift_id)? {
        return invalid("لا يمكن تعديل أو حذف دفعة من وردية مغلقة");
    }
    Ok(())
}

/// Workbook rule: Σ purchase line totals / Σ purchased qty, else the default cost.
pub fn recompute_ingredient_avg(conn: &Connection, ingredient_id: i64) -> AppResult<()> {
    let (cost, qty): (i64, f64) = conn.query_row(
        "SELECT COALESCE(SUM(total_cost_milli),0), COALESCE(SUM(qty),0) FROM purchase_items WHERE ingredient_id = ?1",
        [ingredient_id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    if qty > 0.0 {
        conn.execute(
            "UPDATE ingredients SET avg_cost_milli = ?1 WHERE id = ?2",
            params![cost as f64 / qty, ingredient_id],
        )?;
    } else {
        conn.execute(
            "UPDATE ingredients SET avg_cost_milli = default_cost_milli WHERE id = ?1",
            [ingredient_id],
        )?;
    }
    Ok(())
}

pub fn opt_text(s: Option<String>) -> Option<String> {
    s.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

pub fn round(v: f64) -> i64 {
    v.round() as i64
}

#[cfg(test)]
pub mod testutil {
    use rusqlite::Connection;

    use crate::db;
    use crate::models::*;
    use crate::services::*;

    pub fn conn() -> Connection {
        db::open_in_memory().unwrap()
    }

    pub fn local_ms(conn: &Connection, s: &str) -> i64 {
        conn.query_row("SELECT CAST(strftime('%s', ?1, 'utc') AS INTEGER)*1000", [s], |r| r.get(0))
            .unwrap()
    }

    pub fn id_of(conn: &Connection, table: &str, name: &str) -> i64 {
        conn.query_row(&format!("SELECT id FROM {table} WHERE name = ?1"), [name], |r| r.get(0))
            .unwrap()
    }

    pub fn ingredient(conn: &Connection, name: &str) -> Ingredient {
        catalog::list_ingredients(conn, true).unwrap().into_iter().find(|i| i.name == name).unwrap()
    }

    pub fn product(conn: &Connection, name: &str) -> Product {
        catalog::list_products(conn, true).unwrap().into_iter().find(|p| p.name == name).unwrap()
    }

    pub fn staff_named(conn: &Connection, name: &str) -> Staff {
        staff::list_staff(conn, true).unwrap().into_iter().find(|s| s.name == name).unwrap()
    }

    pub fn err<T: std::fmt::Debug>(r: crate::error::AppResult<T>) -> String {
        r.unwrap_err().to_string()
    }

    pub fn base_settings(conn: &Connection) -> SettingsInput {
        SettingsInput {
            bakery_name: "سنبلة".into(),
            currency_symbol: "ر.س".into(),
            currency_decimals: 2,
            diesel_ingredient_id: Some(id_of(conn, "ingredients", "ديزل")),
            tank_capacity_l: 1000.0,
            default_baker_id: Some(id_of(conn, "staff", "رئيس الخبازين")),
        }
    }

    pub fn purchase(conn: &mut Connection, ingredient: &str, qty: f64, unit_cost: i64, at: &str) -> i64 {
        let ing = id_of(conn, "ingredients", ingredient);
        let at = local_ms(conn, at);
        let total = (qty * unit_cost as f64).round() as i64;
        purchases::create_purchase(
            conn,
            NewPurchase {
                supplier_id: None,
                invoice_no: None,
                purchased_at: at,
                note: None,
                items: vec![PurchaseItemInput { ingredient_id: ing, qty, unit_cost_milli: unit_cost }],
                paid_now_milli: total,
                method: "cash".into(),
                paid_from_drawer: false,
            },
        )
        .unwrap()
    }

    pub fn new_staff(conn: &Connection, name: &str, pay_type: &str) -> i64 {
        staff::create_staff(
            conn,
            StaffInput {
                id: None,
                name: name.into(),
                role: None,
                pay_type: pay_type.into(),
                rate_milli: 0,
                phone: None,
                start_date: None,
            },
        )
        .unwrap()
    }

    pub struct Fixture {
        pub product_id: i64,
        pub ahmad: i64,
        pub salem: i64,
    }

    /// Shared fixture from the plan's Verification section.
    pub fn fixture(conn: &mut Connection) -> Fixture {
        settings::save_settings(conn, base_settings(conn)).unwrap();
        purchase(conn, "دقيق", 20.0, 6000, "2025-03-01 12:00");
        let flour = id_of(conn, "ingredients", "دقيق");
        let product_id = catalog::save_product(
            conn,
            ProductInput {
                id: None,
                name: "خبز عربي".into(),
                category_id: id_of(conn, "product_categories", "خبز"),
                price_milli: 2000,
                unit: "pcs".into(),
                batch_yield: 20.0,
                low_stock_qty: 0.0,
                pay_mode: "per_kg".into(),
                pay_rate_milli: 500,
                pay_basis_ingredient_id: None,
                overhead_per_batch_milli: 2000,
                recipe: vec![RecipeInput { ingredient_id: flour, qty: 2.0 }],
            },
        )
        .unwrap();
        let ahmad = new_staff(conn, "أحمد", "production");
        let salem = new_staff(conn, "سالم", "production");
        staff::set_staff_rate(conn, SetStaffRateInput { staff_id: salem, product_id, rate_milli: Some(1000) })
            .unwrap();
        Fixture { product_id, ahmad, salem }
    }

    pub fn produce(conn: &mut Connection, product_id: i64, units: f64, staff_ids: Vec<i64>, at: &str) -> i64 {
        let at = local_ms(conn, at);
        production::record_production(
            conn,
            RecordProductionInput { product_id, units, staff_ids, produced_at: at, note: None, ..Default::default() },
        )
        .unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weighted_avg_rules() {
        assert_eq!(weighted_avg(0.0, 0.0, 30.0, 20250.0), 675.0);
        assert_eq!(weighted_avg(-5.0, 999.0, 10.0, 1000.0), 100.0);
        assert_eq!(weighted_avg(10.0, 100.0, 10.0, 3000.0), 200.0);
    }

    #[test]
    fn weights() {
        assert_eq!(weight_kg("g", 500.0), Some(0.5));
        assert_eq!(weight_kg("l", 2.0), Some(2.0));
        assert_eq!(weight_kg("pcs", 2.0), None);
    }
}
