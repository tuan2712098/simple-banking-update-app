import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../security/roles.guard';
import { Roles } from '../security/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { BatchQueueService } from './batch-queue.service';
import { BatchEnqueueDto } from './dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/batch-poc')
export class BatchQueueController {
  constructor(private readonly queue: BatchQueueService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  enqueue(@Body() body: BatchEnqueueDto) {
    return this.queue.enqueue(body.transfers);
  }

  @Get(':jobId')
  status(@Param('jobId') jobId: string) {
    return this.queue.status(jobId);
  }
}
