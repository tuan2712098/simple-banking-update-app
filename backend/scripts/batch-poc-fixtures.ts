import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { Account } from '../src/accounts/entities/account.entity';
import { User } from '../src/users/entities/user.entity';
import { TransferCandidate } from '../src/batch-planning/batch-planner';

export const FIRST_ACCOUNT = '980000009001';
export const SECOND_ACCOUNT = '980000009002';
export const SENDER_COUNT = 100;

export function requireSafeBatchDatabase() {
  if (process.env.DB_DATABASE !== 'simple_banking_race_test' ||
      process.env.DB_SYNCHRONIZE === 'true' ||
      process.env.NODE_ENV === 'production') {
    throw new Error('STOP: Batch demos require DB_DATABASE=simple_banking_race_test, DB_SYNCHRONIZE=false, NODE_ENV!=production');
  }
}

export function stableUuid(value: string): string {
  const h = createHash('sha256').update(value).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function demoEmail(index: number) {
  return `bankflow-batch-${index.toString().padStart(3, '0')}@example.test`;
}

export async function loadDemoTransfers(dataSource: DataSource, namespace = 'demo-v1'): Promise<TransferCandidate[]> {
  const users = await dataSource.getRepository(User).find({
    where: Array.from({ length: SENDER_COUNT }, (_, i) => ({ email: demoEmail(i + 1) })),
  });
  if (users.length !== SENDER_COUNT) throw new Error('Run npm run seed:batch-poc first');
  const byEmail = new Map(users.map((user) => [user.email, user]));
  const recipients = await dataSource.getRepository(Account).find({
    where: [{ accountNumber: FIRST_ACCOUNT }, { accountNumber: SECOND_ACCOUNT }],
  });
  if (recipients.length !== 2) throw new Error('Demo recipient accounts missing');
  return Array.from({ length: SENDER_COUNT }, (_, i) => {
    const index = i + 1;
    const user = byEmail.get(demoEmail(index));
    if (!user) throw new Error('Demo user missing: ' + index);
    const amount = `${100000 + (i % 7) * 15000}.00`;
    return {
      jobId: `test-transfer-${namespace}-${index}`,
      userId: user.id,
      idempotencyKey: stableUuid(`${namespace}-transfer-${index}`),
      toAccountNumber: i < 65 ? FIRST_ACCOUNT : SECOND_ACCOUNT,
      amount,
      description: `Batch PoC sender ${index}`,
    };
  });
}
