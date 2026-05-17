import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsSnapshotEntity } from './analytics-snapshot.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ReservationEntity } from '../reservations/reservation.entity';
import { RoomEntity } from '../rooms/room.entity';
import { GuestEntity } from '../guests/guest.entity';
import { HousekeepingTaskEntity } from '../housekeeping/housekeeping-task.entity';
import { MaintenanceRequestEntity } from '../maintenance/maintenance-request.entity';
import { ConciergeRequestEntity } from '../concierge/concierge-request.entity';
import { FolioItemEntity } from '../folio/folio-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnalyticsSnapshotEntity,
      ReservationEntity,
      RoomEntity,
      GuestEntity,
      HousekeepingTaskEntity,
      MaintenanceRequestEntity,
      ConciergeRequestEntity,
      FolioItemEntity,
    ]),
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
