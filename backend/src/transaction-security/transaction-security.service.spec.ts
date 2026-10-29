import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { PaymentChallenge } from './entities/payment-challenge.entity';
import { TransactionSecurityService, canonicalPayload } from './transaction-security.service';

function fakeRepository(challenge: Partial<PaymentChallenge>) {
  const builder = { addSelect: jest.fn(), where: jest.fn(), setLock: jest.fn(), getOne: jest.fn().mockResolvedValue(challenge) };
  builder.addSelect.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.setLock.mockReturnValue(builder);
  return { builder, repo: {createQueryBuilder: jest.fn().mockReturnValue(builder), save: jest.fn(async (row: unknown) => row)} };
}

describe('Bảo mật giao dịch: ràng buộc OTP vào dữ liệu', () => {
  it('Chuẩn hóa chính xác số tiền và người nhận', () => {
    expect(canonicalPayload('transfer', {toAccountNumber:' 900000000003 ',amount:'100000',description:' Chuyen tien ',ignored:'x'}))
      .toEqual({toAccountNumber:'900000000003',amount:'100000',description:'Chuyen tien'});
  });
  it('Không chấp nhận số tiền và số tài khoản không hợp lệ', () => {
    expect(()=>canonicalPayload('transfer',{toAccountNumber:'x',amount:'100',description:'abc'})).toThrow(BadRequestException);
    expect(()=>canonicalPayload('deposit',{accountNumber:'900000000003',amount:'0'})).toThrow(BadRequestException);
  });
  it('OTP sai tăng số lần thử và được lưu, OTP đúng cho token', async () => {
    const otpHash = await bcrypt.hash('123987', 4);
    const challenge = {id:'d9c7d15f-04fd-42fd-9de1-70be53d872aa',actorId:'user1',otpHash,attempts:0,expiresAt:new Date(Date.now()+300000),consumedAt:null,verifiedAt:null,tokenHash:null} as PaymentChallenge;
    const {repo} = fakeRepository(challenge);
    const ds = {transaction: async (cb:(manager:unknown)=>Promise<unknown>)=>cb({getRepository:()=>repo})} as unknown as DataSource;
    const service = new TransactionSecurityService(ds);
    await expect(service.verify('user1',challenge.id,'000000')).rejects.toThrow(UnauthorizedException);
    expect(challenge.attempts).toBe(1);
    expect(repo.save).toHaveBeenCalled();
    const auth = await service.verify('user1',challenge.id,'123987');
    expect(auth.authorizationToken).toMatch(/^[a-f0-9]{64}$/);
    expect(challenge.otpHash).toBeNull();
    expect(challenge.tokenHash).toBe(createHash('sha256').update(auth.authorizationToken).digest('hex'));
    await expect(service.verify('user1',challenge.id,'123987')).rejects.toThrow(BadRequestException);
  });
  it('Token không được dùng cho số tiền khác và chỉ dùng 1 lần', async () => {
    const token = 'a'.repeat(64);
    const challenge = {actorId:'user1',action:'transfer',payloadHash:createHash('sha256').update(JSON.stringify({action:'transfer',payload:{toAccountNumber:'900000000003',amount:'100000',description:'test'}})).digest('hex'),tokenHash:createHash('sha256').update(token).digest('hex'),verifiedAt:new Date(),expiresAt:new Date(Date.now()+120000),consumedAt:null} as PaymentChallenge;
    const {repo} = fakeRepository(challenge);
    const manager = {getRepository:()=>repo} as never;
    const security = new TransactionSecurityService({} as DataSource);
    await expect(security.consume(manager,'user1','transfer',{toAccountNumber:'900000000003',amount:'200000',description:'test'},token)).rejects.toThrow(ForbiddenException);
    await security.consume(manager,'user1','transfer',{toAccountNumber:'900000000003',amount:'100000',description:'test'},token);
    expect(challenge.consumedAt).toBeInstanceOf(Date);
    await expect(security.consume(manager,'user1','transfer',{toAccountNumber:'900000000003',amount:'100000',description:'test'},token)).rejects.toThrow(ForbiddenException);
  });
});
