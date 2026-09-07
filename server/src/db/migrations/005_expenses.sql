CREATE TABLE IF NOT EXISTS expenses (
  id          TEXT PRIMARY KEY,
  branch_id   TEXT NOT NULL REFERENCES branches(id),
  amount      REAL NOT NULL,
  category    TEXT NOT NULL CHECK(category IN ('rent','utilities','supplies','salaries','maintenance','food','other')),
  description TEXT,
  expense_date TEXT NOT NULL,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(branch_id, expense_date);
