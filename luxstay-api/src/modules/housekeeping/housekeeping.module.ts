import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HousekeepingTaskEntity } from './housekeeping-task.entity';
import { HousekeepingService } from './housekeeping.service';
import { HousekeepingController } from './housekeeping.controller';
import { RoomEntity } from '../rooms/room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HousekeepingTaskEntity, RoomEntity])],
  providers: [HousekeepingService],
  controllers: [HousekeepingController],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
