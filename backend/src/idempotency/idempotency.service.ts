import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { sha256 } from '../common/hash';
import { cryptoEnabled, encryptText, decryptText } from '../crypto/transaction-crypto';
import { IdempotencyKey } from './entities/idempotency-key.entity';

@Injectable()
export class IdempotencyService {
  fingerprint(userId: string, payload: Record<string, unknown>) {
    const ordered = Object.fromEntries(Object.entries(payload).sort(([first], [second]) => first.localeCompare(second)));
    return sha256(JSON.stringify({ userId, ...ordered }));
  }

  async lookup(manager: EntityManager, userId: string, key: string, requestHash: string) {
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${userId}:${key}`]);
    const current = await manager.getRepository(IdempotencyKey).findOne({ where: { userId, key } });
    if (!current) return null;
    if (current.requestHash !== requestHash) throw new ConflictException('Idempotency-Key reused with different payload');
    if (current.expiredAt < new Date()) throw new ConflictException('Expired Idempotency-Key cannot be reused');
    const stored = current.response as Record<string, unknown>;
    if (typeof stored?.__bankflowEncryptedResponse === 'string') {
      const plaintext = decryptText(stored.__bankflowEncryptedResponse, 'idempotency.response');
      if (!plaintext) throw new Error('Encrypted idempotency response is empty');
      return JSON.parse(plaintext) as Record<string, unknown>;
    }
    return stored;
  }

  async save(manager: EntityManager, userId: string, key: string, requestHash: string, response: Record<string, unknown>) {
    const protectedResponse = cryptoEnabled()
      ? { __bankflowEncryptedResponse: encryptText(JSON.stringify(response), 'idempotency.response') }
      : response;
    await manager.getRepository(IdempotencyKey).insert({
      userId,
      key,
      requestHash,
      response: protectedResponse as any,
      status: 'completed',
      expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  }
}
