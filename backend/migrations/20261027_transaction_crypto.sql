-- Required before enabling BANKFLOW_CRYPTO_ENABLED=true on an existing database.
-- Back up PostgreSQL first; older plaintext descriptions remain readable but are not auto-migrated.
BEGIN;
ALTER TABLE transactions ALTER COLUMN description TYPE text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_hash varchar(64);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_signature varchar(128);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_key_id varchar(64);
COMMIT;
