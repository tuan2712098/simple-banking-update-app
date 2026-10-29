import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { sha256 } from '../common/hash';
import { checkAmount } from '../common/money';
import { TransferCandidate, planTransfersByRecipient } from '../batch-planning/batch-planner';
import { TransactionsService } from '../transactions/transactions.service';
import { executeBatchWithFallback } from './execute-batch';

@Injectable()
export class BatchQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BatchQueueService.name);
  private queue: Queue<{ transfers: TransferCandidate[] }> | null = null;
  private worker: Worker<{ transfers: TransferCandidate[] }> | null = null;
  constructor(private readonly transactions: TransactionsService) {}

  private permitted() {
    return process.env.DB_DATABASE === 'simple_banking_race_test' &&
      process.env.DB_SYNCHRONIZE !== 'true' &&
      process.env.BANKFLOW_BATCH_QUEUE_ENABLED === 'true' &&
      process.env.NODE_ENV !== 'production';
  }

  async onModuleInit() {
    if (process.env.BANKFLOW_BATCH_QUEUE_ENABLED !== 'true') return;
    if (!this.permitted()) throw new Error('Batch PoC only allowed on simple_banking_race_test with DB_SYNCHRONIZE=false');
    const connection = { host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT || '6379'), maxRetriesPerRequest: null };
    const name = 'bankflow-batch-transfer-poc';
    this.queue = new Queue(name, { connection });
    this.worker = new Worker(name, async (job) => executeBatchWithFallback(this.transactions, job.data.transfers), {
      connection,
      concurrency: Math.max(1, Math.min(3, Number(process.env.BANKFLOW_BATCH_WORKER_CONCURRENCY || '1') || 1)),
    });
    this.worker.on('failed', (job, error) => this.logger.warn(`Batch ${job?.id} failed: ${error.message}`));
    this.worker.on('error', (error) => this.logger.error(error.message));
    await Promise.all([this.queue.waitUntilReady(), this.worker.waitUntilReady()]);
    this.logger.log('Batch PoC enabled on test database');
  }

  private requireQueue() {
    if (!this.permitted() || !this.queue) throw new ServiceUnavailableException('Batch PoC is disabled');
    return this.queue;
  }

  async enqueue(transfers: TransferCandidate[]) {
    const queue = this.requireQueue();
    for (const transfer of transfers) {
      if (checkAmount(transfer.amount) >= 10_000_000n * 100n) {
        throw new BadRequestException('Batch PoC excludes transfers requiring OTP');
      }
    }
    const plan = planTransfersByRecipient(transfers, 20);
    if (plan.batches.length !== 1 || plan.uniqueJobs !== transfers.length) {
      throw new BadRequestException('Send 1-20 unique transfers to one recipient per batch');
    }
    const batch = plan.batches[0];
    const payloadHash = sha256(JSON.stringify(transfers.map((t) => ({ userId: t.userId, idempotencyKey: t.idempotencyKey, toAccountNumber: t.toAccountNumber, amount: t.amount, description: t.description }))));
    const job = await queue.add('batch-transfer', { transfers }, {
      jobId: `batch-${payloadHash}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: false,
      removeOnFail: false,
    });
    return { batchId: batch.batchId, jobId: job.id, state: await job.getState(), message: 'ACCEPTED is not COMMITTED' };
  }

  async status(jobId: string) {
    const job = await this.requireQueue().getJob(jobId);
    if (!job) throw new NotFoundException('Batch job not found');
    const state = await job.getState();
    return { jobId, state, ...(state === 'completed' ? { result: job.returnvalue } : {}),
      ...(state === 'failed' ? { failedReason: job.failedReason } : {}) };
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}
