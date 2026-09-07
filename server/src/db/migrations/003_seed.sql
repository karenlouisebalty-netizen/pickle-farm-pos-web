-- Seed: default branch
INSERT OR IGNORE INTO branches (id, name, address, contact_number) VALUES (
  'branch-pf-001',
  'The Pickle Farm',
  '9070 Binambangan Street Brgy. 4 Indang Cavite',
  '09XX-XXX-XXXX'
);

-- Seed: owner account (PIN: 1234 → bcrypt hash stored at runtime by AuthService)
-- We store a placeholder; the app will re-hash on first launch if pin_hash = 'SETUP'
INSERT OR IGNORE INTO users (id, branch_id, full_name, email, pin_hash, role) VALUES (
  'user-owner-001',
  'branch-pf-001',
  'Owner',
  'owner@picklefarm.ph',
  'SETUP',
  'owner'
);

-- Seed: default cashier
INSERT OR IGNORE INTO users (id, branch_id, full_name, pin_hash, role) VALUES (
  'user-cashier-001',
  'branch-pf-001',
  'Maria R.',
  'SETUP',
  'cashier'
);

-- ── PRODUCTS ───────────────────────────────────────

-- Open Play
INSERT OR IGNORE INTO products (id, branch_id, name, category, price, cost, track_inventory, sort_order) VALUES
  ('prod-op-001', 'branch-pf-001', 'Adult Open Play',   'open_play', 250, 0, 0, 10),
  ('prod-op-002', 'branch-pf-001', 'Student Open Play', 'open_play', 200, 0, 0, 11),
  ('prod-op-003', 'branch-pf-001', 'Senior Open Play',  'open_play', 180, 0, 0, 12);

-- Court Rental
INSERT OR IGNORE INTO products (id, branch_id, name, category, price, cost, track_inventory, sort_order) VALUES
  ('prod-cr-001', 'branch-pf-001', 'Court 1 Rental', 'court_rental', 450, 0, 0, 20),
  ('prod-cr-002', 'branch-pf-001', 'Court 2 Rental', 'court_rental', 450, 0, 0, 21);

-- Equipment Rentals
INSERT OR IGNORE INTO products (id, branch_id, name, category, price, cost, stock_qty, low_stock_threshold, sort_order) VALUES
  ('prod-rn-001', 'branch-pf-001', 'Paddle Rental', 'rental', 100, 0, 10, 3, 30),
  ('prod-rn-002', 'branch-pf-001', 'Ball Rental',   'rental',  50, 0, 20, 5, 31);

-- Food & Drinks
INSERT OR IGNORE INTO products (id, branch_id, name, category, price, cost, stock_qty, low_stock_threshold, sort_order) VALUES
  ('prod-fd-001', 'branch-pf-001', 'Water (500ml)', 'food_drinks',  30, 15, 50, 10, 40),
  ('prod-fd-002', 'branch-pf-001', 'Soft Drinks',   'food_drinks',  50, 25, 30,  8, 41),
  ('prod-fd-003', 'branch-pf-001', 'Coffee',        'food_drinks',  60, 20, 20,  5, 42),
  ('prod-fd-004', 'branch-pf-001', 'Snacks',        'food_drinks',  45, 20, 40, 10, 43);

-- Merchandise
INSERT OR IGNORE INTO products (id, branch_id, name, category, price, cost, stock_qty, low_stock_threshold, sort_order) VALUES
  ('prod-me-001', 'branch-pf-001', 'Pickle Farm Shirt', 'merchandise', 350, 150, 20, 5, 50),
  ('prod-me-002', 'branch-pf-001', 'Cap / Hat',         'merchandise', 280, 100, 15, 5, 51),
  ('prod-me-003', 'branch-pf-001', 'Wristband',         'merchandise',  80,  30, 30, 5, 52),
  ('prod-me-004', 'branch-pf-001', 'Towel',             'merchandise', 220, 100, 15, 5, 53);

-- Coaching
INSERT OR IGNORE INTO products (id, branch_id, name, category, price, cost, track_inventory, sort_order) VALUES
  ('prod-co-001', 'branch-pf-001', 'Beginner Session',      'coaching',  500, 0, 0, 60),
  ('prod-co-002', 'branch-pf-001', 'Intermediate Session',  'coaching',  700, 0, 0, 61),
  ('prod-co-003', 'branch-pf-001', 'Private Lesson',        'coaching', 1200, 0, 0, 62);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('default_printer_id', ''),
  ('auto_print', 'true'),
  ('receipt_copies', '1'),
  ('theme', 'light'),
  ('last_receipt_seq', '0');
