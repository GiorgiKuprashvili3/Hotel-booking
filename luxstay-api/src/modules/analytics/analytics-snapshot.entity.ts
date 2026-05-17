import { Entity, Column, Index, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';

@Entity('analytics_snapshots')
@Unique(['propertyId', 'snapshotDate'])
@Index(['propertyId', 'snapshotDate'])
export class AnalyticsSnapshotEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  propertyId: string;

  @ApiProperty({ example: '2025-06-01' })
  @Column({ type: 'date' })
  snapshotDate: string;

  // ── Occupancy ────────────────────────────────────────────────────────────────
  @ApiProperty() @Column({ type: 'int', default: 0 }) totalRooms: number;
  @ApiProperty() @Column({ type: 'int', default: 0 }) occupiedRooms: number;
  @ApiProperty() @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 }) occupancyRate: number;

  // ── Revenue ──────────────────────────────────────────────────────────────────
  @ApiProperty() @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 }) totalRevenue: number;
  @ApiProperty() @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 }) roomRevenue: number;
  @ApiProperty() @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 }) ancillaryRevenue: number;

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  /** Average Daily Rate */
  @ApiProperty() @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) adr: number;
  /** Revenue Per Available Room */
  @ApiProperty() @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) revpar: number;

  // ── Reservations ─────────────────────────────────────────────────────────────
  @ApiProperty() @Column({ type: 'int', default: 0 }) newReservations: number;
  @ApiProperty() @Column({ type: 'int', default: 0 }) cancellations: number;
  @ApiProperty() @Column({ type: 'int', default: 0 }) checkIns: number;
  @ApiProperty() @Column({ type: 'int', default: 0 }) checkOuts: number;
  @ApiProperty() @Column({ type: 'int', default: 0 }) noShows: number;

  // ── Operations ───────────────────────────────────────────────────────────────
  @ApiProperty() @Column({ type: 'int', default: 0 }) housekeepingTasksCompleted: number;
  @ApiProperty() @Column({ type: 'int', default: 0 }) maintenanceRequestsOpen: number;
  @ApiProperty() @Column({ type: 'int', default: 0 }) conciergeRequestsCompleted: number;

  // ── Guests ───────────────────────────────────────────────────────────────────
  @ApiProperty() @Column({ type: 'int', default: 0 }) newGuests: number;
  @ApiProperty() @Column({ type: 'int', default: 0 }) returningGuests: number;
}
