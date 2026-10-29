import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../security/roles.guard';
import { Roles } from '../security/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { Audit } from '../audit/audit.decorator';
import { AccountsService } from './accounts.service';

@Controller('teller/accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TELLER, UserRole.ADMIN)
export class TellerLookupController {
  constructor(private readonly accounts: AccountsService) {}

  @Get(':accountNumber')
  @Audit('lookup_account', 'account')
  lookup(@Param('accountNumber') accountNumber: string) {
    return this.accounts.lookupForTeller(accountNumber);
  }
}
