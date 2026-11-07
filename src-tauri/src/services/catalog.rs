use std::collections::HashSet;

use rusqlite::{Connection, OptionalExtension, params};

use crate::db::now_ms;
use crate::error::{AppError, AppResult, invalid, map_unique, not_found};
use crate::models::*;
use crate::services::{UNITS, fits_unit, recompute_ingredient_avg, round, weight_kg};

const PAY_MODES: &[&str] = &["none", "per_unit", "per_kg", "per_batch"];

// ---------- ingredients ----------

fn ingredient_status(stock: f64, reorder: f64) -> &'static str {
    if stock <= 0.0 {
        "out"
    } else if stock <= reorder {
        "reorder"
    } else {
        "ok"
    }
}

pub fn list_ingredients(conn: &Connection, include_archived: bool) -> AppResult<Vec<Ingredient>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, unit, default_cost_milli, opening_qty, reorder_qty, stock_qty, avg_cost_milli, archived
         FROM ingredients WHERE (?1 OR archived = 0) ORDER BY name",
    )?;
    let rows = stmt.query_map([include_archived], |r| {
        let stock: f64 = r.get(6)?;
        let avg: f64 = r.get(7)?;
        let reorder: f64 = r.get(5)?;
        Ok(Ingredient {
            id: r.get(0)?,
            name: r.get(1)?,
            unit: r.get(2)?,
            default_cost_milli: r.get(3)?,
            opening_qty: r.get(4)?,
            reorder_qty: reorder,
            stock_qty: stock,
            avg_cost_milli: avg,
            stock_value_milli: round(stock.max(0.0) * avg),
            status: ingredient_status(stock, reorder).to_string(),
            archived: r.get(8)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

fn validate_ingredient(name: &str, default_cost: i64, opening: f64, reorder: f64) -> AppResult<()> {
    if name.trim().is_empty() {
        return invalid("أدخل اسم المكوّن");
    }
    if default_cost < 0 || opening < 0.0 || reorder < 0.0 {
        return invalid("قيمة غير صالحة");
    }
    Ok(())
}

pub fn create_ingredient(conn: &Connection, input: NewIngredient) -> AppResult<i64> {
    validate_ingredient(&input.name, input.default_cost_milli, input.opening_qty, input.reorder_qty)?;
    if !UNITS.contains(&input.unit.as_str()) {
        return invalid("وحدة غير صالحة");
    }
    conn.execute(
        "INSERT INTO ingredients (name, unit, default_cost_milli, opening_qty, reorder_qty, stock_qty, avg_cost_milli, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?4, ?3, ?6)",
        params![
            input.name.trim(),
            input.unit,
            input.default_cost_milli,
            input.opening_qty,
            input.reorder_qty,
            now_ms()
        ],
    )
    .map_err(map_unique)?;
    Ok(conn.last_insert_rowid())
}

pub fn update_ingredient(conn: &mut Connection, input: UpdateIngredient) -> AppResult<()> {
    validate_ingredient(&input.name, input.default_cost_milli, input.opening_qty, input.reorder_qty)?;
    let tx = conn.transaction()?;
    let old_opening: f64 = tx
        .query_row("SELECT opening_qty FROM ingredients WHERE id = ?1", [input.id], |r| r.get(0))
        .map_err(not_found)?;
    tx.execute(
        "UPDATE ingredients SET name = ?1, default_cost_milli = ?2, opening_qty = ?3, reorder_qty = ?4,
           stock_qty = stock_qty + (?3 - ?5) WHERE id = ?6",
        params![
            input.name.trim(),
            input.default_cost_milli,
            input.opening_qty,
            input.reorder_qty,
            old_opening,
            input.id
        ],
    )
    .map_err(map_unique)?;
    recompute_ingredient_avg(&tx, input.id)?;
    tx.commit()?;
    Ok(())
}

pub fn set_ingredient_archived(conn: &Connection, id: i64, archived: bool) -> AppResult<()> {
    let n = conn.execute("UPDATE ingredients SET archived = ?1 WHERE id = ?2", params![archived, id])?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

// ---------- product categories ----------

pub fn list_product_categories(conn: &Connection) -> AppResult<Vec<Category>> {
    let mut stmt = conn.prepare("SELECT id, name, sort_order FROM product_categories ORDER BY sort_order, name")?;
    let rows = stmt.query_map([], |r| Ok(Category { id: r.get(0)?, name: r.get(1)?, sort_order: r.get(2)? }))?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn create_product_category(conn: &Connection, input: NewCategory) -> AppResult<i64> {
    if input.name.trim().is_empty() {
        return invalid("أدخل اسم الفئة");
    }
    conn.execute(
        "INSERT INTO product_categories (name, sort_order, created_at)
         VALUES (?1, (SELECT COALESCE(MAX(sort_order),0)+1 FROM product_categories), ?2)",
        params![input.name.trim(), now_ms()],
    )
    .map_err(map_unique)?;
    Ok(conn.last_insert_rowid())
}

pub fn rename_product_category(conn: &Connection, input: RenameCategory) -> AppResult<()> {
    if input.name.trim().is_empty() {
        return invalid("أدخل اسم الفئة");
    }
    let n = conn
        .execute("UPDATE product_categories SET name = ?1 WHERE id = ?2", params![input.name.trim(), input.id])
        .map_err(map_unique)?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn delete_product_category(conn: &Connection, id: i64) -> AppResult<()> {
    let used: i64 = conn.query_row("SELECT COUNT(*) FROM products WHERE category_id = ?1", [id], |r| r.get(0))?;
    if used > 0 {
        return invalid("لا يمكن حذف فئة تحتوي على منتجات");
    }
    conn.execute("DELETE FROM product_categories WHERE id = ?1", [id])?;
    Ok(())
}

// ---------- products ----------

/// Per-unit cost breakdown (milli, rounded). The single source of the cost formula.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct UnitCosts {
    pub ingredient: i64,
    pub labor: i64,
    pub overhead: i64,
    pub direct: i64,
    pub full: i64,
}

pub struct CostLine {
    pub ingredient_id: i64,
    pub unit: String,
    pub qty: f64,
    pub avg: f64,
}

pub fn cost_lines(conn: &Connection, product_id: i64) -> AppResult<Vec<CostLine>> {
    let mut stmt = conn.prepare(
        "SELECT ri.ingredient_id, i.unit, ri.qty, i.avg_cost_milli
         FROM recipe_items ri JOIN ingredients i ON i.id = ri.ingredient_id WHERE ri.product_id = ?1",
    )?;
    let rows = stmt.query_map([product_id], |r| {
        Ok(CostLine { ingredient_id: r.get(0)?, unit: r.get(1)?, qty: r.get(2)?, avg: r.get(3)? })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// Baker-pay weight per batch: the basis ingredient's weight, or the full dough weight.
pub fn pay_kg_per_batch(basis: Option<i64>, lines: &[CostLine]) -> f64 {
    match basis {
        Some(id) => lines
            .iter()
            .find(|l| l.ingredient_id == id)
            .and_then(|l| weight_kg(&l.unit, l.qty))
            .unwrap_or(0.0),
        None => lines.iter().filter_map(|l| weight_kg(&l.unit, l.qty)).sum(),
    }
}

pub struct PayConfig {
    pub unit: String,
    pub batch_yield: f64,
    pub pay_mode: String,
    pub pay_rate_milli: i64,
    pub pay_basis_ingredient_id: Option<i64>,
    pub overhead_per_batch_milli: i64,
    pub avg_cost_milli: f64,
}

pub fn pay_config(conn: &Connection, product_id: i64) -> AppResult<PayConfig> {
    conn.query_row(
        "SELECT unit, batch_yield, pay_mode, pay_rate_milli, pay_basis_ingredient_id, overhead_per_batch_milli,
                avg_cost_milli
         FROM products WHERE id = ?1",
        [product_id],
        |r| {
            Ok(PayConfig {
                unit: r.get(0)?,
                batch_yield: r.get(1)?,
                pay_mode: r.get(2)?,
                pay_rate_milli: r.get(3)?,
                pay_basis_ingredient_id: r.get(4)?,
                overhead_per_batch_milli: r.get(5)?,
                avg_cost_milli: r.get(6)?,
            })
        },
    )
    .map_err(not_found)
}

pub fn unit_costs(conn: &Connection, product_id: i64) -> AppResult<UnitCosts> {
    let p = pay_config(conn, product_id)?;
    let lines = cost_lines(conn, product_id)?;
    let y = p.batch_yield;
    let rate = p.pay_rate_milli as f64;
    let ingredient = round(lines.iter().map(|l| l.qty * l.avg).sum::<f64>() / y);
    let labor = match p.pay_mode.as_str() {
        "per_unit" => p.pay_rate_milli,
        "per_batch" => round(rate / y),
        "per_kg" => round(pay_kg_per_batch(p.pay_basis_ingredient_id, &lines) * rate / y),
        _ => 0,
    };
    let overhead = round(p.overhead_per_batch_milli as f64 / y);
    let direct = if p.avg_cost_milli > 0.0 { round(p.avg_cost_milli) } else { ingredient + labor };
    Ok(UnitCosts { ingredient, labor, overhead, direct, full: direct + overhead })
}

/// (direct unit cost, overhead per unit) snapshotted on POS sale lines.
pub fn sale_costs(conn: &Connection, product_id: i64) -> AppResult<(i64, i64)> {
    let c = unit_costs(conn, product_id)?;
    Ok((c.direct, c.overhead))
}

/// SQL expression: whether product `id`'s stock has moved (production, sale or adjustment).
fn has_movements_sql(id: &str) -> String {
    format!(
        "EXISTS (SELECT 1 FROM productions WHERE product_id = {id})
         OR EXISTS (SELECT 1 FROM sale_items WHERE product_id = {id})
         OR EXISTS (SELECT 1 FROM stock_adjustments WHERE item_type = 'product' AND item_id = {id})"
    )
}

pub fn list_products(conn: &Connection, include_archived: bool) -> AppResult<Vec<Product>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT p.id, p.name, p.category_id, c.name, p.price_milli, p.unit, p.batch_yield, p.stock_qty, p.avg_cost_milli,
                p.low_stock_qty, p.archived, p.pay_mode, p.pay_rate_milli, p.pay_basis_ingredient_id,
                p.overhead_per_batch_milli,
                (SELECT COUNT(*) FROM recipe_items ri WHERE ri.product_id = p.id),
                (SELECT COALESCE(SUM(units),0) FROM productions pr WHERE pr.product_id = p.id),
                ({movements})
         FROM products p JOIN product_categories c ON c.id = p.category_id
         WHERE (?1 OR p.archived = 0)
         ORDER BY c.sort_order, c.name, p.name",
        movements = has_movements_sql("p.id")
    ))?;
    let rows = stmt.query_map([include_archived], |r| {
        Ok(Product {
            id: r.get(0)?,
            name: r.get(1)?,
            category_id: r.get(2)?,
            category_name: r.get(3)?,
            price_milli: r.get(4)?,
            unit: r.get(5)?,
            batch_yield: r.get(6)?,
            stock_qty: r.get(7)?,
            avg_cost_milli: r.get(8)?,
            low_stock_qty: r.get(9)?,
            archived: r.get(10)?,
            pay_mode: r.get(11)?,
            pay_rate_milli: r.get(12)?,
            pay_basis_ingredient_id: r.get(13)?,
            overhead_per_batch_milli: r.get(14)?,
            recipe_line_count: r.get(15)?,
            produced_units: r.get(16)?,
            has_movements: r.get(17)?,
            ingredient_cost_per_unit_milli: 0,
            labor_cost_per_unit_milli: 0,
            overhead_per_unit_milli: 0,
            direct_unit_cost_milli: 0,
            full_unit_cost_milli: 0,
        })
    })?;
    let mut products: Vec<Product> = rows.collect::<Result<_, _>>()?;
    for p in &mut products {
        let c = unit_costs(conn, p.id)?;
        p.ingredient_cost_per_unit_milli = c.ingredient;
        p.labor_cost_per_unit_milli = c.labor;
        p.overhead_per_unit_milli = c.overhead;
        p.direct_unit_cost_milli = c.direct;
        p.full_unit_cost_milli = c.full;
    }
    Ok(products)
}

pub fn get_recipe(conn: &Connection, product_id: i64) -> AppResult<Vec<RecipeLine>> {
    let mut stmt = conn.prepare(
        "SELECT ri.ingredient_id, i.name, i.unit, ri.qty
         FROM recipe_items ri JOIN ingredients i ON i.id = ri.ingredient_id
         WHERE ri.product_id = ?1 ORDER BY i.name",
    )?;
    let rows = stmt.query_map([product_id], |r| {
        Ok(RecipeLine { ingredient_id: r.get(0)?, ingredient_name: r.get(1)?, unit: r.get(2)?, qty: r.get(3)? })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn save_product(conn: &mut Connection, input: ProductInput) -> AppResult<i64> {
    let name = input.name.trim();
    if name.is_empty() {
        return invalid("أدخل اسم المنتج");
    }
    if !UNITS.contains(&input.unit.as_str()) {
        return invalid("وحدة غير صالحة");
    }
    if input.price_milli < 0
        || !(input.batch_yield >= 1.0)
        || input.overhead_per_batch_milli < 0
        || !(input.low_stock_qty >= 0.0)
        || !PAY_MODES.contains(&input.pay_mode.as_str())
    {
        return invalid("قيمة غير صالحة");
    }
    if !fits_unit(&input.unit, input.batch_yield) || !fits_unit(&input.unit, input.low_stock_qty) {
        return invalid("الكمية يجب أن تكون عدداً صحيحاً");
    }
    let mut seen = HashSet::new();
    for line in &input.recipe {
        if !(line.qty > 0.0) {
            return invalid("كمية غير صالحة في الوصفة");
        }
        if !seen.insert(line.ingredient_id) {
            return invalid("مكوّن مكرر في الوصفة");
        }
    }
    if input.pay_mode != "none" && input.pay_rate_milli <= 0 {
        return invalid("أدخل أجر الخباز");
    }

    let tx = conn.transaction()?;
    let cat: Option<i64> = tx
        .query_row("SELECT id FROM product_categories WHERE id = ?1", [input.category_id], |r| r.get(0))
        .optional()?;
    if cat.is_none() {
        return invalid("اختر الفئة");
    }
    let mut units = Vec::with_capacity(input.recipe.len());
    for line in &input.recipe {
        let unit: String = tx
            .query_row("SELECT unit FROM ingredients WHERE id = ?1", [line.ingredient_id], |r| r.get(0))
            .map_err(not_found)?;
        units.push((line.ingredient_id, unit, line.qty));
    }
    let basis = if input.pay_mode == "per_kg" { input.pay_basis_ingredient_id } else { None };
    if input.pay_mode == "per_kg" {
        match basis {
            Some(b) => {
                let ok = units.iter().any(|(id, unit, qty)| *id == b && weight_kg(unit, *qty).is_some());
                if !ok {
                    return invalid("مكوّن أساس الأجر يجب أن يكون في الوصفة ويقاس بالوزن");
                }
            }
            None => {
                if !units.iter().any(|(_, unit, qty)| weight_kg(unit, *qty).is_some()) {
                    return invalid("الوصفة لا تحتوي على مكونات بالوزن");
                }
            }
        }
    }
    let rate = if input.pay_mode == "none" { 0 } else { input.pay_rate_milli };

    let id = match input.id {
        Some(id) => {
            let (unit, moved): (String, bool) = tx
                .query_row(
                    &format!("SELECT unit, {} FROM products WHERE id = ?1", has_movements_sql("?1")),
                    [id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .map_err(not_found)?;
            if unit != input.unit && moved {
                return invalid("لا يمكن تغيير وحدة منتج له حركات إنتاج أو بيع أو تعديل مخزون");
            }
            tx.execute(
                "UPDATE products SET name = ?1, category_id = ?2, price_milli = ?3, unit = ?4, batch_yield = ?5,
                   low_stock_qty = ?6, pay_mode = ?7, pay_rate_milli = ?8, pay_basis_ingredient_id = ?9,
                   overhead_per_batch_milli = ?10
                 WHERE id = ?11",
                params![
                    name,
                    input.category_id,
                    input.price_milli,
                    input.unit,
                    input.batch_yield,
                    input.low_stock_qty,
                    input.pay_mode,
                    rate,
                    basis,
                    input.overhead_per_batch_milli,
                    id
                ],
            )
            .map_err(map_unique)?;
            tx.execute("DELETE FROM recipe_items WHERE product_id = ?1", [id])?;
            id
        }
        None => {
            tx.execute(
                "INSERT INTO products (name, category_id, price_milli, unit, batch_yield, low_stock_qty, pay_mode,
                   pay_rate_milli, pay_basis_ingredient_id, overhead_per_batch_milli, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
                    name,
                    input.category_id,
                    input.price_milli,
                    input.unit,
                    input.batch_yield,
                    input.low_stock_qty,
                    input.pay_mode,
                    rate,
                    basis,
                    input.overhead_per_batch_milli,
                    now_ms()
                ],
            )
            .map_err(map_unique)?;
            tx.last_insert_rowid()
        }
    };
    {
        let mut ins = tx.prepare("INSERT INTO recipe_items (product_id, ingredient_id, qty) VALUES (?1, ?2, ?3)")?;
        for line in &input.recipe {
            ins.execute(params![id, line.ingredient_id, line.qty])?;
        }
    }
    tx.commit()?;
    Ok(id)
}

pub fn set_product_archived(conn: &Connection, id: i64, archived: bool) -> AppResult<()> {
    let n = conn.execute("UPDATE products SET archived = ?1 WHERE id = ?2", params![archived, id])?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::testutil::*;

    #[test]
    fn product_costing() {
        let mut c = conn();
        let f = fixture(&mut c);
        let p = product(&c, "خبز عربي");
        assert_eq!(p.id, f.product_id);
        assert_eq!(p.ingredient_cost_per_unit_milli, 600);
        assert_eq!(p.labor_cost_per_unit_milli, 50);
        assert_eq!(p.overhead_per_unit_milli, 100);
        assert_eq!(p.full_unit_cost_milli, 750);
        assert_eq!(p.recipe_line_count, 1);

        let egg = id_of(&c, "ingredients", "بيض");
        let flour = id_of(&c, "ingredients", "دقيق");
        let base = ProductInput {
            id: None,
            name: "بيض مسلوق".into(),
            category_id: id_of(&c, "product_categories", "خبز"),
            price_milli: 1000,
            unit: "pcs".into(),
            batch_yield: 10.0,
            low_stock_qty: 0.0,
            pay_mode: "per_kg".into(),
            pay_rate_milli: 500,
            pay_basis_ingredient_id: None,
            overhead_per_batch_milli: 0,
            recipe: vec![RecipeInput { ingredient_id: egg, qty: 10.0 }],
        };
        assert_eq!(err(save_product(&mut c, base.clone())), "الوصفة لا تحتوي على مكونات بالوزن");

        let mut dup = base.clone();
        dup.pay_mode = "none".into();
        dup.recipe = vec![
            RecipeInput { ingredient_id: flour, qty: 1.0 },
            RecipeInput { ingredient_id: flour, qty: 2.0 },
        ];
        assert_eq!(err(save_product(&mut c, dup)), "مكوّن مكرر في الوصفة");

        let mut basis = base.clone();
        basis.recipe = vec![RecipeInput { ingredient_id: flour, qty: 1.0 }, RecipeInput { ingredient_id: egg, qty: 2.0 }];
        basis.pay_basis_ingredient_id = Some(egg);
        assert_eq!(err(save_product(&mut c, basis)), "مكوّن أساس الأجر يجب أن يكون في الوصفة ويقاس بالوزن");

        let mut same = base.clone();
        same.name = "خبز عربي".into();
        same.pay_mode = "none".into();
        assert_eq!(err(save_product(&mut c, same)), "الاسم مستخدم مسبقاً");
    }

    #[test]
    fn product_measured_in_kg() {
        use crate::services::{inventory, production, sales, shifts};
        let mut c = conn();
        fixture(&mut c); // flour avg 6000/kg, default baker set
        let flour = id_of(&c, "ingredients", "دقيق");
        let input = ProductInput {
            id: None,
            name: "كعك بالكيلو".into(),
            category_id: id_of(&c, "product_categories", "معجنات"),
            price_milli: 20000,
            unit: "kg".into(),
            batch_yield: 4.5,
            low_stock_qty: 1.5,
            pay_mode: "per_unit".into(),
            pay_rate_milli: 1000,
            pay_basis_ingredient_id: None,
            overhead_per_batch_milli: 0,
            recipe: vec![RecipeInput { ingredient_id: flour, qty: 3.0 }],
        };
        let mut pieces = input.clone();
        pieces.unit = "pcs".into();
        assert_eq!(err(save_product(&mut c, pieces)), "الكمية يجب أن تكون عدداً صحيحاً");
        let id = save_product(&mut c, input.clone()).unwrap();

        // Costs are per kg: 3 kg flour × 6000 / 4.5 kg + 1000 pay per kg.
        let p = product(&c, "كعك بالكيلو");
        assert_eq!((p.unit.as_str(), p.batch_yield, p.low_stock_qty), ("kg", 4.5, 1.5));
        assert_eq!((p.ingredient_cost_per_unit_milli, p.full_unit_cost_milli, p.has_movements), (4000, 5000, false));

        // Entered directly in kg, or as dough weight: 1 kg of dough = 1/3 batch = 1.5 kg of product.
        let direct = ProductionInput { product_id: id, units: 2.25, ..Default::default() };
        assert_eq!(production::preview_production(&c, direct).unwrap().units, 2.25);
        let dough = ProductionInput { product_id: id, unit: Some("kg".into()), quantity: Some(1.0), ..Default::default() };
        let preview = production::preview_production(&c, dough).unwrap();
        assert_eq!((preview.units, preview.product_unit.as_str(), preview.workers[0].basis_qty), (1.5, "kg", 1.5));
        produce(&mut c, id, 2.25, vec![], "2025-03-02 08:00");

        shifts::open_shift(&c, OpenShiftInput { opening_cash_milli: 0 }).unwrap();
        let sale = sales::create_sale(&mut c, SaleInput { items: vec![CartLine { product_id: id, qty: 0.75 }] }).unwrap();
        assert_eq!((sale.total_milli, sale.items[0].qty, sale.items[0].unit.as_str()), (15000, 0.75, "kg"));
        inventory::create_stock_adjustment(
            &mut c,
            StockAdjustmentInput {
                item_type: "product".into(),
                item_id: id,
                qty_delta: -0.25,
                reason: "waste".into(),
                adjusted_at: 0,
                note: None,
            },
        )
        .unwrap();
        let p = product(&c, "كعك بالكيلو");
        assert_eq!((p.stock_qty, p.produced_units, p.has_movements), (1.25, 2.25, true));

        let mut to_pieces = input;
        to_pieces.id = Some(id);
        to_pieces.unit = "pcs".into();
        to_pieces.batch_yield = 5.0;
        to_pieces.low_stock_qty = 1.0;
        assert_eq!(err(save_product(&mut c, to_pieces)), "لا يمكن تغيير وحدة منتج له حركات إنتاج أو بيع أو تعديل مخزون");
    }

    #[test]
    fn ingredient_create_update() {
        let mut c = conn();
        let id = create_ingredient(
            &c,
            NewIngredient {
                name: "تمر".into(),
                unit: "kg".into(),
                default_cost_milli: 4000,
                opening_qty: 5.0,
                reorder_qty: 2.0,
            },
        )
        .unwrap();
        let i = ingredient(&c, "تمر");
        assert_eq!((i.stock_qty, i.avg_cost_milli, i.status.as_str()), (5.0, 4000.0, "ok"));
        update_ingredient(
            &mut c,
            UpdateIngredient { id, name: "تمر".into(), default_cost_milli: 4500, opening_qty: 8.0, reorder_qty: 9.0 },
        )
        .unwrap();
        let i = ingredient(&c, "تمر");
        assert_eq!((i.stock_qty, i.avg_cost_milli, i.status.as_str()), (8.0, 4500.0, "reorder"));
        assert_eq!(i.stock_value_milli, 36000);
        assert_eq!(ingredient(&c, "دقيق").status, "out");
    }

    #[test]
    fn category_delete_guard() {
        let c = conn();
        let bread = id_of(&c, "product_categories", "خبز");
        assert_eq!(err(delete_product_category(&c, bread)), "لا يمكن حذف فئة تحتوي على منتجات");
        let drinks = id_of(&c, "product_categories", "مشروبات");
        delete_product_category(&c, drinks).unwrap();
    }
}
