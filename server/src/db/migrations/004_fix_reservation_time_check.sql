-- Remove the end_time > start_time constraint to support overnight bookings
-- SQLite doesn't support DROP CONSTRAINT, so we recreate the table

CREATE TABLE IF NOT EXISTS reservations_new (
  id                TEXT PRIMARY KEY,
  branch_id         TEXT NOT NULL REFERENCES branches(id),
  customer_id       TEXT REFERENCES customers(id),
  transaction_id    TEXT REFERENCES transactions(id),
  court_name        TEXT NOT NULL,
  reservation_date  TEXT NOT NULL,
  start_time        TEXT NOT NULL,
  end_time          TEXT NOT NULL,
  booker_name       TEXT NOT NULL,
  contact_number    TEXT,
  status            TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled','no_show','completed')),
  deposit_amount    REAL NOT NULL DEFAULT 0,
  notes             TEXT,
  is_recurring      INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL
);

INSERT INTO reservations_new SELECT * FROM reservations;
DROP TABLE reservations;
ALTER TABLE reservations_new RENAME TO reservations;

CREATE INDEX IF NOT EXISTS idx_res_date_court ON reservations(branch_id, reservation_date, court_name);
CREATE INDEX IF NOT EXISTS idx_res_status ON reservations(status, reservation_date);
