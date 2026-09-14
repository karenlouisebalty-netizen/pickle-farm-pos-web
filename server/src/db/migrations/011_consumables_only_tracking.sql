-- ── TRACK INVENTORY: CONSUMABLES ONLY ───────────────────────────────
-- Physical daily counts only make sense for things actually sitting on a shelf —
-- food/drinks and merchandise. Court rentals, open play, coaching, and equipment
-- rentals are services/bookings, not shelf stock, and having them "tracked" was
-- producing nonsensical Daily Count and Reconciliation entries (huge placeholder-
-- looking counts with no real stock behind them). Turn tracking off for everything
-- outside those two categories — they stay exactly as sellable on POS as before,
-- they just stop showing up on Daily Count / Waste / Reconciliation.
UPDATE products
SET track_inventory = 0, updated_at = datetime('now')
WHERE category NOT IN ('food_drinks', 'merchandise') AND track_inventory = 1;
