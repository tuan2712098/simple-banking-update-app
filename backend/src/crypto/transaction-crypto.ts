/**
 * Security helpers for transaction descriptions and immutable transfer receipts.
 * Uses built-in Node.js crypto; no secret key is committed into the repository.
 */
import {
  createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey,
  KeyObject, randomBytes, sign as nodeSign, verify as nodeVerify,
} from 'crypto';

const CIPHER_PREFIX = 'enc:v1:';
function associatedData(purpose: string): Buffer {
  return Buffer.from(`bankflow:${purpose}:v1`, 'utf8');
}

export function cryptoEnabled(): boolean {
  return process.env.BANKFLOW_CRYPTO_ENABLED === 'true';
}

export function encryptionKey(): Buffer {
  const base64 = process.env.TRANSACTION_ENCRYPTION_KEY || '';
  const key = Buffer.from(base64, 'base64');
  if (!base64 || !/^[A-Za-z0-9+/]{43}=$/.test(base64) || key.length !== 32 || key.toString('base64') !== base64) {
    throw new Error('TRANSACTION_ENCRYPTION_KEY must be a base64-encoded random 32-byte key');
  }
  return key;
}

export function encryptText(value: string | null, purpose: string): string | null {
  if (value == null) return value;
  if (!cryptoEnabled()) return value;
  if (value.startsWith(CIPHER_PREFIX)) throw new Error('Encrypted payload must not be encrypted twice');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(associatedData(purpose));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${CIPHER_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptText(value: string | null, purpose: string): string | null {
  if (value == null) return value;
  // Old rows may contain cleartext; they remain readable until migrated.
  if (!value.startsWith(CIPHER_PREFIX)) return value;
  // Do not silently return ciphertext if a crypto-enabled database was opened without a key.
  const parts = value.slice(CIPHER_PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted transaction description');
  const [ivBase64, tagBase64, dataBase64] = parts;
  const iv = Buffer.from(ivBase64, 'base64');
  const tag = Buffer.from(tagBase64, 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid encrypted transaction description');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAAD(associatedData(purpose));
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(Buffer.from(dataBase64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Transaction description authentication failed (wrong key or modified data)');
  }
}

export function encryptDescription(value: string | null): string | null {
  return encryptText(value, 'transactions.description');
}
export function decryptDescription(value: string | null): string | null {
  return decryptText(value, 'transactions.description');
}
export const descriptionTransformer = {
  to: encryptDescription,
  from: decryptDescription,
};

export type ReceiptFields = {
  id: string;
  fromAccountNumber: string;
  toAccountNumber: string;
  amount: string;
  type: string;
  description: string;
  createdAt: Date | string;
};

export function receiptPayload(fields: ReceiptFields): string {
  const date = fields.createdAt instanceof Date ? fields.createdAt : new Date(fields.createdAt);
  if (!Number.isFinite(date.getTime())) throw new Error('Receipt requires a valid creation timestamp');
  // Fixed order and exact currency formatting are part of receipt v1 canonicalization.
  const match = /^(\d{1,16})(?:\.(\d{1,2}))?$/.exec(fields.amount);
  if (!match) throw new Error('Invalid receipt amount');
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
  const canonicalAmount = `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
  return JSON.stringify({
    version: 1,
    transactionId: fields.id,
    fromAccountNumber: fields.fromAccountNumber,
    toAccountNumber: fields.toAccountNumber,
    amount: canonicalAmount,
    currency: 'VND',
    type: fields.type,
    descriptionHash: createHash('sha256').update(fields.description, 'utf8').digest('hex'),
    createdAt: date.toISOString(),
  });
}

export function digestSha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function loadSigningKeys(): { privateKey: KeyObject; publicKey: KeyObject; publicPem: string; keyId: string } {
  const privateB64 = process.env.TRANSACTION_SIGN_PRIVATE_KEY_B64 || '';
  const publicB64 = process.env.TRANSACTION_SIGN_PUBLIC_KEY_B64 || '';
  if (!privateB64 || !publicB64) throw new Error('Ed25519 signing keys are required when BANKFLOW_CRYPTO_ENABLED=true');
  const privatePem = Buffer.from(privateB64, 'base64').toString('utf8');
  const publicPem = Buffer.from(publicB64, 'base64').toString('utf8');
  const privateKey = createPrivateKey(privatePem);
  const publicKey = createPublicKey(publicPem);
  if (privateKey.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('Receipt keys must use Ed25519');
  }
  const sample = Buffer.from('bankflow-key-pair-check');
  if (!nodeVerify(null, sample, publicKey, nodeSign(null, sample, privateKey))) {
    throw new Error('Ed25519 private and public keys do not match');
  }
  const publicDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  return { privateKey, publicKey, publicPem, keyId: createHash('sha256').update(publicDer).digest('hex') };
}

export function signReceipt(fields: ReceiptFields, privateKey: KeyObject): { receiptHash: string; receiptSignature: string } {
  const payload = receiptPayload(fields);
  return {
    receiptHash: digestSha256(payload),
    receiptSignature: nodeSign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64'),
  };
}

export function verifyReceipt(fields: ReceiptFields, receiptHash: string | null, signature: string | null, publicKey: KeyObject): boolean {
  if (!receiptHash || !signature || !/^[0-9a-f]{64}$/.test(receiptHash)) return false;
  const payload = receiptPayload(fields);
  if (digestSha256(payload) !== receiptHash) return false;
  const sig = Buffer.from(signature, 'base64');
  if (sig.length !== 64 || sig.toString('base64') !== signature) return false;
  return nodeVerify(null, Buffer.from(payload, 'utf8'), publicKey, sig);
}
