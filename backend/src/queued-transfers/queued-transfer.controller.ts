import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedRequest } from '../common/auth-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserThrottleGuard } from '../security/user-throttle.guard';
import { TransferDto } from '../transactions/dto/transfer.dto';
import { QueuedTransferService } from './queued-transfer.service';

@UseGuards(JwtAuthGuard, UserThrottleGuard)
@Controller('queued-transfers')
export class QueuedTransferController {
  constructor(private readonly queueService: QueuedTransferService) {}

  @Post()
  @Throttle({ default: { limit: 80, ttl: 60000 } })
  enqueue(@Req() request: AuthenticatedRequest, @Body() dto: TransferDto, @Headers('idempotency-key') key: string) {
    return this.queueService.enqueue(request.user.userId, dto, key, request.requestId);
  }

  @Get(':jobId')
  status(@Req() request: AuthenticatedRequest, @Param('jobId') jobId: string) {
    return this.queueService.status(request.user.userId, jobId);
  }
}
