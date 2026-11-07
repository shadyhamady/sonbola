use std::collections::BTreeMap;

use rusqlite::{Connection, params};

use crate::error::AppResult;
use crate::models::*;
use crate::services::{catalog, date_bounds, local_date_sql, round, settings, staff};

fn scalar_i64(conn: &Connection, sql: &str, p: impl rusqlite::Params) -> AppResult<i64> {
    Ok(conn.query_row(sql, p, |r| r.get(0))?)
}

pub fn period_report(conn: &Connection, range: Range) -> AppResult<PeriodReport> {
    let (from, to) = (range.from, range.to);
    let (dfrom, dto) = date_bounds(conn, range)?;
    let diesel = settings::get_id(conn, "diesel_ingredient_id")?.unwrap_or(-1);

    let pos_sales_milli = scalar_i64(
        conn,
        "SELECT COALESCE(SUM(total_milli),0) FROM sales WHERE voided_at IS NULL AND created_at >= ?1 AND created_at < ?2",
        params![from, to],
    )?;
    let manual: SalesByMethod = conn.query_row(
        "SELECT COALESCE(SUM(cash_milli),0), COALESCE(SUM(card_milli),0), COALESCE(SUM(online_milli),0),
                COALESCE(SUM(other_milli),0)
         FROM daily_sales WHERE sale_date >= ?1 AND sale_date < ?2",
        params![dfrom, dto],
        |r| Ok(SalesByMethod { cash: r.get(0)?, card: r.get(1)?, online: r.get(2)?, other: r.get(3)? }),
    )?;
    let manual_sales_milli = manual.cash + manual.card + manual.online + manual.other;
    let sales_milli = pos_sales_milli + manual_sales_milli;
    let sales_by_method = SalesByMethod { cash: pos_sales_milli + manual.cash, ..manual };

    let operating_expenses_milli = scalar_i64(
        conn,
        "SELECT COALESCE(SUM(amount_milli),0) FROM expenses WHERE spent_at >= ?1 AND spent_at < ?2",
        params![from, to],
    )?;
    let (diesel_purchases_milli, ingredient_purchases_milli): (i64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN pi.ingredient_id = ?3 THEN pi.total_cost_milli ELSE 0 END),0),
                COALESCE(SUM(CASE WHEN pi.ingredient_id = ?3 THEN 0 ELSE pi.total_cost_milli END),0)
         FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id
         WHERE p.purchased_at >= ?1 AND p.purchased_at < ?2",
        params![from, to, diesel],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    let wages_milli = scalar_i64(
        conn,
        "SELECT COALESCE(SUM(net_milli),0) FROM payroll_payments WHERE paid_at >= ?1 AND paid_at < ?2",
        params![from, to],
    )?;
    let total_costs_milli = operating_expenses_milli + ingredient_purchases_milli + diesel_purchases_milli + wages_milli;
    let net_profit_milli = sales_milli - total_costs_milli;
    let profit_margin = if sales_milli != 0 { net_profit_milli as f64 / sales_milli as f64 } else { 0.0 };

    let sales_days = scalar_i64(
        conn,
        &format!(
            "SELECT COUNT(*) FROM (
               SELECT {d} AS day FROM sales WHERE voided_at IS NULL AND created_at >= ?1 AND created_at < ?2
               UNION SELECT sale_date FROM daily_sales WHERE sale_date >= ?3 AND sale_date < ?4)",
            d = local_date_sql("created_at")
        ),
        params![from, to, dfrom, dto],
    )?;
    let avg_daily_sales_milli = if sales_days > 0 { round(sales_milli as f64 / sales_days as f64) } else { 0 };

    let production_ingredient_cost_milli = scalar_i64(
        conn,
        "SELECT COALESCE(SUM(ingredient_cost_milli),0) FROM productions WHERE produced_at >= ?1 AND produced_at < ?2",
        params![from, to],
    )?;
    let units_produced: Vec<UnitQty> = {
        let mut stmt = conn.prepare(
            "SELECT p.unit, SUM(pr.units) FROM productions pr JOIN products p ON p.id = pr.product_id
             WHERE pr.produced_at >= ?1 AND pr.produced_at < ?2 GROUP BY p.unit ORDER BY p.unit",
        )?;
        stmt.query_map(params![from, to], |r| Ok(UnitQty { unit: r.get(0)?, qty: r.get(1)? }))?
            .collect::<Result<_, _>>()?
    };
    let (diesel_liters_used, diesel_cost_used_milli): (f64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(liters_used),0), COALESCE(SUM(cost_milli),0)
         FROM diesel_logs WHERE log_date >= ?1 AND log_date < ?2",
        params![dfrom, dto],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    // Per unit only when the period's production shares one unit; pieces and kg can't be added up.
    let diesel_cost_per_unit_milli = match units_produced.as_slice() {
        [only] if only.qty > 0.0 => Some(round(diesel_cost_used_milli as f64 / only.qty)),
        _ => None,
    };
    let stock_written_off_milli = -scalar_i64(
        conn,
        "SELECT COALESCE(SUM(value_milli),0) FROM stock_adjustments
         WHERE qty_delta < 0 AND adjusted_at >= ?1 AND adjusted_at < ?2",
        params![from, to],
    )?;
    let baker_pay_earned_milli = scalar_i64(
        conn,
        "SELECT COALESCE(SUM(w.amount_milli),0) FROM production_workers w JOIN productions p ON p.id = w.production_id
         WHERE p.produced_at >= ?1 AND p.produced_at < ?2",
        params![from, to],
    )?;

    let expenses_by_category: Vec<CategoryTotal> = {
        let mut stmt = conn.prepare(
            "SELECT c.name, SUM(e.amount_milli) AS total FROM expenses e JOIN expense_categories c ON c.id = e.category_id
             WHERE e.spent_at >= ?1 AND e.spent_at < ?2 GROUP BY c.id ORDER BY total DESC",
        )?;
        stmt.query_map(params![from, to], |r| Ok(CategoryTotal { category_name: r.get(0)?, total_milli: r.get(1)? }))?
            .collect::<Result<_, _>>()?
    };

    let mut days: BTreeMap<String, (i64, i64)> = BTreeMap::new();
    {
        let mut stmt = conn.prepare(&format!(
            "SELECT {d} AS day, SUM(total_milli) FROM sales
             WHERE voided_at IS NULL AND created_at >= ?1 AND created_at < ?2 GROUP BY day",
            d = local_date_sql("created_at")
        ))?;
        for row in stmt.query_map(params![from, to], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))? {
            let (day, v) = row?;
            days.entry(day).or_default().0 += v;
        }
        let mut stmt = conn.prepare(
            "SELECT sale_date, cash_milli + card_milli + online_milli + other_milli FROM daily_sales
             WHERE sale_date >= ?1 AND sale_date < ?2",
        )?;
        for row in stmt.query_map(params![dfrom, dto], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))? {
            let (day, v) = row?;
            days.entry(day).or_default().1 += v;
        }
    }
    let sales_by_day =
        days.into_iter().map(|(day, (pos, manual))| DaySales { day, pos_milli: pos, manual_milli: manual }).collect();

    let product_profit: Vec<ProductProfit> = {
        let mut stmt = conn.prepare(
            "SELECT si.product_id, p.name, SUM(si.qty), p.unit, SUM(si.line_total_milli),
                    CAST(ROUND(SUM(si.qty * si.unit_cost_milli)) AS INTEGER),
                    CAST(ROUND(SUM(si.qty * si.unit_overhead_milli)) AS INTEGER)
             FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
             WHERE s.voided_at IS NULL AND s.created_at >= ?1 AND s.created_at < ?2
             GROUP BY si.product_id ORDER BY SUM(si.line_total_milli) DESC",
        )?;
        stmt.query_map(params![from, to], |r| {
            let revenue: i64 = r.get(4)?;
            let cogs: i64 = r.get(5)?;
            let overhead: i64 = r.get(6)?;
            Ok(ProductProfit {
                product_id: r.get(0)?,
                name: r.get(1)?,
                qty: r.get(2)?,
                unit: r.get(3)?,
                revenue_milli: revenue,
                cogs_milli: cogs,
                gross_milli: revenue - cogs,
                overhead_milli: overhead,
                after_overhead_milli: revenue - cogs - overhead,
            })
        })?
        .collect::<Result<_, _>>()?
    };

    Ok(PeriodReport {
        pos_sales_milli,
        manual_sales_milli,
        sales_milli,
        sales_by_method,
        operating_expenses_milli,
        diesel_purchases_milli,
        ingredient_purchases_milli,
        wages_milli,
        total_costs_milli,
        net_profit_milli,
        profit_margin,
        avg_daily_sales_milli,
        production_ingredient_cost_milli,
        units_produced,
        diesel_liters_used,
        diesel_cost_used_milli,
        diesel_cost_per_unit_milli,
        stock_written_off_milli,
        baker_pay_earned_milli,
        expenses_by_category,
        sales_by_day,
        product_profit,
    })
}

