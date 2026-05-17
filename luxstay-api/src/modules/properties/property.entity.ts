import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';

@Entity('properties')
export class PropertyEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty()
  @Column({ unique: true })
  code: string; // short slug e.g. "lux-tbs" — used in URLs / reports

  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty()
  @Column()
  addressLine1: string;

  @ApiProperty()
  @Column({ nullable: true })
  addressLine2: string;

  @ApiProperty()
  @Column()
  city: string;

  @ApiProperty()
  @Column({ nullable: true })
  state: string;

  @ApiProperty()
  @Column()
  country: string;

  @ApiProperty()
  @Column({ nullable: true })
  postalCode: string;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  latitude: number;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  longitude: number;

  @ApiProperty()
  @Column()
  timezone: string; // e.g. "Asia/Tbilisi"

  @ApiProperty()
  @Column({ default: 'USD' })
  currency: string; // ISO 4217

  @ApiProperty()
  @Column({ nullable: true })
  phone: string;

  @ApiProperty()
  @Column({ nullable: true })
  email: string;

  @ApiProperty()
  @Column({ nullable: true })
  website: string;

  @ApiProperty()
  @Column({ type: 'int', nullable: true })
  starRating: number; // 1–5

  @ApiProperty()
  @Column('text', { array: true, default: [] })
  amenities: string[]; // ['pool', 'gym', 'spa', 'parking', ...]

  @ApiProperty()
  @Column('text', { array: true, default: [] })
  imageUrls: string[];

  @ApiProperty()
  @Column({ type: 'time', nullable: true })
  checkInTime: string; // "15:00"

  @ApiProperty()
  @Column({ type: 'time', nullable: true })
  checkOutTime: string; // "11:00"

  @ApiProperty()
  @Column({ default: true })
  isActive: boolean;
}
