import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { LoyaltyTier, GuestIdType } from '../../common/enums';

@Entity('guests')
export class GuestEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  firstName: string;

  @ApiProperty()
  @Column()
  lastName: string;

  @ApiProperty()
  @Column({ unique: true })
  email: string;

  @ApiProperty()
  @Column({ nullable: true })
  phone: string;

  @ApiProperty()
  @Column({ nullable: true })
  nationality: string; // ISO 3166-1 alpha-2, e.g. "GE"

  @ApiProperty()
  @Column({ type: 'date', nullable: true })
  dateOfBirth: string;

  @ApiProperty({ enum: GuestIdType })
  @Column({
    type: 'enum',
    enum: GuestIdType,
    nullable: true,
  })
  idType: GuestIdType;

  @ApiProperty()
  @Column({ nullable: true })
  idNumber: string;

  @ApiProperty()
  @Column({ nullable: true })
  addressLine1: string;

  @ApiProperty()
  @Column({ nullable: true })
  addressLine2: string;

  @ApiProperty()
  @Column({ nullable: true })
  city: string;

  @ApiProperty()
  @Column({ nullable: true })
  country: string;

  @ApiProperty()
  @Column({ nullable: true })
  postalCode: string;

  @ApiProperty()
  @Column({ nullable: true })
  avatarUrl: string;

  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  language: string; // preferred language, ISO 639-1 e.g. "en"

  // ── Loyalty ────────────────────────────────────────────────────────────────

  @ApiProperty({ enum: LoyaltyTier, nullable: true })
  @Column({ type: 'enum', enum: LoyaltyTier, nullable: true })
  loyaltyTier: LoyaltyTier;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  loyaltyPoints: number;

  @ApiProperty()
  @Column({ nullable: true })
  loyaltyCardNumber: string;

  // ── Flags ──────────────────────────────────────────────────────────────────

  @ApiProperty()
  @Column({ default: false })
  isBlacklisted: boolean;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  blacklistReason: string;

  @ApiProperty({ nullable: true })
  @Column({ default: false })
  isVip: boolean;

  // ── Internal ───────────────────────────────────────────────────────────────

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string; // staff-only notes

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  totalStays: number;

  @ApiProperty()
  @Column({ type: 'timestamptz', nullable: true })
  lastStayAt: Date;

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
