-- ── STAFF DAILY RATE (for payroll) ──────────────────
-- Flat amount paid per day worked, set per staff member by the owner (editable from the
-- Attendance > Manage Staff tab). /attendance/summary uses this to auto-compute salary
-- for any day with a completed clock-in + clock-out.
ALTER TABLE users ADD COLUMN daily_rate REAL NOT NULL DEFAULT 0;

-- Seed the rates Louise already pays her two current staff; she can change these anytime
-- from Manage Staff, and this only sets an initial value — it never overrides one she's
-- since edited.
UPDATE users SET daily_rate = 400, updated_at = datetime('now')
  WHERE full_name LIKE '%Gian%' AND daily_rate = 0;
UPDATE users SET daily_rate = 350, updated_at = datetime('now')
  WHERE full_name LIKE '%Yuan%' AND daily_rate = 0;
