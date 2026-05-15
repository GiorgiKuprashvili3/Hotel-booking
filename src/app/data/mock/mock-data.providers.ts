import { Provider } from '@angular/core';
import {
  PROPERTY_SERVICE, ROOM_SERVICE, RESERVATION_SERVICE, GUEST_SERVICE,
  STAFF_SERVICE, HOUSEKEEPING_SERVICE, MAINTENANCE_SERVICE, CONCIERGE_SERVICE,
} from '../services/service-tokens';
import {
  MockPropertyService, MockRoomService, MockReservationService, MockGuestService,
  MockStaffService, MockHousekeepingService, MockMaintenanceService, MockConciergeService,
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
];
