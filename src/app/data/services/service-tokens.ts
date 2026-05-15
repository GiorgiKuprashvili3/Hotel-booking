import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Guest, Property, Reservation, Room, RoomType,
  HousekeepingTask, MaintenanceRequest, ConciergeRequest,
  Staff, ReservationStatus, RoomStatus, Folio,
} from '../../domain';

/* ============================================================
   Service interfaces — the contract.
   Mock impls live in /data/mock/impl
   Real HTTP impls will live in /data/http  (later, when NestJS is ready)
   ============================================================ */

export interface IPropertyService {
  list(): Observable<Property[]>;
  getById(id: string): Observable<Property | undefined>;
}

export interface IRoomService {
  list(propertyId: string): Observable<Room[]>;
  listTypes(propertyId: string): Observable<RoomType[]>;
  getById(id: string): Observable<Room | undefined>;
  updateStatus(id: string, status: RoomStatus): Observable<Room>;
}

export interface IReservationService {
  list(propertyId: string, params?: ReservationQuery): Observable<Reservation[]>;
  getById(id: string): Observable<Reservation | undefined>;
  getByDateRange(propertyId: string, from: Date, to: Date): Observable<Reservation[]>;
  create(data: Partial<Reservation>): Observable<Reservation>;
  updateStatus(id: string, status: ReservationStatus): Observable<Reservation>;
  cancel(id: string, reason: string): Observable<Reservation>;
  getFolio(reservationId: string): Observable<Folio | undefined>;
}

export interface ReservationQuery {
  status?: ReservationStatus[];
  guestId?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

export interface IGuestService {
  list(params?: GuestQuery): Observable<Guest[]>;
  getById(id: string): Observable<Guest | undefined>;
  search(query: string): Observable<Guest[]>;
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
}

export interface IMaintenanceService {
  list(propertyId: string): Observable<MaintenanceRequest[]>;
  create(data: Partial<MaintenanceRequest>): Observable<MaintenanceRequest>;
}

export interface IConciergeService {
  list(propertyId: string): Observable<ConciergeRequest[]>;
  updateStatus(id: string, status: string): Observable<ConciergeRequest>;
}

/* ---------- Injection tokens ---------- */
export const PROPERTY_SERVICE      = new InjectionToken<IPropertyService>('PROPERTY_SERVICE');
export const ROOM_SERVICE          = new InjectionToken<IRoomService>('ROOM_SERVICE');
export const RESERVATION_SERVICE   = new InjectionToken<IReservationService>('RESERVATION_SERVICE');
export const GUEST_SERVICE         = new InjectionToken<IGuestService>('GUEST_SERVICE');
export const STAFF_SERVICE         = new InjectionToken<IStaffService>('STAFF_SERVICE');
export const HOUSEKEEPING_SERVICE  = new InjectionToken<IHousekeepingService>('HOUSEKEEPING_SERVICE');
export const MAINTENANCE_SERVICE   = new InjectionToken<IMaintenanceService>('MAINTENANCE_SERVICE');
export const CONCIERGE_SERVICE     = new InjectionToken<IConciergeService>('CONCIERGE_SERVICE');
