import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { PropertyEntity } from '../properties/property.entity';
import { RoomTypeEntity } from '../rooms/room-type.entity';
import { MealPlan } from '../../common/enums';

@Entity('rate_plans')
@Unique(['propertyId', 'code']) // code unique per property
export class RatePlanEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  propertyId: string;

  @ManyToOne(() => PropertyEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'propertyId' })
  property: PropertyEntity;

  @ApiProperty({ nullable: true, description: 'If null this plan applies to all room types' })
  @Column({ nullable: true })
  roomTypeId: string;

  @ManyToOne(() => RoomTypeEntity, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'roomTypeId' })
  roomType: RoomTypeEntity;

  @ApiProperty({ example: 'Summer Saver 2025' })
  @Column()
  name: string;

  @ApiProperty({ example: 'summer-saver-25' })
  @Column()
  code: string;

  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ example: 199.00, description: 'Nightly rate in property currency' })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  baseRate: number;

  @ApiProperty({ example: 0, description: 'Percentage discount off the room type base rate (0–100). Used when baseRate is auto-derived.' })
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @ApiProperty({ enum: MealPlan, default: MealPlan.RoomOnly })
  @Column({ type: 'enum', enum: MealPlan, default: MealPlan.RoomOnly })
  mealPlan: MealPlan;

  @ApiProperty({ example: 1, description: 'Minimum consecutive nights required' })
  @Column({ type: 'int', default: 1 })
  minNights: number;

  @ApiProperty({ example: null, nullable: true, description: 'Maximum consecutive nights (null = unlimited)' })
  @Column({ type: 'int', nullable: true })
  maxNights: number;

  @ApiProperty({ nullable: true, description: 'Rate valid from (inclusive). Null = no start restriction.' })
  @Column({ type: 'date', nullable: true })
  validFrom: string;

  @ApiProperty({ nullable: true, description: 'Rate valid to (inclusive). Null = no end restriction.' })
  @Column({ type: 'date', nullable: true })
  validTo: string;

  @ApiProperty({ default: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ default: false, description: 'Whether this plan can be booked directly by guests' })
  @Column({ default: false })
  isPublic: boolean;
}
