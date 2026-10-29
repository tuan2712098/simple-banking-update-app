import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';

export class BatchTransferItemDto {
  @IsString()
  @IsNotEmpty()
  jobId: string;
  @IsUUID()
  userId: string;
  @IsUUID()
  idempotencyKey: string;
  @Matches(/^\d{8,30}$/)
  toAccountNumber: string;
  @Matches(/^(?!0+(?:\.0{1,2})?$)\d{1,16}(?:\.\d{1,2})?$/)
  amount: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;
}

export class BatchEnqueueDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BatchTransferItemDto)
  transfers: BatchTransferItemDto[];
}
