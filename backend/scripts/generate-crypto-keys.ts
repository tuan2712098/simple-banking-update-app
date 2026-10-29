/** Local developer only: writes sample secrets to .env.crypto.generated (never commit). */
import { generateKeyPairSync, randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const pair = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const content = [
  'BANKFLOW_CRYPTO_ENABLED=true',
  `TRANSACTION_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
  `TRANSACTION_SIGN_PRIVATE_KEY_B64=${Buffer.from(pair.privateKey).toString('base64')}`,
  `TRANSACTION_SIGN_PUBLIC_KEY_B64=${Buffer.from(pair.publicKey).toString('base64')}`,
].join('\n') + '\n';
const file = resolve(__dirname, '../.env.crypto.generated');
writeFileSync(file, content, { mode: 0o600, flag: 'wx' });
console.log(`Saved local sample crypto keys to ${file}. Copy values into backend/.env; never commit or share this file.`);
