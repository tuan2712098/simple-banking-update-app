import * as assert from 'node:assert/strict';
import { planTransfersByRecipient, TransferCandidate } from '../src/batch-planning/batch-planner';

function create(jobId: string, recipient: string, amount = '100000.00'): TransferCandidate {
  return {
    jobId,
    userId: `sender-${jobId}`,
    idempotencyKey: `key-${jobId}`,
    toAccountNumber: recipient,
    amount,
    description: 'Demo transfer',
  };
}

const LOTTE = '900000000002';
const KFC = '900000000003';

const jobs = Array.from({ length: 100 }, (_, index) => create(`${index + 1}`, index < 65 ? LOTTE : KFC));
const plan = planTransfersByRecipient(jobs, 10);
assert.equal(plan.inputJobs, 100);
assert.equal(plan.uniqueJobs, 100);
assert.equal(plan.batches.length, 11);
assert.equal(plan.batches.filter((batch) => batch.recipientAccountNumber === LOTTE).length, 7);
assert.equal(plan.batches.filter((batch) => batch.recipientAccountNumber === KFC).length, 4);
assert.equal(plan.batches.reduce((sum, batch) => sum + batch.jobCount, 0), 100);
assert.ok(plan.batches.every((batch) => batch.jobCount <= 10));

const varied = planTransfersByRecipient([create('a', LOTTE, '50000.00'), create('b', LOTTE, '120000.00'), create('c', LOTTE, '230000.00')], 10);
assert.equal(varied.batches[0].totalAmount, '400000.00');
assert.equal(varied.batches[0].jobCount, 3);

const repeated = planTransfersByRecipient([create('a', LOTTE), create('a', LOTTE)], 10);
assert.equal(repeated.uniqueJobs, 1);
assert.equal(repeated.repeatedJobsIgnored, 1);
assert.equal(repeated.batches[0].totalAmount, '100000.00');

const changedPayload = { ...create('a', LOTTE), amount: '200000.00' };
assert.throws(() => planTransfersByRecipient([create('a', LOTTE), changedPayload], 10), /Idempotency-Key reused/);
assert.throws(() => planTransfersByRecipient([create('a', LOTTE, '0.00')], 10), /Invalid positive amount/);
assert.throws(() => planTransfersByRecipient(jobs, 0), /batchSize/);
assert.throws(() => planTransfersByRecipient(jobs, 1.5), /batchSize/);
assert.throws(() => planTransfersByRecipient([create('a', LOTTE, '9999999999999999.99'), create('b', LOTTE, '1.00')], 10), /exceeds numeric/);
assert.throws(() => planTransfersByRecipient([create('a', LOTTE), { ...create('b', LOTTE), jobId: 'a' }], 10), /jobId reused/);

process.stdout.write('PASS: 10 checks for grouping, chunk size, money precision, duplicates and invalid data\n');
