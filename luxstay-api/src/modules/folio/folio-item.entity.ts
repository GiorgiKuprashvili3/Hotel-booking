import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { FolioEntity } from './folio.entity';
import { PaymentMethod } from '../../common/enums';

export enum FolioItemType {
  Charge  = 'charge',
  Payment = 'payment',
  Credit  = 'credit',
  Tax     = 'tax',
}

export enum FolioItemCategory {
  RoomRate      = 'room_rate',
  Tax           = 'tax',
  ServiceCharge = 'service_charge',
  FoodBeverage  = 'food_and_beverage',
  Spa           = 'spa',
  Minibar       = 'minibar',
  Telephone     = 'telephone',
  Parking       = 'parking',
  EarlyCheckIn  = 'early_check_in',
  LateCheckOut  = 'late_check_out',
  Laundry       = 'laundry',
  Transport     = 'transport',
  Damage        = 'damage',
  Deposit       = 'deposit',
  Refund        = 'refund',
  Discount      = 'discount',
  Other         = 'other',
}

@Entity('folio_items')
export class FolioItemEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  folioId: string;

  @ManyToOne(() => FolioEntity, (folio) => folio.items, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'folioId' })
  folio: FolioEntity;

  @ApiProperty({ enum: FolioItemType })
  @Column({ type: 'enum', enum: FolioItemType })
  type: FolioItemType;

  @ApiProperty({ enum: FolioItemCategory })
  @Column({ type: 'enum', enum: FolioItemCategory, default: FolioItemCategory.Other })
  category: FolioItemCategory;

  @ApiProperty({ example: 'Room charge – night of 2025-06-01' })
  @Column()
  description: string;

  /**
   * Positive = charge or tax.
   * Negative = payment, credit, refund, or discount.
   */
  @ApiProperty({ example: 200.0 })
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  /** The date the charge or payment applies to (for room-rate breakdown) */
  @ApiProperty({ example: '2025-06-01' })
  @Column({ type: 'date' })
  date: string;

  /** Populated when type === payment */
  @ApiProperty({ enum: PaymentMethod, nullable: true })
  @Column({
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod: PaymentMethod;

  /** Reference number from card terminal / bank / voucher */
  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  paymentReference: string;

  /** Staff member who posted this line */
  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  postedBy: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string;

  /** Whether this line has been voided */
  @ApiProperty({ default: false })
  @Column({ default: false })
  isVoided: boolean;
}
