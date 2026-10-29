import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { AuthenticatedRequest } from '../common/auth-request';
import { AiService } from './ai.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  @Get('spending/overview')
  spending(@Req() req: AuthenticatedRequest, @Query('month') month?: string) {
    return this.service.getSpending(req.user.userId, month);
  }

  @Get('fraud/overview')
  @Roles(UserRole.ADMIN)
  fraud() {
    return this.service.getFraudOverview();
  }
}