fn month_start(conn: &Connection, year: i32, month: u32) -> AppResult<i64> {
    scalar_i64(
        conn,
        "SELECT CAST(strftime('%s', printf('%04d-%02d-01', ?1, ?2), 'utc') AS INTEGER)*1000",
        params![year, month],
    )
}

pub fn monthly_summary(conn: &Connection, year: i32) -> AppResult<Vec<MonthRow>> {
    (1..=12u32)
        .map(|month| {
            let from = month_start(conn, year, month)?;
            let to = if month == 12 { month_start(conn, year + 1, 1)? } else { month_start(conn, year, month + 1)? };
            let r = period_report(conn, Range { from, to })?;
            Ok(MonthRow {
                month,
                sales_milli: r.sales_milli,
                operating_expenses_milli: r.operating_expenses_milli,
                ingredient_purchases_milli: r.ingredient_purchases_milli,
                diesel_purchases_milli: r.diesel_purchases_milli,
                wages_milli: r.wages_milli,
                total_costs_milli: r.total_costs_milli,
                net_profit_milli: r.net_profit_milli,
                profit_margin: r.profit_margin,
                production_ingredient_cost_milli: r.production_ingredient_cost_milli,
                diesel_liters_used: r.diesel_liters_used,
                diesel_cost_used_milli: r.diesel_cost_used_milli,
                stock_written_off_milli: r.stock_written_off_milli,
                baker_pay_earned_milli: r.baker_pay_earned_milli,
            })
        })
        .collect()
}

