# Hash – Sign – Encrypt/Decrypt integration (JITS Simple Banking App)

This is a **demo/learning integration**, not a certification for production banking use.
It changes the **backend and transaction-history UI** while preserving the existing banking flow.

## What is integrated

| Technique | Real code path | Where |
|---|---|---|
| SHA-256 | Idempotency fingerprint and receipt digest | `backend/src/common/hash.ts`, `backend/src/idempotency`, `backend/src/crypto/transaction-crypto.ts` |
| bcrypt | Password hashing/checking and transfer OTP hashing | `backend/src/auth`, `backend/src/transactions` |
| Ed25519 signature | Automatically signs each completed regular, OTP or batch **transfer**, in the same DB transaction as its ledger writes | `backend/src/transactions/transactions.service.ts` |
| Ed25519 verification | Reads stored receipt and verifies current transaction against its signature, with user access control | `GET /transactions/:id/receipt` |
| AES-256-GCM encryption/decryption | Transparently encrypts/decrypts the **transaction description** using TypeORM transformer and protects stored idempotency replay JSON; changing IV on each write | `backend/src/crypto/transaction-crypto.ts`, `backend/src/transactions/entities/transaction.entity.ts` |
| Frontend receipt check | Button on completed transfer history entries | `frontend/src/app/transactions/page.tsx` |

**Not encrypted:** balances, account numbers, customer emails, ledger entries, and the Redis queue payload. These need separate design if required; do **not** claim the entire database is encrypted.

## 1. Back up DB and apply migration FIRST

```powershell
cd Simple_Banking_App_Security_Integrated/backend
# In psql against YOUR development database:
psql -h 127.0.0.1 -U postgres -d simple_banking_app_final -f migrations/20261027_transaction_crypto.sql
```

This extends `transactions.description` to `text` (AES ciphertext exceeds 255 characters) and creates three nullable signature columns.
If you use `DB_SYNCHRONIZE=true` in a **disposable** dev database, TypeORM may make those changes automatically; **do not** use schema sync in production.

## 2. Generate local keys (do not commit them)

```powershell
cd backend
npm install
npm run crypto:keygen
```

This creates `backend/.env.crypto.generated`, readable only by the local user on compatible systems.
Copy its four values into **your existing** `backend/.env` (keep all existing database/JWT settings), then delete the generated file if desired. Do not email or commit private keys or `.env`.

Sample keys from this script are for local testing. In a real service, generate/store keys in KMS/HSM or another dedicated secret store; plan key rotation before onboarding users.

Enabling settings:

```dotenv
BANKFLOW_CRYPTO_ENABLED=true
TRANSACTION_ENCRYPTION_KEY=<base64 32 random bytes>
TRANSACTION_SIGN_PRIVATE_KEY_B64=<base64 of Ed25519 PKCS8 PEM>
TRANSACTION_SIGN_PUBLIC_KEY_B64=<base64 of Ed25519 SPKI PEM>
```

**Important:** A service configured with `BANKFLOW_CRYPTO_ENABLED=true` refuses to initialize with missing/malformed/mismatched keys. Stop the app and restore valid keys rather than switching them while it runs. Keep encrypted-data keys for existing records; changing encryption key makes old descriptions unreadable. Changing signing keys makes older receipts unverifiable (multi-key rotation support is not implemented).

## 3. Start API & UI

```powershell
# Terminal 1
cd backend
npm run start:dev
# Terminal 2
cd frontend
npm install
npm run dev
```

Use app UI to transfer money below OTP threshold, or confirm an OTP transfer. For a new completed transfer:

- `transactions.description` column is stored as `enc:v1:<iv>:<tag>:<ciphertext>`; history JSON/UI transparently shows the original description.
- New `receipt_hash`, `receipt_signature`, `receipt_key_id` columns are set. The SHA-256 hash covers a canonical receipt, and the Ed25519 signature covers the same original receipt.
- From the transaction-history page click **Kiểm tra chữ ký giao dịch**.

Authenticated API endpoints:

```http
GET /transactions/receipt-public-key
Authorization: Bearer <accessToken>

GET /transactions/<transaction-uuid>/receipt
Authorization: Bearer <accessToken>
```

Only the **sender or receiver** can read a signed receipt. Example response fields:

```json
{
  "transactionId": "...",
  "signed": true,
  "verified": true,
  "algorithm": "Ed25519",
  "hashAlgorithm": "SHA-256",
  "receiptHash": "...",
  "signature": "...",
  "keyId": "...",
  "receipt": { "fromAccountNumber": "...", "toAccountNumber": "...", "amount": "10000.00", "currency": "VND", "description": "...", "createdAt": "..." }
}
```

**Tests without database:**

```powershell
cd backend
npm run test:crypto
```

The test creates ephemeral keys, verifies encryption/decryption, integrity failures, digital signature and tampering. `npm run test` and `npm run build` require dependencies installed. Check application integration against your local PostgreSQL; a fully running DB/Redis integration test has not been performed here.

## Notes / boundaries

- Existing **plaintext descriptions** remain readable for compatibility. The migration does not automatically encrypt historical transaction descriptions or previously stored idempotency replay JSON, nor sign existing transfers. They show `signed: false` until a deliberate audited backfill procedure is implemented.
- `BANKFLOW_CRYPTO_ENABLED=false` is the default to avoid blocking an old deployment before schema migration. No new signature/encryption occurs in this mode. Do not turn this flag off after storing encrypted rows without retaining the encryption key: they must still decrypt on read.
- Encrypted descriptions are authenticated (AES-GCM). Modified ciphertext or wrong keys cause decryption to fail. There is no plaintext fallback for encrypted rows.
- The **signed receipt** covers transaction ID, source/destination account numbers, amount, type, SHA-256 hash of plaintext description and creation timestamp. It intentionally does not sign the mutable status (a transaction can later be REVERSED) or ledger metadata. Do not claim this prevents all database tampering.
- `receipt_hash`, `receipt_signature` and `receipt_key_id` have no DB immutability trigger yet. For production, add storage protection, key rotation, event-sourcing/audit verification and a secure signing-key infrastructure.
- Logs, Redis payloads, responses and existing audit data remain subject to their current permissions and protection; encryption of selected DB fields is not full end-to-end encryption.
- Never print OTPs, passwords or private keys in production logs.
