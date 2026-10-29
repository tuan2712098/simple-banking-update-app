import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('payment_challenges')
export class PaymentChallenge {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'actor_id', type: 'uuid' }) actorId: string;
  @Column({ name: 'action', type: 'varchar', length: 32 }) action: string;
  @Column({ name: 'payload_hash', type: 'varchar', length: 64 }) payloadHash: string;
  @Column({ name: 'otp_hash', type: 'varchar', nullable: true, select: false }) otpHash: string | null;
  @Column({ name: 'token_hash', type: 'varchar', length: 64, nullable: true, select: false }) tokenHash: string | null;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true }) verifiedAt: Date | null;
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true }) consumedAt: Date | null;
  @Column({ name: 'attempts', type: 'int', default: 0 }) attempts: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