pub fn dashboard_snapshot(conn: &Connection) -> AppResult<Snapshot> {
    let ingredients = catalog::list_ingredients(conn, false)?;
    let stock_value_milli = ingredients.iter().map(|i| i.stock_value_milli).sum();
    let reorder_count = ingredients.iter().filter(|i| i.status == "reorder").count() as i64;
    let out_count = ingredients.iter().filter(|i| i.status == "out").count() as i64;
    let shopping_list = ingredients
        .iter()
        .filter(|i| i.status != "ok")
        .map(|i| ShoppingItem {
            name: i.name.clone(),
            stock_qty: i.stock_qty,
            reorder_qty: i.reorder_qty,
            unit: i.unit.clone(),
            status: i.status.clone(),
        })
        .collect();

    let low_stock_products: Vec<LowStockProduct> = {
        let mut stmt = conn.prepare(
            "SELECT id, name, unit, stock_qty, low_stock_qty FROM products
             WHERE archived = 0 AND ((stock_qty <= low_stock_qty AND low_stock_qty > 0) OR stock_qty < 0)
             ORDER BY name",
        )?;
        stmt.query_map([], |r| {
            Ok(LowStockProduct {
                id: r.get(0)?,
                name: r.get(1)?,
                unit: r.get(2)?,
                stock_qty: r.get(3)?,
                low_stock_qty: r.get(4)?,
            })
        })?
        .collect::<Result<_, _>>()?
    };

    let (owed_to_suppliers_milli, unpaid_invoices): (i64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(bal),0), COUNT(*) FROM (
           SELECT p.total_milli - COALESCE((SELECT SUM(amount_milli) FROM purchase_payments pp WHERE pp.purchase_id = p.id),0) AS bal
           FROM purchases p) WHERE bal > 0",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    let products_without_recipe = scalar_i64(
        conn,
        "SELECT COUNT(*) FROM products p WHERE p.archived = 0
           AND NOT EXISTS (SELECT 1 FROM recipe_items ri WHERE ri.product_id = p.id)",
        [],
    )?;

    let s = settings::get_settings(conn)?;
    let diesel_in_tank_l: f64 = match s.diesel_ingredient_id {
        Some(id) => conn.query_row("SELECT COALESCE((SELECT stock_qty FROM ingredients WHERE id = ?1), 0)", [id], |r| {
            r.get(0)
        })?,
        None => 0.0,
    };
    let tank_level = (diesel_in_tank_l / s.tank_capacity_l).clamp(0.0, 1.0);
    let (month_liters, month_logs): (f64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(liters_used),0), COUNT(*) FROM diesel_logs
         WHERE log_date >= date('now','localtime','start of month')",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    let days_of_diesel_left = if month_logs > 0 && month_liters > 0.0 {
        Some((diesel_in_tank_l.max(0.0)) / (month_liters / month_logs as f64))
    } else {
        None
    };
    let owed_to_staff_milli =
        staff::list_staff(conn, true)?.iter().filter_map(|s| s.owed_milli).map(|o| o.max(0)).sum();

    Ok(Snapshot {
        stock_value_milli,
        reorder_count,
        out_count,
        shopping_list,
        low_stock_products,
        owed_to_suppliers_milli,
        unpaid_invoices,
        products_without_recipe,
        diesel_in_tank_l,
        tank_level,
        days_of_diesel_left,
        owed_to_staff_milli,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::testutil::*;
    use crate::services::{diesel, expenses, inventory, sales, shifts};

    #[test]
    fn cash_report_and_monthly() {
        let mut c = conn();
        let f = fixture(&mut c);
        purchase(&mut c, "ديزل", 100.0, 2000, "2025-03-01 09:00");
        produce(&mut c, f.product_id, 30.0, vec![f.ahmad, f.salem], "2025-03-02 08:00");
        sales::create_daily_sale(
            &c,
            DailySaleInput {
                id: None,
                sale_date: "2025-03-05".into(),
                cash_milli: 0,
                card_milli: 4000,
                online_milli: 2000,
                other_milli: 0,
                note: None,
            },
        )
        .unwrap();
        let at = local_ms(&c, "2025-03-06 10:00");
        expenses::create_expense(
            &c,
            NewExpense {
                category_id: id_of(&c, "expense_categories", "كهرباء"),
                description: None,
                amount_milli: 10000,
                method: "card".into(),
                spent_at: at,
                paid_from_drawer: false,
                note: None,
            },
        )
        .unwrap();
        staff::create_payroll_payment(
            &c,
            PayrollInput {
                staff_id: id_of(&c, "staff", "كاشير"),
                paid_at: at,
                period: Some("مارس".into()),
                base_milli: 3500,
                bonus_milli: 0,
                deductions_milli: 500,
                method: "cash".into(),
                paid_from_drawer: false,
                note: None,
            },
        )
        .unwrap();
        let adj = |item_type: &str, item_id, qty_delta, reason: &str| StockAdjustmentInput {
            item_type: item_type.into(),
            item_id,
            qty_delta,
            reason: reason.into(),
            adjusted_at: at,
            note: None,
        };
        inventory::create_stock_adjustment(&mut c, adj("product", f.product_id, -2.0, "waste")).unwrap();
        let flour = id_of(&c, "ingredients", "دقيق");
        inventory::create_stock_adjustment(&mut c, adj("ingredient", flour, 1.0, "count")).unwrap();
        let log = |date: &str, reading| DieselLogInput {
            log_date: date.into(),
            tank_reading_l: Some(reading),
            manual_liters: None,
            oven_hours: None,
            note: None,
        };
        diesel::create_diesel_log(&mut c, log("2025-03-01", 100.0)).unwrap();
        diesel::create_diesel_log(&mut c, log("2025-03-02", 70.0)).unwrap();
        shifts::open_shift(&c, OpenShiftInput { opening_cash_milli: 0 }).unwrap();
        sales::create_sale(&mut c, SaleInput { items: vec![CartLine { product_id: f.product_id, qty: 3.0 }] }).unwrap();

        let r = period_report(&c, Range::all()).unwrap();
        assert_eq!(r.sales_milli, 12000);
        assert_eq!(r.sales_by_method, SalesByMethod { cash: 6000, card: 4000, online: 2000, other: 0 });
        assert_eq!(r.operating_expenses_milli, 10000);
        assert_eq!(r.ingredient_purchases_milli, 120000);
        assert_eq!(r.diesel_purchases_milli, 200000);
        assert_eq!(r.wages_milli, 3000);
        assert_eq!(r.total_costs_milli, 333000);
        assert_eq!(r.net_profit_milli, -321000);
        assert_eq!(r.profit_margin, -26.75);
        assert_eq!(r.production_ingredient_cost_milli, 18000);
        assert_eq!(r.units_produced, vec![UnitQty { unit: "pcs".into(), qty: 30.0 }]);
        assert_eq!((r.diesel_liters_used, r.diesel_cost_used_milli, r.diesel_cost_per_unit_milli), (30.0, 60000, Some(2000)));
        assert_eq!(r.stock_written_off_milli, 1350);
        assert_eq!(r.baker_pay_earned_milli, 2250);
        assert_eq!(r.avg_daily_sales_milli, 6000);
        let pp = &r.product_profit[0];
        assert_eq!(
            (pp.name.as_str(), pp.qty, pp.revenue_milli, pp.cogs_milli, pp.gross_milli, pp.overhead_milli, pp.after_overhead_milli),
            ("خبز عربي", 3.0, 6000, 2025, 3975, 300, 3675)
        );
        assert_eq!(r.expenses_by_category[0].category_name, "كهرباء");
        assert_eq!(r.sales_by_day.len(), 2);

        let months = monthly_summary(&c, 2025).unwrap();
        let m = &months[2];
        assert_eq!(m.month, 3);
        assert_eq!(
            (m.sales_milli, m.operating_expenses_milli, m.ingredient_purchases_milli, m.diesel_purchases_milli, m.wages_milli, m.net_profit_milli),
            (6000, 10000, 120000, 200000, 3000, -327000)
        );
        for (i, m) in months.iter().enumerate().filter(|(i, _)| *i != 2) {
            assert_eq!(
                (m.sales_milli, m.total_costs_milli, m.net_profit_milli, m.production_ingredient_cost_milli, m.diesel_liters_used,
                 m.stock_written_off_milli, m.baker_pay_earned_milli),
                (0, 0, 0, 0, 0.0, 0, 0),
                "month {}",
                i + 1
            );
        }
    }

    #[test]
    fn snapshot() {
        let mut c = conn();
        let f = fixture(&mut c);
        produce(&mut c, f.product_id, 30.0, vec![f.ahmad, f.salem], "2025-03-02 08:00");
        staff::create_payroll_payment(
            &c,
            PayrollInput {
                staff_id: f.ahmad,
                paid_at: 1,
                period: None,
                base_milli: 1000,
                bonus_milli: 0,
                deductions_milli: 0,
                method: "cash".into(),
                paid_from_drawer: false,
                note: None,
            },
        )
        .unwrap();
        let flour = id_of(&c, "ingredients", "دقيق");
        catalog::update_ingredient(
            &mut c,
            UpdateIngredient { id: flour, name: "دقيق".into(), default_cost_milli: 0, opening_qty: 0.0, reorder_qty: 25.0 },
        )
        .unwrap();
        let s = dashboard_snapshot(&c).unwrap();
        assert_eq!(s.owed_to_staff_milli, 1500);
        let item = s.shopping_list.iter().find(|i| i.name == "دقيق").unwrap();
        assert_eq!(item.status, "reorder");
        assert_eq!(s.products_without_recipe, 5);
        assert_eq!((s.diesel_in_tank_l, s.tank_level, s.days_of_diesel_left), (0.0, 0.0, None));
        assert_eq!(s.owed_to_suppliers_milli, 0);
    }
}
