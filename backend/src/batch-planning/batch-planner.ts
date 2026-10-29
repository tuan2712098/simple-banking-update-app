import { createHash } from 'node:crypto';

export type TransferCandidate = {
  jobId: string;
  userId: string;
  idempotencyKey: string;
  toAccountNumber: string;
  amount: string;
  description: string;
};

export type PlannedBatch = {
  batchId: string;
  recipientAccountNumber: string;
  jobCount: number;
  totalAmount: string;
  jobIds: string[];
  transfers: TransferCandidate[];
};

export type BatchPlan = {
  inputJobs: number;
  uniqueJobs: number;
  repeatedJobsIgnored: number;
  batchSize: number;
  batches: PlannedBatch[];
};

const MAX_NUMERIC_18_2_CENTS = 999999999999999999n;

function parsePositiveMoneyCents(value: string): bigint {
  if (typeof value !== 'string' || !/^(?!0+(?:\.0{1,2})?$)\d{1,16}(?:\.\d{1,2})?$/.test(value)) {
    throw new Error('Invalid positive amount');
  }
  const [whole, fraction = ''] = value.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents <= 0n || cents > MAX_NUMERIC_18_2_CENTS) throw new Error('Amount is outside numeric(18,2)');
  return cents;
}

function formatCents(value: bigint): string {
  if (value > MAX_NUMERIC_18_2_CENTS) throw new Error('Batch total exceeds numeric(18,2)');
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

function requireNonEmpty(value: string, name: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${name} is required`);
}

export function planTransfersByRecipient(transfers: TransferCandidate[], batchSize: number): BatchPlan {
  if (!Array.isArray(transfers)) throw new Error('transfers must be an array');
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new Error('batchSize must be an integer between 1 and 100');
  }

  const uniqueByIdempotency = new Map<string, { candidate: TransferCandidate; payload: string }>();
  const uniqueJobIds = new Map<string, string>();
  const groups = new Map<string, TransferCandidate[]>();
  let repeatedJobsIgnored = 0;

  for (const transfer of transfers) {
    if (!transfer || typeof transfer !== 'object') throw new Error('Invalid transfer candidate');
    requireNonEmpty(transfer.jobId, 'jobId');
    requireNonEmpty(transfer.userId, 'userId');
    requireNonEmpty(transfer.idempotencyKey, 'idempotencyKey');
    requireNonEmpty(transfer.description, 'description');
    if (typeof transfer.toAccountNumber !== 'string' || !/^\d{8,30}$/.test(transfer.toAccountNumber)) {
      throw new Error('Invalid recipient account number');
    }
    parsePositiveMoneyCents(transfer.amount);

    const identity = `${transfer.userId}:${transfer.idempotencyKey}`;
    const payload = JSON.stringify({ toAccountNumber: transfer.toAccountNumber, amount: transfer.amount, description: transfer.description });
    const seenJobIdentity = uniqueJobIds.get(transfer.jobId);
    if (seenJobIdentity !== undefined && seenJobIdentity !== identity) throw new Error('jobId reused for a different request');
    uniqueJobIds.set(transfer.jobId, identity);

    const existing = uniqueByIdempotency.get(identity);
    if (existing) {
      if (existing.payload !== payload) throw new Error('Idempotency-Key reused with different payload');
      repeatedJobsIgnored += 1;
      continue;
    }
    uniqueByIdempotency.set(identity, { candidate: transfer, payload });
    const group = groups.get(transfer.toAccountNumber) ?? [];
    group.push(transfer);
    groups.set(transfer.toAccountNumber, group);
  }

  const batches: PlannedBatch[] = [];
  for (const [recipientAccountNumber, group] of groups) {
    for (let index = 0; index < group.length; index += batchSize) {
      const chunk = group.slice(index, index + batchSize);
      const cents = chunk.reduce((sum, job) => sum + parsePositiveMoneyCents(job.amount), 0n);
      const identity = `${recipientAccountNumber}:${chunk.map((job) => `${job.userId}:${job.idempotencyKey}`).join('|')}`;
      const batchId = createHash('sha256').update(identity).digest('hex');
      batches.push({
        batchId,
        recipientAccountNumber,
        jobCount: chunk.length,
        totalAmount: formatCents(cents),
        jobIds: chunk.map((job) => job.jobId),
        transfers: chunk,
      });
    }
  }

  return {
    inputJobs: transfers.length,
    uniqueJobs: uniqueByIdempotency.size,
    repeatedJobsIgnored,
    batchSize,
    batches,
  };
}
