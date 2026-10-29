# Security integration – changed files

Based on uploaded archive `BankFlow_Buoc3_BatchCommit_Queue_PoC.zip`. **If you made newer local changes, merge instead of replacing your current project.**

New files:
- `backend/src/crypto/transaction-crypto.ts` (SHA-256 receipt hash, AES-256-GCM, Ed25519)
- `backend/src/crypto/transaction-crypto.service.ts` (startup key validation, signing and verifying)
- `backend/src/crypto/transaction-crypto.module.ts`
- `backend/migrations/20261027_transaction_crypto.sql`
- `backend/scripts/generate-crypto-keys.ts`
- `backend/scripts/test-crypto.ts`
- `SECURITY_INTEGRATION_GUIDE.md`
- `CHANGES_SECURITY.md`

Edited files:
- `backend/src/transactions/entities/transaction.entity.ts` (description encryption transformer, persisted receipt fields)
- `backend/src/transactions/transactions.module.ts` (imports crypto module)
- `backend/src/transactions/transactions.service.ts` (sign every finalized transfer, including batch/OTP; authenticated receipt verification)
- `backend/src/transactions/transactions.controller.ts` (receipt/public-key endpoints)
- `backend/src/idempotency/idempotency.service.ts` (encrypt stored replay JSON; backwards-compatible reads)
- `frontend/src/app/transactions/page.tsx` (verify signature button)
- `backend/.env.example`, `backend/package.json`, `.gitignore`, `README.md` (setup)

**Preserved:** current SHA-256 helpers, bcrypt password/OTP hash, normal transaction/ledger flow, other APIs and frontend screens.

Validation performed in this environment:
- `npm run test:crypto` **PASS** (cryptography unit/demo, no DB)
- TypeScript/TSX **syntax checked on 107 files**
- `npm run build` and database/Redis integrated tests **NOT run**, because project dependencies could not be installed here. Execute with `npm install` on your workstation.
