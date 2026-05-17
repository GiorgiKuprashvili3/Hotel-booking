import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';

// Phase 1 / 2
import { AuthModule } from './modules/auth/auth.module';
import { StaffModule } from './modules/staff/staff.module';

// Phase 3
import { PropertiesModule } from './modules/properties/properties.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { GuestsModule } from './modules/guests/guests.module';
import { RatePlansModule } from './modules/rate-plans/rate-plans.module';

// Phase 4
import { ReservationsModule } from './modules/reservations/reservations.module';
import { FolioModule } from './modules/folio/folio.module';

// Phase 5
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { ConciergeModule } from './modules/concierge/concierge.module';

// Phase 6
import { AuditModule } from './modules/audit/audit.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { RealtimeModule } from './modules/realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),

    // Phase 1 / 2
    AuthModule,
    StaffModule,

    // Phase 3
    PropertiesModule,
    RoomsModule,
    GuestsModule,
    RatePlansModule,

    // Phase 4
    ReservationsModule,
    FolioModule,

    // Phase 5
    HousekeepingModule,
    MaintenanceModule,
    ConciergeModule,

    // Phase 6
    AuditModule,       // @Global() — AuditService available everywhere
    LoyaltyModule,
    AnalyticsModule,
    RealtimeModule,
  ],
})
export class AppModule {}
