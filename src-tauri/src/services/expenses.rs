use rusqlite::{Connection, params};

use crate::db::now_ms;
use crate::error::{AppError, AppResult, invalid, map_unique, not_found};
use crate::models::*;
use crate::services::{METHODS, drawer_link, ensure_shift_editable, opt_text};

pub fn list_expense_categories(conn: &Connection) -> AppResult<Vec<Category>> {
    let mut stmt = conn.prepare("SELECT id, name, sort_order FROM expense_categories ORDER BY sort_order, name")?;
    let rows = stmt.query_map([], |r| Ok(Category { id: r.get(0)?, name: r.get(1)?, sort_order: r.get(2)? }))?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn create_expense_category(conn: &Connection, input: NewCategory) -> AppResult<i64> {
    if input.name.trim().is_empty() {
        return invalid("أدخل اسم الفئة");
    }
    conn.execute(
        "INSERT INTO expense_categories (name, sort_order, created_at)
         VALUES (?1, (SELECT COALESCE(MAX(sort_order),0)+1 FROM expense_categories), ?2)",
        params![input.name.trim(), now_ms()],
    )
    .map_err(map_unique)?;
    Ok(conn.last_insert_rowid())
}

pub fn rename_expense_category(conn: &Connection, input: RenameCategory) -> AppResult<()> {
    if input.name.trim().is_empty() {
        return invalid("أدخل اسم الفئة");
    }
    let n = conn
        .execute("UPDATE expense_categories SET name = ?1 WHERE id = ?2", params![input.name.trim(), input.id])
        .map_err(map_unique)?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn delete_expense_category(conn: &Connection, id: i64) -> AppResult<()> {
    let used: i64 = conn.query_row("SELECT COUNT(*) FROM expenses WHERE category_id = ?1", [id], |r| r.get(0))?;
    if used > 0 {
        return invalid("لا يمكن حذف فئة مستخدمة");
    }
    conn.execute("DELETE FROM expense_categories WHERE id = ?1", [id])?;
    Ok(())
}

pub fn list_expenses(conn: &Connection, range: Range, category_id: Option<i64>) -> AppResult<Vec<Expense>> {
    let mut stmt = conn.prepare(
        "SELECT e.id, e.category_id, c.name, e.description, e.amount_milli, e.method, e.spent_at, e.paid_from_drawer,
                e.shift_id, (s.closed_at IS NOT NULL), e.note
         FROM expenses e
         JOIN expense_categories c ON c.id = e.category_id
         LEFT JOIN shifts s ON s.id = e.shift_id
         WHERE e.spent_at >= ?1 AND e.spent_at < ?2 AND (?3 IS NULL OR e.category_id = ?3)
         ORDER BY e.spent_at DESC, e.id DESC",
    )?;
    let rows = stmt.query_map(params![range.from, range.to, category_id], |r| {
        Ok(Expense {
            id: r.get(0)?,
            category_id: r.get(1)?,
            category_name: r.get(2)?,
            description: r.get(3)?,
            amount_milli: r.get(4)?,
            method: r.get(5)?,
            spent_at: r.get(6)?,
            paid_from_drawer: r.get(7)?,
            shift_id: r.get(8)?,
            locked: r.get::<_, Option<bool>>(9)?.unwrap_or(false),
            note: r.get(10)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn create_expense(conn: &Connection, input: NewExpense) -> AppResult<i64> {
    if input.amount_milli <= 0 {
        return invalid("المبلغ يجب أن يكون أكبر من صفر");
    }
    let shift_id = drawer_link(conn, &input.method, input.paid_from_drawer)?;
    conn.execute(
        "INSERT INTO expenses (category_id, description, amount_milli, method, spent_at, paid_from_drawer, shift_id, note, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            input.category_id,
            opt_text(input.description),
            input.amount_milli,
            input.method,
            input.spent_at,
            shift_id.is_some(),
            shift_id,
            opt_text(input.note),
            now_ms()
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_expense(conn: &Connection, input: UpdateExpense) -> AppResult<()> {
    if input.amount_milli <= 0 {
        return invalid("المبلغ يجب أن يكون أكبر من صفر");
    }
    if !METHODS.contains(&input.method.as_str()) {
        return invalid("طريقة دفع غير صالحة");
    }
    let (shift_id, from_drawer): (Option<i64>, bool) = conn
        .query_row("SELECT shift_id, paid_from_drawer FROM expenses WHERE id = ?1", [input.id], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .map_err(not_found)?;
    ensure_shift_editable(conn, shift_id)?;
    if from_drawer && input.method != "cash" {
        return invalid("الدفع من الدرج متاح للنقد فقط");
    }
    conn.execute(
        "UPDATE expenses SET category_id = ?1, description = ?2, amount_milli = ?3, method = ?4, spent_at = ?5, note = ?6
         WHERE id = ?7",
        params![
            input.category_id,
            opt_text(input.description),
            input.amount_milli,
            input.method,
            input.spent_at,
            opt_text(input.note),
            input.id
        ],
    )?;
    Ok(())
}

pub fn delete_expense(conn: &Connection, id: i64) -> AppResult<()> {
    let shift_id: Option<i64> =
        conn.query_row("SELECT shift_id FROM expenses WHERE id = ?1", [id], |r| r.get(0)).map_err(not_found)?;
    ensure_shift_editable(conn, shift_id)?;
    conn.execute("DELETE FROM expenses WHERE id = ?1", [id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::testutil::*;

    #[test]
    fn category_guard_and_update() {
        let c = conn();
        let elec = id_of(&c, "expense_categories", "كهرباء");
        let id = create_expense(
            &c,
            NewExpense {
                category_id: elec,
                description: None,
                amount_milli: 5000,
                method: "card".into(),
                spent_at: 1,
                paid_from_drawer: false,
                note: None,
            },
        )
        .unwrap();
        assert_eq!(err(delete_expense_category(&c, elec)), "لا يمكن حذف فئة مستخدمة");
        update_expense(
            &c,
            UpdateExpense {
                id,
                category_id: elec,
                description: Some("فاتورة".into()),
                amount_milli: 6000,
                method: "cash".into(),
                spent_at: 2,
                note: None,
            },
        )
        .unwrap();
        let list = list_expenses(&c, Range::all(), Some(elec)).unwrap();
        assert_eq!((list[0].amount_milli, list[0].method.as_str()), (6000, "cash"));
        delete_expense(&c, id).unwrap();
        delete_expense_category(&c, elec).unwrap();
    }
}
