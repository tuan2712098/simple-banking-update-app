import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiInsightsService } from './ai-insights.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Account]), PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AiController],
  providers: [AiService, AiInsightsService],
})
export class AiModule {}
