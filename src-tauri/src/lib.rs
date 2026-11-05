pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod services;

use std::sync::Mutex;

use tauri::Manager;

pub struct AppState(pub Mutex<rusqlite::Connection>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let conn = db::open(&dir.join("sonbola.db"))?;
            app.manage(AppState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::list_ingredients,
            commands::create_ingredient,
            commands::update_ingredient,
            commands::set_ingredient_archived,
            commands::list_product_categories,
            commands::create_product_category,
            commands::rename_product_category,
            commands::delete_product_category,
            commands::list_products,
            commands::get_recipe,
            commands::save_product,
            commands::set_product_archived,
            commands::list_suppliers,
            commands::create_supplier,
            commands::update_supplier,
            commands::set_supplier_archived,
            commands::create_purchase,
            commands::list_purchases,
            commands::add_purchase_payment,
            commands::delete_purchase_payment,
            commands::delete_purchase,
            commands::create_stock_adjustment,
            commands::list_stock_adjustments,
            commands::delete_stock_adjustment,
            commands::preview_production,
            commands::record_production,
            commands::list_productions,
            commands::list_staff,
            commands::create_staff,
            commands::update_staff,
            commands::set_staff_archived,
            commands::list_staff_rates,
            commands::set_staff_rate,
            commands::create_payroll_payment,
            commands::delete_payroll_payment,
            commands::list_payroll_payments,
            commands::staff_statement,
            commands::list_expense_categories,
            commands::create_expense_category,
            commands::rename_expense_category,
            commands::delete_expense_category,
            commands::list_expenses,
            commands::create_expense,
            commands::update_expense,
            commands::delete_expense,
            commands::create_diesel_log,
            commands::list_diesel_logs,
            commands::delete_diesel_log,
            commands::get_open_shift,
            commands::open_shift,
            commands::shift_summary,
            commands::close_shift,
            commands::list_shifts,
            commands::create_sale,
            commands::void_sale,
            commands::list_sales,
            commands::create_daily_sale,
            commands::update_daily_sale,
            commands::delete_daily_sale,
            commands::list_daily_sales,
            commands::period_report,
            commands::monthly_summary,
            commands::dashboard_snapshot,
            commands::load_demo_data,
            commands::clear_demo_data,
            commands::export_backup,
            commands::import_backup,
            commands::set_pin,
            commands::verify_pin,
            commands::remove_pin,
            commands::reset_pin
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
