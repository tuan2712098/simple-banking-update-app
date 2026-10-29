import { Injectable, OnModuleInit } from '@nestjs/common';
import { KeyObject } from 'crypto';
import {
  cryptoEnabled, encryptionKey, loadSigningKeys, ReceiptFields, signReceipt, verifyReceipt,
} from './transaction-crypto';

@Injectable()
export class TransactionCryptoService implements OnModuleInit {
  private privateKey: KeyObject | null = null;
  private publicKey: KeyObject | null = null;
  private publicPem: string | null = null;
  private keyId: string | null = null;

  onModuleInit(): void {
    if (!cryptoEnabled()) return;
    encryptionKey(); // Fail at startup, not in the middle of a transfer.
    const pair = loadSigningKeys();
    this.privateKey = pair.privateKey;
    this.publicKey = pair.publicKey;
    this.publicPem = pair.publicPem;
    this.keyId = pair.keyId;
  }

  getPublicKey() {
    return { enabled: cryptoEnabled(), algorithm: 'Ed25519', keyId: this.keyId, publicKeyPem: this.publicPem };
  }

  sign(fields: ReceiptFields): { receiptHash: string; receiptSignature: string; receiptKeyId: string } | null {
    if (!cryptoEnabled()) return null;
    if (!this.privateKey || !this.keyId) throw new Error('Receipt signer has not been initialized');
    return { ...signReceipt(fields, this.privateKey), receiptKeyId: this.keyId };
  }

  verify(fields: ReceiptFields, hash: string | null, signature: string | null, keyId: string | null): boolean {
    if (!cryptoEnabled() || !this.publicKey || !this.keyId || this.keyId !== keyId) return false;
    return verifyReceipt(fields, hash, signature, this.publicKey);
  }
}
