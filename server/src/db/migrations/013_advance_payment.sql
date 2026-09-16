-- ── ADVANCE PAYMENT (sale scheduled for a future date/time) ───────────
-- The opposite of a backdated sale: money collected TODAY for something that will happen
-- LATER (e.g. a customer pre-pays for a court rental next week). The checkout screen's
-- "different date/time" option now accepts a future date+time as well as a past one; when
-- the chosen moment is in the future, the sale is tagged advance-payment instead of
-- backdated, and — like backdating — it lands in the REPORTS of the date it's assigned to,
-- not today's, per how `date(created_at)` bucketing already works everywhere.
ALTER TABLE transactions ADD COLUMN is_advance_payment INTEGER NOT NULL DEFAULT 0;
