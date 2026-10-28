use rusqlite::{Connection, params};

use crate::db::now_ms;
use crate::error::{AppError, AppResult, invalid, map_unique};
use crate::models::{Supplier, SupplierInput};
use crate::services::opt_text;

/// Per-purchase paid amount, reused by supplier and purchase queries.
pub const PURCHASE_BALANCES: &str = "SELECT p.id, p.supplier_id, p.total_milli,
       COALESCE((SELECT SUM(amount_milli) FROM purchase_payments pp WHERE pp.purchase_id = p.id), 0) AS paid
     FROM purchases p";

pub fn list_suppliers(conn: &Connection, include_archived: bool) -> AppResult<Vec<Supplier>> {
    let sql = format!(
        "WITH b AS ({PURCHASE_BALANCES})
         SELECT s.id, s.name, s.contact_person, s.phone, s.supplies, s.archived,
                COALESCE(SUM(b.total_milli), 0), COALESCE(SUM(b.paid), 0),
                COALESCE(SUM(CASE WHEN b.total_milli - b.paid > 0 THEN 1 ELSE 0 END), 0)
         FROM suppliers s LEFT JOIN b ON b.supplier_id = s.id
         WHERE (?1 OR s.archived = 0)
         GROUP BY s.id ORDER BY s.name"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([include_archived], |r| {
        let total: i64 = r.get(6)?;
        let paid: i64 = r.get(7)?;
        Ok(Supplier {
            id: r.get(0)?,
            name: r.get(1)?,
            contact_person: r.get(2)?,
            phone: r.get(3)?,
            supplies: r.get(4)?,
            archived: r.get(5)?,
            total_purchased_milli: total,
            total_paid_milli: paid,
            balance_milli: total - paid,
            unpaid_invoices: r.get(8)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn create_supplier(conn: &Connection, input: SupplierInput) -> AppResult<i64> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return invalid("أدخل اسم المورد");
    }
    conn.execute(
        "INSERT INTO suppliers (name, contact_person, phone, supplies, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![name, opt_text(input.contact_person), opt_text(input.phone), opt_text(input.supplies), now_ms()],
    )
    .map_err(map_unique)?;
    Ok(conn.last_insert_rowid())
}

pub fn update_supplier(conn: &Connection, input: SupplierInput) -> AppResult<()> {
    let id = input.id.ok_or(AppError::NotFound)?;
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return invalid("أدخل اسم المورد");
    }
    let n = conn
        .execute(
            "UPDATE suppliers SET name = ?1, contact_person = ?2, phone = ?3, supplies = ?4 WHERE id = ?5",
            params![name, opt_text(input.contact_person), opt_text(input.phone), opt_text(input.supplies), id],
        )
        .map_err(map_unique)?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn set_supplier_archived(conn: &Connection, id: i64, archived: bool) -> AppResult<()> {
    let n = conn.execute("UPDATE suppliers SET archived = ?1 WHERE id = ?2", params![archived, id])?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
