import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomTypeEntity } from './room-type.entity';
import { RoomEntity } from './room.entity';
import { RoomsService } from './rooms.service';
import { RoomTypesController, RoomsController } from './rooms.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RoomTypeEntity, RoomEntity])],
  providers: [RoomsService],
  controllers: [RoomTypesController, RoomsController],
  exports: [RoomsService],
})
export class RoomsModule {}
