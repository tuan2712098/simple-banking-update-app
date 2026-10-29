import { TransferCandidate } from '../batch-planning/batch-planner';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { TransactionSecurityService } from '../transaction-security/transaction-security.service';
import { PaymentAction } from '../transaction-security/dto/security.dto';
import { TransactionCryptoService } from '../crypto/transaction-crypto.service';
import { ReceiptFields } from '../crypto/transaction-crypto';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager, LessThan } from 'typeorm';
import { Account, AccountStatus, AccountTier } from '../accounts/entities/account.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { checkAmount, centsToMoney, moneyToCents } from '../common/money';
import { changeTransactionStatus } from '../common/transaction-state';
import { LedgerService } from '../ledger/ledger.service';
import { LedgerEntry, LedgerEntryType } from '../ledger/entities/ledger-entry.entity';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { TransferDto } from './dto/transfer.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { ReviewStatus, Transaction, TransactionStatus, TransactionType } from './entities/transaction.entity';

class VersionConflict extends Error {}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ledger: LedgerService,
    private readonly idempotency: IdempotencyService,
    private readonly transactionCrypto: TransactionCryptoService,
    private readonly paymentSecurity: TransactionSecurityService,
  ) {}

  private async lockedAccounts(manager: EntityManager, firstId: string, secondId: string) {
    const rows = new Map<string, Account>();
    for (const id of [firstId, secondId].sort()) {
      const row = await manager.getRepository(Account).createQueryBuilder('account')
        .where('account.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!row) throw new NotFoundException('Account not found');
      rows.set(id, row);
    }
    return [rows.get(firstId)!, rows.get(secondId)!] as const;
  }

  private async updateAccount(manager: EntityManager, account: Account, change: bigint, useOptimistic = false) {
    if (useOptimistic) {
      const result = await manager.getRepository(Account).createQueryBuilder().update(Account)
        .set({ balance: () => 'balance + :delta', version: () => 'version + 1' })
        .where('id = :id AND version = :version AND balance + :delta >= 0', {
          id: account.id,
          version: account.version,
          delta: centsToMoney(change),
        }).execute();
      if (result.affected !== 1) throw new VersionConflict('Concurrent modification');
    } else {
      account.balance = centsToMoney(moneyToCents(account.balance) + change);
      await manager.getRepository(Account).save(account);
    }
    account.balance = centsToMoney(moneyToCents(account.balance) + (useOptimistic ? change : 0n));
  }

  private ensureActive(account: Account, owner: User) {
    if (account.status !== AccountStatus.ACTIVE || owner.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Account is frozen, closed or unavailable');
    }
    if (account.currency !== 'VND') throw new BadRequestException('Currency must be VND');
  }

  private async limitCheck(manager: EntityManager, source: Account, amount: bigint) {
    const perTransfer = source.tier === AccountTier.VIP ? 50_000_000n : 20_000_000n;
    const daily = source.tier === AccountTier.VIP ? 200_000_000n : 50_000_000n;
    if (amount > perTransfer * 100n) throw new BadRequestException('Per-transaction limit exceeded');
    const result = await manager.query(`
      SELECT COALESCE(SUM(amount), 0)::text AS spent
      FROM transactions
      WHERE from_account_id = $1
        AND type IN ('transfer', 'withdrawal')
        AND status IN ('COMPLETED', 'REVERSED')
        AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    `, [source.id]) as { spent: string }[];
    if (moneyToCents(result[0].spent) + amount > daily * 100n) {
      throw new BadRequestException('Daily transaction limit exceeded');
    }
  }

  private async fraudReview(manager: EntityManager, source: Account, amount: bigint) {
    const result = await manager.query(`
      SELECT COUNT(*)::int AS count,
        COALESCE(TRUNC(AVG(amount) * 100), 0)::text AS avg_cents
      FROM transactions
      WHERE from_account_id = $1
        AND status = 'COMPLETED'
        AND created_at >= now() - interval '30 days'
    `, [source.id]) as { count: number; avg_cents: string }[];
    const recent = await manager.query(`
      SELECT COUNT(*)::int AS count FROM transactions
      WHERE from_account_id = $1 AND status = 'COMPLETED'
        AND created_at >= now() - interval '1 minute'
    `, [source.id]) as { count: number }[];
    const average = BigInt(result[0].avg_cents);
    return recent[0].count >= 5 || (result[0].count > 0 && average > 0n && amount > average * 5n);
  }

  private publicTransaction(transaction: Transaction, from: Account, to: Account) {
    return {
      id: transaction.id,
      fromAccountNumber: from.accountNumber,
      toAccountNumber: to.accountNumber,
      amount: transaction.amount,
      type: transaction.type,
      status: transaction.status,
      description: transaction.description,
      reviewStatus: transaction.reviewStatus,
      createdAt: transaction.createdAt,
    };
  }

  private receiptFields(tx: Transaction, source: Account, destination: Account): ReceiptFields {
    return {
      id: tx.id,
      fromAccountNumber: source.accountNumber,
      toAccountNumber: destination.accountNumber,
      amount: tx.amount,
      type: tx.type,
      description: tx.description,
      createdAt: tx.createdAt,
    };
  }

  private async signCompletedTransfer(manager: EntityManager, tx: Transaction, source: Account, destination: Account) {
    if (tx.type !== TransactionType.TRANSFER || tx.status !== TransactionStatus.COMPLETED) return;
    if (tx.receiptHash) return; // Avoid overwriting an earlier signature.
    const signed = this.transactionCrypto.sign(this.receiptFields(tx, source, destination));
    if (!signed) return;
    // This update is part of the SAME database transaction as the balance and ledger writes.
    await manager.getRepository(Transaction).update(tx.id, signed);
    Object.assign(tx, signed);
  }

  getReceiptPublicKey() {
    return this.transactionCrypto.getPublicKey();
  }

  async getReceipt(userId: string, transactionId: string) {
    const tx = await this.dataSource.getRepository(Transaction).createQueryBuilder('t')
      .addSelect('t.receiptSignature')
      .leftJoinAndSelect('t.fromAccount', 'source')
      .leftJoinAndSelect('t.toAccount', 'destination')
      .leftJoinAndSelect('source.user', 'sender')
      .leftJoinAndSelect('destination.user', 'recipient')
      .where('t.id = :id', { id: transactionId }).getOne();
    if (!tx || !tx.fromAccount || !tx.toAccount) throw new NotFoundException('Transfer receipt not found');
    if (tx.fromAccount.user?.id !== userId && tx.toAccount.user?.id !== userId) {
      throw new ForbiddenException('You cannot view this transfer receipt');
    }
    if (tx.type !== TransactionType.TRANSFER) throw new BadRequestException('Receipts are only available for transfers');
    const signed = Boolean(tx.receiptSignature && tx.receiptHash && tx.receiptKeyId);
    return {
      transactionId: tx.id,
      status: tx.status,
      signed,
      verified: signed && this.transactionCrypto.verify(
        this.receiptFields(tx, tx.fromAccount, tx.toAccount),
        tx.receiptHash, tx.receiptSignature, tx.receiptKeyId,
      ),
      algorithm: 'Ed25519',
      hashAlgorithm: 'SHA-256',
      receiptHash: tx.receiptHash,
      signature: tx.receiptSignature || null,
      keyId: tx.receiptKeyId,
      // These fields reproduce the canonical signed receipt without exposing unrelated PII.
      receipt: {
        fromAccountNumber: tx.fromAccount.accountNumber,
        toAccountNumber: tx.toAccount.accountNumber,
        amount: tx.amount,
        currency: 'VND',
        description: tx.description,
        createdAt: tx.createdAt,
      },
    };
  }

  private async finalTransfer(manager: EntityManager, sourceId: string, destinationId: string, amountRaw: string, description: string, options: { optimistic?: boolean; transaction?: Transaction; requestId?: string } = {}) {
    const useOptimistic = options.optimistic === true;
    let source: Account;
    let destination: Account;
    if (useOptimistic) {
      const [a, b] = await Promise.all([
        manager.getRepository(Account).findOne({ where: { id: sourceId } }),
        manager.getRepository(Account).findOne({ where: { id: destinationId } }),
      ]);
      if (!a || !b) throw new NotFoundException('Account not found');
      source = a;
      destination = b;
    } else {
      [source, destination] = await this.lockedAccounts(manager, sourceId, destinationId);
    }
    const [sourceUser, destinationUser] = await Promise.all([
      manager.findOneBy(User, { id: (await manager.findOne(Account, { where: { id: source.id }, relations: { user: true } }))!.user.id }),
      manager.findOneBy(User, { id: (await manager.findOne(Account, { where: { id: destination.id }, relations: { user: true } }))!.user.id }),
    ]);
    if (!sourceUser || !destinationUser) throw new NotFoundException('Account owner not found');
    this.ensureActive(source, sourceUser);
    this.ensureActive(destination, destinationUser);
    if (source.currency !== destination.currency) throw new BadRequestException('Currency mismatch');
    if (source.id === destination.id) throw new BadRequestException('Cannot transfer to same account');
    const amount = checkAmount(amountRaw);
    await this.limitCheck(manager, source, amount);
    if (moneyToCents(source.balance) - moneyToCents(source.holdAmount) < amount) {
      throw new BadRequestException('Insufficient available balance');
    }
    const review = await this.fraudReview(manager, source, amount);
    await this.updateAccount(manager, source, -amount, useOptimistic);
    await this.updateAccount(manager, destination, amount, useOptimistic);
    let transaction = options.transaction;
    if (transaction) {
      transaction.status = changeTransactionStatus(transaction.status, TransactionStatus.PROCESSING);
    } else {
      transaction = manager.create(Transaction, {
        fromAccount: source,
        toAccount: destination,
        amount: amountRaw,
        type: TransactionType.TRANSFER,
        status: TransactionStatus.INITIATED,
        description,
        attemptedAccountNumber: destination.accountNumber,
        requestId: options.requestId || null,
      });
      if (!transaction) throw new BadRequestException('Transaction could not be created');
      transaction.status = changeTransactionStatus(transaction.status, TransactionStatus.PROCESSING);
    }
    if (!transaction) throw new BadRequestException('Transaction could not be created');
    transaction.status = changeTransactionStatus(transaction.status, TransactionStatus.COMPLETED);
    transaction.reviewStatus = review ? ReviewStatus.FLAGGED : ReviewStatus.NONE;
    const saved = await manager.save(Transaction, transaction);
    await this.ledger.post(manager, saved, source, destination, amountRaw);
    await this.signCompletedTransfer(manager, saved, source, destination);
    this.logger.log(JSON.stringify({ event: 'transfer_completed', requestId: options.requestId || null, transactionId: saved.id, from: source.id, to: destination.id }));
    return this.publicTransaction(saved, source, destination);
  }

  async commitBatch(
    transfers: TransferCandidate[],
    options: { simulateRollback?: boolean } = {},
  ) {
    // Batch PoC has no per-transaction OTP authorization yet: fail closed.
    if (!(process.env.BANKFLOW_ALLOW_INSECURE_BATCH_POC === 'true' && (process.env.DB_DATABASE || '').endsWith('_test'))) throw new ForbiddenException('Batch PoC chưa hỗ trợ xác thực OTP từng giao dịch và chỉ được dùng trong DB test');

    if (!Array.isArray(transfers) || transfers.length < 1 || transfers.length > 20) {
      throw new BadRequestException('Batch size must be between 1 and 20');
    }
    const targetNumber = transfers[0].toAccountNumber;
    const keys = new Set<string>();
    for (const transfer of transfers) {
      if (transfer.toAccountNumber !== targetNumber) {
        throw new BadRequestException('All batch transfers must have the same recipient');
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transfer.idempotencyKey)) {
        throw new BadRequestException('Idempotency-Key must be UUID');
      }
      const identity = `${transfer.userId}:${transfer.idempotencyKey}`;
      if (keys.has(identity)) throw new ConflictException('Duplicate idempotency key in one batch');
      keys.add(identity);
      const cents = checkAmount(transfer.amount);
      if (cents >= 10_000_000n * 100n) {
        throw new BadRequestException('Batch PoC excludes transfers requiring OTP');
      }
      if (!transfer.description || !transfer.description.trim()) {
        throw new BadRequestException('Description must be non-empty');
      }
    }

    const outcome = await this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const info = new Map<string, { fingerprint: string; replay: Record<string, unknown> | null }>();
      const sorted = [...transfers].sort((a, b) =>
        `${a.userId}:${a.idempotencyKey}`.localeCompare(`${b.userId}:${b.idempotencyKey}`),
      );
      for (const transfer of sorted) {
        const fingerprint = this.idempotency.fingerprint(transfer.userId, {
          ownerId: transfer.userId,
          toAccountNumber: transfer.toAccountNumber,
          amount: transfer.amount,
          description: transfer.description,
        });
        const replay = await this.idempotency.lookup(manager, transfer.userId, transfer.idempotencyKey, fingerprint);
        info.set(`${transfer.userId}:${transfer.idempotencyKey}`, { fingerprint, replay });
      }
      const pending = transfers.filter((t) => !info.get(`${t.userId}:${t.idempotencyKey}`)!.replay);
      if (!pending.length) {
        return { recipientAccountNumber: targetNumber, committed: 0, replayed: transfers.length, results: transfers.map((t) => ({
          jobId: t.jobId, replayed: true, transfer: info.get(`${t.userId}:${t.idempotencyKey}`)!.replay,
        })) };
      }

      const repository = manager.getRepository(Account);
      const destinationReference = await repository.findOne({ where: { accountNumber: targetNumber } });
      if (!destinationReference) throw new NotFoundException('Destination account not found');
      const sources = new Map<string, string>();
      for (const transfer of pending) {
        if (!sources.has(transfer.userId)) {
          const account = await repository.findOne({ where: { user: { id: transfer.userId } } });
          if (!account) throw new NotFoundException('Source account not found');
          if (account.id === destinationReference.id) throw new BadRequestException('Cannot transfer to same account');
          sources.set(transfer.userId, account.id);
        }
      }

      const locked = new Map<string, Account>();
      const ids = [...new Set([destinationReference.id, ...sources.values()])].sort();
      for (const id of ids) {
        const account = await repository.createQueryBuilder('account')
          .leftJoinAndSelect('account.user', 'owner')
          .where('account.id = :id', { id })
          .setLock('pessimistic_write', undefined, ['account'])
          .getOne();
        if (!account || !account.user) throw new NotFoundException('Account unavailable');
        locked.set(id, account);
      }
      const destination = locked.get(destinationReference.id)!;
      this.ensureActive(destination, destination.user);
      let runningRecipientCents = moneyToCents(destination.balance);
      let totalAddedCents = 0n;
      let committed = 0;
      let replayed = 0;
      const results: { jobId: string; replayed: boolean; transfer: Record<string, unknown> | null }[] = [];

      for (const request of transfers) {
        const state = info.get(`${request.userId}:${request.idempotencyKey}`)!;
        if (state.replay) {
          replayed += 1;
          results.push({ jobId: request.jobId, replayed: true, transfer: state.replay });
          continue;
        }
        const source = locked.get(sources.get(request.userId)!)!;
        this.ensureActive(source, source.user);
        if (source.currency !== destination.currency) throw new BadRequestException('Currency mismatch');
        const amount = checkAmount(request.amount);
        await this.limitCheck(manager, source, amount);
        if (moneyToCents(source.balance) - moneyToCents(source.holdAmount) < amount) {
          throw new BadRequestException(`Insufficient funds for batch job ${request.jobId}`);
        }
        const flagged = await this.fraudReview(manager, source, amount);
        await this.updateAccount(manager, source, -amount);
        runningRecipientCents += amount;
        totalAddedCents += amount;
        const entry = manager.create(Transaction, {
          fromAccount: source,
          toAccount: destination,
          amount: request.amount,
          type: TransactionType.TRANSFER,
          status: TransactionStatus.INITIATED,
          description: request.description.trim(),
          attemptedAccountNumber: destination.accountNumber,
          requestId: null,
        });
        entry.status = changeTransactionStatus(entry.status, TransactionStatus.PROCESSING);
        entry.status = changeTransactionStatus(entry.status, TransactionStatus.COMPLETED);
        entry.reviewStatus = flagged ? ReviewStatus.FLAGGED : ReviewStatus.NONE;
        const saved = await manager.save(Transaction, entry);
        const virtualDestination = { ...destination, balance: centsToMoney(runningRecipientCents) } as Account;
        await this.ledger.post(manager, saved, source, virtualDestination, request.amount);
        await this.signCompletedTransfer(manager, saved, source, virtualDestination);
        const response = this.publicTransaction(saved, source, virtualDestination);
        await this.idempotency.save(manager, request.userId, request.idempotencyKey, state.fingerprint, response);
        results.push({ jobId: request.jobId, replayed: false, transfer: response });
        committed += 1;
      }
      await manager.query(
        'UPDATE accounts SET balance = $1::numeric, version = version + 1 WHERE id = $2',
        [centsToMoney(runningRecipientCents), destination.id],
      );
      if (options.simulateRollback) throw new Error('SIMULATED_BATCH_ROLLBACK');
      return { recipientAccountNumber: targetNumber, committed, replayed, totalAdded: centsToMoney(totalAddedCents), results };
    });
    this.logger.log(JSON.stringify({ event: 'batch_commit_complete', recipient: outcome.recipientAccountNumber, committed: outcome.committed, replayed: outcome.replayed }));
    return outcome;
  }

  private async recordFailure(userId: string, dto: TransferDto, reason: string, requestId?: string) {
    try {
      const source = await this.dataSource.getRepository(Account).findOne({ where: { user: { id: userId } } });
      if (!source) return;
      const destination = await this.dataSource.getRepository(Account).findOne({ where: { accountNumber: dto.toAccountNumber } });
      await this.dataSource.getRepository(Transaction).save({
        fromAccount: source,
        toAccount: destination,
        amount: dto.amount,
        type: TransactionType.TRANSFER,
        status: TransactionStatus.FAILED,
        description: dto.description,
        attemptedAccountNumber: dto.toAccountNumber,
        failureReason: reason.slice(0, 255),
        requestId: requestId || null,
      });
    } catch (error) {
      this.logger.warn(JSON.stringify({ event: 'failed_transaction_log_error', requestId, error: String(error) }));
    }
  }

  async transfer(userId: string, dto: TransferDto, key: string, requestId?: string, ownerId = userId, optimistic = false, authorizationToken?: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
      throw new BadRequestException('Idempotency-Key must be UUID');
    }
    const payload = { ownerId, ...dto };
    const fingerprint = this.idempotency.fingerprint(userId, payload);
    const attempts = optimistic ? 5 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await this.dataSource.transaction('READ COMMITTED', async (manager) => {
          const replay = await this.idempotency.lookup(manager, userId, key, fingerprint);
          if (replay) return replay;
          const action: PaymentAction = ownerId !== userId ? 'teller-transfer' : optimistic ? 'transfer-optimistic' : 'transfer';
          await this.paymentSecurity.consume(manager, userId, action, ownerId !== userId ? {ownerId, toAccountNumber:dto.toAccountNumber, amount:dto.amount, description:dto.description} : {toAccountNumber:dto.toAccountNumber,amount:dto.amount,description:dto.description}, authorizationToken);
          const source = await manager.findOne(Account, { where: { user: { id: ownerId } }, relations: { user: true } });
          if (!source) throw new NotFoundException('Source account not found');
          const destination = await manager.findOne(Account, { where: { accountNumber: dto.toAccountNumber } });
          if (!destination) throw new NotFoundException('Destination account not found');
          if (source.id === destination.id) throw new BadRequestException('Cannot transfer to same account');
          const amount = checkAmount(dto.amount);
          // Large teller-assisted transactions keep the additional customer-OTP/admin approval flow.
          // Ordinary customer transfers have ALREADY passed PIN + OTP authorization above.
          if (ownerId !== userId && amount >= 10_000_000n * 100n) {
            const current = manager.create(Transaction, {
              fromAccount: source,
              toAccount: destination,
              amount: dto.amount,
              type: TransactionType.TRANSFER,
              status: TransactionStatus.INITIATED,
              attemptedAccountNumber: destination.accountNumber,
              description: dto.description.trim(),
              requestId: requestId || null,
              tellerInitiated: ownerId !== userId,
            });
            const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
            current.status = changeTransactionStatus(current.status, TransactionStatus.PENDING_OTP);
            current.otpHash = await bcrypt.hash(otp, 10);
            current.otpExpiresAt = new Date(Date.now() + 5 * 60_000);
            const saved = await manager.save(current);
            const response = { id: saved.id, status: saved.status, otpRequired: true, ...(process.env.NODE_ENV === 'production' ? {} : { demoOtp: otp }) };
            await this.idempotency.save(manager, userId, key, fingerprint, response);
            return response;
          }
          const result = await this.finalTransfer(manager, source.id, destination.id, dto.amount, dto.description.trim(), { optimistic, requestId });
          await this.idempotency.save(manager, userId, key, fingerprint, result);
          return result;
        });
      } catch (error) {
        if (error instanceof VersionConflict && attempt + 1 < attempts) continue;
        if (error instanceof BadRequestException || error instanceof NotFoundException) {
          if (!(error instanceof ConflictException)) await this.recordFailure(ownerId, dto, error.message, requestId);
        }
        throw error;
      }
    }
    throw new ConflictException('Concurrent update exceeded retry limit');
  }

  async confirmOtp(userId: string, transactionId: string, otp: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const transaction = await manager.getRepository(Transaction).createQueryBuilder('t')
        .addSelect('t.otpHash')
        .leftJoinAndSelect('t.fromAccount', 'source')
        .leftJoinAndSelect('t.toAccount', 'destination')
        .where('t.id = :id', { id: transactionId })
        .setLock('pessimistic_write', undefined, ['t'])
        .getOne();
      if (!transaction || !transaction.fromAccount || !transaction.toAccount) throw new NotFoundException('Transaction not found');
      const sourceOwner = await manager.findOne(Account, { where: { id: transaction.fromAccount.id }, relations: { user: true } });
      if (sourceOwner?.user.id !== userId) throw new ForbiddenException('Transaction does not belong to user');
      if (transaction.status !== TransactionStatus.PENDING_OTP) throw new BadRequestException('OTP confirmation no longer allowed');
      if (transaction.tellerInitiated && !transaction.approvedById) throw new BadRequestException('Admin approval required for teller-initiated large transaction');
      if (!transaction.otpExpiresAt || transaction.otpExpiresAt <= new Date() || transaction.otpAttempts >= 3) {
        transaction.status = changeTransactionStatus(transaction.status, TransactionStatus.FAILED);
        transaction.failureReason = 'OTP expired or attempts exceeded';
        await manager.save(transaction);
        return { id: transaction.id, status: transaction.status, error: 'OTP expired or attempts exceeded' };
      }
      if (!transaction.otpHash || !await bcrypt.compare(otp, transaction.otpHash)) {
        transaction.otpAttempts += 1;
        if (transaction.otpAttempts >= 3) {
          transaction.status = changeTransactionStatus(transaction.status, TransactionStatus.FAILED);
          transaction.failureReason = 'Too many OTP attempts';
        }
        await manager.save(transaction);
        return { id: transaction.id, status: transaction.status, error: 'Invalid OTP' };
      }
      transaction.otpHash = null;
      transaction.otpExpiresAt = null;
      return this.finalTransfer(manager, transaction.fromAccount.id, transaction.toAccount.id, transaction.amount, transaction.description, { transaction, requestId: transaction.requestId || undefined });
    });
    if ('error' in result) throw new BadRequestException(result.error);
    return result;
  }

  async approveLarge(id: string, adminId: string) {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager.getRepository(Transaction).createQueryBuilder('t')
        .where('t.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!transaction) throw new NotFoundException('Transaction not found');
      if (!transaction.tellerInitiated || transaction.status !== TransactionStatus.PENDING_OTP) {
        throw new BadRequestException('Transaction is not awaiting teller approval');
      }
      if (transaction.approvedById) throw new ConflictException('Already approved');
      transaction.approvedById = adminId;
      await manager.save(transaction);
      return { id: transaction.id, approvedById: adminId, status: transaction.status };
    });
  }

  async reverse(id: string, adminId: string, authorizationToken?: string) {
    return this.dataSource.transaction(async (manager) => {
      await this.paymentSecurity.consume(manager, adminId, 'reverse', { transactionId: id }, authorizationToken);
      const original = await manager.getRepository(Transaction).createQueryBuilder('tx')
        .leftJoinAndSelect('tx.fromAccount', 'source')
        .leftJoinAndSelect('tx.toAccount', 'target')
        .where('tx.id = :id', { id })
        .setLock('pessimistic_write', undefined, ['tx'])
        .getOne();
      if (!original || !original.fromAccount || !original.toAccount) throw new NotFoundException('Transaction not found');
      if (original.status !== TransactionStatus.COMPLETED || original.type !== TransactionType.TRANSFER) {
        throw new BadRequestException('Only completed transfers can be reversed once');
      }
      const [source, target] = await this.lockedAccounts(manager, original.toAccount.id, original.fromAccount.id);
      const amount = checkAmount(original.amount);
      if (moneyToCents(source.balance) - moneyToCents(source.holdAmount) < amount) {
        throw new BadRequestException('Recipient has insufficient balance for reversal');
      }
      source.balance = centsToMoney(moneyToCents(source.balance) - amount);
      target.balance = centsToMoney(moneyToCents(target.balance) + amount);
      await manager.save([source, target]);
      const reversal = manager.create(Transaction, {
        fromAccount: source,
        toAccount: target,
        amount: original.amount,
        type: TransactionType.REVERSAL,
        status: TransactionStatus.COMPLETED,
        originalTransactionId: original.id,
        description: `Reversal of ${original.id}`,
      });
      const saved = await manager.save(reversal);
      await this.ledger.post(manager, saved, source, target, original.amount);
      original.status = changeTransactionStatus(original.status, TransactionStatus.REVERSED);
      await manager.save(original);
      return { reversedTransactionId: original.id, reversalTransactionId: saved.id, status: original.status };
    });
  }

  async deposit(accountNumber: string, amountRaw: string, actorId: string, authorizationToken?: string) {
    const amount = checkAmount(amountRaw);
    return this.dataSource.transaction(async (manager) => {
      await this.paymentSecurity.consume(manager, actorId, 'deposit', { accountNumber, amount: amountRaw }, authorizationToken);
      const account = await manager.getRepository(Account).createQueryBuilder('a')
        .where('a.accountNumber = :number', { number: accountNumber }).setLock('pessimistic_write').getOne();
      if (!account || account.status !== AccountStatus.ACTIVE) throw new NotFoundException('Account not active');
      account.balance = centsToMoney(moneyToCents(account.balance) + amount);
      await manager.save(account);
      const transaction = await manager.save(Transaction, manager.create(Transaction, {
        fromAccount: null,
        toAccount: account,
        amount: amountRaw,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        description: 'Cash deposit',
      }));
      await this.ledger.opening(manager, account, amountRaw);
      return { id: transaction.id, balance: account.balance, status: transaction.status };
    });
  }

  async getHistory(userId: string, query: TransactionQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sort = query.sort ?? 'desc';
    const [transactions, total] = await this.dataSource.getRepository(Transaction)
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.fromAccount', 'source')
      .leftJoinAndSelect('t.toAccount', 'destination')
      .leftJoinAndSelect('source.user', 'sender')
      .leftJoinAndSelect('destination.user', 'receiver')
      .where('(sender.id = :userId OR receiver.id = :userId)', { userId })
      .andWhere(query.status ? 't.status = :status' : '1=1', query.status ? { status: query.status } : {})
      .andWhere(query.type ? 't.type = :type' : '1=1', query.type ? { type: query.type } : {})
      // Chỉ tìm trong giao dịch của chính người dùng; tìm kiếm theo ID hoặc số tài khoản.
      // Nội dung mã hóa AES-GCM không hỗ trợ tìm kiếm văn bản trực tiếp.
      .andWhere(query.search?.trim() ?
        '(CAST(t.id AS TEXT) ILIKE :term OR source.accountNumber ILIKE :term OR destination.accountNumber ILIKE :term)' : '1=1',
        query.search?.trim() ? { term: `%${query.search.trim()}%` } : {})
      .orderBy('t.createdAt', sort.toUpperCase() as 'ASC' | 'DESC')
      .addOrderBy('t.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return {
      data: transactions.map((transaction) => ({
        id: transaction.id,
        direction: transaction.fromAccount?.user?.id === userId ? 'outgoing' : 'incoming',
        fromAccountNumber: transaction.fromAccount?.accountNumber ?? null,
        toAccountNumber: transaction.toAccount?.accountNumber ?? transaction.attemptedAccountNumber,
        amount: transaction.amount,
        type: transaction.type,
        status: transaction.status,
        reviewStatus: transaction.reviewStatus,
        description: transaction.description,
        createdAt: transaction.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listAll() {
    return this.dataSource.getRepository(Transaction).find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  async listFlagged() {
    return this.dataSource.getRepository(Transaction).find({ where: { reviewStatus: ReviewStatus.FLAGGED }, order: { createdAt: 'DESC' } });
  }

  async review(id: string, status: ReviewStatus.APPROVED | ReviewStatus.REJECTED) {
    const transaction = await this.dataSource.getRepository(Transaction).findOne({ where: { id } });
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.reviewStatus !== ReviewStatus.FLAGGED) throw new BadRequestException('Transaction not flagged');
    transaction.reviewStatus = status;
    await this.dataSource.getRepository(Transaction).save(transaction);
    return { id, reviewStatus: status };
  }

  async failStalled() {
    const overdue = await this.dataSource.getRepository(Transaction).find({
      where: { status: TransactionStatus.PROCESSING, createdAt: LessThan(new Date(Date.now() - 10 * 60_000)) },
    });
    for (const transaction of overdue) {
      transaction.status = changeTransactionStatus(transaction.status, TransactionStatus.FAILED);
      transaction.failureReason = 'Processing timeout';
      await this.dataSource.getRepository(Transaction).save(transaction);
    }
    return { inspected: overdue.length };
  }
}
