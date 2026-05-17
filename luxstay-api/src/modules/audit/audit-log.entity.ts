import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { StaffEntity } from '../staff/staff.entity';
import { AuditAction, AuditEntityType } from '../../common/enums';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['performedById', 'createdAt'])
@Index(['propertyId', 'createdAt'])
export class AuditLogEntity extends AbstractEntity {
  @ApiProperty({ enum: AuditAction })
  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @ApiProperty({ enum: AuditEntityType })
  @Column({ type: 'enum', enum: AuditEntityType })
  entityType: AuditEntityType;

  @ApiProperty()
  @Column()
  entityId: string;

  /** Snapshot of the record before the change */
  @ApiProperty({ nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  before: Record<string, any>;

  /** Snapshot of the record after the change */
  @ApiProperty({ nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, any>;

  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  performedById: string;

  @ManyToOne(() => StaffEntity, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'performedById' })
  performedBy: StaffEntity;

  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  propertyId: string;

  /** IP address of the actor */
  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  ipAddress: string;

  /** Extra free-form context */
  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string;
}
