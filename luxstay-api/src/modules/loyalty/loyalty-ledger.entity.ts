import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { GuestEntity } from '../guests/guest.entity';
import { ReservationEntity } from '../reservations/reservation.entity';
import { LoyaltyTier } from '../../common/enums';

export enum LoyaltyTransactionType {
  Earn   = 'earn',
  Redeem = 'redeem',
  Adjust = 'adjust',
  Expire = 'expire',
  Bonus  = 'bonus',
}

export const TIER_EARN_RATE: Record<LoyaltyTier, number> = {
  [LoyaltyTier.Bronze]:   1,
  [LoyaltyTier.Silver]:   1.5,
  [LoyaltyTier.Gold]:     2,
  [LoyaltyTier.Platinum]: 3,
  [LoyaltyTier.Diamond]:  4,
};

export const TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  [LoyaltyTier.Bronze]:     0,
  [LoyaltyTier.Silver]:   500,
  [LoyaltyTier.Gold]:    2000,
  [LoyaltyTier.Platinum]: 5000,
  [LoyaltyTier.Diamond]: 15000,
};

@Entity('loyalty_ledger')
@Index(['guestId', 'createdAt'])
export class LoyaltyLedgerEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  guestId: string;

  @ManyToOne(() => GuestEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'guestId' })
  guest: GuestEntity;

  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  reservationId: string;

  @ManyToOne(() => ReservationEntity, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'reservationId' })
  reservation: ReservationEntity;

  @ApiProperty({ enum: LoyaltyTransactionType })
  @Column({ type: 'enum', enum: LoyaltyTransactionType })
  type: LoyaltyTransactionType;

  @ApiProperty()
  @Column({ type: 'int' })
  points: number;

  @ApiProperty()
  @Column({ type: 'int' })
  balanceAfter: number;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  createdById: string;
}
