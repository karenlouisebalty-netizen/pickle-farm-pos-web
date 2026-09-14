-- ── BACKDATED / MANUALLY-LOGGED SALES ──────────────────
-- Lets a manager/owner record a sale that happened in the past (a forgotten entry, or
-- recovering from a data-loss incident) under its real date, instead of it landing in
-- today's totals. `is_backdated` just marks that the sale's date was typed in rather than
-- captured live, so Reports/receipts can show a small "logged after the fact" indicator —
-- it does not change how the sale is counted (revenue, stock, payment status all behave
-- exactly like a normal completed sale).
ALTER TABLE transactions ADD COLUMN is_backdated INTEGER NOT NULL DEFAULT 0;
