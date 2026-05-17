import {
  Entity, Column, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { PropertyEntity } from '../properties/property.entity';
import { RoomEntity } from '../rooms/room.entity';
import { GuestEntity } from '../guests/guest.entity';
import { RatePlanEntity } from '../rate-plans/rate-plan.entity';
import { BookingGroupEntity } from './booking-group.entity';
import {
  ReservationStatus,
  BookingSource,
  MealPlan,
} from '../../common/enums';

@Entity('reservations')
@Index(['propertyId', 'status'])
@Index(['roomId', 'checkInDate', 'checkOutDate'])
export class ReservationEntity extends AbstractEntity {
  // ── Property / Room ──────────────────────────────────────────────────────────

  @ApiProperty()
  @Column()
  propertyId: string;

  @ManyToOne(() => PropertyEntity, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'propertyId' })
  property: PropertyEntity;

  @ApiProperty()
  @Column()
  roomId: string;

  @ManyToOne(() => RoomEntity, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'roomId' })
  room: RoomEntity;

  // ── Guest ────────────────────────────────────────────────────────────────────

  @ApiProperty({ description: 'Primary / lead guest' })
  @Column()
  guestId: string;

  @ManyToOne(() => GuestEntity, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'guestId' })
  guest: GuestEntity;

  // ── Rate plan ────────────────────────────────────────────────────────────────

  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  ratePlanId: string;

  @ManyToOne(() => RatePlanEntity, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'ratePlanId' })
  ratePlan: RatePlanEntity;

  // ── Group booking ────────────────────────────────────────────────────────────

  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  bookingGroupId: string;

  @ManyToOne(() => BookingGroupEntity, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'bookingGroupId' })
  bookingGroup: BookingGroupEntity;

  // ── Booking identity ─────────────────────────────────────────────────────────

  /** Human-readable confirmation number, e.g. RES-20250517-0042 */
  @ApiProperty({ example: 'RES-20250517-0042' })
  @Column({ unique: true })
  confirmationNumber: string;

  @ApiProperty({ enum: ReservationStatus })
  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.Pending,
  })
  status: ReservationStatus;

  @ApiProperty({ enum: BookingSource })
  @Column({
    type: 'enum',
    enum: BookingSource,
    default: BookingSource.Direct,
  })
  source: BookingSource;

  // ── Dates ────────────────────────────────────────────────────────────────────

  /** Booked check-in date (date string YYYY-MM-DD) */
  @ApiProperty({ example: '2025-06-01' })
  @Column({ type: 'date' })
  checkInDate: string;

  /** Booked check-out date (date string YYYY-MM-DD) */
  @ApiProperty({ example: '2025-06-05' })
  @Column({ type: 'date' })
  checkOutDate: string;

  /** Actual timestamp when guest physically checked in */
  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  actualCheckInAt: Date;

  /** Actual timestamp when guest physically checked out */
  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  actualCheckOutAt: Date;

  // ── Occupancy & meal plan ────────────────────────────────────────────────────

  @ApiProperty({ example: 2 })
  @Column({ type: 'int', default: 1 })
  adults: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'int', default: 0 })
  children: number;

  @ApiProperty({ enum: MealPlan, default: MealPlan.RoomOnly })
  @Column({ type: 'enum', enum: MealPlan, default: MealPlan.RoomOnly })
  mealPlan: MealPlan;

  // ── Financial ────────────────────────────────────────────────────────────────

  /** Agreed total amount for the stay (room + extras agreed at booking time) */
  @ApiProperty({ example: 800.0 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  /** Amount due at booking / as deposit */
  @ApiProperty({ example: 200.0 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  depositAmount: number;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  depositPaidAt: Date;

  // ── Misc ─────────────────────────────────────────────────────────────────────

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  specialRequests: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string; // staff-only

  /** Staff member who created the reservation */
  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  createdBy: string;

  /** Staff member who performed check-in */
  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  checkedInBy: string;

  /** Staff member who performed check-out */
  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  checkedOutBy: string;

  /** Reason for cancellation (if applicable) */
  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date;
}
