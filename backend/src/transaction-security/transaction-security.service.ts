import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager } from 'typeorm';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { PaymentChallenge } from './entities/payment-challenge.entity';
import { PaymentAction } from './dto/security.dto';
import { validateNewPin } from '../auth/pin-policy';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const isDigits = (s: unknown) => typeof s === 'string' && /^\d{6}$/.test(s);

// Canonicalize only allowed fields. The OTP authorization is bound to these values.
export function canonicalPayload(action: PaymentAction, raw: Record<string, unknown>): Record<string, string> {
  const value = (name: string): string => {
    const v = raw?.[name];
    if (typeof v !== 'string') throw new BadRequestException(`Trường ${name} phải là chuỗi`);
    return v.trim();
  };
  const amount = () => {
    const v = value('amount');
    if (!/^(?!0+(?:\.0{1,2})?$)\d{1,16}(?:\.\d{1,2})?$/.test(v)) throw new BadRequestException('Số tiền không hợp lệ');
    return v;
  };
  const account = (name: string) => {
    const v = value(name);
    if (!/^\d{8,30}$/.test(v)) throw new BadRequestException(`Số tài khoản ${name} không hợp lệ`);
    return v;
  };
  const description = () => {
    const v = value('description');
    if (!v || v.length > 255) throw new BadRequestException('Nội dung chuyển khoản không hợp lệ');
    return v;
  };
  if (action === 'transfer' || action === 'transfer-optimistic') return { toAccountNumber: account('toAccountNumber'), amount: amount(), description: description() };
  if (action === 'teller-transfer') {
    const ownerId = value('ownerId');
    if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new BadRequestException('Mã khách hàng không hợp lệ');
    return { ownerId, toAccountNumber: account('toAccountNumber'), amount: amount(), description: description() };
  }
  if (action === 'deposit') return { accountNumber: account('accountNumber'), amount: amount() };
  if (action === 'reverse') {
    const transactionId = value('transactionId');
    if (!/^[0-9a-f-]{36}$/i.test(transactionId)) throw new BadRequestException('Mã giao dịch không hợp lệ');
    return { transactionId };
  }
  throw new BadRequestException('Nghiệp vụ không được hỗ trợ');
}

function fingerprint(action: PaymentAction, payload: Record<string, unknown>) {
  return hash(JSON.stringify({ action, payload: canonicalPayload(action, payload) }));
}

@Injectable()
export class TransactionSecurityService {
  constructor(private readonly dataSource: DataSource) {}

  async getPinStatus(userId: string) {
    const user = await this.dataSource.getRepository(User).createQueryBuilder('u').addSelect('u.transactionPinHash').where('u.id = :id', {id: userId}).getOne();
    if (!user) throw new UnauthorizedException();
    return { pinConfigured: Boolean(user.transactionPinHash), pinLocked: Boolean(user.pinLockedUntil && user.pinLockedUntil > new Date()) };
  }

