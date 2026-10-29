import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { checkAmount } from '../common/money';
import { sha256 } from '../common/hash';
import { TransferDto } from '../transactions/dto/transfer.dto';
import { TransactionsService } from '../transactions/transactions.service';

type TransferJobData = {
  userId: string;
  key: string;
  requestId?: string;
  dto: TransferDto;
};

@Injectable()
export class QueuedTransferService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueuedTransferService.name);
  private queue: Queue<TransferJobData> | null = null;
  private worker: Worker<TransferJobData> | null = null;

  constructor(private readonly transactions: TransactionsService) {}

  async onModuleInit() {
    if (process.env.BANKFLOW_QUEUE_ENABLED !== 'true') return;
    if (!(process.env.DB_DATABASE || '').endsWith('_test')) {
      throw new Error('Queue PoC requires a dedicated database ending in _test');
    }
    const connection = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    };
    const concurrency = Math.max(1, Math.min(10, Number(process.env.BANKFLOW_WORKER_CONCURRENCY || '1') || 1));
    this.queue = new Queue<TransferJobData>('bankflow-transfer-poc', { connection });
    this.worker = new Worker<TransferJobData>('bankflow-transfer-poc', async (job) => {
      try {
        return await this.transactions.transfer(job.data.userId, job.data.dto, job.data.key, job.data.requestId);
      } catch (error) {
        if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) {
          throw new UnrecoverableError(error.message);
        }
        throw error;
      }
    }, { connection, concurrency });
    this.worker.on('failed', (job, error) => {
      this.logger.warn(`Queue job ${job?.id || 'unknown'} failed: ${error.name}`);
    });
    this.worker.on('error', (error) => {
      this.logger.error(`Queue worker error: ${error.message}`);
    });
    await Promise.all([this.queue.waitUntilReady(), this.worker.waitUntilReady()]);
    this.logger.log(`Queue PoC enabled with concurrency ${concurrency}`);
  }

  private ready() {
    if (!this.queue) throw new ServiceUnavailableException('Queue PoC is disabled');
    return this.queue;
  }

  async enqueue(userId: string, dto: TransferDto, key: string, requestId?: string) {
    if (!(process.env.BANKFLOW_ALLOW_INSECURE_BATCH_POC === 'true' && (process.env.DB_DATABASE || '').endsWith('_test'))) throw new ServiceUnavailableException('Queue PoC chưa hỗ trợ xác thực OTP từng giao dịch và chỉ được dùng trong DB test');
    const queue = this.ready();
    if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
      throw new BadRequestException('Idempotency-Key must be UUID');
    }
    if (checkAmount(dto.amount) >= 10_000_000n * 100n) {
      throw new BadRequestException('Queue PoC accepts only transfers below OTP threshold');
    }
    const jobId = sha256(`${userId}:${key}`);
    const job = await queue.add('transfer', { userId, key, dto, requestId }, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: false,
      removeOnFail: false,
    });
    const actual = await queue.getJob(jobId);
    if (!actual || actual.data.userId !== userId || actual.data.dto.toAccountNumber !== dto.toAccountNumber || actual.data.dto.amount !== dto.amount || actual.data.dto.description !== dto.description) {
      throw new ConflictException('Idempotency-Key reused with different payload');
    }
    const state = await actual.getState();
    return { jobId: job.id, status: state === 'completed' ? 'ALREADY_PROCESSED' : 'ACCEPTED', transferStatus: state === 'completed' ? actual.returnvalue : 'PENDING' };
  }

  async status(userId: string, jobId: string) {
    const job = await this.ready().getJob(jobId);
    if (!job || job.data.userId !== userId) throw new NotFoundException('Job not found');
    const state = await job.getState();
    return {
      jobId: job.id,
      queueState: state,
      ...(state === 'completed' ? { transferResult: job.returnvalue } : {}),
      ...(state === 'failed' ? { transferStatus: 'FAILED' } : {}),
    };
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}
