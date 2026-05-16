import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Guest, Property, Reservation, Room, RoomType,
  HousekeepingTask, MaintenanceRequest, ConciergeRequest,
  Staff, ReservationStatus, RoomStatus, Folio, FolioItem, Payment,
  RoomStatusHistory,
} from '../../domain';
import { MaintenanceStatus } from '../../domain/enums';

export interface IPropertyService {
  list(): Observable<Property[]>;
  getById(id: string): Observable<Property | undefined>;
}

export interface IRoomService {
  list(propertyId: string): Observable<Room[]>;
  listTypes(propertyId: string): Observable<RoomType[]>;
  getById(id: string): Observable<Room | undefined>;
  updateStatus(id: string, status: RoomStatus, note?: string): Observable<Room>;
  listStatusHistory(roomId: string): Observable<RoomStatusHistory[]>;
}

export interface IReservationService {
  list(propertyId: string, params?: ReservationQuery): Observable<Reservation[]>;
  getById(id: string): Observable<Reservation | undefined>;
  getByDateRange(propertyId: string, from: Date, to: Date): Observable<Reservation[]>;
  create(data: Partial<Reservation>): Observable<Reservation>;
  update(id: string, patch: Partial<Reservation>): Observable<Reservation>;
  updateStatus(id: string, status: ReservationStatus): Observable<Reservation>;
  cancel(id: string, reason: string): Observable<Reservation>;
  checkIn(id: string, opts: CheckInOptions): Observable<Reservation>;
  checkOut(id: string, opts: CheckOutOptions): Observable<Reservation>;
  getFolio(reservationId: string): Observable<Folio | undefined>;
  postFolioItem(reservationId: string, item: Partial<FolioItem>): Observable<Folio>;
  recordPayment(reservationId: string, payment: Partial<Payment>): Observable<Folio>;
}

export interface CheckInOptions {
  roomId: string;
  idVerified: boolean;
  keyCardsIssued: number;
  paymentAmount?: number;
  paymentMethod?: string;
  notes?: string;
}

export interface CheckOutOptions {
  paymentAmount?: number;
  paymentMethod?: string;
  emailReceipt?: boolean;
  notes?: string;
}

export interface ReservationQuery {
  status?: ReservationStatus[];
  guestId?: string;
  roomTypeId?: string;
  source?: string[];
  search?: string;
  from?: Date;
  to?: Date;
}

export interface IGuestService {
  list(params?: GuestQuery): Observable<Guest[]>;
  getById(id: string): Observable<Guest | undefined>;
  search(query: string): Observable<Guest[]>;
  create(data: Partial<Guest>): Observable<Guest>;
  update(id: string, patch: Partial<Guest>): Observable<Guest>;
  getStays(guestId: string): Observable<Reservation[]>;
}

export interface GuestQuery {
  vipOnly?: boolean;
  loyaltyTier?: string;
  search?: string;
}

export interface IStaffService {
  list(propertyId?: string): Observable<Staff[]>;
  getById(id: string): Observable<Staff | undefined>;
}

export interface IHousekeepingService {
  listTasks(propertyId: string): Observable<HousekeepingTask[]>;
  assignTask(taskId: string, staffId: string): Observable<HousekeepingTask>;
  startTask(taskId: string): Observable<HousekeepingTask>;
  completeTask(taskId: string): Observable<HousekeepingTask>;
  inspectTask(taskId: string, inspectorId: string): Observable<HousekeepingTask>;
  updateNotes(taskId: string, notes: string): Observable<HousekeepingTask>;
}

export interface IMaintenanceService {
  list(propertyId: string): Observable<MaintenanceRequest[]>;
  create(data: Partial<MaintenanceRequest>): Observable<MaintenanceRequest>;
  updateStatus(
    id: string,
    status: MaintenanceStatus,
    assignedTo?: string,
    resolutionNotes?: string,
  ): Observable<MaintenanceRequest>;
}

export interface IConciergeService {
  list(propertyId: string): Observable<ConciergeRequest[]>;
  updateStatus(id: string, status: string): Observable<ConciergeRequest>;
}

export interface AnalyticsSnapshot {
  date: string;
  propertyId: string;
  occupancyRate: number;
  totalRooms: number;
  occupiedRooms: number;
  adr: number;
  revpar: number;
  totalRevenue: number;
  roomRevenue: number;
  fnbRevenue: number;
  spaRevenue: number;
  arrivals: number;
  departures: number;
  noShows: number;
  cancellations: number;
}

export interface IAnalyticsService {
  listSnapshots(propertyId: string): Observable<AnalyticsSnapshot[]>;
  getSnapshot(propertyId: string, date: string): Observable<AnalyticsSnapshot | undefined>;
}

export const PROPERTY_SERVICE      = new InjectionToken<IPropertyService>('PROPERTY_SERVICE');
export const ROOM_SERVICE          = new InjectionToken<IRoomService>('ROOM_SERVICE');
export const RESERVATION_SERVICE   = new InjectionToken<IReservationService>('RESERVATION_SERVICE');
export const GUEST_SERVICE         = new InjectionToken<IGuestService>('GUEST_SERVICE');
export const STAFF_SERVICE         = new InjectionToken<IStaffService>('STAFF_SERVICE');
export const HOUSEKEEPING_SERVICE  = new InjectionToken<IHousekeepingService>('HOUSEKEEPING_SERVICE');
export const MAINTENANCE_SERVICE   = new InjectionToken<IMaintenanceService>('MAINTENANCE_SERVICE');
export const CONCIERGE_SERVICE     = new InjectionToken<IConciergeService>('CONCIERGE_SERVICE');
export const ANALYTICS_SERVICE     = new InjectionToken<IAnalyticsService>('ANALYTICS_SERVICE');
