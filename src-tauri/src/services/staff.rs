use rusqlite::{Connection, OptionalExtension, params};

use crate::db::now_ms;
use crate::error::{AppError, AppResult, invalid, map_unique, not_found};
use crate::models::*;
use crate::services::{drawer_link, ensure_shift_editable, opt_text};

const PAY_TYPES: &[&str] = &["monthly", "weekly", "daily", "hourly", "production"];

pub fn list_staff(conn: &Connection, include_archived: bool) -> AppResult<Vec<Staff>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.name, s.role, s.pay_type, s.rate_milli, s.phone, s.start_date, s.archived,
                (SELECT COALESCE(SUM(net_milli),0) FROM payroll_payments pp WHERE pp.staff_id = s.id),
                (SELECT COALESCE(SUM(amount_milli),0) FROM production_workers w WHERE w.staff_id = s.id)
         FROM staff s WHERE (?1 OR s.archived = 0) ORDER BY s.name",
    )?;
    let rows = stmt.query_map([include_archived], |r| {
        let pay_type: String = r.get(3)?;
        let paid: i64 = r.get(8)?;
        let earned: i64 = r.get(9)?;
        Ok(Staff {
            id: r.get(0)?,
            name: r.get(1)?,
            role: r.get(2)?,
            owed_milli: (pay_type == "production").then_some(earned - paid),
            pay_type,
            rate_milli: r.get(4)?,
            phone: r.get(5)?,
            start_date: r.get(6)?,
            archived: r.get(7)?,
            paid_milli: paid,
            earned_milli: earned,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

fn validate(input: &StaffInput) -> AppResult<()> {
    if input.name.trim().is_empty() {
        return invalid("أدخل اسم الموظف");
    }
    if !PAY_TYPES.contains(&input.pay_type.as_str()) || input.rate_milli < 0 {
        return invalid("قيمة غير صالحة");
    }
    Ok(())
}

pub fn create_staff(conn: &Connection, input: StaffInput) -> AppResult<i64> {
    validate(&input)?;
    conn.execute(
        "INSERT INTO staff (name, role, pay_type, rate_milli, phone, start_date, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            input.name.trim(),
            opt_text(input.role),
            input.pay_type,
            input.rate_milli,
            opt_text(input.phone),
            opt_text(input.start_date),
            now_ms()
        ],
    )
    .map_err(map_unique)?;
    Ok(conn.last_insert_rowid())
}

pub fn update_staff(conn: &Connection, input: StaffInput) -> AppResult<()> {
    validate(&input)?;
    let id = input.id.ok_or(AppError::NotFound)?;
    let n = conn
        .execute(
            "UPDATE staff SET name = ?1, role = ?2, pay_type = ?3, rate_milli = ?4, phone = ?5, start_date = ?6 WHERE id = ?7",
            params![
                input.name.trim(),
                opt_text(input.role),
                input.pay_type,
                input.rate_milli,
                opt_text(input.phone),
                opt_text(input.start_date),
                id
            ],
        )
        .map_err(map_unique)?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn set_staff_archived(conn: &Connection, id: i64, archived: bool) -> AppResult<()> {
    let n = conn.execute("UPDATE staff SET archived = ?1 WHERE id = ?2", params![archived, id])?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn list_staff_rates(conn: &Connection, staff_id: i64) -> AppResult<Vec<StaffRate>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.pay_mode, p.unit, p.pay_rate_milli, r.rate_milli
         FROM products p LEFT JOIN staff_product_rates r ON r.product_id = p.id AND r.staff_id = ?1
         WHERE p.archived = 0 AND p.pay_mode <> 'none' ORDER BY p.name",
    )?;
    let rows = stmt.query_map([staff_id], |r| {
        Ok(StaffRate {
            product_id: r.get(0)?,
            product_name: r.get(1)?,
            pay_mode: r.get(2)?,
            product_unit: r.get(3)?,
            default_rate_milli: r.get(4)?,
            override_rate_milli: r.get(5)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn set_staff_rate(conn: &Connection, input: SetStaffRateInput) -> AppResult<()> {
    let pay_type: String = conn
        .query_row("SELECT pay_type FROM staff WHERE id = ?1", [input.staff_id], |r| r.get(0))
        .map_err(not_found)?;
    if pay_type != "production" {
        return invalid("الموظف ليس من خبازي الإنتاج");
    }
    match input.rate_milli {
        None => {
            conn.execute(
                "DELETE FROM staff_product_rates WHERE staff_id = ?1 AND product_id = ?2",
                params![input.staff_id, input.product_id],
            )?;
        }
        Some(rate) => {
            if rate <= 0 {
                return invalid("قيمة غير صالحة");
            }
            conn.execute(
                "INSERT INTO staff_product_rates (staff_id, product_id, rate_milli) VALUES (?1, ?2, ?3)
                 ON CONFLICT(staff_id, product_id) DO UPDATE SET rate_milli = excluded.rate_milli",
                params![input.staff_id, input.product_id, rate],
            )?;
        }
    }
    Ok(())
}

pub fn create_payroll_payment(conn: &Connection, input: PayrollInput) -> AppResult<i64> {
    if input.base_milli < 0 || input.bonus_milli < 0 || input.deductions_milli < 0 {
        return invalid("قيمة غير صالحة");
    }
    let net = input.base_milli + input.bonus_milli - input.deductions_milli;
    if net <= 0 {
        return invalid("صافي المبلغ يجب أن يكون أكبر من صفر");
    }
    conn.query_row("SELECT id FROM staff WHERE id = ?1", [input.staff_id], |r| r.get::<_, i64>(0))
        .map_err(not_found)?;
    let shift_id = drawer_link(conn, &input.method, input.paid_from_drawer)?;
    conn.execute(
        "INSERT INTO payroll_payments (staff_id, paid_at, period, base_milli, bonus_milli, deductions_milli, net_milli,
           method, paid_from_drawer, shift_id, note, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            input.staff_id,
            input.paid_at,
            opt_text(input.period),
            input.base_milli,
            input.bonus_milli,
            input.deductions_milli,
            net,
            input.method,
            shift_id.is_some(),
            shift_id,
            opt_text(input.note),
            now_ms()
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_payroll_payment(conn: &Connection, id: i64) -> AppResult<()> {
    let shift_id: Option<i64> = conn
        .query_row("SELECT shift_id FROM payroll_payments WHERE id = ?1", [id], |r| r.get(0))
        .optional()?
        .ok_or(AppError::NotFound)?;
    ensure_shift_editable(conn, shift_id)?;
    conn.execute("DELETE FROM payroll_payments WHERE id = ?1", [id])?;
    Ok(())
}

pub fn list_payroll_payments(conn: &Connection, filter: PayrollFilter) -> AppResult<Vec<PayrollPayment>> {
    let mut stmt = conn.prepare(
        "SELECT pp.id, pp.staff_id, st.name, pp.paid_at, pp.period, pp.base_milli, pp.bonus_milli, pp.deductions_milli,
                pp.net_milli, pp.method, pp.paid_from_drawer, pp.shift_id, (sh.closed_at IS NOT NULL), pp.note
         FROM payroll_payments pp
         JOIN staff st ON st.id = pp.staff_id
         LEFT JOIN shifts sh ON sh.id = pp.shift_id
         WHERE pp.paid_at >= ?1 AND pp.paid_at < ?2 AND (?3 IS NULL OR pp.staff_id = ?3)
         ORDER BY pp.paid_at DESC, pp.id DESC",
    )?;
    let rows = stmt.query_map(params![filter.range.from, filter.range.to, filter.staff_id], |r| {
        Ok(PayrollPayment {
            id: r.get(0)?,
            staff_id: r.get(1)?,
            staff_name: r.get(2)?,
            paid_at: r.get(3)?,
            period: r.get(4)?,
            base_milli: r.get(5)?,
            bonus_milli: r.get(6)?,
            deductions_milli: r.get(7)?,
            net_milli: r.get(8)?,
            method: r.get(9)?,
            paid_from_drawer: r.get(10)?,
            shift_id: r.get(11)?,
            locked: r.get::<_, Option<bool>>(12)?.unwrap_or(false),
            note: r.get(13)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn staff_statement(conn: &Connection, input: StatementInput) -> AppResult<StaffStatement> {
    let mut stmt = conn.prepare(
        "SELECT pr.id, pr.produced_at, p.name, p.pay_mode, p.unit, w.basis_qty, w.rate_milli, w.amount_milli
         FROM production_workers w
         JOIN productions pr ON pr.id = w.production_id
         JOIN products p ON p.id = pr.product_id
         WHERE w.staff_id = ?1 AND pr.produced_at >= ?2 AND pr.produced_at < ?3
         ORDER BY pr.produced_at DESC, pr.id DESC",
    )?;
    let earnings: Vec<Earning> = stmt
        .query_map(params![input.staff_id, input.range.from, input.range.to], |r| {
            Ok(Earning {
                production_id: r.get(0)?,
                produced_at: r.get(1)?,
                product_name: r.get(2)?,
                pay_mode: r.get(3)?,
                product_unit: r.get(4)?,
                basis_qty: r.get(5)?,
                rate_milli: r.get(6)?,
                amount_milli: r.get(7)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    let payments = list_payroll_payments(conn, PayrollFilter { staff_id: Some(input.staff_id), range: input.range })?;
    Ok(StaffStatement {
        earned_milli: earnings.iter().map(|e| e.amount_milli).sum(),
        paid_milli: payments.iter().map(|p| p.net_milli).sum(),
        earnings,
        payments,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::testutil::*;

    #[test]
    fn owed_and_statement() {
        let mut c = conn();
        let f = fixture(&mut c);
        produce(&mut c, f.product_id, 30.0, vec![f.ahmad, f.salem], "2025-03-02 08:00");
        let pay = PayrollInput {
            staff_id: f.ahmad,
            paid_at: 1,
            period: None,
            base_milli: 1000,
            bonus_milli: 0,
            deductions_milli: 1000,
            method: "cash".into(),
            paid_from_drawer: false,
            note: None,
        };
        assert_eq!(err(create_payroll_payment(&c, pay.clone())), "صافي المبلغ يجب أن يكون أكبر من صفر");
        create_payroll_payment(&c, PayrollInput { deductions_milli: 0, ..pay }).unwrap();
        assert_eq!(staff_named(&c, "أحمد").owed_milli, Some(-250));
        assert_eq!(staff_named(&c, "سالم").owed_milli, Some(1500));
        assert_eq!(staff_named(&c, "كاشير").owed_milli, None);

        let st = staff_statement(&c, StatementInput { staff_id: f.salem, range: Range::all() }).unwrap();
        assert_eq!((st.earned_milli, st.paid_milli, st.earnings[0].rate_milli), (1500, 0, 1000));

        let rates = list_staff_rates(&c, f.salem).unwrap();
        assert_eq!(rates[0].override_rate_milli, Some(1000));
        let cashier = id_of(&c, "staff", "كاشير");
        assert_eq!(
            err(set_staff_rate(&c, SetStaffRateInput { staff_id: cashier, product_id: f.product_id, rate_milli: Some(5) })),
            "الموظف ليس من خبازي الإنتاج"
        );
    }
}
