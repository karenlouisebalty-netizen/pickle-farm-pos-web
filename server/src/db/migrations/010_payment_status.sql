-- ── PAYMENT STATUS (sales made on credit / paid later) ──────────────────
-- Lets a cashier record a sale as completed — items given, inventory taken out,
-- counted in reports — without the money actually being in hand yet (a regular
-- who settles up at the end of the week, etc). Defaults to 'paid' so every
-- existing transaction, and any new one that doesn't say otherwise, behaves
-- exactly as before this feature existed.
ALTER TABLE transactions ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE transactions ADD COLUMN paid_at TEXT;
ALTER TABLE transactions ADD COLUMN paid_by TEXT;

-- Backfill: every transaction that already existed was, as far as this system
-- knew, paid for at the time it was made — record that instead of leaving
-- paid_at empty (which would otherwise misread as "still unpaid").
UPDATE transactions SET paid_at = created_at WHERE payment_status = 'paid' AND paid_at IS NULL;
