//! One Tauri command per public service function; each locks the connection and delegates.

use tauri::State;

use crate::AppState;
use crate::error::AppResult;
use crate::models::*;
use crate::services::{catalog, diesel, expenses, inventory, production, purchases, reports, sales, settings, shifts, staff, suppliers};

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> AppResult<Settings> {
    settings::get_settings(&state.0.lock().unwrap())
}

#[tauri::command]
pub fn save_settings(state: State<AppState>, input: SettingsInput) -> AppResult<Settings> {
    settings::save_settings(&mut state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn list_ingredients(state: State<AppState>, include_archived: bool) -> AppResult<Vec<Ingredient>> {
    catalog::list_ingredients(&state.0.lock().unwrap(), include_archived)
}

#[tauri::command]
pub fn create_ingredient(state: State<AppState>, input: NewIngredient) -> AppResult<i64> {
    catalog::create_ingredient(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn update_ingredient(state: State<AppState>, input: UpdateIngredient) -> AppResult<()> {
    catalog::update_ingredient(&mut state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn set_ingredient_archived(state: State<AppState>, id: i64, archived: bool) -> AppResult<()> {
    catalog::set_ingredient_archived(&state.0.lock().unwrap(), id, archived)
}

#[tauri::command]
pub fn list_product_categories(state: State<AppState>) -> AppResult<Vec<Category>> {
    catalog::list_product_categories(&state.0.lock().unwrap())
}

#[tauri::command]
pub fn create_product_category(state: State<AppState>, input: NewCategory) -> AppResult<i64> {
    catalog::create_product_category(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn rename_product_category(state: State<AppState>, input: RenameCategory) -> AppResult<()> {
    catalog::rename_product_category(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn delete_product_category(state: State<AppState>, id: i64) -> AppResult<()> {
    catalog::delete_product_category(&state.0.lock().unwrap(), id)
}

#[tauri::command]
pub fn list_products(state: State<AppState>, include_archived: bool) -> AppResult<Vec<Product>> {
    catalog::list_products(&state.0.lock().unwrap(), include_archived)
}

#[tauri::command]
pub fn get_recipe(state: State<AppState>, product_id: i64) -> AppResult<Vec<RecipeLine>> {
    catalog::get_recipe(&state.0.lock().unwrap(), product_id)
}

#[tauri::command]
pub fn save_product(state: State<AppState>, input: ProductInput) -> AppResult<i64> {
    catalog::save_product(&mut state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn set_product_archived(state: State<AppState>, id: i64, archived: bool) -> AppResult<()> {
    catalog::set_product_archived(&state.0.lock().unwrap(), id, archived)
}

#[tauri::command]
pub fn list_suppliers(state: State<AppState>, include_archived: bool) -> AppResult<Vec<Supplier>> {
    suppliers::list_suppliers(&state.0.lock().unwrap(), include_archived)
}

#[tauri::command]
pub fn create_supplier(state: State<AppState>, input: SupplierInput) -> AppResult<i64> {
    suppliers::create_supplier(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn update_supplier(state: State<AppState>, input: SupplierInput) -> AppResult<()> {
    suppliers::update_supplier(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn set_supplier_archived(state: State<AppState>, id: i64, archived: bool) -> AppResult<()> {
    suppliers::set_supplier_archived(&state.0.lock().unwrap(), id, archived)
}

#[tauri::command]
pub fn create_purchase(state: State<AppState>, input: NewPurchase) -> AppResult<i64> {
    purchases::create_purchase(&mut state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn list_purchases(state: State<AppState>, range: Range, supplier_id: Option<i64>) -> AppResult<Vec<Purchase>> {
    purchases::list_purchases(&state.0.lock().unwrap(), range, supplier_id)
}

#[tauri::command]
pub fn add_purchase_payment(state: State<AppState>, input: PurchasePaymentInput) -> AppResult<i64> {
    purchases::add_purchase_payment(&mut state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn delete_purchase_payment(state: State<AppState>, id: i64) -> AppResult<()> {
    purchases::delete_purchase_payment(&state.0.lock().unwrap(), id)
}

#[tauri::command]
pub fn delete_purchase(state: State<AppState>, id: i64) -> AppResult<()> {
    purchases::delete_purchase(&mut state.0.lock().unwrap(), id)
}

#[tauri::command]
pub fn create_stock_adjustment(state: State<AppState>, input: StockAdjustmentInput) -> AppResult<i64> {
    inventory::create_stock_adjustment(&mut state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn list_stock_adjustments(state: State<AppState>, range: Range) -> AppResult<Vec<StockAdjustment>> {
    inventory::list_stock_adjustments(&state.0.lock().unwrap(), range)
}

#[tauri::command]
pub fn delete_stock_adjustment(state: State<AppState>, id: i64) -> AppResult<()> {
    inventory::delete_stock_adjustment(&mut state.0.lock().unwrap(), id)
}

#[tauri::command]
pub fn preview_production(state: State<AppState>, input: ProductionInput) -> AppResult<ProductionPreview> {
    production::preview_production(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn record_production(state: State<AppState>, input: RecordProductionInput) -> AppResult<i64> {
    production::record_production(&mut state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn list_productions(state: State<AppState>, range: Range) -> AppResult<Vec<ProductionRow>> {
    production::list_productions(&state.0.lock().unwrap(), range)
}

#[tauri::command]
pub fn list_staff(state: State<AppState>, include_archived: bool) -> AppResult<Vec<Staff>> {
    staff::list_staff(&state.0.lock().unwrap(), include_archived)
}

#[tauri::command]
pub fn create_staff(state: State<AppState>, input: StaffInput) -> AppResult<i64> {
    staff::create_staff(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn update_staff(state: State<AppState>, input: StaffInput) -> AppResult<()> {
    staff::update_staff(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn set_staff_archived(state: State<AppState>, id: i64, archived: bool) -> AppResult<()> {
    staff::set_staff_archived(&state.0.lock().unwrap(), id, archived)
}

#[tauri::command]
pub fn list_staff_rates(state: State<AppState>, staff_id: i64) -> AppResult<Vec<StaffRate>> {
    staff::list_staff_rates(&state.0.lock().unwrap(), staff_id)
}

#[tauri::command]
pub fn set_staff_rate(state: State<AppState>, input: SetStaffRateInput) -> AppResult<()> {
    staff::set_staff_rate(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn create_payroll_payment(state: State<AppState>, input: PayrollInput) -> AppResult<i64> {
    staff::create_payroll_payment(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn delete_payroll_payment(state: State<AppState>, id: i64) -> AppResult<()> {
    staff::delete_payroll_payment(&state.0.lock().unwrap(), id)
}

#[tauri::command]
pub fn list_payroll_payments(state: State<AppState>, input: PayrollFilter) -> AppResult<Vec<PayrollPayment>> {
    staff::list_payroll_payments(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn staff_statement(state: State<AppState>, input: StatementInput) -> AppResult<StaffStatement> {
    staff::staff_statement(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn list_expense_categories(state: State<AppState>) -> AppResult<Vec<Category>> {
    expenses::list_expense_categories(&state.0.lock().unwrap())
}

#[tauri::command]
pub fn create_expense_category(state: State<AppState>, input: NewCategory) -> AppResult<i64> {
    expenses::create_expense_category(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn rename_expense_category(state: State<AppState>, input: RenameCategory) -> AppResult<()> {
    expenses::rename_expense_category(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn delete_expense_category(state: State<AppState>, id: i64) -> AppResult<()> {
    expenses::delete_expense_category(&state.0.lock().unwrap(), id)
}

#[tauri::command]
pub fn list_expenses(state: State<AppState>, range: Range, category_id: Option<i64>) -> AppResult<Vec<Expense>> {
    expenses::list_expenses(&state.0.lock().unwrap(), range, category_id)
}

#[tauri::command]
pub fn create_expense(state: State<AppState>, input: NewExpense) -> AppResult<i64> {
    expenses::create_expense(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn update_expense(state: State<AppState>, input: UpdateExpense) -> AppResult<()> {
    expenses::update_expense(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn delete_expense(state: State<AppState>, id: i64) -> AppResult<()> {
    expenses::delete_expense(&state.0.lock().unwrap(), id)
}

#[tauri::command]
pub fn create_diesel_log(state: State<AppState>, input: DieselLogInput) -> AppResult<i64> {
    diesel::create_diesel_log(&mut state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn list_diesel_logs(state: State<AppState>, range: Range) -> AppResult<Vec<DieselLog>> {
    diesel::list_diesel_logs(&state.0.lock().unwrap(), range)
}

#[tauri::command]
pub fn delete_diesel_log(state: State<AppState>, id: i64) -> AppResult<()> {
    diesel::delete_diesel_log(&mut state.0.lock().unwrap(), id)
}

#[tauri::command]
pub fn get_open_shift(state: State<AppState>) -> AppResult<Option<Shift>> {
    shifts::get_open_shift(&state.0.lock().unwrap())
}

#[tauri::command]
pub fn open_shift(state: State<AppState>, input: OpenShiftInput) -> AppResult<Shift> {
    shifts::open_shift(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn shift_summary(state: State<AppState>, id: i64) -> AppResult<ShiftSummary> {
    shifts::shift_summary(&state.0.lock().unwrap(), id)
}

#[tauri::command]
pub fn close_shift(state: State<AppState>, input: CloseShiftInput) -> AppResult<ShiftSummary> {
    shifts::close_shift(&mut state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn list_shifts(state: State<AppState>, range: Range) -> AppResult<Vec<ShiftSummary>> {
    shifts::list_shifts(&state.0.lock().unwrap(), range)
}

#[tauri::command]
pub fn create_sale(state: State<AppState>, input: SaleInput) -> AppResult<Sale> {
    sales::create_sale(&mut state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn void_sale(state: State<AppState>, id: i64) -> AppResult<()> {
    sales::void_sale(&mut state.0.lock().unwrap(), id)
}

#[tauri::command]
pub fn list_sales(state: State<AppState>, range: Range) -> AppResult<Vec<Sale>> {
    sales::list_sales(&state.0.lock().unwrap(), range)
}

#[tauri::command]
pub fn create_daily_sale(state: State<AppState>, input: DailySaleInput) -> AppResult<i64> {
    sales::create_daily_sale(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn update_daily_sale(state: State<AppState>, input: DailySaleInput) -> AppResult<()> {
    sales::update_daily_sale(&state.0.lock().unwrap(), input)
}

#[tauri::command]
pub fn delete_daily_sale(state: State<AppState>, id: i64) -> AppResult<()> {
    sales::delete_daily_sale(&state.0.lock().unwrap(), id)
}

#[tauri::command]
pub fn list_daily_sales(state: State<AppState>, range: Range) -> AppResult<Vec<DailySale>> {
    sales::list_daily_sales(&state.0.lock().unwrap(), range)
}

#[tauri::command]
pub fn period_report(state: State<AppState>, range: Range) -> AppResult<PeriodReport> {
    reports::period_report(&state.0.lock().unwrap(), range)
}

#[tauri::command]
pub fn monthly_summary(state: State<AppState>, year: i32) -> AppResult<Vec<MonthRow>> {
    reports::monthly_summary(&state.0.lock().unwrap(), year)
}

#[tauri::command]
pub fn dashboard_snapshot(state: State<AppState>) -> AppResult<Snapshot> {
    reports::dashboard_snapshot(&state.0.lock().unwrap())
}
