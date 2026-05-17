import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { PropertyEntity } from '../properties/property.entity';
import { RoomTypeEntity } from './room-type.entity';
import { RoomStatus, HousekeepingStatus } from '../../common/enums';

@Entity('rooms')
@Unique(['propertyId', 'number']) // room number unique per property
export class RoomEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  propertyId: string;

  @ManyToOne(() => PropertyEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'propertyId' })
  property: PropertyEntity;

  @ApiProperty()
  @Column()
  roomTypeId: string;

  @ManyToOne(() => RoomTypeEntity, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'roomTypeId' })
  roomType: RoomTypeEntity;

  @ApiProperty({ example: '101', description: 'Room number as displayed to guests' })
  @Column()
  number: string;

  @ApiProperty({ example: 1 })
  @Column({ type: 'int' })
  floor: number;

  @ApiProperty({ enum: RoomStatus })
  @Column({ type: 'enum', enum: RoomStatus, default: RoomStatus.Available })
  status: RoomStatus;

  @ApiProperty({ enum: HousekeepingStatus })
  @Column({
    type: 'enum',
    enum: HousekeepingStatus,
    default: HousekeepingStatus.Clean,
  })
  housekeepingStatus: HousekeepingStatus;

  @ApiProperty({ nullable: true, description: 'Internal notes visible to staff only' })
  @Column({ type: 'text', nullable: true })
  notes: string;

  @ApiProperty({ description: 'Connecting room ID if applicable', nullable: true })
  @Column({ nullable: true })
  connectingRoomId: string;

  @ApiProperty({ default: true })
  @Column({ default: true })
  isActive: boolean;
}
