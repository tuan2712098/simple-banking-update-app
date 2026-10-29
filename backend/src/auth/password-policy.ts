import { BadRequestException } from '@nestjs/common';

export const NEW_PASSWORD_MIN_LENGTH = 8;
export const BCRYPT_MAX_BYTES = 72;

const blockedPasswords = new Set([
  '123456789012345',
  '1234567890123456',
  'password123456789',
  'passwordpassword',
  'admin123456789012',
  'qwertyuiop123456',
  'demo@123456',
  'demo@1234567890',
  'matkhau123456789',
]);

export function validateNewPassword(value: string, email?: string): void {
  if (typeof value !== 'string') {
    throw new BadRequestException('Mật khẩu không hợp lệ.');
  }

  if ([...value].length < NEW_PASSWORD_MIN_LENGTH) {
    throw new BadRequestException(
      `Mật khẩu mới cần ít nhất ${NEW_PASSWORD_MIN_LENGTH} ký tự.`,
    );
  }

  if (Buffer.byteLength(value, 'utf8') > BCRYPT_MAX_BYTES) {
    throw new BadRequestException(
      `Mật khẩu mới vượt giới hạn ${BCRYPT_MAX_BYTES} byte của bcrypt.`,
    );
  }

  const normalized = value.trim().toLowerCase();

  if (blockedPasswords.has(normalized) || /^(.)\1{14,}$/u.test(value)) {
    throw new BadRequestException(
      'Mật khẩu quá phổ biến hoặc dễ đoán.',
    );
  }

  const emailPart = email?.split('@')[0]?.trim().toLowerCase();

  if (emailPart && emailPart.length >= 5 && normalized.includes(emailPart)) {
    throw new BadRequestException(
      'Không nên dùng tên email trong mật khẩu mới.',
    );
  }
}
