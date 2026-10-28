use rusqlite::{Connection, OptionalExtension, params};

use crate::db::now_ms;
use crate::error::{AppResult, invalid};
use crate::models::*;
use crate::services::catalog::{cost_lines, pay_config, pay_kg_per_batch};
use crate::services::{opt_text, round, settings, weighted_avg};

/// Read-only production calculation shared by preview and record.
pub fn compute_production(conn: &Connection, input: &ProductionInput) -> AppResult<ProductionPreview> {
    let p = pay_config(conn, input.product_id)?;
    if input.units <= 0 {
        return invalid("قيمة غير صالحة");
    }
    let units = input.units as f64;
    let batches = units / p.batch_yield as f64;

    let mut ingredients = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT ri.ingredient_id, i.name, i.unit, ri.qty, i.stock_qty, i.avg_cost_milli
             FROM recipe_items ri JOIN ingredients i ON i.id = ri.ingredient_id
             WHERE ri.product_id = ?1 ORDER BY i.name",
        )?;
        let rows = stmt.query_map([input.product_id], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, f64>(3)?,
                r.get::<_, f64>(4)?,
                r.get::<_, f64>(5)?,
            ))
        })?;
        for row in rows {
            let (ingredient_id, name, unit, qty, stock_qty, avg) = row?;
            let required_qty = qty * batches;
            ingredients.push(PreviewIngredient {
                ingredient_id,
                name,
                unit,
                required_qty,
                stock_qty,
                cost_milli: round(required_qty * avg),
            });
        }
    }

    let mut staff_ids: Vec<i64> = Vec::new();
    for id in &input.staff_ids {
        if !staff_ids.contains(id) {
            staff_ids.push(*id);
        }
    }
    let mut used_default_baker = false;
    if staff_ids.is_empty() {
        if let Some(default) = settings::get_id(conn, "default_baker_id")? {
            staff_ids.push(default);
            used_default_baker = true;
        }
    }

    let total_basis = match p.pay_mode.as_str() {
        "per_unit" => units,
        "per_batch" => batches,
        "per_kg" => pay_kg_per_batch(p.pay_basis_ingredient_id, &cost_lines(conn, input.product_id)?) * batches,
        _ => 0.0,
    };
    let paid = p.pay_mode != "none";
    let n = staff_ids.len() as f64;
    let mut workers = Vec::with_capacity(staff_ids.len());
    for staff_id in staff_ids {
        let name: Option<String> = conn
            .query_row(
                "SELECT name FROM staff WHERE id = ?1 AND archived = 0 AND pay_type = 'production'",
                [staff_id],
                |r| r.get(0),
            )
            .optional()?;
        let Some(name) = name else {
            return invalid("الموظف ليس من خبازي الإنتاج");
        };
        if !paid {
            workers.push(PreviewWorker { staff_id, name, basis_qty: 0.0, rate_milli: 0, amount_milli: 0 });
            continue;
        }
        let rate: i64 = conn
            .query_row(
                "SELECT rate_milli FROM staff_product_rates WHERE staff_id = ?1 AND product_id = ?2",
                params![staff_id, input.product_id],
                |r| r.get(0),
            )
            .optional()?
            .unwrap_or(p.pay_rate_milli);
        let basis_qty = total_basis / n;
        workers.push(PreviewWorker { staff_id, name, basis_qty, rate_milli: rate, amount_milli: round(basis_qty * rate as f64) });
    }

    let ingredient_cost_milli: i64 = ingredients.iter().map(|i| i.cost_milli).sum();
    let labor_cost_milli: i64 = workers.iter().map(|w| w.amount_milli).sum();
    let overhead_milli = round(batches * p.overhead_per_batch_milli as f64);
    let total_cost_milli = ingredient_cost_milli + labor_cost_milli + overhead_milli;
    Ok(ProductionPreview {
        pay_mode: p.pay_mode,
        batches,
        ingredients,
        workers,
        ingredient_cost_milli,
        labor_cost_milli,
        overhead_milli,
        total_cost_milli,
        unit_cost_milli: round(total_cost_milli as f64 / units),
        used_default_baker,
    })
}

pub fn preview_production(conn: &Connection, input: ProductionInput) -> AppResult<ProductionPreview> {
    compute_production(conn, &input)
}

