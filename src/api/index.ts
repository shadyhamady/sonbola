// One function per Tauri command (src-tauri/src/commands.rs).
import { invoke } from '@tauri-apps/api/core';
import type {
  Category,
  CloseShiftInput,
  DailySale,
  DailySaleInput,
  DieselLog,
  DieselLogInput,
  Expense,
  Ingredient,
  MonthRow,
  NewCategory,
  NewExpense,
  NewIngredient,
  NewPurchase,
  OpenShiftInput,
  PayrollFilter,
  PayrollInput,
  PayrollPayment,
  PeriodReport,
  Product,
  ProductInput,
  ProductionInput,
  ProductionPreview,
  ProductionRow,
  Purchase,
  PurchasePaymentInput,
  Range,
  RecipeLine,
  RecordProductionInput,
  RenameCategory,
  Sale,
  SaleInput,
  SetStaffRateInput,
  Settings,
  SettingsInput,
  Shift,
  ShiftSummary,
  Snapshot,
  Staff,
  StaffInput,
  StaffRate,
  StaffStatement,
  StatementInput,
  StockAdjustment,
  StockAdjustmentInput,
  Supplier,
  SupplierInput,
  UpdateExpense,
  UpdateIngredient,
} from './types';

export const getSettings = () => invoke<Settings>('get_settings');
export const saveSettings = (input: SettingsInput) => invoke<Settings>('save_settings', { input });
export const loadDemoData = () => invoke<void>('load_demo_data');
export const clearDemoData = () => invoke<void>('clear_demo_data');
export const exportBackup = (path: string) => invoke<void>('export_backup', { path });
export const importBackup = (path: string) => invoke<void>('import_backup', { path });
export const listIngredients = (includeArchived: boolean) => invoke<Ingredient[]>('list_ingredients', { includeArchived });
export const createIngredient = (input: NewIngredient) => invoke<number>('create_ingredient', { input });
export const updateIngredient = (input: UpdateIngredient) => invoke<void>('update_ingredient', { input });
export const setIngredientArchived = (id: number, archived: boolean) => invoke<void>('set_ingredient_archived', { id, archived });
export const listProductCategories = () => invoke<Category[]>('list_product_categories');
export const createProductCategory = (input: NewCategory) => invoke<number>('create_product_category', { input });
export const renameProductCategory = (input: RenameCategory) => invoke<void>('rename_product_category', { input });
export const deleteProductCategory = (id: number) => invoke<void>('delete_product_category', { id });
export const listProducts = (includeArchived: boolean) => invoke<Product[]>('list_products', { includeArchived });
export const getRecipe = (productId: number) => invoke<RecipeLine[]>('get_recipe', { productId });
export const saveProduct = (input: ProductInput) => invoke<number>('save_product', { input });
export const setProductArchived = (id: number, archived: boolean) => invoke<void>('set_product_archived', { id, archived });
export const listSuppliers = (includeArchived: boolean) => invoke<Supplier[]>('list_suppliers', { includeArchived });
export const createSupplier = (input: SupplierInput) => invoke<number>('create_supplier', { input });
export const updateSupplier = (input: SupplierInput) => invoke<void>('update_supplier', { input });
export const setSupplierArchived = (id: number, archived: boolean) => invoke<void>('set_supplier_archived', { id, archived });
export const createPurchase = (input: NewPurchase) => invoke<number>('create_purchase', { input });
export const listPurchases = (range: Range, supplierId: number | null) => invoke<Purchase[]>('list_purchases', { range, supplierId });
export const addPurchasePayment = (input: PurchasePaymentInput) => invoke<number>('add_purchase_payment', { input });
export const deletePurchasePayment = (id: number) => invoke<void>('delete_purchase_payment', { id });
export const deletePurchase = (id: number) => invoke<void>('delete_purchase', { id });
export const createStockAdjustment = (input: StockAdjustmentInput) => invoke<number>('create_stock_adjustment', { input });
export const listStockAdjustments = (range: Range) => invoke<StockAdjustment[]>('list_stock_adjustments', { range });
export const deleteStockAdjustment = (id: number) => invoke<void>('delete_stock_adjustment', { id });
export const previewProduction = (input: ProductionInput) => invoke<ProductionPreview>('preview_production', { input });
export const recordProduction = (input: RecordProductionInput) => invoke<number>('record_production', { input });
export const listProductions = (range: Range) => invoke<ProductionRow[]>('list_productions', { range });
export const listStaff = (includeArchived: boolean) => invoke<Staff[]>('list_staff', { includeArchived });
export const createStaff = (input: StaffInput) => invoke<number>('create_staff', { input });
export const updateStaff = (input: StaffInput) => invoke<void>('update_staff', { input });
export const setStaffArchived = (id: number, archived: boolean) => invoke<void>('set_staff_archived', { id, archived });
export const listStaffRates = (staffId: number) => invoke<StaffRate[]>('list_staff_rates', { staffId });
export const setStaffRate = (input: SetStaffRateInput) => invoke<void>('set_staff_rate', { input });
export const createPayrollPayment = (input: PayrollInput) => invoke<number>('create_payroll_payment', { input });
export const deletePayrollPayment = (id: number) => invoke<void>('delete_payroll_payment', { id });
export const listPayrollPayments = (input: PayrollFilter) => invoke<PayrollPayment[]>('list_payroll_payments', { input });
export const staffStatement = (input: StatementInput) => invoke<StaffStatement>('staff_statement', { input });
export const listExpenseCategories = () => invoke<Category[]>('list_expense_categories');
export const createExpenseCategory = (input: NewCategory) => invoke<number>('create_expense_category', { input });
export const renameExpenseCategory = (input: RenameCategory) => invoke<void>('rename_expense_category', { input });
export const deleteExpenseCategory = (id: number) => invoke<void>('delete_expense_category', { id });
export const listExpenses = (range: Range, categoryId: number | null) => invoke<Expense[]>('list_expenses', { range, categoryId });
export const createExpense = (input: NewExpense) => invoke<number>('create_expense', { input });
export const updateExpense = (input: UpdateExpense) => invoke<void>('update_expense', { input });
export const deleteExpense = (id: number) => invoke<void>('delete_expense', { id });
export const createDieselLog = (input: DieselLogInput) => invoke<number>('create_diesel_log', { input });
export const listDieselLogs = (range: Range) => invoke<DieselLog[]>('list_diesel_logs', { range });
export const deleteDieselLog = (id: number) => invoke<void>('delete_diesel_log', { id });
export const getOpenShift = () => invoke<Shift | null>('get_open_shift');
export const openShift = (input: OpenShiftInput) => invoke<Shift>('open_shift', { input });
export const shiftSummary = (id: number) => invoke<ShiftSummary>('shift_summary', { id });
export const closeShift = (input: CloseShiftInput) => invoke<ShiftSummary>('close_shift', { input });
export const listShifts = (range: Range) => invoke<ShiftSummary[]>('list_shifts', { range });
export const createSale = (input: SaleInput) => invoke<Sale>('create_sale', { input });
export const voidSale = (id: number) => invoke<void>('void_sale', { id });
export const listSales = (range: Range) => invoke<Sale[]>('list_sales', { range });
export const createDailySale = (input: DailySaleInput) => invoke<number>('create_daily_sale', { input });
export const updateDailySale = (input: DailySaleInput) => invoke<void>('update_daily_sale', { input });
export const deleteDailySale = (id: number) => invoke<void>('delete_daily_sale', { id });
export const listDailySales = (range: Range) => invoke<DailySale[]>('list_daily_sales', { range });
export const periodReport = (range: Range) => invoke<PeriodReport>('period_report', { range });
export const monthlySummary = (year: number) => invoke<MonthRow[]>('monthly_summary', { year });
export const dashboardSnapshot = () => invoke<Snapshot>('dashboard_snapshot');
