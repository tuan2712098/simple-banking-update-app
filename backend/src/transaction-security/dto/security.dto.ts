import { IsIn, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export const paymentActions = ['transfer', 'transfer-optimistic', 'teller-transfer', 'deposit', 'reverse'] as const;
export type PaymentAction = typeof paymentActions[number];

export class SetPinDto {
  @IsOptional() @IsString() @MaxLength(256) currentPassword?: string;
  @IsOptional() @Matches(/^\d{6}$/, { message: 'PIN hiện tại phải gồm đúng 6 chữ số' }) currentPin?: string;
  @Matches(/^\d{6}$/, { message: 'Mã PIN phải gồm đúng 6 chữ số' }) pin: string;
}

export class ChallengeRequestDto {
  @IsIn(paymentActions) action: PaymentAction;
  @IsObject() payload: Record<string, unknown>;
  @IsOptional() @Matches(/^\d{6}$/) pin?: string;
}

export class ChallengeVerifyDto {
  @IsUUID() challengeId: string;
  @Matches(/^\d{6}$/) otp: string;
}
