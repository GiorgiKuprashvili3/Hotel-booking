import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationEntity } from './reservation.entity';
import { BookingGroupEntity } from './booking-group.entity';
import { RoomEntity } from '../rooms/room.entity';
import { GuestEntity } from '../guests/guest.entity';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReservationEntity,
      BookingGroupEntity,
      RoomEntity,
      GuestEntity,
    ]),
  ],
  providers: [ReservationsService],
  controllers: [ReservationsController],
  exports: [ReservationsService],
})
export class ReservationsModule {}
