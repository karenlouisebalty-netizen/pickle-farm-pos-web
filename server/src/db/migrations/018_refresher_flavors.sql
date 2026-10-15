-- ── FREE REFRESHER FLAVORS ON OPEN PLAY SALE ITEMS ─────────────────────
-- Louise runs an occasional "Free Refreshers" promo tied to an Open Play sale (a product
-- she names something like "Open Play W/ Free Refresher"). When such a line is rung up,
-- Checkout now also asks for one refresher flavor per unit of quantity (same one-per-unit
-- pattern as customer_names, migration 014), so a printable claim stub can show each
-- player's chosen flavor. Stored as a JSON array of strings, one entry per unit of
-- quantity; null/absent for every other line item.
ALTER TABLE transaction_items ADD COLUMN refresher_flavors TEXT;
