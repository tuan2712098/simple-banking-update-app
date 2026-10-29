import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { BatchQueueController } from './batch-queue.controller';
import { BatchQueueService } from './batch-queue.service';

@Module({
  imports: [TransactionsModule],
  controllers: [BatchQueueController],
  providers: [BatchQueueService],
})
export class BatchQueueModule {}
