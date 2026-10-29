import { planTransfersByRecipient, TransferCandidate } from '../src/batch-planning/batch-planner';

const LOTTE = '900000000002';
const KFC = '900000000003';

const jobs: TransferCandidate[] = Array.from({ length: 100 }, (_, index) => ({
  jobId: `job-${index + 1}`,
  userId: `sender-${index + 1}`,
  idempotencyKey: `request-${index + 1}`,
  toAccountNumber: index < 65 ? LOTTE : KFC,
  amount: index % 2 === 0 ? '50000.00' : '120000.00',
  description: 'Demo capacity planning only',
}));

const plan = planTransfersByRecipient(jobs, 10);
const byRecipient = Object.fromEntries([LOTTE, KFC].map((recipient) => [recipient, {
  jobs: plan.batches.filter((batch) => batch.recipientAccountNumber === recipient).reduce((count, batch) => count + batch.jobCount, 0),
  batches: plan.batches.filter((batch) => batch.recipientAccountNumber === recipient).length,
  totals: plan.batches.filter((batch) => batch.recipientAccountNumber === recipient).map((batch) => batch.totalAmount),
}]));

process.stdout.write(JSON.stringify({
  warning: 'PREVIEW ONLY: no Redis, PostgreSQL, account balances or ledger were modified',
  inputJobs: plan.inputJobs,
  uniqueJobs: plan.uniqueJobs,
  batchSize: plan.batchSize,
  totalBatches: plan.batches.length,
  byRecipient,
}, null, 2) + '\n');
