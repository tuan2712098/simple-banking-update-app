import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { QueuedTransferController } from './queued-transfer.controller';
import { QueuedTransferService } from './queued-transfer.service';

@Module({
  imports: [TransactionsModule],
  controllers: [QueuedTransferController],
  providers: [QueuedTransferService],
})
export class QueuedTransferModule {}
