import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { PropertyEntity } from '../properties/property.entity';
import { RoomEntity } from '../rooms/room.entity';
import { StaffEntity } from '../staff/staff.entity';
import { HousekeepingStatus } from '../../common/enums';

export enum HousekeepingTaskType {
  Checkout   = 'checkout',
  Stayover   = 'stayover',
  DeepClean  = 'deep_clean',
  Inspection = 'inspection',
  Turndown   = 'turndown',
}

@Entity('housekeeping_tasks')
@Index(['propertyId', 'scheduledDate'])
@Index(['assignedToId', 'scheduledDate'])
export class HousekeepingTaskEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  propertyId: string;

  @ManyToOne(() => PropertyEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'propertyId' })
  property: PropertyEntity;

  @ApiProperty()
  @Column()
  roomId: string;

  @ManyToOne(() => RoomEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'roomId' })
  room: RoomEntity;

  @ApiProperty({ enum: HousekeepingTaskType })
  @Column({ type: 'enum', enum: HousekeepingTaskType, default: HousekeepingTaskType.Stayover })
  taskType: HousekeepingTaskType;

  @ApiProperty({ enum: HousekeepingStatus })
  @Column({ type: 'enum', enum: HousekeepingStatus, default: HousekeepingStatus.Dirty })
  status: HousekeepingStatus;

  @ApiProperty({ example: '2025-06-01' })
  @Column({ type: 'date' })
  scheduledDate: string;

  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  assignedToId: string;

  @ManyToOne(() => StaffEntity, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: StaffEntity;

  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  inspectedById: string;

  @ManyToOne(() => StaffEntity, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'inspectedById' })
  inspectedBy: StaffEntity;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  inspectedAt: Date;

  /** Estimated minutes to complete */
  @ApiProperty({ nullable: true })
  @Column({ type: 'int', nullable: true })
  estimatedMinutes: number;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string;

  @ApiProperty({ default: 0 })
  @Column({ type: 'int', default: 0 })
  priority: number; // 0 = normal, higher = more urgent
}
