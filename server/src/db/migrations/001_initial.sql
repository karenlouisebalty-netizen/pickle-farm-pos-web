PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- ── BRANCHES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  address         TEXT NOT NULL,
  contact_number  TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── USERS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  branch_id     TEXT NOT NULL REFERENCES branches(id),
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE,
  pin_hash      TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('owner','manager','cashier')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);

-- ── CUSTOMERS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id              TEXT PRIMARY KEY,
  branch_id       TEXT NOT NULL REFERENCES branches(id),
  full_name       TEXT NOT NULL,
  contact_number  TEXT,
  email           TEXT,
  notes           TEXT,
  total_visits    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_branch   ON customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_contact  ON customers(contact_number);

-- ── MEMBERS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id              TEXT PRIMARY KEY,
  customer_id     TEXT NOT NULL REFERENCES customers(id),
  member_code     TEXT NOT NULL UNIQUE,
  membership_type TEXT NOT NULL CHECK(membership_type IN ('monthly','quarterly','annual')),
  start_date      TEXT NOT NULL,
  expiry_date     TEXT NOT NULL,
  discount_pct    REAL NOT NULL DEFAULT 10.0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_members_expiry ON members(expiry_date) WHERE is_active = 1;

-- ── PRODUCTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                   TEXT PRIMARY KEY,
  branch_id            TEXT NOT NULL REFERENCES branches(id),
  name                 TEXT NOT NULL,
  category             TEXT NOT NULL CHECK(category IN ('open_play','court_rental','rental','food_drinks','merchandise','coaching')),
  price                REAL NOT NULL,
  cost                 REAL,
  stock_qty            INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold  INTEGER NOT NULL DEFAULT 5,
  track_inventory      INTEGER NOT NULL DEFAULT 1,
  sku                  TEXT UNIQUE,
  is_active            INTEGER NOT NULL DEFAULT 1,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_branch_cat ON products(branch_id, category) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_products_low_stock  ON products(branch_id, stock_qty) WHERE track_inventory = 1;

-- ── TRANSACTIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id              TEXT PRIMARY KEY,
  branch_id       TEXT NOT NULL REFERENCES branches(id),
  cashier_id      TEXT NOT NULL REFERENCES users(id),
  customer_id     TEXT REFERENCES customers(id),
  receipt_number  TEXT NOT NULL UNIQUE,
  subtotal        REAL NOT NULL,
  discount_total  REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL,
  status          TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','refunded','voided')),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_txn_branch_date ON transactions(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_cashier     ON transactions(cashier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_status      ON transactions(branch_id, status);

-- ── TRANSACTION ITEMS ──────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_items (
  id              TEXT PRIMARY KEY,
  transaction_id  TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id      TEXT REFERENCES products(id),
  item_name       TEXT NOT NULL,
  unit_price      REAL NOT NULL,
  quantity        INTEGER NOT NULL CHECK(quantity > 0),
  discount        REAL NOT NULL DEFAULT 0,
  line_total      REAL NOT NULL,
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_ti_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ti_product     ON transaction_items(product_id);

-- ── PAYMENTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id               TEXT PRIMARY KEY,
  transaction_id   TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  payment_method   TEXT NOT NULL CHECK(payment_method IN ('cash','gcash','maya','credit_card','bank_transfer')),
  amount           REAL NOT NULL,
  change_given     REAL NOT NULL DEFAULT 0,
  reference_number TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_method      ON payments(payment_method, created_at DESC);

-- ── OPEN PLAY REGISTRATIONS ────────────────────────
CREATE TABLE IF NOT EXISTS open_play_registrations (
  id              TEXT PRIMARY KEY,
  branch_id       TEXT NOT NULL REFERENCES branches(id),
  transaction_id  TEXT REFERENCES transactions(id),
  player_name     TEXT NOT NULL,
  contact_number  TEXT,
  skill_level     TEXT NOT NULL CHECK(skill_level IN ('beginner','intermediate','advanced')),
  court_assigned  TEXT,
  play_date       TEXT NOT NULL DEFAULT (date('now')),
  check_in_at     TEXT NOT NULL DEFAULT (datetime('now')),
  checked_out_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_opr_date  ON open_play_registrations(branch_id, play_date);
CREATE INDEX IF NOT EXISTS idx_opr_court ON open_play_registrations(court_assigned, play_date);

-- ── RESERVATIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id                TEXT PRIMARY KEY,
  branch_id         TEXT NOT NULL REFERENCES branches(id),
  customer_id       TEXT REFERENCES customers(id),
  transaction_id    TEXT REFERENCES transactions(id),
  court_name        TEXT NOT NULL,
  reservation_date  TEXT NOT NULL,
  start_time        TEXT NOT NULL,
  end_time          TEXT NOT NULL CHECK(end_time > start_time),
  booker_name       TEXT NOT NULL,
  contact_number    TEXT,
  status            TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled','no_show','completed')),
  deposit_amount    REAL NOT NULL DEFAULT 0,
  notes             TEXT,
  is_recurring      INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_res_date_court ON reservations(branch_id, reservation_date, court_name);
CREATE INDEX IF NOT EXISTS idx_res_status     ON reservations(status, reservation_date);

-- ── INVENTORY MOVEMENTS ────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id             TEXT PRIMARY KEY,
  product_id     TEXT NOT NULL REFERENCES products(id),
  user_id        TEXT NOT NULL REFERENCES users(id),
  movement_type  TEXT NOT NULL CHECK(movement_type IN ('sale','stock_in','stock_out','adjustment','refund')),
  quantity       INTEGER NOT NULL,
  unit_cost      REAL,
  stock_before   INTEGER NOT NULL,
  stock_after    INTEGER NOT NULL,
  reference_id   TEXT,
  reason         TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inv_product_date ON inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_type         ON inventory_movements(movement_type, created_at DESC);

-- ── COACHING SESSIONS ──────────────────────────────
CREATE TABLE IF NOT EXISTS coaching_sessions (
  id               TEXT PRIMARY KEY,
  branch_id        TEXT NOT NULL REFERENCES branches(id),
  transaction_id   TEXT REFERENCES transactions(id),
  customer_id      TEXT REFERENCES customers(id),
  session_type     TEXT NOT NULL CHECK(session_type IN ('beginner','intermediate','private')),
  coach_name       TEXT NOT NULL,
  student_name     TEXT NOT NULL,
  session_date     TEXT NOT NULL,
  session_time     TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status           TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled','no_show')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_coaching_date   ON coaching_sessions(branch_id, session_date);
CREATE INDEX IF NOT EXISTS idx_coaching_status ON coaching_sessions(status, session_date);

-- ── SYNC QUEUE (local only, never synced) ──────────
CREATE TABLE IF NOT EXISTS sync_queue (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name     TEXT NOT NULL,
  operation      TEXT NOT NULL CHECK(operation IN ('INSERT','UPDATE','DELETE')),
  record_id      TEXT NOT NULL,
  payload        TEXT NOT NULL,
  retry_count    INTEGER NOT NULL DEFAULT 0,
  error_message  TEXT,
  synced_at      TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sync_pending ON sync_queue(id) WHERE synced_at IS NULL;

-- ── SETTINGS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
