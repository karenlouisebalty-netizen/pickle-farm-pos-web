-- ── DAILY INVENTORY COUNTS (beginning/ending of shift) ─────
-- One row per product per day per count_type. Re-submitting the same
-- product/date/type overwrites the previous entry (id is deterministic).
CREATE TABLE IF NOT EXISTS inventory_counts (
  id           TEXT PRIMARY KEY,
  branch_id    TEXT NOT NULL REFERENCES branches(id),
  product_id   TEXT NOT NULL REFERENCES products(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  count_date   TEXT NOT NULL,
  count_type   TEXT NOT NULL CHECK(count_type IN ('start','end')),
  quantity     INTEGER NOT NULL CHECK(quantity >= 0),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_counts_branch_date ON inventory_counts(branch_id, count_date);
CREATE INDEX IF NOT EXISTS idx_counts_product_date ON inventory_counts(product_id, count_date);

-- ── WASTE LOG ────────────────────────────────────────────────
-- Logging waste deducts stock automatically (via inventory_movements,
-- type 'adjustment') and creates a matching expense automatically
-- (expense_id links back here) so waste cost shows up in Expenses
-- and reports without a separate manual entry.
CREATE TABLE IF NOT EXISTS waste_log (
  id           TEXT PRIMARY KEY,
  branch_id    TEXT NOT NULL REFERENCES branches(id),
  product_id   TEXT NOT NULL REFERENCES products(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  quantity     INTEGER NOT NULL CHECK(quantity > 0),
  reason       TEXT NOT NULL CHECK(reason IN ('spoiled','expired','damaged','dropped','other')),
  notes        TEXT,
  unit_cost    REAL NOT NULL DEFAULT 0,
  total_cost   REAL NOT NULL DEFAULT 0,
  expense_id   TEXT REFERENCES expenses(id),
  waste_date   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_waste_branch_date  ON waste_log(branch_id, waste_date);
CREATE INDEX IF NOT EXISTS idx_waste_product_date ON waste_log(product_id, waste_date);
