import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { AuthenticatedRequest } from '../common/auth-request';
import { AiService } from './ai.service';
import { AiInsightsService } from './ai-insights.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService, private readonly insights: AiInsightsService) {}

  @Get('spending/overview')
  spending(@Req() req: AuthenticatedRequest, @Query('month') month?: string) {
    return this.service.getSpending(req.user.userId, month);
  }

  @Get('insights')
  @Roles(UserRole.CUSTOMER)
  insight(@Req() req: AuthenticatedRequest, @Query('month') month?: string) {
    return this.insights.getInsights(req.user.userId, month);
  }

  @Get('transfer-check')
  @Roles(UserRole.CUSTOMER)
  transferCheck(@Req() req: AuthenticatedRequest, @Query('toAccountNumber') to = '', @Query('amount') amount = '') {
    return this.insights.checkTransfer(req.user.userId, to, amount);
  }

  @Get('fraud/overview')
  @Roles(UserRole.ADMIN)
  fraud() {
    return this.service.getFraudOverview();
  }
}
