use rusqlite::{Connection, OptionalExtension, params};

use crate::db::now_ms;
use crate::error::{AppError, AppResult, invalid, not_found};
use crate::models::{DieselLog, DieselLogInput, Range};
use crate::services::{date_bounds, local_date_sql, opt_text, round, settings};

fn diesel_id(conn: &Connection) -> AppResult<i64> {
    match settings::get_id(conn, "diesel_ingredient_id")? {
        Some(id) => Ok(id),
        None => invalid("حدد مادة الديزل في الإعدادات"),
    }
}

fn latest(conn: &Connection) -> AppResult<Option<(i64, String, Option<f64>)>> {
    Ok(conn
        .query_row(
            "SELECT id, log_date, tank_reading_l FROM diesel_logs ORDER BY log_date DESC LIMIT 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?)
}

pub fn create_diesel_log(conn: &mut Connection, input: DieselLogInput) -> AppResult<i64> {
    let tx = conn.transaction()?;
    let diesel = diesel_id(&tx)?;
    let valid_date: bool =
        tx.query_row("SELECT date(?1) IS NOT NULL AND date(?1) = ?1", [&input.log_date], |r| r.get(0))?;
    if !valid_date {
        return invalid("تاريخ غير صالح");
    }
    let negative = |v: Option<f64>| v.is_some_and(|x| !(x >= 0.0));
    if negative(input.tank_reading_l) || negative(input.manual_liters) || negative(input.oven_hours) {
        return invalid("قيمة غير صالحة");
    }
    let prev = latest(&tx)?;
    if let Some((_, prev_date, _)) = &prev {
        if input.log_date.as_str() <= prev_date.as_str() {
            return invalid("يجب أن يكون التاريخ بعد آخر قراءة");
        }
    }

    let liters = match (input.manual_liters, input.tank_reading_l, &prev) {
        (Some(manual), _, _) => manual,
        (None, Some(reading), Some((_, prev_date, Some(prev_reading)))) => {
            let bought: f64 = tx.query_row(
                &format!(
                    "SELECT COALESCE(SUM(pi.qty), 0) FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id
                     WHERE pi.ingredient_id = ?1 AND {d} > ?2 AND {d} <= ?3",
                    d = local_date_sql("p.purchased_at")
                ),
                params![diesel, prev_date, input.log_date],
                |r| r.get(0),
            )?;
            prev_reading + bought - reading
        }
        (None, Some(_), _) => 0.0,
        (None, None, _) => return invalid("أدخل قراءة الخزان أو اللترات المستهلكة"),
    };
    if liters < 0.0 {
        return invalid("الاستهلاك المحسوب سالب، تحقق من القراءة أو من مشتريات الديزل");
    }
    let avg: f64 = tx
        .query_row("SELECT avg_cost_milli FROM ingredients WHERE id = ?1", [diesel], |r| r.get(0))
        .map_err(not_found)?;
    let cost = round(liters * avg);
    tx.execute("UPDATE ingredients SET stock_qty = stock_qty - ?1 WHERE id = ?2", params![liters, diesel])?;
    tx.execute(
        "INSERT INTO diesel_logs (log_date, tank_reading_l, manual_liters, liters_used, cost_milli, oven_hours, note, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            input.log_date,
            input.tank_reading_l,
            input.manual_liters,
            liters,
            cost,
            input.oven_hours,
            opt_text(input.note),
            now_ms()
        ],
    )?;
    let id = tx.last_insert_rowid();
    tx.commit()?;
    Ok(id)
}

pub fn list_diesel_logs(conn: &Connection, range: Range) -> AppResult<Vec<DieselLog>> {
    let (from, to) = date_bounds(conn, range)?;
    let latest_id = latest(conn)?.map(|l| l.0);
    let mut stmt = conn.prepare(
        "SELECT id, log_date, tank_reading_l, manual_liters, liters_used, cost_milli, oven_hours, note
         FROM diesel_logs WHERE log_date >= ?1 AND log_date < ?2 ORDER BY log_date DESC",
    )?;
    let rows = stmt.query_map(params![from, to], |r| {
        let id: i64 = r.get(0)?;
        let liters: f64 = r.get(4)?;
        let hours: Option<f64> = r.get(6)?;
        Ok(DieselLog {
            id,
            log_date: r.get(1)?,
            tank_reading_l: r.get(2)?,
            manual_liters: r.get(3)?,
            liters_used: liters,
            cost_milli: r.get(5)?,
            oven_hours: hours,
            liters_per_hour: hours.filter(|h| *h > 0.0).map(|h| liters / h),
            is_latest: Some(id) == latest_id,
            note: r.get(7)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn delete_diesel_log(conn: &mut Connection, id: i64) -> AppResult<()> {
    let tx = conn.transaction()?;
    let liters: f64 =
        tx.query_row("SELECT liters_used FROM diesel_logs WHERE id = ?1", [id], |r| r.get(0)).map_err(not_found)?;
    if latest(&tx)?.map(|l| l.0) != Some(id) {
        return invalid("يمكن حذف آخر قراءة فقط");
    }
    let diesel = diesel_id(&tx)?;
    let n = tx.execute("UPDATE ingredients SET stock_qty = stock_qty + ?1 WHERE id = ?2", params![liters, diesel])?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    tx.execute("DELETE FROM diesel_logs WHERE id = ?1", [id])?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::testutil::*;

    fn log(date: &str, reading: Option<f64>, manual: Option<f64>) -> DieselLogInput {
        DieselLogInput {
            log_date: date.into(),
            tank_reading_l: reading,
            manual_liters: manual,
            oven_hours: Some(10.0),
            note: None,
        }
    }

    fn by_date(c: &Connection, date: &str) -> DieselLog {
        list_diesel_logs(c, Range::all()).unwrap().into_iter().find(|l| l.log_date == date).unwrap()
    }

    #[test]
    fn diesel_log() {
        let mut c = conn();
        let s = base_settings(&c);
        settings::save_settings(&mut c, s).unwrap();
        purchase(&mut c, "ديزل", 500.0, 2000, "2025-03-01 12:00");
        create_diesel_log(&mut c, log("2025-03-01", Some(500.0), None)).unwrap();
        assert_eq!(by_date(&c, "2025-03-01").liters_used, 0.0);

        create_diesel_log(&mut c, log("2025-03-02", Some(440.0), None)).unwrap();
        let l = by_date(&c, "2025-03-02");
        assert_eq!((l.liters_used, l.cost_milli, l.liters_per_hour), (60.0, 120000, Some(6.0)));
        assert_eq!(ingredient(&c, "ديزل").stock_qty, 440.0);

        purchase(&mut c, "ديزل", 200.0, 2000, "2025-03-03 09:00");
        let third = create_diesel_log(&mut c, log("2025-03-03", Some(560.0), None)).unwrap();
        let l = by_date(&c, "2025-03-03");
        assert_eq!((l.liters_used, l.cost_milli), (80.0, 160000));
        assert_eq!(ingredient(&c, "ديزل").stock_qty, 560.0);

        assert_eq!(
            err(create_diesel_log(&mut c, log("2025-03-02", Some(500.0), None))),
            "يجب أن يكون التاريخ بعد آخر قراءة"
        );
        assert_eq!(
            err(create_diesel_log(&mut c, log("2025-03-04", Some(600.0), None))),
            "الاستهلاك المحسوب سالب، تحقق من القراءة أو من مشتريات الديزل"
        );
        let fourth = create_diesel_log(&mut c, log("2025-03-04", None, Some(50.0))).unwrap();
        assert_eq!(ingredient(&c, "ديزل").stock_qty, 510.0);
        assert!(by_date(&c, "2025-03-04").is_latest);

        assert_eq!(err(delete_diesel_log(&mut c, third)), "يمكن حذف آخر قراءة فقط");
        delete_diesel_log(&mut c, fourth).unwrap();
        assert_eq!(ingredient(&c, "ديزل").stock_qty, 560.0);
    }

    #[test]
    fn diesel_requires_setting_and_input() {
        let mut c = conn();
        assert_eq!(
            err(create_diesel_log(&mut c, log("2025-03-01", None, None))),
            "أدخل قراءة الخزان أو اللترات المستهلكة"
        );
        let mut s = base_settings(&c);
        s.diesel_ingredient_id = None;
        settings::save_settings(&mut c, s).unwrap();
        assert_eq!(err(create_diesel_log(&mut c, log("2025-03-01", Some(1.0), None))), "حدد مادة الديزل في الإعدادات");
    }
}
