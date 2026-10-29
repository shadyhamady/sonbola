use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct Range {
    pub from: i64,
    pub to: i64,
}

impl Range {
    pub fn all() -> Self {
        Range { from: 0, to: i64::MAX }
    }
}

// ---------- settings ----------

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub bakery_name: String,
    pub currency_symbol: String,
    pub currency_decimals: i64,
    pub diesel_ingredient_id: Option<i64>,
    pub tank_capacity_l: f64,
    pub default_baker_id: Option<i64>,
    pub is_configured: bool,
    /// True while the demo data loaded at onboarding is still in the database.
    pub is_demo: bool,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInput {
    pub bakery_name: String,
    pub currency_symbol: String,
    pub currency_decimals: i64,
    pub diesel_ingredient_id: Option<i64>,
    pub tank_capacity_l: f64,
    pub default_baker_id: Option<i64>,
}

// ---------- catalog ----------

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Ingredient {
    pub id: i64,
    pub name: String,
    pub unit: String,
    pub default_cost_milli: i64,
    pub opening_qty: f64,
    pub reorder_qty: f64,
    pub stock_qty: f64,
    pub avg_cost_milli: f64,
    pub stock_value_milli: i64,
    pub status: String,
    pub archived: bool,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NewIngredient {
    pub name: String,
    pub unit: String,
    pub default_cost_milli: i64,
    pub opening_qty: f64,
    pub reorder_qty: f64,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateIngredient {
    pub id: i64,
    pub name: String,
    pub default_cost_milli: i64,
    pub opening_qty: f64,
    pub reorder_qty: f64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub sort_order: i64,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NewCategory {
    pub name: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RenameCategory {
    pub id: i64,
    pub name: String,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: i64,
    pub name: String,
    pub category_id: i64,
    pub category_name: String,
    pub price_milli: i64,
    pub batch_yield: i64,
    pub stock_qty: i64,
    pub avg_cost_milli: f64,
    pub low_stock_qty: i64,
    pub archived: bool,
    pub pay_mode: String,
    pub pay_rate_milli: i64,
    pub pay_basis_ingredient_id: Option<i64>,
    pub overhead_per_batch_milli: i64,
    pub ingredient_cost_per_unit_milli: i64,
    pub labor_cost_per_unit_milli: i64,
    pub overhead_per_unit_milli: i64,
    pub direct_unit_cost_milli: i64,
    pub full_unit_cost_milli: i64,
    pub recipe_line_count: i64,
    pub produced_units: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecipeLine {
    pub ingredient_id: i64,
    pub ingredient_name: String,
    pub unit: String,
    pub qty: f64,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecipeInput {
    pub ingredient_id: i64,
    pub qty: f64,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProductInput {
    pub id: Option<i64>,
    pub name: String,
    pub category_id: i64,
    pub price_milli: i64,
    pub batch_yield: i64,
    pub low_stock_qty: i64,
    pub pay_mode: String,
    pub pay_rate_milli: i64,
    pub pay_basis_ingredient_id: Option<i64>,
    pub overhead_per_batch_milli: i64,
    pub recipe: Vec<RecipeInput>,
}

// ---------- suppliers & purchases ----------

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Supplier {
    pub id: i64,
    pub name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub supplies: Option<String>,
    pub archived: bool,
    pub total_purchased_milli: i64,
    pub total_paid_milli: i64,
    pub balance_milli: i64,
    pub unpaid_invoices: i64,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SupplierInput {
    #[serde(default)]
    pub id: Option<i64>,
    pub name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub supplies: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseItemInput {
    pub ingredient_id: i64,
    pub qty: f64,
    pub unit_cost_milli: i64,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NewPurchase {
    pub supplier_id: Option<i64>,
    pub invoice_no: Option<String>,
    pub purchased_at: i64,
    pub note: Option<String>,
    pub items: Vec<PurchaseItemInput>,
    pub paid_now_milli: i64,
    pub method: String,
    pub paid_from_drawer: bool,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseItem {
    pub id: i64,
    pub ingredient_id: i64,
    pub ingredient_name: String,
    pub unit: String,
    pub qty: f64,
    pub unit_cost_milli: i64,
    pub total_cost_milli: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PurchasePayment {
    pub id: i64,
    pub purchase_id: i64,
    pub amount_milli: i64,
    pub method: String,
    pub paid_at: i64,
    pub paid_from_drawer: bool,
    pub shift_id: Option<i64>,
    pub locked: bool,
    pub note: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Purchase {
    pub id: i64,
    pub supplier_id: Option<i64>,
    pub supplier_name: Option<String>,
    pub invoice_no: Option<String>,
    pub purchased_at: i64,
    pub total_milli: i64,
    pub paid_milli: i64,
    pub balance_milli: i64,
    pub status: String,
    pub note: Option<String>,
    pub items: Vec<PurchaseItem>,
    pub payments: Vec<PurchasePayment>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PurchasePaymentInput {
    pub purchase_id: i64,
    pub amount_milli: i64,
    pub method: String,
    pub paid_at: i64,
    pub paid_from_drawer: bool,
    pub note: Option<String>,
}

// ---------- inventory ----------

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StockAdjustmentInput {
    pub item_type: String,
    pub item_id: i64,
    pub qty_delta: f64,
    pub reason: String,
    pub adjusted_at: i64,
    pub note: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StockAdjustment {
    pub id: i64,
    pub item_type: String,
    pub item_id: i64,
    pub item_name: String,
    pub unit: String,
    pub qty_delta: f64,
    pub value_milli: i64,
    pub reason: String,
    pub adjusted_at: i64,
    pub note: Option<String>,
}

// ---------- production ----------

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProductionInput {
    pub product_id: i64,
    pub units: i64,
    pub staff_ids: Vec<i64>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecordProductionInput {
    pub product_id: i64,
    pub units: i64,
    pub staff_ids: Vec<i64>,
    pub produced_at: i64,
    pub note: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PreviewIngredient {
    pub ingredient_id: i64,
    pub name: String,
    pub unit: String,
    pub required_qty: f64,
    pub stock_qty: f64,
    pub cost_milli: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PreviewWorker {
    pub staff_id: i64,
    pub name: String,
    pub basis_qty: f64,
    pub rate_milli: i64,
    pub amount_milli: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProductionPreview {
    pub pay_mode: String,
    pub batches: f64,
    pub ingredients: Vec<PreviewIngredient>,
    pub workers: Vec<PreviewWorker>,
    pub ingredient_cost_milli: i64,
    pub labor_cost_milli: i64,
    pub overhead_milli: i64,
    pub total_cost_milli: i64,
    pub unit_cost_milli: i64,
    pub used_default_baker: bool,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProductionRow {
    pub id: i64,
    pub produced_at: i64,
    pub product_name: String,
    pub units: i64,
    pub ingredient_cost_milli: i64,
    pub labor_cost_milli: i64,
    pub overhead_milli: i64,
    pub worker_names: Vec<String>,
    pub note: Option<String>,
}

// ---------- staff ----------

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Staff {
    pub id: i64,
    pub name: String,
    pub role: Option<String>,
    pub pay_type: String,
    pub rate_milli: i64,
    pub phone: Option<String>,
    pub start_date: Option<String>,
    pub archived: bool,
    pub paid_milli: i64,
    pub earned_milli: i64,
    pub owed_milli: Option<i64>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StaffInput {
    #[serde(default)]
    pub id: Option<i64>,
    pub name: String,
    pub role: Option<String>,
    pub pay_type: String,
    pub rate_milli: i64,
    pub phone: Option<String>,
    pub start_date: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StaffRate {
    pub product_id: i64,
    pub product_name: String,
    pub pay_mode: String,
    pub default_rate_milli: i64,
    pub override_rate_milli: Option<i64>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SetStaffRateInput {
    pub staff_id: i64,
    pub product_id: i64,
    pub rate_milli: Option<i64>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PayrollInput {
    pub staff_id: i64,
    pub paid_at: i64,
    pub period: Option<String>,
    pub base_milli: i64,
    pub bonus_milli: i64,
    pub deductions_milli: i64,
    pub method: String,
    pub paid_from_drawer: bool,
    pub note: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PayrollPayment {
    pub id: i64,
    pub staff_id: i64,
    pub staff_name: String,
    pub paid_at: i64,
    pub period: Option<String>,
    pub base_milli: i64,
    pub bonus_milli: i64,
    pub deductions_milli: i64,
    pub net_milli: i64,
    pub method: String,
    pub paid_from_drawer: bool,
    pub shift_id: Option<i64>,
    pub locked: bool,
    pub note: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PayrollFilter {
    pub staff_id: Option<i64>,
    pub range: Range,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatementInput {
    pub staff_id: i64,
    pub range: Range,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Earning {
    pub production_id: i64,
    pub produced_at: i64,
    pub product_name: String,
    pub pay_mode: String,
    pub basis_qty: f64,
    pub rate_milli: i64,
    pub amount_milli: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StaffStatement {
    pub earnings: Vec<Earning>,
    pub payments: Vec<PayrollPayment>,
    pub earned_milli: i64,
    pub paid_milli: i64,
}

// ---------- expenses ----------

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Expense {
    pub id: i64,
    pub category_id: i64,
    pub category_name: String,
    pub description: Option<String>,
    pub amount_milli: i64,
    pub method: String,
    pub spent_at: i64,
    pub paid_from_drawer: bool,
    pub shift_id: Option<i64>,
    pub locked: bool,
    pub note: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NewExpense {
    pub category_id: i64,
    pub description: Option<String>,
    pub amount_milli: i64,
    pub method: String,
    pub spent_at: i64,
    pub paid_from_drawer: bool,
    pub note: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateExpense {
    pub id: i64,
    pub category_id: i64,
    pub description: Option<String>,
    pub amount_milli: i64,
    pub method: String,
    pub spent_at: i64,
    pub note: Option<String>,
}

// ---------- diesel ----------

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DieselLogInput {
    pub log_date: String,
    pub tank_reading_l: Option<f64>,
    pub manual_liters: Option<f64>,
    pub oven_hours: Option<f64>,
    pub note: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DieselLog {
    pub id: i64,
    pub log_date: String,
    pub tank_reading_l: Option<f64>,
    pub manual_liters: Option<f64>,
    pub liters_used: f64,
    pub cost_milli: i64,
    pub oven_hours: Option<f64>,
    pub liters_per_hour: Option<f64>,
    pub is_latest: bool,
    pub note: Option<String>,
}

// ---------- shifts ----------

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Shift {
    pub id: i64,
    pub opened_at: i64,
    pub opening_cash_milli: i64,
    pub closed_at: Option<i64>,
    pub counted_cash_milli: Option<i64>,
    pub expected_cash_milli: Option<i64>,
    pub note: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ShiftSummary {
    pub shift: Shift,
    pub sale_count: i64,
    pub sales_total_milli: i64,
    pub drawer_payments_milli: i64,
    pub expected_cash_milli: i64,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OpenShiftInput {
    pub opening_cash_milli: i64,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CloseShiftInput {
    pub counted_cash_milli: i64,
    pub note: Option<String>,
}

// ---------- sales ----------

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CartLine {
    pub product_id: i64,
    pub qty: i64,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaleInput {
    pub items: Vec<CartLine>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaleItem {
    pub id: i64,
    pub product_id: i64,
    pub product_name: String,
    pub qty: i64,
    pub unit_price_milli: i64,
    pub unit_cost_milli: i64,
    pub unit_overhead_milli: i64,
    pub line_total_milli: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Sale {
    pub id: i64,
    pub shift_id: i64,
    pub total_milli: i64,
    pub cost_milli: i64,
    pub created_at: i64,
    pub voided_at: Option<i64>,
    pub items: Vec<SaleItem>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DailySale {
    pub id: i64,
    pub sale_date: String,
    pub cash_milli: i64,
    pub card_milli: i64,
    pub online_milli: i64,
    pub other_milli: i64,
    pub total_milli: i64,
    pub note: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DailySaleInput {
    #[serde(default)]
    pub id: Option<i64>,
    pub sale_date: String,
    pub cash_milli: i64,
    pub card_milli: i64,
    pub online_milli: i64,
    pub other_milli: i64,
    pub note: Option<String>,
}

// ---------- reports ----------

#[derive(Serialize, Debug, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SalesByMethod {
    pub cash: i64,
    pub card: i64,
    pub online: i64,
    pub other: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTotal {
    pub category_name: String,
    pub total_milli: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DaySales {
    pub day: String,
    pub pos_milli: i64,
    pub manual_milli: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProductProfit {
    pub product_id: i64,
    pub name: String,
    pub qty: i64,
    pub revenue_milli: i64,
    pub cogs_milli: i64,
    pub gross_milli: i64,
    pub overhead_milli: i64,
    pub after_overhead_milli: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PeriodReport {
    pub pos_sales_milli: i64,
    pub manual_sales_milli: i64,
    pub sales_milli: i64,
    pub sales_by_method: SalesByMethod,
    pub operating_expenses_milli: i64,
    pub diesel_purchases_milli: i64,
    pub ingredient_purchases_milli: i64,
    pub wages_milli: i64,
    pub total_costs_milli: i64,
    pub net_profit_milli: i64,
    pub profit_margin: f64,
    pub avg_daily_sales_milli: i64,
    pub production_ingredient_cost_milli: i64,
    pub units_produced: i64,
    pub diesel_liters_used: f64,
    pub diesel_cost_used_milli: i64,
    pub diesel_cost_per_item_milli: i64,
    pub stock_written_off_milli: i64,
    pub baker_pay_earned_milli: i64,
    pub expenses_by_category: Vec<CategoryTotal>,
    pub sales_by_day: Vec<DaySales>,
    pub product_profit: Vec<ProductProfit>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MonthRow {
    pub month: u32,
    pub sales_milli: i64,
    pub operating_expenses_milli: i64,
    pub ingredient_purchases_milli: i64,
    pub diesel_purchases_milli: i64,
    pub wages_milli: i64,
    pub total_costs_milli: i64,
    pub net_profit_milli: i64,
    pub profit_margin: f64,
    pub production_ingredient_cost_milli: i64,
    pub diesel_liters_used: f64,
    pub diesel_cost_used_milli: i64,
    pub stock_written_off_milli: i64,
    pub baker_pay_earned_milli: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ShoppingItem {
    pub name: String,
    pub stock_qty: f64,
    pub reorder_qty: f64,
    pub unit: String,
    pub status: String,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LowStockProduct {
    pub id: i64,
    pub name: String,
    pub stock_qty: i64,
    pub low_stock_qty: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub stock_value_milli: i64,
    pub reorder_count: i64,
    pub out_count: i64,
    pub shopping_list: Vec<ShoppingItem>,
    pub low_stock_products: Vec<LowStockProduct>,
    pub owed_to_suppliers_milli: i64,
    pub unpaid_invoices: i64,
    pub products_without_recipe: i64,
    pub diesel_in_tank_l: f64,
    pub tank_level: f64,
    pub days_of_diesel_left: Option<f64>,
    pub owed_to_staff_milli: i64,
}
