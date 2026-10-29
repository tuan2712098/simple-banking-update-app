import 'reflect-metadata';
import 'dotenv/config';
import { dataSource } from './db';
import { FIRST_ACCOUNT, loadDemoTransfers, requireSafeBatchDatabase, stableUuid } from './batch-poc-fixtures';
import { TransactionsService } from '../src/transactions/transactions.service';
import { LedgerService } from '../src/ledger/ledger.service';
import { IdempotencyService } from '../src/idempotency/idempotency.service';
import { Account } from '../src/accounts/entities/account.entity';
import { LedgerEntry } from '../src/ledger/entities/ledger-entry.entity';
import { IdempotencyKey } from '../src/idempotency/entities/idempotency-key.entity';
import { moneyToCents } from '../src/common/money';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  requireSafeBatchDatabase();
  await dataSource.initialize();
  try {
    const service = new TransactionsService(dataSource, new LedgerService(), new IdempotencyService());
    const repo = dataSource.getRepository(Account);
    const ledgerRepo = dataSource.getRepository(LedgerEntry);
    const idRepo = dataSource.getRepository(IdempotencyKey);
    const base = await loadDemoTransfers(dataSource, 'batch-safety-v1');
    const two = base.slice(0, 2);
    const recipient = await repo.findOneByOrFail({ accountNumber: FIRST_ACCOUNT });
    const before = moneyToCents(recipient.balance);
    const ledgersBefore = await ledgerRepo.count();
    const idsBefore = await idRepo.count();
    let rolledBack = false;
    try { await service.commitBatch(two, { simulateRollback: true }); }
    catch (error) { rolledBack = (error as Error).message === 'SIMULATED_BATCH_ROLLBACK'; }
    assert(rolledBack, 'Rollback was not triggered');
    const afterRollback = await repo.findOneByOrFail({ accountNumber: FIRST_ACCOUNT });
    assert(moneyToCents(afterRollback.balance) === before, 'Balance changed on rollback');
    assert(await ledgerRepo.count() === ledgersBefore, 'Ledger changed on rollback');
    assert(await idRepo.count() === idsBefore, 'Idempotency changed on rollback');
    console.log('PASS 1: rollback restores recipient balance, ledger and idempotency');

    const first = await service.commitBatch(two);
    assert(first.committed === 2 || first.replayed === 2, 'Unexpected first batch result');
    const afterFirst = await repo.findOneByOrFail({ accountNumber: FIRST_ACCOUNT });
    const firstBalance = moneyToCents(afterFirst.balance);
    const ledgerFirst = await ledgerRepo.count();
    const second = await service.commitBatch(two);
    assert(second.committed === 0 && second.replayed === 2, 'Replay was not detected');
    const afterReplay = await repo.findOneByOrFail({ accountNumber: FIRST_ACCOUNT });
    assert(moneyToCents(afterReplay.balance) === firstBalance, 'Replay increased recipient balance');
    assert(await ledgerRepo.count() === ledgerFirst, 'Replay wrote duplicate ledger');
    console.log('PASS 2: idempotent retry does not change balance or Ledger');

    const invalid = [
      { ...base[2], jobId: 'valid-before-failure', idempotencyKey: stableUuid('safe-valid-fallback'), amount: '100.00' },
      { ...base[3], jobId: 'insufficient', idempotencyKey: stableUuid('safe-insufficient'), amount: '9000000.00' },
    ];
    const beforeInvalid = moneyToCents((await repo.findOneByOrFail({ accountNumber: FIRST_ACCOUNT })).balance);
    let rejected = false;
    try { await service.commitBatch(invalid); } catch { rejected = true; }
    assert(rejected, 'Invalid batch should be rejected');
    assert(moneyToCents((await repo.findOneByOrFail({ accountNumber: FIRST_ACCOUNT })).balance) === beforeInvalid, 'Invalid batch was partially committed');
    console.log('PASS 3: invalid batch cannot partially commit money');

    const originalKey = two[0];
    const conflicting = [{ ...originalKey, amount: '199999.00' }];
    let collision = false;
    try { await service.commitBatch(conflicting); } catch { collision = true; }
    assert(collision, 'Idempotency collision was not rejected');
    console.log('PASS 4: idempotency key with changed amount is rejected');
  } finally {
    await dataSource.destroy();
  }
}
main().catch((error) => { console.error('BATCH SAFETY FAIL:', error.message); process.exitCode = 1; });
