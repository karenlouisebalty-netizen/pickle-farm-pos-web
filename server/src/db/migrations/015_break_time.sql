-- ── BREAK TIME ─────────────────────────────────────────────
-- Widens attendance_logs.clock_type so staff can log a break from the same Time Clock
-- panel they already use to clock in/out ('break_start' when they step away, 'break_end'
-- when they're back). SQLite can't alter a CHECK constraint in place, so the table is
-- recreated with the wider constraint and the existing rows are copied over untouched.
CREATE TABLE attendance_logs_new (
  id           TEXT PRIMARY KEY,
  branch_id    TEXT NOT NULL REFERENCES branches(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  clock_type   TEXT NOT NULL CHECK(clock_type IN ('in','out','break_start','break_end')),
  photo        TEXT,
  captured_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO attendance_logs_new (id, branch_id, user_id, clock_type, photo, captured_at)
  SELECT id, branch_id, user_id, clock_type, photo, captured_at FROM attendance_logs;

DROP TABLE attendance_logs;
ALTER TABLE attendance_logs_new RENAME TO attendance_logs;

CREATE INDEX IF NOT EXISTS idx_attendance_user_date   ON attendance_logs(user_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_attendance_branch_date ON attendance_logs(branch_id, captured_at);
