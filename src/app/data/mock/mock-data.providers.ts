import { Provider } from '@angular/core';
import {
  PROPERTY_SERVICE, ROOM_SERVICE, RESERVATION_SERVICE, GUEST_SERVICE,
  STAFF_SERVICE, HOUSEKEEPING_SERVICE, MAINTENANCE_SERVICE, CONCIERGE_SERVICE,
  ANALYTICS_SERVICE, LOYALTY_SERVICE, AUDIT_SERVICE, RATE_PLAN_SERVICE, SETTINGS_SERVICE,
} from '../services/service-tokens';
import {
  MockPropertyService, MockRoomService, MockReservationService, MockGuestService,
  MockStaffService, MockHousekeepingService, MockMaintenanceService, MockConciergeService,
  MockAnalyticsService, MockLoyaltyService, MockAuditService, MockRatePlanService,
  MockSettingsService,
} from './impl/mock-services';

export const MOCK_DATA_PROVIDERS: Provider[] = [
  { provide: PROPERTY_SERVICE,     useClass: MockPropertyService },
  { provide: ROOM_SERVICE,         useClass: MockRoomService },
  { provide: RESERVATION_SERVICE,  useClass: MockReservationService },
  { provide: GUEST_SERVICE,        useClass: MockGuestService },
  { provide: STAFF_SERVICE,        useClass: MockStaffService },
  { provide: HOUSEKEEPING_SERVICE, useClass: MockHousekeepingService },
  { provide: MAINTENANCE_SERVICE,  useClass: MockMaintenanceService },
  { provide: CONCIERGE_SERVICE,    useClass: MockConciergeService },
  { provide: ANALYTICS_SERVICE,    useClass: MockAnalyticsService },
  { provide: LOYALTY_SERVICE,      useClass: MockLoyaltyService },
  { provide: AUDIT_SERVICE,        useClass: MockAuditService },
  { provide: RATE_PLAN_SERVICE,    useClass: MockRatePlanService },
  { provide: SETTINGS_SERVICE,     useClass: MockSettingsService },
];
