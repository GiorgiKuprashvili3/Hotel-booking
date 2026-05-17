import {
  Entity, Column, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { ReservationEntity } from '../reservations/reservation.entity';
import { PropertyEntity } from '../properties/property.entity';
import { FolioItemEntity } from './folio-item.entity';

export enum FolioStatus {
  Open   = 'open',
  Closed = 'closed',
  Voided = 'voided',
}

@Entity('folios')
export class FolioEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  reservationId: string;

  @ManyToOne(() => ReservationEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'reservationId' })
  reservation: ReservationEntity;

  @ApiProperty()
  @Column()
  propertyId: string;

  @ManyToOne(() => PropertyEntity, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'propertyId' })
  property: PropertyEntity;

  @ApiProperty({ enum: FolioStatus, default: FolioStatus.Open })
  @Column({
    type: 'enum',
    enum: FolioStatus,
    default: FolioStatus.Open,
  })
  status: FolioStatus;

  @ApiProperty({ example: 'USD' })
  @Column({ default: 'USD' })
  currency: string;

  /** Sum of all charge lines */
  @ApiProperty()
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalCharges: number;

  /** Sum of all payment lines */
  @ApiProperty()
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalPayments: number;

  /** totalCharges - totalPayments (positive = amount owed by guest) */
  @ApiProperty()
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date;

  @OneToMany(() => FolioItemEntity, (item) => item.folio, { eager: false })
  items: FolioItemEntity[];
}
