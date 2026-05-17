import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { StaffModule } from './modules/staff/staff.module';

// Phase 3+: uncomment as you build
// import { PropertiesModule } from './modules/properties/properties.module';
// import { RoomsModule } from './modules/rooms/rooms.module';
// import { GuestsModule } from './modules/guests/guests.module';
// import { ReservationsModule } from './modules/reservations/reservations.module';
// import { FolioModule } from './modules/folio/folio.module';
// import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
// import { MaintenanceModule } from './modules/maintenance/maintenance.module';
// import { ConciergeModule } from './modules/concierge/concierge.module';
// import { LoyaltyModule } from './modules/loyalty/loyalty.module';
// import { AnalyticsModule } from './modules/analytics/analytics.module';
// import { AuditModule } from './modules/audit/audit.module';
// import { RealtimeModule } from './modules/realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    AuthModule,
    StaffModule,
  ],
})
export class AppModule {}
