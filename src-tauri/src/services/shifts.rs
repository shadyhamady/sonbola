use rusqlite::{Connection, OptionalExtension, Row, params};

use crate::db::now_ms;
use crate::error::{AppResult, invalid, not_found};
use crate::models::*;
use crate::services::{open_shift_id, opt_text};

const SHIFT_COLS: &str =
    "id, opened_at, opening_cash_milli, closed_at, counted_cash_milli, expected_cash_milli, note";

fn shift_row(r: &Row) -> rusqlite::Result<Shift> {
    Ok(Shift {
        id: r.get(0)?,
        opened_at: r.get(1)?,
        opening_cash_milli: r.get(2)?,
        closed_at: r.get(3)?,
        counted_cash_milli: r.get(4)?,
        expected_cash_milli: r.get(5)?,
        note: r.get(6)?,
    })
}

pub fn get_open_shift(conn: &Connection) -> AppResult<Option<Shift>> {
    Ok(conn
        .query_row(
            &format!("SELECT {SHIFT_COLS} FROM shifts WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1"),
            [],
            shift_row,
        )
        .optional()?)
}

pub fn open_shift(conn: &Connection, input: OpenShiftInput) -> AppResult<Shift> {
    if input.opening_cash_milli < 0 {
        return invalid("قيمة غير صالحة");
    }
    if open_shift_id(conn)?.is_some() {
        return invalid("توجد وردية مفتوحة بالفعل");
    }
    let now = now_ms();
    conn.execute(
        "INSERT INTO shifts (opened_at, opening_cash_milli, created_at) VALUES (?1, ?2, ?1)",
        params![now, input.opening_cash_milli],
    )?;
    let id = conn.last_insert_rowid();
    Ok(conn.query_row(&format!("SELECT {SHIFT_COLS} FROM shifts WHERE id = ?1"), [id], shift_row)?)
}

pub fn shift_summary(conn: &Connection, id: i64) -> AppResult<ShiftSummary> {
    let shift = conn
        .query_row(&format!("SELECT {SHIFT_COLS} FROM shifts WHERE id = ?1"), [id], shift_row)
        .map_err(not_found)?;
    let (sale_count, sales_total_milli): (i64, i64) = conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(total_milli),0) FROM sales WHERE shift_id = ?1 AND voided_at IS NULL",
        [id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    let drawer_payments_milli: i64 = conn.query_row(
        "SELECT
           (SELECT COALESCE(SUM(amount_milli),0) FROM expenses WHERE shift_id = ?1 AND paid_from_drawer = 1)
         + (SELECT COALESCE(SUM(amount_milli),0) FROM purchase_payments WHERE shift_id = ?1 AND paid_from_drawer = 1)
         + (SELECT COALESCE(SUM(net_milli),0) FROM payroll_payments WHERE shift_id = ?1 AND paid_from_drawer = 1)",
        [id],
        |r| r.get(0),
    )?;
    Ok(ShiftSummary {
        expected_cash_milli: shift.opening_cash_milli + sales_total_milli - drawer_payments_milli,
        shift,
        sale_count,
        sales_total_milli,
        drawer_payments_milli,
    })
}

pub fn close_shift(conn: &mut Connection, input: CloseShiftInput) -> AppResult<ShiftSummary> {
    if input.counted_cash_milli < 0 {
        return invalid("قيمة غير صالحة");
    }
    let tx = conn.transaction()?;
    let Some(id) = open_shift_id(&tx)? else {
        return invalid("لا توجد وردية مفتوحة");
    };
    let summary = shift_summary(&tx, id)?;
    tx.execute(
        "UPDATE shifts SET closed_at = ?1, counted_cash_milli = ?2, expected_cash_milli = ?3, note = ?4 WHERE id = ?5",
        params![now_ms(), input.counted_cash_milli, summary.expected_cash_milli, opt_text(input.note), id],
    )?;
    let closed = shift_summary(&tx, id)?;
    tx.commit()?;
    Ok(closed)
}

pub fn list_shifts(conn: &Connection, range: Range) -> AppResult<Vec<ShiftSummary>> {
    let ids: Vec<i64> = {
        let mut stmt =
            conn.prepare("SELECT id FROM shifts WHERE opened_at >= ?1 AND opened_at < ?2 ORDER BY opened_at DESC")?;
        stmt.query_map(params![range.from, range.to], |r| r.get(0))?.collect::<Result<_, _>>()?
    };
    ids.into_iter().map(|id| shift_summary(conn, id)).collect()
}
