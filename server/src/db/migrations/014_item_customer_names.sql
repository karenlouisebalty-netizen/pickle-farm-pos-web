-- ── NAMES ON OPEN PLAY / COURT RENTAL SALE ITEMS ───────────────────────
-- When a POS sale line is Open Play or Court Rental, the checkout screen now asks for one
-- name per unit of quantity (2x Open Play → 2 names) so there's always a record of who
-- played/booked, even for a quick sale rung up straight from the product grid rather than
-- through the fuller Open Play check-in or Reservations booking flow. Stored as a JSON
-- array of strings, one entry per unit of quantity; null/absent for every other category.
ALTER TABLE transaction_items ADD COLUMN customer_names TEXT;
