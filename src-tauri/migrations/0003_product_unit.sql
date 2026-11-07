-- Unit each product is measured, stocked, priced and sold in (existing products stay in pieces).
-- products.batch_yield/stock_qty/low_stock_qty, productions.units and sale_items.qty are in this unit and are
-- fractional for weight/volume units; their INTEGER affinity stores non-integral values as REAL.
ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT 'pcs' CHECK(unit IN ('kg','g','l','ml','pcs','pack','tray'));
