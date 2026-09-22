-- ── STARTING CASH / DRAWER FLOAT ──────────────────────────────
-- Staff usually start a shift with some cash already in the drawer (change fund), which
-- isn't part of that day's sales but IS part of what should physically be in the drawer by
-- end of day. One row per branch per day — whoever opens the register enters it, and it can
-- be corrected later the same day by re-saving (upsert on branch_id+drawer_date).
CREATE TABLE IF NOT EXISTS cash_drawer_starts (
  id           TEXT PRIMARY KEY,
  branch_id    TEXT NOT NULL REFERENCES branches(id),
  drawer_date  TEXT NOT NULL, -- YYYY-MM-DD
  amount       REAL NOT NULL DEFAULT 0,
  set_by       TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(branch_id, drawer_date)
);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_starts_branch_date ON cash_drawer_starts(branch_id, drawer_date);
