-- BACK UP DATABASE BEFORE RUNNING. Compatible with existing accounts/transactions.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS transaction_pin_hash varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_failed_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;
CREATE TABLE IF NOT EXISTS payment_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(id),
  action varchar(32) NOT NULL,
  payload_hash varchar(64) NOT NULL,
  otp_hash varchar,
  token_hash varchar(64),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_challenges_actor_created ON payment_challenges(actor_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_challenges_token_hash ON payment_challenges(token_hash) WHERE token_hash IS NOT NULL;
COMMIT;
