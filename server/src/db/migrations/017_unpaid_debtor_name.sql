-- ── WHO OWES AN UNPAID SALE ──────────────────────────────────────────────
-- Payment status (migration 010) flags a sale as unpaid, but gave no way to record WHO
-- still owes for it — with several unpaid sales sitting in Reports/Daily Sales at once,
-- there was no way to tell them apart without opening each one and checking the items.
-- Checkout now requires a name (a person, not a registered Member) whenever a sale is
-- marked Not Paid Yet, stored here. Distinct from the existing `customers` table/
-- `customer_id` membership link — this is plain free text, captured even for a walk-in
-- with no Member account, and column-named `debtor_name` (not `customer_name`) so it can
-- never collide with the member-name lookup already aliased as `customer_name` in queries.
ALTER TABLE transactions ADD COLUMN debtor_name TEXT;
