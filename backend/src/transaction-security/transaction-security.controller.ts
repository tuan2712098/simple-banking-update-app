import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request';
import { ChallengeRequestDto, ChallengeVerifyDto, SetPinDto } from './dto/security.dto';
import { TransactionSecurityService } from './transaction-security.service';

@UseGuards(JwtAuthGuard)
@Controller('transaction-security')
export class TransactionSecurityController {
  constructor(private readonly security: TransactionSecurityService) {}

  @Get('pin-status') pinStatus(@Req() req: AuthenticatedRequest) {
    return this.security.getPinStatus(req.user.userId);
  }
  @Post('pin') @Throttle({ default: {limit: 5, ttl: 60000} })
  setPin(@Req() req: AuthenticatedRequest, @Body() dto: SetPinDto) {
    return this.security.setPin(req.user.userId, dto.pin, dto.currentPassword, dto.currentPin);
  }
  @Post('request') @Throttle({ default: {limit: 5, ttl: 60000} })
  request(@Req() req: AuthenticatedRequest, @Body() dto: ChallengeRequestDto) {
    return this.security.request(req.user.userId, req.user.role, dto.action, dto.payload, dto.pin);
  }
  @Post('verify') @Throttle({ default: {limit: 5, ttl: 60000} })
  verify(@Req() req: AuthenticatedRequest, @Body() dto: ChallengeVerifyDto) {
    return this.security.verify(req.user.userId, dto.challengeId, dto.otp);
  }
}
