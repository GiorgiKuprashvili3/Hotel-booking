import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { PropertyEntity } from '../properties/property.entity';
import { RoomEntity } from '../rooms/room.entity';
import { StaffEntity } from '../staff/staff.entity';
import { MaintenancePriority, MaintenanceStatus } from '../../common/enums';

export enum MaintenanceCategory {
  Electrical = 'electrical',
  Plumbing   = 'plumbing',
  HVAC       = 'hvac',
  Furniture  = 'furniture',
  Appliance  = 'appliance',
  Painting   = 'painting',
  General    = 'general',
  Safety     = 'safety',
  IT         = 'it',
  Other      = 'other',
}

@Entity('maintenance_requests')
@Index(['propertyId', 'status'])
@Index(['roomId', 'status'])
export class MaintenanceRequestEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  propertyId: string;

  @ManyToOne(() => PropertyEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'propertyId' })
  property: PropertyEntity;

  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  roomId: string;

  @ManyToOne(() => RoomEntity, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'roomId' })
  room: RoomEntity;

  @ApiProperty()
  @Column()
  title: string;

  @ApiProperty()
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ enum: MaintenanceCategory })
  @Column({ type: 'enum', enum: MaintenanceCategory, default: MaintenanceCategory.General })
  category: MaintenanceCategory;

  @ApiProperty({ enum: MaintenancePriority })
  @Column({ type: 'enum', enum: MaintenancePriority, default: MaintenancePriority.Medium })
  priority: MaintenancePriority;

  @ApiProperty({ enum: MaintenanceStatus })
  @Column({ type: 'enum', enum: MaintenanceStatus, default: MaintenanceStatus.Open })
  status: MaintenanceStatus;

  /** Staff member who reported the issue */
  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  reportedById: string;

  @ManyToOne(() => StaffEntity, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'reportedById' })
  reportedBy: StaffEntity;

  /** Staff member assigned to fix the issue */
  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  assignedToId: string;

  @ManyToOne(() => StaffEntity, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: StaffEntity;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  resolutionNotes: string;

  /** Estimated cost of repair */
  @ApiProperty({ nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedCost: number;

  /** Actual cost after completion */
  @ApiProperty({ nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualCost: number;

  /** Should the room be taken out of service during repair? */
  @ApiProperty()
  @Column({ default: false })
  requiresRoomBlocked: boolean;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string;
}