pub fn record_production(conn: &mut Connection, input: RecordProductionInput) -> AppResult<i64> {
    let tx = conn.transaction()?;
    let preview = compute_production(
        &tx,
        &ProductionInput { product_id: input.product_id, units: input.units, staff_ids: input.staff_ids.clone() },
    )?;
    if preview.pay_mode != "none" && preview.workers.is_empty() {
        return invalid("اختر خبازاً واحداً على الأقل");
    }
    let cost = preview.ingredient_cost_milli + preview.labor_cost_milli;
    tx.execute(
        "INSERT INTO productions (product_id, units, batches, ingredient_cost_milli, labor_cost_milli, overhead_milli,
           cost_milli, produced_at, note, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            input.product_id,
            input.units,
            preview.batches,
            preview.ingredient_cost_milli,
            preview.labor_cost_milli,
            preview.overhead_milli,
            cost,
            input.produced_at,
            opt_text(input.note),
            now_ms()
        ],
    )?;
    let production_id = tx.last_insert_rowid();
    for i in &preview.ingredients {
        tx.execute(
            "UPDATE ingredients SET stock_qty = stock_qty - ?1 WHERE id = ?2",
            params![i.required_qty, i.ingredient_id],
        )?;
        tx.execute(
            "INSERT INTO production_items (production_id, ingredient_id, qty, cost_milli) VALUES (?1, ?2, ?3, ?4)",
            params![production_id, i.ingredient_id, i.required_qty, i.cost_milli],
        )?;
    }
    for w in &preview.workers {
        tx.execute(
            "INSERT INTO production_workers (production_id, staff_id, basis_qty, rate_milli, amount_milli)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![production_id, w.staff_id, w.basis_qty, w.rate_milli, w.amount_milli],
        )?;
    }
    let (stock, avg): (i64, f64) = tx.query_row(
        "SELECT stock_qty, avg_cost_milli FROM products WHERE id = ?1",
        [input.product_id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    let new_avg = weighted_avg(stock as f64, avg, input.units as f64, cost as f64);
    tx.execute(
        "UPDATE products SET avg_cost_milli = ?1, stock_qty = stock_qty + ?2 WHERE id = ?3",
        params![new_avg, input.units, input.product_id],
    )?;
    tx.commit()?;
    Ok(production_id)
}

pub fn list_productions(conn: &Connection, range: Range) -> AppResult<Vec<ProductionRow>> {
    let mut stmt = conn.prepare(
        "SELECT pr.id, pr.produced_at, p.name, pr.units, pr.ingredient_cost_milli, pr.labor_cost_milli,
                pr.overhead_milli, pr.note
         FROM productions pr JOIN products p ON p.id = pr.product_id
         WHERE pr.produced_at >= ?1 AND pr.produced_at < ?2
         ORDER BY pr.produced_at DESC, pr.id DESC",
    )?;
    let rows = stmt.query_map(params![range.from, range.to], |r| {
        Ok(ProductionRow {
            id: r.get(0)?,
            produced_at: r.get(1)?,
            product_name: r.get(2)?,
            units: r.get(3)?,
            ingredient_cost_milli: r.get(4)?,
            labor_cost_milli: r.get(5)?,
            overhead_milli: r.get(6)?,
            note: r.get(7)?,
            worker_names: vec![],
        })
    })?;
    let mut out: Vec<ProductionRow> = rows.collect::<Result<_, _>>()?;
    let mut names = conn.prepare(
        "SELECT s.name FROM production_workers w JOIN staff s ON s.id = w.staff_id WHERE w.production_id = ?1 ORDER BY s.name",
    )?;
    for row in &mut out {
        row.worker_names = names.query_map([row.id], |r| r.get(0))?.collect::<Result<_, _>>()?;
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::testutil::*;

    #[test]
    fn production_split_override_default() {
        let mut c = conn();
        let f = fixture(&mut c);
        let preview = preview_production(
            &c,
            ProductionInput { product_id: f.product_id, units: 30, staff_ids: vec![f.ahmad, f.salem, f.ahmad] },
        )
        .unwrap();
        assert_eq!(preview.batches, 1.5);
        assert_eq!(preview.ingredient_cost_milli, 18000);
        let w: Vec<(f64, i64)> = preview.workers.iter().map(|w| (w.basis_qty, w.amount_milli)).collect();
        assert_eq!(w, vec![(1.5, 750), (1.5, 1500)]);
        assert_eq!(preview.labor_cost_milli, 2250);
        assert_eq!(preview.overhead_milli, 3000);
        assert!(!preview.used_default_baker);

        produce(&mut c, f.product_id, 30, vec![f.ahmad, f.salem], "2025-03-02 08:00");
        assert_eq!(ingredient(&c, "دقيق").stock_qty, 17.0);
        let p = product(&c, "خبز عربي");
        assert_eq!((p.stock_qty, p.avg_cost_milli), (30, 675.0));
        assert_eq!(p.produced_units, 30);

        let cashier = id_of(&c, "staff", "كاشير");
        let bad = record_production(
            &mut c,
            RecordProductionInput { product_id: f.product_id, units: 10, staff_ids: vec![cashier], produced_at: 0, note: None },
        );
        assert_eq!(err(bad), "الموظف ليس من خبازي الإنتاج");

        let preview =
            preview_production(&c, ProductionInput { product_id: f.product_id, units: 20, staff_ids: vec![] }).unwrap();
        assert!(preview.used_default_baker);
        assert_eq!(preview.workers.len(), 1);
        assert_eq!(preview.workers[0].name, "رئيس الخبازين");
        assert_eq!((preview.workers[0].basis_qty, preview.workers[0].amount_milli), (2.0, 1000));

        let mut s = base_settings(&c);
        s.default_baker_id = None;
        settings::save_settings(&mut c, s).unwrap();
        let none = record_production(
            &mut c,
            RecordProductionInput { product_id: f.product_id, units: 20, staff_ids: vec![], produced_at: 0, note: None },
        );
        assert_eq!(err(none), "اختر خبازاً واحداً على الأقل");

        let rows = list_productions(&c, Range::all()).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].worker_names, vec!["أحمد".to_string(), "سالم".to_string()]);
    }
}
