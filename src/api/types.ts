// Mirrors src-tauri/src/models.rs (serde camelCase). Money fields ending in `Milli` are thousandths.

export type Unit = 'kg' | 'g' | 'l' | 'ml' | 'pcs' | 'pack' | 'tray';
export type Method = 'cash' | 'card' | 'bank_transfer' | 'other';
export type PayMode = 'none' | 'per_unit' | 'per_kg' | 'per_batch';
export type PayType = 'monthly' | 'weekly' | 'daily' | 'hourly' | 'production';
export type StockStatus = 'out' | 'reorder' | 'ok';
export type PurchaseStatus = 'paid' | 'partial' | 'unpaid';
export type AdjReason = 'waste' | 'count' | 'returned' | 'outside_use' | 'other';
export type ItemType = 'ingredient' | 'product';

export interface Range {
  from: number;
  to: number;
}

// ---------- settings ----------
export interface Settings {
  bakeryName: string;
  currencySymbol: string;
  currencyDecimals: number;
  dieselIngredientId: number | null;
  tankCapacityL: number;
  defaultBakerId: number | null;
  isConfigured: boolean;
  /** Demo data loaded at onboarding is still present. */
  isDemo: boolean;
}

export interface SettingsInput {
  bakeryName: string;
  currencySymbol: string;
  currencyDecimals: number;
  dieselIngredientId: number | null;
  tankCapacityL: number;
  defaultBakerId: number | null;
}

// ---------- catalog ----------
export interface Ingredient {
  id: number;
  name: string;
  unit: Unit;
  defaultCostMilli: number;
  openingQty: number;
  reorderQty: number;
  stockQty: number;
  avgCostMilli: number;
  stockValueMilli: number;
  status: StockStatus;
  archived: boolean;
}

export interface NewIngredient {
  name: string;
  unit: Unit;
  defaultCostMilli: number;
  openingQty: number;
  reorderQty: number;
}

export interface UpdateIngredient {
  id: number;
  name: string;
  defaultCostMilli: number;
  openingQty: number;
  reorderQty: number;
}

export interface Category {
  id: number;
  name: string;
  sortOrder: number;
}

export interface Product {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  priceMilli: number;
  batchYield: number;
  stockQty: number;
  avgCostMilli: number;
  lowStockQty: number;
  archived: boolean;
  payMode: PayMode;
  payRateMilli: number;
  payBasisIngredientId: number | null;
  overheadPerBatchMilli: number;
  ingredientCostPerUnitMilli: number;
  laborCostPerUnitMilli: number;
  overheadPerUnitMilli: number;
  directUnitCostMilli: number;
  fullUnitCostMilli: number;
  recipeLineCount: number;
  producedUnits: number;
}

export interface RecipeLine {
  ingredientId: number;
  ingredientName: string;
  unit: Unit;
  qty: number;
}

export interface RecipeInput {
  ingredientId: number;
  qty: number;
}

export interface ProductInput {
  id: number | null;
  name: string;
  categoryId: number;
  priceMilli: number;
  batchYield: number;
  lowStockQty: number;
  payMode: PayMode;
  payRateMilli: number;
  payBasisIngredientId: number | null;
  overheadPerBatchMilli: number;
  recipe: RecipeInput[];
}

// ---------- suppliers & purchases ----------
export interface Supplier {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  supplies: string | null;
  archived: boolean;
  totalPurchasedMilli: number;
  totalPaidMilli: number;
  balanceMilli: number;
  unpaidInvoices: number;
}

export interface SupplierInput {
  id?: number | null;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  supplies: string | null;
}

export interface PurchaseItemInput {
  ingredientId: number;
  qty: number;
  unitCostMilli: number;
}

export interface NewPurchase {
  supplierId: number | null;
  invoiceNo: string | null;
  purchasedAt: number;
  note: string | null;
  items: PurchaseItemInput[];
  paidNowMilli: number;
  method: Method;
  paidFromDrawer: boolean;
}

export interface PurchaseItem {
  id: number;
  ingredientId: number;
  ingredientName: string;
  unit: Unit;
  qty: number;
  unitCostMilli: number;
  totalCostMilli: number;
}

export interface PurchasePayment {
  id: number;
  purchaseId: number;
  amountMilli: number;
  method: Method;
  paidAt: number;
  paidFromDrawer: boolean;
  shiftId: number | null;
  /** Tied to a closed shift: cannot be edited or deleted. */
  locked: boolean;
  note: string | null;
}

export interface Purchase {
  id: number;
  supplierId: number | null;
  supplierName: string | null;
  invoiceNo: string | null;
  purchasedAt: number;
  totalMilli: number;
  paidMilli: number;
  balanceMilli: number;
  status: PurchaseStatus;
  note: string | null;
  items: PurchaseItem[];
  payments: PurchasePayment[];
}

