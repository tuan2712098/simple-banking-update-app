import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { LedgerModule } from '../ledger/ledger.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { SecurityModule } from '../security/security.module';
import { TransactionCryptoModule } from '../crypto/transaction-crypto.module';
import { TransactionSecurityModule } from '../transaction-security/transaction-security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    LedgerModule,
    IdempotencyModule,
    SecurityModule,
    TransactionCryptoModule,
    TransactionSecurityModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
