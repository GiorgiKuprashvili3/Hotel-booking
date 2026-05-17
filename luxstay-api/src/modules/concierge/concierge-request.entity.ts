import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { PropertyEntity } from '../properties/property.entity';
import { ReservationEntity } from '../reservations/reservation.entity';
import { GuestEntity } from '../guests/guest.entity';
import { StaffEntity } from '../staff/staff.entity';
import { ConciergeRequestType, ConciergeStatus } from '../../common/enums';

@Entity('concierge_requests')
@Index(['propertyId', 'status'])
@Index(['reservationId'])
export class ConciergeRequestEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  propertyId: string;

  @ManyToOne(() => PropertyEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'propertyId' })
  property: PropertyEntity;

  @ApiProperty()
  @Column()
  reservationId: string;

  @ManyToOne(() => ReservationEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'reservationId' })
  reservation: ReservationEntity;

  @ApiProperty()
  @Column()
  guestId: string;

  @ManyToOne(() => GuestEntity, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'guestId' })
  guest: GuestEntity;

  @ApiProperty({ enum: ConciergeRequestType })
  @Column({ type: 'enum', enum: ConciergeRequestType })
  requestType: ConciergeRequestType;

  @ApiProperty({ enum: ConciergeStatus })
  @Column({ type: 'enum', enum: ConciergeStatus, default: ConciergeStatus.New })
  status: ConciergeStatus;

  @ApiProperty()
  @Column({ type: 'text' })
  details: string;

  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  assignedToId: string;

  @ManyToOne(() => StaffEntity, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: StaffEntity;

  /** Requested delivery / fulfillment time */
  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  requestedAt: Date;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  fulfilledAt: Date;

  /** Any extra charge applied to folio */
  @ApiProperty({ nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  charge: number;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  staffNotes: string;

  @ApiProperty({ default: 0 })
  @Column({ type: 'int', default: 0 })
  priority: number;
}