export interface PurchasePaymentInput {
  purchaseId: number;
  amountMilli: number;
  method: Method;
  paidAt: number;
  paidFromDrawer: boolean;
  note: string | null;
}

// ---------- inventory ----------
export interface StockAdjustmentInput {
  itemType: ItemType;
  itemId: number;
  qtyDelta: number;
  reason: AdjReason;
  adjustedAt: number;
  note: string | null;
}

export interface StockAdjustment {
  id: number;
  itemType: ItemType;
  itemId: number;
  itemName: string;
  unit: Unit;
  qtyDelta: number;
  valueMilli: number;
  reason: AdjReason;
  adjustedAt: number;
  note: string | null;
}

// ---------- production ----------
export interface ProductionInput {
  productId: number;
  units: number;
  staffIds: number[];
}

export interface RecordProductionInput extends ProductionInput {
  producedAt: number;
  note: string | null;
}

export interface PreviewIngredient {
  ingredientId: number;
  name: string;
  unit: Unit;
  requiredQty: number;
  stockQty: number;
  costMilli: number;
}

export interface PreviewWorker {
  staffId: number;
  name: string;
  basisQty: number;
  rateMilli: number;
  amountMilli: number;
}

export interface ProductionPreview {
  payMode: PayMode;
  batches: number;
  ingredients: PreviewIngredient[];
  workers: PreviewWorker[];
  ingredientCostMilli: number;
  laborCostMilli: number;
  overheadMilli: number;
  totalCostMilli: number;
  unitCostMilli: number;
  usedDefaultBaker: boolean;
}

export interface ProductionRow {
  id: number;
  producedAt: number;
  productName: string;
  units: number;
  ingredientCostMilli: number;
  laborCostMilli: number;
  overheadMilli: number;
  workerNames: string[];
  note: string | null;
}

// ---------- staff ----------
export interface Staff {
  id: number;
  name: string;
  role: string | null;
  payType: PayType;
  rateMilli: number;
  phone: string | null;
  startDate: string | null;
  archived: boolean;
  paidMilli: number;
  earnedMilli: number;
  /** earned − paid for production staff; null otherwise. Negative = advance. */
  owedMilli: number | null;
}

export interface StaffInput {
  id?: number | null;
  name: string;
  role: string | null;
  payType: PayType;
  rateMilli: number;
  phone: string | null;
  startDate: string | null;
}

export interface StaffRate {
  productId: number;
  productName: string;
  payMode: PayMode;
  defaultRateMilli: number;
  overrideRateMilli: number | null;
}

export interface SetStaffRateInput {
  staffId: number;
  productId: number;
  rateMilli: number | null;
}

export interface PayrollInput {
  staffId: number;
  paidAt: number;
  period: string | null;
  baseMilli: number;
  bonusMilli: number;
  deductionsMilli: number;
  method: Method;
  paidFromDrawer: boolean;
  note: string | null;
}

export interface PayrollPayment {
  id: number;
  staffId: number;
  staffName: string;
  paidAt: number;
  period: string | null;
  baseMilli: number;
  bonusMilli: number;
  deductionsMilli: number;
  netMilli: number;
  method: Method;
  paidFromDrawer: boolean;
  shiftId: number | null;
  locked: boolean;
  note: string | null;
}

export interface PayrollFilter {
  staffId: number | null;
  range: Range;
}

export interface StatementInput {
  staffId: number;
  range: Range;
}

export interface Earning {
  productionId: number;
  producedAt: number;
  productName: string;
  payMode: PayMode;
  basisQty: number;
  rateMilli: number;
  amountMilli: number;
}

export interface StaffStatement {
  earnings: Earning[];
  payments: PayrollPayment[];
  earnedMilli: number;
  paidMilli: number;
}

// ---------- expenses ----------
export interface Expense {
  id: number;
  categoryId: number;
  categoryName: string;
  description: string | null;
  amountMilli: number;
  method: Method;
  spentAt: number;
  paidFromDrawer: boolean;
  shiftId: number | null;
  locked: boolean;
  note: string | null;
}

export interface NewExpense {
  categoryId: number;
  description: string | null;
  amountMilli: number;
  method: Method;
  spentAt: number;
  paidFromDrawer: boolean;
  note: string | null;
}

export interface UpdateExpense {
  id: number;
  categoryId: number;
  description: string | null;
  amountMilli: number;
  method: Method;
  spentAt: number;
  note: string | null;
}

// ---------- diesel ----------
export interface DieselLogInput {
  /** YYYY-MM-DD local date */
  logDate: string;
  tankReadingL: number | null;
  manualLiters: number | null;
  ovenHours: number | null;
  note: string | null;
}

