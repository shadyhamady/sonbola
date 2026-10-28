use rusqlite::{Connection, params};

use crate::db::now_ms;
use crate::error::{AppError, AppResult, invalid, not_found};
use crate::models::{Range, StockAdjustment, StockAdjustmentInput};
use crate::services::{catalog, opt_text, round};

const REASONS: &[&str] = &["waste", "count", "returned", "outside_use", "other"];

pub fn create_stock_adjustment(conn: &mut Connection, input: StockAdjustmentInput) -> AppResult<i64> {
    if input.qty_delta == 0.0 || !input.qty_delta.is_finite() {
        return invalid("قيمة غير صالحة");
    }
    if !REASONS.contains(&input.reason.as_str()) {
        return invalid("سبب غير صالح");
    }
    let tx = conn.transaction()?;
    let unit_cost = match input.item_type.as_str() {
        "ingredient" => tx
            .query_row("SELECT avg_cost_milli FROM ingredients WHERE id = ?1", [input.item_id], |r| {
                r.get::<_, f64>(0)
            })
            .map_err(not_found)?,
        "product" => {
            if input.qty_delta.fract() != 0.0 {
                return invalid("الكمية يجب أن تكون عدداً صحيحاً");
            }
            catalog::unit_costs(&tx, input.item_id)?.direct as f64
        }
        _ => return invalid("نوع غير صالح"),
    };
    let value = round(input.qty_delta * unit_cost);
    if input.item_type == "ingredient" {
        tx.execute(
            "UPDATE ingredients SET stock_qty = stock_qty + ?1 WHERE id = ?2",
            params![input.qty_delta, input.item_id],
        )?;
    } else {
        tx.execute(
            "UPDATE products SET stock_qty = stock_qty + ?1 WHERE id = ?2",
            params![input.qty_delta as i64, input.item_id],
        )?;
    }
    tx.execute(
        "INSERT INTO stock_adjustments (item_type, item_id, qty_delta, value_milli, reason, adjusted_at, note, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            input.item_type,
            input.item_id,
            input.qty_delta,
            value,
            input.reason,
            input.adjusted_at,
            opt_text(input.note),
            now_ms()
        ],
    )?;
    let id = tx.last_insert_rowid();
    tx.commit()?;
    Ok(id)
}

pub fn list_stock_adjustments(conn: &Connection, range: Range) -> AppResult<Vec<StockAdjustment>> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.item_type, a.item_id,
                COALESCE(i.name, p.name, ''), COALESCE(i.unit, 'pcs'),
                a.qty_delta, a.value_milli, a.reason, a.adjusted_at, a.note
         FROM stock_adjustments a
         LEFT JOIN ingredients i ON a.item_type = 'ingredient' AND i.id = a.item_id
         LEFT JOIN products p ON a.item_type = 'product' AND p.id = a.item_id
         WHERE a.adjusted_at >= ?1 AND a.adjusted_at < ?2
         ORDER BY a.adjusted_at DESC, a.id DESC",
    )?;
    let rows = stmt.query_map(params![range.from, range.to], |r| {
        Ok(StockAdjustment {
            id: r.get(0)?,
            item_type: r.get(1)?,
            item_id: r.get(2)?,
            item_name: r.get(3)?,
            unit: r.get(4)?,
            qty_delta: r.get(5)?,
            value_milli: r.get(6)?,
            reason: r.get(7)?,
            adjusted_at: r.get(8)?,
            note: r.get(9)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn delete_stock_adjustment(conn: &mut Connection, id: i64) -> AppResult<()> {
    let tx = conn.transaction()?;
    let (item_type, item_id, delta): (String, i64, f64) = tx
        .query_row("SELECT item_type, item_id, qty_delta FROM stock_adjustments WHERE id = ?1", [id], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        })
        .map_err(not_found)?;
    let n = if item_type == "ingredient" {
        tx.execute("UPDATE ingredients SET stock_qty = stock_qty - ?1 WHERE id = ?2", params![delta, item_id])?
    } else {
        tx.execute("UPDATE products SET stock_qty = stock_qty - ?1 WHERE id = ?2", params![delta as i64, item_id])?
    };
    if n == 0 {
        return Err(AppError::NotFound);
    }
    tx.execute("DELETE FROM stock_adjustments WHERE id = ?1", [id])?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::testutil::*;

    #[test]
    fn adjustments_apply_and_reverse() {
        let mut c = conn();
        let f = fixture(&mut c);
        let flour = id_of(&c, "ingredients", "دقيق");
        let adj = |item_type: &str, item_id, qty_delta| StockAdjustmentInput {
            item_type: item_type.into(),
            item_id,
            qty_delta,
            reason: "waste".into(),
            adjusted_at: 1,
            note: None,
        };
        assert_eq!(
            err(create_stock_adjustment(&mut c, adj("product", f.product_id, -1.5))),
            "الكمية يجب أن تكون عدداً صحيحاً"
        );
        let id = create_stock_adjustment(&mut c, adj("ingredient", flour, -2.0)).unwrap();
        assert_eq!(ingredient(&c, "دقيق").stock_qty, 18.0);
        let list = list_stock_adjustments(&c, Range::all()).unwrap();
        assert_eq!((list[0].value_milli, list[0].item_name.as_str()), (-12000, "دقيق"));
        delete_stock_adjustment(&mut c, id).unwrap();
        assert_eq!(ingredient(&c, "دقيق").stock_qty, 20.0);
    }
}
