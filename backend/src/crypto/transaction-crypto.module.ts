import { Module } from '@nestjs/common';
import { TransactionCryptoService } from './transaction-crypto.service';

@Module({ providers: [TransactionCryptoService], exports: [TransactionCryptoService] })
export class TransactionCryptoModule {}
