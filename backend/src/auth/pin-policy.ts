import { BadRequestException } from '@nestjs/common';

export function validateNewPin(pin: string): void {
  if (!/^\d{6}$/.test(pin) || /^(\d)\1{5}$/.test(pin) || ['123456', '654321'].includes(pin)) {
    throw new BadRequestException('PIN phải gồm 6 số và không được quá dễ đoán.');
  }
}
