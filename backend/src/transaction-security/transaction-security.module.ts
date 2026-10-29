import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentChallenge } from './entities/payment-challenge.entity';
import { TransactionSecurityController } from './transaction-security.controller';
import { TransactionSecurityService } from './transaction-security.service';

@Module({ imports: [TypeOrmModule.forFeature([PaymentChallenge])], controllers: [TransactionSecurityController], providers: [TransactionSecurityService], exports: [TransactionSecurityService] })
export class TransactionSecurityModule {}