export interface DieselLog {
  id: number;
  logDate: string;
  tankReadingL: number | null;
  manualLiters: number | null;
  litersUsed: number;
  costMilli: number;
  ovenHours: number | null;
  litersPerHour: number | null;
  /** Only the latest log can be deleted. */
  isLatest: boolean;
  note: string | null;
}

// ---------- shifts ----------
export interface Shift {
  id: number;
  openedAt: number;
  openingCashMilli: number;
  closedAt: number | null;
  countedCashMilli: number | null;
  expectedCashMilli: number | null;
  note: string | null;
}

export interface ShiftSummary {
  shift: Shift;
  saleCount: number;
  salesTotalMilli: number;
  drawerPaymentsMilli: number;
  expectedCashMilli: number;
}

// ---------- sales ----------
export interface CartLine {
  productId: number;
  qty: number;
}

export interface SaleItem {
  id: number;
  productId: number;
  productName: string;
  qty: number;
  unitPriceMilli: number;
  unitCostMilli: number;
  unitOverheadMilli: number;
  lineTotalMilli: number;
}

export interface Sale {
  id: number;
  shiftId: number;
  totalMilli: number;
  costMilli: number;
  createdAt: number;
  voidedAt: number | null;
  items: SaleItem[];
}

export interface DailySale {
  id: number;
  saleDate: string;
  cashMilli: number;
  cardMilli: number;
  onlineMilli: number;
  otherMilli: number;
  totalMilli: number;
  note: string | null;
}

export interface DailySaleInput {
  id?: number | null;
  /** YYYY-MM-DD local date */
  saleDate: string;
  cashMilli: number;
  cardMilli: number;
  onlineMilli: number;
  otherMilli: number;
  note: string | null;
}

// ---------- reports ----------
export interface SalesByMethod {
  cash: number;
  card: number;
  online: number;
  other: number;
}

export interface CategoryTotal {
  categoryName: string;
  totalMilli: number;
}

export interface DaySales {
  /** YYYY-MM-DD local date */
  day: string;
  posMilli: number;
  manualMilli: number;
}

export interface ProductProfit {
  productId: number;
  name: string;
  qty: number;
  revenueMilli: number;
  cogsMilli: number;
  grossMilli: number;
  overheadMilli: number;
  afterOverheadMilli: number;
}

export interface PeriodReport {
  posSalesMilli: number;
  manualSalesMilli: number;
  salesMilli: number;
  salesByMethod: SalesByMethod;
  operatingExpensesMilli: number;
  dieselPurchasesMilli: number;
  ingredientPurchasesMilli: number;
  wagesMilli: number;
  totalCostsMilli: number;
  netProfitMilli: number;
  /** fraction, e.g. -0.25 */
  profitMargin: number;
  avgDailySalesMilli: number;
  productionIngredientCostMilli: number;
  unitsProduced: number;
  dieselLitersUsed: number;
  dieselCostUsedMilli: number;
  dieselCostPerItemMilli: number;
  stockWrittenOffMilli: number;
  bakerPayEarnedMilli: number;
  expensesByCategory: CategoryTotal[];
  salesByDay: DaySales[];
  productProfit: ProductProfit[];
}

export interface MonthRow {
  month: number;
  salesMilli: number;
  operatingExpensesMilli: number;
  ingredientPurchasesMilli: number;
  dieselPurchasesMilli: number;
  wagesMilli: number;
  totalCostsMilli: number;
  netProfitMilli: number;
  profitMargin: number;
  productionIngredientCostMilli: number;
  dieselLitersUsed: number;
  dieselCostUsedMilli: number;
  stockWrittenOffMilli: number;
  bakerPayEarnedMilli: number;
}

export interface ShoppingItem {
  name: string;
  stockQty: number;
  reorderQty: number;
  unit: Unit;
  status: StockStatus;
}

export interface LowStockProduct {
  id: number;
  name: string;
  stockQty: number;
  lowStockQty: number;
}

export interface Snapshot {
  stockValueMilli: number;
  reorderCount: number;
  outCount: number;
  shoppingList: ShoppingItem[];
  lowStockProducts: LowStockProduct[];
  owedToSuppliersMilli: number;
  unpaidInvoices: number;
  productsWithoutRecipe: number;
  dieselInTankL: number;
  /** 0–1 */
  tankLevel: number;
  daysOfDieselLeft: number | null;
  owedToStaffMilli: number;
}

// ---------- small command inputs ----------
export interface NewCategory {
  name: string;
}

export interface RenameCategory {
  id: number;
  name: string;
}

export interface OpenShiftInput {
  openingCashMilli: number;
}

export interface CloseShiftInput {
  countedCashMilli: number;
  note: string | null;
}

export interface SaleInput {
  items: CartLine[];
}