  async setPin(userId: string, pin: string, currentPassword?: string, currentPin?: string) {
    validateNewPin(pin);
    const repo = this.dataSource.getRepository(User);
    const user = await repo.createQueryBuilder('u')
      .addSelect(['u.passwordHash', 'u.transactionPinHash'])
      .where('u.id = :userId', { userId }).getOne();
    if (!user) throw new UnauthorizedException();

    if (user.transactionPinHash) {
      // Người đã đặt PIN phải xác minh PIN cũ. Không cho đổi chỉ bằng form tạo mới.
      if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
        throw new ForbiddenException('PIN đang bị tạm khóa, vui lòng thử lại sau');
      }
      if (typeof currentPin !== 'string' || !isDigits(currentPin) || !await bcrypt.compare(currentPin, user.transactionPinHash)) {
        const attempts = (user.pinFailedAttempts ?? 0) + 1;
        await repo.update(userId, {
          pinFailedAttempts: attempts >= 5 ? 0 : attempts,
          pinLockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
        });
        throw new UnauthorizedException('PIN hiện tại không đúng');
      }
      if (await bcrypt.compare(pin, user.transactionPinHash)) {
        throw new BadRequestException('PIN mới phải khác PIN hiện tại');
      }
    } else {
      // Thiết lập PIN lần đầu phải xác minh lại mật khẩu đăng nhập.
      if (typeof currentPassword !== 'string' || !await bcrypt.compare(currentPassword, user.passwordHash)) {
        throw new UnauthorizedException('Mật khẩu đăng nhập không đúng');
      }
    }
    if (await bcrypt.compare(pin, user.passwordHash)) {
      throw new BadRequestException('PIN không được giống mật khẩu đăng nhập');
    }
    user.transactionPinHash = await bcrypt.hash(pin, 12);
    user.pinFailedAttempts = 0;
    user.pinLockedUntil = null;
    await repo.save(user);
    return { pinConfigured: true };
  }

  async request(userId: string, role: UserRole, action: PaymentAction, raw: Record<string, unknown>, pin?: string) {
    if (role === UserRole.CUSTOMER && !['transfer','transfer-optimistic'].includes(action)) throw new ForbiddenException('Không được phép thực hiện nghiệp vụ');
    if (role === UserRole.TELLER && !['deposit','teller-transfer'].includes(action)) throw new ForbiddenException('Không được phép thực hiện nghiệp vụ');
    if (role === UserRole.ADMIN && !['deposit','teller-transfer','reverse'].includes(action)) throw new ForbiddenException('Không được phép thực hiện nghiệp vụ');
    const clean = canonicalPayload(action, raw);
    if (role === UserRole.CUSTOMER) {
      const repo = this.dataSource.getRepository(User);
      const user = await repo.createQueryBuilder('u').addSelect('u.transactionPinHash')
        .where('u.id = :userId', {userId}).getOne();
      if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();
      if (!user.transactionPinHash) throw new BadRequestException('Vui lòng thiết lập PIN giao dịch trong Tài khoản của tôi');
      if (user.pinLockedUntil && user.pinLockedUntil > new Date()) throw new ForbiddenException('PIN bị tạm khóa, vui lòng thử lại sau');
      if (typeof pin !== 'string' || !isDigits(pin) || !await bcrypt.compare(pin, user.transactionPinHash)) {
        const attempts = user.pinFailedAttempts + 1;
        await repo.update(userId, {pinFailedAttempts: attempts >= 5 ? 0 : attempts, pinLockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null});
        throw new UnauthorizedException('PIN giao dịch không đúng');
      }
      await repo.update(userId, {pinFailedAttempts: 0, pinLockedUntil: null});
    }
    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const challenge = await this.dataSource.getRepository(PaymentChallenge).save({
      actorId: userId, action, payloadHash: fingerprint(action, clean), otpHash: await bcrypt.hash(otp, 10), expiresAt, attempts: 0,
    });
    const isDemo = process.env.NODE_ENV !== 'production' && process.env.BANKFLOW_DEMO_OTP_ENABLED === 'true';
    // NO delivery channel configured; production integration must send OTP out-of-band.
    return { challengeId: challenge.id, expiresAt: expiresAt.toISOString(), otpRequired: true,
      delivery: isDemo ? 'demo' : 'not-configured', ...(isDemo ? { demoOtp: otp } : {}) };
  }

  async verify(userId: string, challengeId: string, otp: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PaymentChallenge);
      const challenge = await repo.createQueryBuilder('challenge').addSelect('challenge.otpHash')
        .where('challenge.id = :id AND challenge.actorId = :userId', { id: challengeId, userId })
        .setLock('pessimistic_write').getOne();
      if (!challenge || challenge.consumedAt || challenge.verifiedAt) throw new BadRequestException('Yêu cầu xác thực không hợp lệ');
      if (challenge.expiresAt <= new Date() || challenge.attempts >= 3) throw new BadRequestException('OTP đã hết hạn hoặc vượt số lần thử');
      if (!isDigits(otp) || !challenge.otpHash || !await bcrypt.compare(otp, challenge.otpHash)) {
        challenge.attempts += 1;
        await repo.save(challenge);
        return { error: 'OTP không đúng' };
      }
      const token = randomBytes(32).toString('hex');
      challenge.verifiedAt = new Date();
      challenge.otpHash = null;
      challenge.tokenHash = hash(token);
      challenge.expiresAt = new Date(Date.now() + 2 * 60_000);
      await repo.save(challenge);
      return { authorizationToken: token, expiresAt: challenge.expiresAt.toISOString() };
    });
    if ('error' in result) throw new UnauthorizedException(result.error);
    return result;
  }

  async consume(manager: EntityManager, userId: string, action: PaymentAction, raw: Record<string, unknown>, token?: string) {
    if (!token || !/^[0-9a-f]{64}$/.test(token)) throw new ForbiddenException('Cần xác thực mã PIN và OTP trước khi giao dịch');
    const repo = manager.getRepository(PaymentChallenge);
    const challenge = await repo.createQueryBuilder('challenge').addSelect('challenge.tokenHash')
      .where('challenge.actorId = :userId AND challenge.tokenHash = :tokenHash', {userId, tokenHash: hash(token)})
      .setLock('pessimistic_write').getOne();
    if (!challenge || challenge.action !== action || challenge.payloadHash !== fingerprint(action, raw) ||
      !challenge.verifiedAt || challenge.expiresAt <= new Date() || challenge.consumedAt) {
      throw new ForbiddenException('Mã xác thực không đúng giao dịch, đã hết hạn hoặc đã sử dụng');
    }
    const supplied = Buffer.from(hash(token), 'hex');
    const expected = Buffer.from(challenge.tokenHash!, 'hex');
    if (!timingSafeEqual(supplied, expected)) throw new ForbiddenException('Mã xác thực không hợp lệ');
    challenge.consumedAt = new Date();
    await repo.save(challenge);
  }
}
