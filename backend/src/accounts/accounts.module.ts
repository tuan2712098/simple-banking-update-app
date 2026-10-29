import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Account } from './entities/account.entity';
import { AccountHistory } from './entities/account-history.entity';
import { AccountsController } from './accounts.controller';
import { TellerLookupController } from './teller-lookup.controller';
import { SecurityModule } from '../security/security.module';
import { AccountsService } from './accounts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Account, AccountHistory]), PassportModule.register({ defaultStrategy: 'jwt' }), SecurityModule],
  controllers: [AccountsController, TellerLookupController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
