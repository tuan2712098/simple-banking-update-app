import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @Transform(({ value }) => typeof value === 'string' ? value.replace(/[<>]/g, '').trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  // Thiết lập PIN trước khi tài khoản mới được kích hoạt.
  @Matches(/^\d{6}$/, { message: 'PIN giao dịch phải gồm đúng 6 chữ số' })
  pin: string;
}
