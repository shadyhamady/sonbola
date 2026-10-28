CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE ingredients (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL CHECK(unit IN ('kg','g','l','ml','pcs','pack','tray')),
  default_cost_milli INTEGER NOT NULL DEFAULT 0,
  opening_qty REAL NOT NULL DEFAULT 0,
  reorder_qty REAL NOT NULL DEFAULT 0,
  stock_qty REAL NOT NULL DEFAULT 0,
  avg_cost_milli REAL NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE product_categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category_id INTEGER NOT NULL REFERENCES product_categories(id),
  price_milli INTEGER NOT NULL DEFAULT 0 CHECK(price_milli>=0),
  batch_yield INTEGER NOT NULL DEFAULT 1 CHECK(batch_yield>=1),
  stock_qty INTEGER NOT NULL DEFAULT 0,
  avg_cost_milli REAL NOT NULL DEFAULT 0,
  low_stock_qty INTEGER NOT NULL DEFAULT 0,
  pay_mode TEXT NOT NULL DEFAULT 'none' CHECK(pay_mode IN ('none','per_unit','per_kg','per_batch')),
  pay_rate_milli INTEGER NOT NULL DEFAULT 0,
  pay_basis_ingredient_id INTEGER REFERENCES ingredients(id),
  overhead_per_batch_milli INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE recipe_items (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty REAL NOT NULL CHECK(qty>0),
  PRIMARY KEY(product_id, ingredient_id)
);

CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  contact_person TEXT,
  phone TEXT,
  supplies TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE shifts (
  id INTEGER PRIMARY KEY,
  opened_at INTEGER NOT NULL,
  opening_cash_milli INTEGER NOT NULL,
  closed_at INTEGER,
  counted_cash_milli INTEGER,
  expected_cash_milli INTEGER,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE purchases (
  id INTEGER PRIMARY KEY,
  supplier_id INTEGER REFERENCES suppliers(id),
  invoice_no TEXT,
  purchased_at INTEGER NOT NULL,
  total_milli INTEGER NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE purchase_items (
  id INTEGER PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty REAL NOT NULL CHECK(qty>0),
  unit_cost_milli INTEGER NOT NULL CHECK(unit_cost_milli>=0),
  total_cost_milli INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE purchase_payments (
  id INTEGER PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  amount_milli INTEGER NOT NULL CHECK(amount_milli>0),
  method TEXT NOT NULL CHECK(method IN ('cash','card','bank_transfer','other')),
  paid_at INTEGER NOT NULL,
  paid_from_drawer INTEGER NOT NULL DEFAULT 0,
  shift_id INTEGER REFERENCES shifts(id),
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE staff (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  role TEXT,
  pay_type TEXT NOT NULL CHECK(pay_type IN ('monthly','weekly','daily','hourly','production')),
  rate_milli INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  start_date TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE staff_product_rates (
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  rate_milli INTEGER NOT NULL CHECK(rate_milli>0),
  PRIMARY KEY(staff_id, product_id)
);

CREATE TABLE productions (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  units INTEGER NOT NULL CHECK(units>0),
  batches REAL NOT NULL,
  ingredient_cost_milli INTEGER NOT NULL,
  labor_cost_milli INTEGER NOT NULL,
  overhead_milli INTEGER NOT NULL,
  cost_milli INTEGER NOT NULL,
  produced_at INTEGER NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE production_items (
  production_id INTEGER NOT NULL REFERENCES productions(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty REAL NOT NULL,
  cost_milli INTEGER NOT NULL
);

CREATE TABLE production_workers (
  production_id INTEGER NOT NULL REFERENCES productions(id),
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  basis_qty REAL NOT NULL,
  rate_milli INTEGER NOT NULL,
  amount_milli INTEGER NOT NULL,
  PRIMARY KEY(production_id, staff_id)
);

CREATE TABLE payroll_payments (
  id INTEGER PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  paid_at INTEGER NOT NULL,
  period TEXT,
  base_milli INTEGER NOT NULL DEFAULT 0 CHECK(base_milli>=0),
  bonus_milli INTEGER NOT NULL DEFAULT 0 CHECK(bonus_milli>=0),
  deductions_milli INTEGER NOT NULL DEFAULT 0 CHECK(deductions_milli>=0),
  net_milli INTEGER NOT NULL CHECK(net_milli>0),
  method TEXT NOT NULL CHECK(method IN ('cash','card','bank_transfer','other')),
  paid_from_drawer INTEGER NOT NULL DEFAULT 0,
  shift_id INTEGER REFERENCES shifts(id),
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE expense_categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  description TEXT,
  amount_milli INTEGER NOT NULL CHECK(amount_milli>0),
  method TEXT NOT NULL CHECK(method IN ('cash','card','bank_transfer','other')),
  spent_at INTEGER NOT NULL,
  paid_from_drawer INTEGER NOT NULL DEFAULT 0,
  shift_id INTEGER REFERENCES shifts(id),
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE stock_adjustments (
  id INTEGER PRIMARY KEY,
  item_type TEXT NOT NULL CHECK(item_type IN ('ingredient','product')),
  item_id INTEGER NOT NULL,
  qty_delta REAL NOT NULL CHECK(qty_delta<>0),
  value_milli INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN ('waste','count','returned','outside_use','other')),
  adjusted_at INTEGER NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE diesel_logs (
  id INTEGER PRIMARY KEY,
  log_date TEXT NOT NULL UNIQUE,
  tank_reading_l REAL,
  manual_liters REAL,
  liters_used REAL NOT NULL,
  cost_milli INTEGER NOT NULL,
  oven_hours REAL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE daily_sales (
  id INTEGER PRIMARY KEY,
  sale_date TEXT NOT NULL UNIQUE,
  cash_milli INTEGER NOT NULL DEFAULT 0 CHECK(cash_milli>=0),
  card_milli INTEGER NOT NULL DEFAULT 0 CHECK(card_milli>=0),
  online_milli INTEGER NOT NULL DEFAULT 0 CHECK(online_milli>=0),
  other_milli INTEGER NOT NULL DEFAULT 0 CHECK(other_milli>=0),
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE sales (
  id INTEGER PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shifts(id),
  total_milli INTEGER NOT NULL,
  cost_milli INTEGER NOT NULL,
  voided_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK(qty>0),
  unit_price_milli INTEGER NOT NULL,
  unit_cost_milli INTEGER NOT NULL,
  unit_overhead_milli INTEGER NOT NULL,
  line_total_milli INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_purchases_purchased_at ON purchases(purchased_at);
CREATE INDEX idx_purchase_payments_paid_at ON purchase_payments(paid_at);
CREATE INDEX idx_productions_produced_at ON productions(produced_at);
CREATE INDEX idx_payroll_payments_paid_at ON payroll_payments(paid_at);
CREATE INDEX idx_expenses_spent_at ON expenses(spent_at);
CREATE INDEX idx_stock_adjustments_adjusted_at ON stock_adjustments(adjusted_at);
CREATE INDEX idx_shifts_opened_at ON shifts(opened_at);
CREATE INDEX idx_shifts_closed_at ON shifts(closed_at);
CREATE INDEX idx_sales_voided_at ON sales(voided_at);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sales_shift_id ON sales(shift_id);
CREATE INDEX idx_purchase_items_ingredient_id ON purchase_items(ingredient_id);
CREATE INDEX idx_production_workers_staff_id ON production_workers(staff_id);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);

-- Seeds (mirror the workbook's starter lists)
INSERT INTO product_categories (name, sort_order, created_at) VALUES
  ('خبز', 1, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('معجنات', 2, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('كيك', 3, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('حلويات', 4, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('مشروبات', 5, CAST(strftime('%s','now') AS INTEGER)*1000);

INSERT INTO expense_categories (name, sort_order, created_at) VALUES
  ('إيجار', 1, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('كهرباء', 2, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('ماء', 3, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('وقود السيارات', 4, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('تغليف', 5, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('مواد تنظيف', 6, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('صيانة وإصلاحات', 7, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('معدات', 8, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('تسويق', 9, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('نقل وتوصيل', 10, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('رسوم بنكية وبطاقات', 11, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('رخص ورسوم حكومية', 12, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('إنترنت واتصالات', 13, CAST(strftime('%s','now') AS INTEGER)*1000),
  ('أخرى', 14, CAST(strftime('%s','now') AS INTEGER)*1000);

INSERT INTO ingredients (name, unit, created_at) VALUES
  ('دقيق', 'kg', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('سميد', 'kg', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('سكر', 'kg', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('زبدة', 'kg', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('سمن', 'kg', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('خميرة', 'kg', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('بيكنج باودر', 'kg', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('ملح', 'kg', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('سمسم', 'kg', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('فستق حلبي', 'kg', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('محلب', 'kg', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('رقائق شوكولاتة', 'kg', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('زيت نباتي', 'l', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('حليب', 'l', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('ديزل', 'l', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('بيض', 'pcs', CAST(strftime('%s','now') AS INTEGER)*1000);

INSERT INTO products (name, category_id, created_at)
  SELECT 'كرواسون', id, CAST(strftime('%s','now') AS INTEGER)*1000 FROM product_categories WHERE name = 'معجنات';
INSERT INTO products (name, category_id, created_at)
  SELECT 'صمون', id, CAST(strftime('%s','now') AS INTEGER)*1000 FROM product_categories WHERE name = 'خبز';
INSERT INTO products (name, category_id, created_at)
  SELECT 'كوكيز', id, CAST(strftime('%s','now') AS INTEGER)*1000 FROM product_categories WHERE name = 'حلويات';
INSERT INTO products (name, category_id, created_at)
  SELECT 'كعك', id, CAST(strftime('%s','now') AS INTEGER)*1000 FROM product_categories WHERE name = 'معجنات';
INSERT INTO products (name, category_id, created_at)
  SELECT 'برازق', id, CAST(strftime('%s','now') AS INTEGER)*1000 FROM product_categories WHERE name = 'حلويات';

INSERT INTO staff (name, role, pay_type, created_at) VALUES
  ('رئيس الخبازين', 'خباز رئيسي', 'production', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('كاشير', 'كاشير', 'monthly', CAST(strftime('%s','now') AS INTEGER)*1000),
  ('عامل نظافة', 'نظافة', 'monthly', CAST(strftime('%s','now') AS INTEGER)*1000);

INSERT INTO settings (key, value) SELECT 'diesel_ingredient_id', CAST(id AS TEXT) FROM ingredients WHERE name = 'ديزل';
INSERT INTO settings (key, value) SELECT 'default_baker_id', CAST(id AS TEXT) FROM staff WHERE name = 'رئيس الخبازين';
INSERT INTO settings (key, value) VALUES ('tank_capacity_l', '1000');
