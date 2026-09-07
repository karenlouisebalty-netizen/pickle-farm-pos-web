-- ── ATTENDANCE / TIME CLOCK ────────────────────────────────
-- Staff clock in/out from the login screen with a photo captured on
-- the spot as proof. Used for the monthly attendance summary (payroll).
CREATE TABLE IF NOT EXISTS attendance_logs (
  id           TEXT PRIMARY KEY,
  branch_id    TEXT NOT NULL REFERENCES branches(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  clock_type   TEXT NOT NULL CHECK(clock_type IN ('in','out')),
  photo        TEXT,
  captured_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date   ON attendance_logs(user_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_attendance_branch_date ON attendance_logs(branch_id, captured_at);
