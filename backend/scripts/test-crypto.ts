/** Offline unit checks for hashing, AES-256-GCM and Ed25519 (no database needed). */
import { strict as assert } from 'assert';
import { generateKeyPairSync, randomBytes } from 'crypto';
import {
  decryptDescription, encryptDescription, decryptText, encryptText, digestSha256, loadSigningKeys,
  receiptPayload, signReceipt, verifyReceipt,
} from '../src/crypto/transaction-crypto';

function test() {
  const keys = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  process.env.BANKFLOW_CRYPTO_ENABLED = 'true';
  process.env.TRANSACTION_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  process.env.TRANSACTION_SIGN_PRIVATE_KEY_B64 = Buffer.from(keys.privateKey).toString('base64');
  process.env.TRANSACTION_SIGN_PUBLIC_KEY_B64 = Buffer.from(keys.publicKey).toString('base64');

  const plain = 'Chuyển tiền học phí — 1.500.000 VND';
  const enc1 = encryptDescription(plain)!;
  const enc2 = encryptDescription(plain)!;
  assert.ok(enc1.startsWith('enc:v1:'));
  assert.notEqual(enc1, enc2, 'AES-GCM must use unique random IVs');
  assert.equal(decryptDescription(enc1), plain);
  assert.equal(decryptDescription('legacy plaintext row'), 'legacy plaintext row');
  const replay = { id: 'demo-transfer', amount: '100.00', description: plain };
  const encryptedReplay = encryptText(JSON.stringify(replay), 'idempotency.response')!;
  assert.deepEqual(JSON.parse(decryptText(encryptedReplay, 'idempotency.response')!), replay);
  assert.throws(() => decryptDescription(encryptedReplay), /authentication failed/);
  console.log('PASS AES-256-GCM: random nonce, roundtrip, idempotency response, domain separation, legacy rows');

  const parts = enc1.split(':');
  const ciphertext = Buffer.from(parts[4], 'base64');
  ciphertext[0] ^= 0x01;
  assert.throws(() => decryptDescription([...parts.slice(0, 4), ciphertext.toString('base64')].join(':')), /authentication failed/);
  const backupKey = process.env.TRANSACTION_ENCRYPTION_KEY;
  process.env.TRANSACTION_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  assert.throws(() => decryptDescription(enc1), /authentication failed/);
  process.env.TRANSACTION_ENCRYPTION_KEY = backupKey;
  console.log('PASS AES-256-GCM: rejects modified ciphertext and wrong keys');

  const { privateKey, publicKey } = loadSigningKeys();
  const transfer = {
    id: '28f39d46-1ba7-445d-9ee0-15fa7e04f3c2',
    fromAccountNumber: '123456789012',
    toAccountNumber: '999999999999',
    amount: '1500000.00',
    type: 'transfer',
    description: plain,
    createdAt: new Date('2026-10-27T03:00:00.000Z'),
  };
  const receipt = signReceipt(transfer, privateKey);
  assert.equal(digestSha256(receiptPayload(transfer)), receipt.receiptHash);
  assert.ok(receiptPayload({ ...transfer, amount: '9999999999999999.99' }).includes('9999999999999999.99')); // exact decimal, no floating point
  assert.equal(verifyReceipt(transfer, receipt.receiptHash, receipt.receiptSignature, publicKey), true);
  assert.equal(verifyReceipt({ ...transfer, amount: '9000000.00' }, receipt.receiptHash, receipt.receiptSignature, publicKey), false);
  assert.equal(verifyReceipt({ ...transfer, description: 'changed' }, receipt.receiptHash, receipt.receiptSignature, publicKey), false);
  const foreign = generateKeyPairSync('ed25519');
  assert.equal(verifyReceipt(transfer, receipt.receiptHash, receipt.receiptSignature, foreign.publicKey), false);
  console.log('PASS Ed25519 + SHA-256: valid, modified amount, modified description, wrong public key');

  process.env.BANKFLOW_CRYPTO_ENABLED = 'false';
  assert.equal(encryptDescription(plain), plain);
  assert.equal(decryptDescription(enc1), plain); // Read encrypted records still requires key.
  console.log('PASS legacy mode: plaintext writes when integration disabled');
  console.log('ALL CRYPTO TESTS PASSED');
}

test();
