import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TransferCandidate } from '../batch-planning/batch-planner';
import { TransactionsService } from '../transactions/transactions.service';

export async function executeBatchWithFallback(service: TransactionsService, transfers: TransferCandidate[]) {
  try {
    const result = await service.commitBatch(transfers);
    return { mode: 'aggregated', ...result };
  } catch (error) {
    if (!(error instanceof BadRequestException || error instanceof ConflictException ||
      error instanceof ForbiddenException || error instanceof NotFoundException)) throw error;
    const results: Array<{ jobId: string; status: string; transfer?: unknown; reason?: string }> = [];
    for (const transfer of transfers) {
      try {
        const response = await service.transfer(transfer.userId, {
          toAccountNumber: transfer.toAccountNumber,
          amount: transfer.amount,
          description: transfer.description,
        }, transfer.idempotencyKey);
        results.push({ jobId: transfer.jobId, status: (response as { status?: string }).status || 'UNKNOWN', transfer: response });
      } catch (individualError) {
        if (!(individualError instanceof BadRequestException || individualError instanceof ConflictException ||
          individualError instanceof ForbiddenException || individualError instanceof NotFoundException)) throw individualError;
        results.push({ jobId: transfer.jobId, status: 'FAILED', reason: individualError.message });
      }
    }
    return { mode: 'individual-fallback', recipientAccountNumber: transfers[0]?.toAccountNumber, results };
  }
}
