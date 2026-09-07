-- Rename the default cashier display name, and set the owner's login PIN.
UPDATE users SET full_name = 'Staff', updated_at = datetime('now')
  WHERE id = 'user-cashier-001';

-- PIN 082697, bcrypt-hashed (cost 10)
UPDATE users SET pin_hash = '$2a$10$SzkC9BrxsisFAe5TxqbhWOAJgOoULsJi.C2MfBCVL/WvkG6Im.7Bu', updated_at = datetime('now')
  WHERE id = 'user-owner-001';
