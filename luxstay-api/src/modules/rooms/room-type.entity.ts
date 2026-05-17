import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { PropertyEntity } from '../properties/property.entity';

@Entity('room_types')
@Unique(['propertyId', 'code']) // code must be unique per property
export class RoomTypeEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  propertyId: string;

  @ManyToOne(() => PropertyEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'propertyId' })
  property: PropertyEntity;

  @ApiProperty({ example: 'Deluxe King' })
  @Column()
  name: string;

  @ApiProperty({ example: 'DLX-K', description: 'Short code, unique per property' })
  @Column()
  code: string;

  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty()
  @Column({ type: 'int', default: 2 })
  maxOccupancy: number; // total guests (adults + children)

  @ApiProperty()
  @Column({ type: 'int', default: 2 })
  maxAdults: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  maxChildren: number;

  @ApiProperty({ example: '1 King Bed' })
  @Column({ nullable: true })
  bedConfiguration: string;

  @ApiProperty({ example: 35.5 })
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  sizeM2: number;

  @ApiProperty({ type: [String], example: ['sea view', 'balcony', 'jacuzzi'] })
  @Column('text', { array: true, default: [] })
  amenities: string[];

  @ApiProperty({ type: [String] })
  @Column('text', { array: true, default: [] })
  imageUrls: string[];

  @ApiProperty({ example: 250.00, description: 'Nightly base rate in property currency' })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  baseRate: number;

  @ApiProperty()
  @Column({ default: true })
  isActive: boolean;
}
