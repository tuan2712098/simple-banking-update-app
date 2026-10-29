import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedRequest } from '../common/auth-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../security/roles.guard';
import { Roles } from '../security/roles.decorator';
import { UserThrottleGuard } from '../security/user-throttle.guard';
import { UserRole } from '../users/entities/user.entity';
import { Audit } from '../audit/audit.decorator';
import { TransferDto } from './dto/transfer.dto';
import { TellerTransferDto } from './dto/teller.dto';
import { ConfirmOtpDto } from './dto/otp.dto';
import { DepositDto } from './dto/money.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { TransactionsService } from './transactions.service';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Post('transfer')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 80, ttl: 60000 } })
  @Audit('transfer', 'transaction')
  transfer(@Req() request: AuthenticatedRequest, @Body() dto: TransferDto, @Headers('idempotency-key') key: string, @Headers('x-transaction-authorization') token: string) {
    return this.transactions.transfer(request.user.userId, dto, key, request.requestId, request.user.userId, false, token);
  }

  @Post('transfer-optimistic')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 80, ttl: 60000 } })
  transferOptimistic(@Req() request: AuthenticatedRequest, @Body() dto: TransferDto, @Headers('idempotency-key') key: string, @Headers('x-transaction-authorization') token: string) {
    return this.transactions.transfer(request.user.userId, dto, key, request.requestId, request.user.userId, true, token);
  }

  @Post('confirm-otp')
  @Audit('confirm_otp', 'transaction')
  confirmOtp(@Req() request: AuthenticatedRequest, @Body() dto: ConfirmOtpDto) {
    return this.transactions.confirmOtp(request.user.userId, dto.transactionId, dto.otp);
  }

  @Post('deposit')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TELLER, UserRole.ADMIN)
  @Audit('deposit', 'transaction')
  deposit(@Req() request: AuthenticatedRequest, @Body() dto: DepositDto, @Headers('x-transaction-authorization') token: string) {
    return this.transactions.deposit(dto.accountNumber, dto.amount, request.user.userId, token);
  }

  @Post('teller-transfer')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TELLER, UserRole.ADMIN)
  @Audit('teller_transfer', 'transaction')
  tellerTransfer(@Req() request: AuthenticatedRequest, @Body() dto: TellerTransferDto, @Headers('idempotency-key') key: string, @Headers('x-transaction-authorization') token: string) {
    return this.transactions.transfer(request.user.userId, dto, key, request.requestId, dto.ownerId, false, token);
  }

  @Get('receipt-public-key')
  getReceiptPublicKey() {
    return this.transactions.getReceiptPublicKey();
  }

  @Get(':id/receipt')
  getReceipt(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.transactions.getReceipt(request.user.userId, id);
  }

  @Get()
  getHistory(@Req() request: AuthenticatedRequest, @Query() query: TransactionQueryDto) {
    return this.transactions.getHistory(request.user.userId, query);
  }
}
