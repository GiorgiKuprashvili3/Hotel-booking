import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { PropertyEntity } from '../properties/property.entity';

@Entity('booking_groups')
export class BookingGroupEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  propertyId: string;

  @ManyToOne(() => PropertyEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'propertyId' })
  property: PropertyEntity;

  /** Human-readable group name, e.g. "Smith Wedding Block" */
  @ApiProperty({ example: 'Smith Wedding Block' })
  @Column()
  name: string;

  /** Auto-generated short code, e.g. "GRP-20250517-001" */
  @ApiProperty({ example: 'GRP-20250517-001' })
  @Column({ unique: true })
  code: string;

  /** Optional guest who is the group coordinator / master payer */
  @ApiProperty({ nullable: true })
  @Column({ nullable: true })
  masterGuestId: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string;

  @ApiProperty()
  @Column({ default: true })
  isActive: boolean;
}
