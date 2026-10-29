import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { Queue, Worker } from 'bullmq';
import { dataSource } from './db';
import { FIRST_ACCOUNT, SECOND_ACCOUNT, loadDemoTransfers, requireSafeBatchDatabase } from './batch-poc-fixtures';
import { planTransfersByRecipient, TransferCandidate } from '../src/batch-planning/batch-planner';
import { TransactionsService } from '../src/transactions/transactions.service';
import { LedgerService } from '../src/ledger/ledger.service';
import { IdempotencyService } from '../src/idempotency/idempotency.service';
import { Account } from '../src/accounts/entities/account.entity';
import { LedgerEntry } from '../src/ledger/entities/ledger-entry.entity';
import { moneyToCents, centsToMoney } from '../src/common/money';
import { executeBatchWithFallback } from '../src/batch-processing/execute-batch';

async function balances() {
  const rows = await dataSource.getRepository(Account).find({ where: [
    { accountNumber: FIRST_ACCOUNT }, { accountNumber: SECOND_ACCOUNT },
  ] });
  if (rows.length !== 2) throw new Error('Demo accounts are missing');
  return new Map(rows.map((account) => [account.accountNumber, moneyToCents(account.balance)]));
}

async function main() {
  requireSafeBatchDatabase();
  if (process.env.BANKFLOW_QUEUE_ENABLED === 'true' || process.env.BANKFLOW_BATCH_QUEUE_ENABLED === 'true') {
    throw new Error('Disable server queues for this standalone demo (BANKFLOW_*_ENABLED=false)');
  }
  await dataSource.initialize();
  const queueName = 'bankflow-batch-demo-standalone';
  const connection = { host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379), maxRetriesPerRequest: null };
  const queue = new Queue<{ transfers: TransferCandidate[] }>(queueName, { connection });
  const service = new TransactionsService(dataSource, new LedgerService(), new IdempotencyService());
  const worker = new Worker<{ transfers: TransferCandidate[] }>(queueName, (job) => executeBatchWithFallback(service, job.data.transfers), {
    connection, concurrency: 1,
  });
  try {
    await Promise.all([queue.waitUntilReady(), worker.waitUntilReady()]);
    const transfers = await loadDemoTransfers(dataSource);
    const plan = planTransfersByRecipient(transfers, 10);
    if (plan.inputJobs !== 100 || plan.batches.length !== 11) throw new Error('Incorrect demo plan');
    const before = await balances();
    const ledgerBefore = await dataSource.getRepository(LedgerEntry).count();
    const existingIds = await dataSource.query(
      'SELECT key::text AS key FROM idempotency_keys WHERE key = ANY($1::uuid[])',
      [transfers.map((transfer) => transfer.idempotencyKey)],
    ) as { key: string }[];
    const previouslyHandled = new Set(existingIds.map((row) => row.key));
    const jobs = [];
    for (const batch of plan.batches) {
      const job = await queue.add('commit-batch', { transfers: batch.transfers }, {
        jobId: `demo-${randomUUID()}`,
        attempts: 3, backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: false, removeOnFail: false,
      });
      jobs.push(job);
    }
    const outcomes = [];
    for (const job of jobs) {
      const until = Date.now() + 120000;
      let state = await job.getState();
      while (state !== 'completed' && state !== 'failed' && Date.now() < until) {
        await new Promise((r) => setTimeout(r, 250));
        state = await job.getState();
      }
      if (state !== 'completed') throw new Error(`Batch ${job.id} not completed: ${state}`);
      outcomes.push(job.id);
    }
    const after = await balances();
    const expected = new Map<string, bigint>([[FIRST_ACCOUNT, 0n], [SECOND_ACCOUNT, 0n]]);
    let newCount = 0;
    for (const transfer of transfers) {
      if (previouslyHandled.has(transfer.idempotencyKey)) continue;
      const [whole, fraction = ''] = transfer.amount.split('.');
      const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
      expected.set(transfer.toAccountNumber, expected.get(transfer.toAccountNumber)! + cents);
      newCount++;
    }
    for (const [recipient, amount] of expected) {
      const delta = after.get(recipient)! - before.get(recipient)!;
      if (delta !== amount) throw new Error(`Recipient delta mismatch: ${recipient} ${centsToMoney(delta)}, expected ${centsToMoney(amount)}`);
    }
    const ledgerAfter = await dataSource.getRepository(LedgerEntry).count();
    if (ledgerAfter - ledgerBefore !== 2 * newCount) {
      throw new Error(`Ledger change mismatch: got ${ledgerAfter - ledgerBefore}, expected ${2 * newCount}`);
    }
    const confirmed = await dataSource.query(
      'SELECT key::text AS key FROM idempotency_keys WHERE key = ANY($1::uuid[])',
      [transfers.map((transfer) => transfer.idempotencyKey)],
    ) as { key: string }[];
    if (confirmed.length !== 100) throw new Error(`Only ${confirmed.length}/100 idempotency requests are confirmed`);
    const mismatches = await dataSource.query(`
      SELECT a.account_number AS account_number
      FROM accounts a LEFT JOIN ledger_entries l ON l.account_id = a.id
      WHERE a.account_number LIKE '98000000%'
      GROUP BY a.id, a.account_number, a.balance
      HAVING a.balance <> COALESCE(SUM(CASE
        WHEN l.type = 'CREDIT' THEN l.amount
        WHEN l.type = 'DEBIT' THEN -l.amount
        ELSE 0 END), 0)
    `) as { account_number: string }[];
    if (mismatches.length) throw new Error(`Ledger reconciliation mismatch on ${mismatches.length} demo accounts`);
    console.log(JSON.stringify({
      mode: 'LIVE_TEST_DATABASE_ONLY',
      requests: 100, batches: outcomes.length, newTransfersCommitted: newCount, replays: 100 - newCount,
      ledgerEntriesCreated: ledgerAfter - ledgerBefore, reconciliation: 'PASS',
      recipients: { lotteJobs: 65, kfcJobs: 35 },
      receiverBalancesBefore: Object.fromEntries([...before].map(([k, v]) => [k, centsToMoney(v)])),
      receiverBalancesAfter: Object.fromEntries([...after].map(([k, v]) => [k, centsToMoney(v)])),
      note: 'Run 1 transfers money, repeat runs with same idempotency keys must not add money again',
    }, null, 2));
  } finally {
    await worker.close();
    await queue.close();
    await dataSource.destroy();
  }
}
main().catch((error) => { console.error('BATCH QUEUE FAIL:', error.message); process.exitCode = 1; });
