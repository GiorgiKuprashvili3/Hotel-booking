import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import {
  IPropertyService, IRoomService, IReservationService, IGuestService,
  IStaffService, IHousekeepingService, IMaintenanceService, IConciergeService,
  IAnalyticsService, AnalyticsSnapshot,
  ReservationQuery, GuestQuery,
} from '../../services/service-tokens';
import {
  Property, Room, RoomType, Guest, Reservation, Staff,
  HousekeepingTask, MaintenanceRequest, ConciergeRequest,
  RoomStatus, ReservationStatus, HousekeepingStatus, Folio,
} from '../../../domain';
import { getSeedDataset, AnalyticsSnapshotRaw } from '../seed/seed-generator';

/* ============================================================
   All mock services. Each simulates network latency with delay().
   Mutations are kept in memory (cached seed dataset is mutable).
   ============================================================ */

const LATENCY_MS = 180;
function latency<T>(value: T): Observable<T> {
  return of(value).pipe(delay(LATENCY_MS));
}

/* ---------- Property ---------- */
@Injectable({ providedIn: 'root' })
export class MockPropertyService implements IPropertyService {
  list(): Observable<Property[]> {
    return latency(getSeedDataset().properties);
  }
  getById(id: string): Observable<Property | undefined> {
    return latency(getSeedDataset().properties.find(p => p.id === id));
  }
}

/* ---------- Room ---------- */
@Injectable({ providedIn: 'root' })
export class MockRoomService implements IRoomService {
  list(propertyId: string): Observable<Room[]> {
    return latency(getSeedDataset().rooms.filter(r => r.propertyId === propertyId));
  }
  listTypes(propertyId: string): Observable<RoomType[]> {
    return latency(getSeedDataset().roomTypes.filter(t => t.propertyId === propertyId));
  }
  getById(id: string): Observable<Room | undefined> {
    return latency(getSeedDataset().rooms.find(r => r.id === id));
  }
  updateStatus(id: string, status: RoomStatus): Observable<Room> {
    const room = getSeedDataset().rooms.find(r => r.id === id);
    if (!room) return throwError(() => new Error('Room not found'));
    room.status = status;
    return latency(room);
  }
}

/* ---------- Reservation ---------- */
@Injectable({ providedIn: 'root' })
export class MockReservationService implements IReservationService {
  list(propertyId: string, params: ReservationQuery = {}): Observable<Reservation[]> {
    let items = getSeedDataset().reservations.filter(r => r.propertyId === propertyId);
    if (params.status?.length) items = items.filter(r => params.status!.includes(r.status));
    if (params.guestId)        items = items.filter(r => r.guestId === params.guestId);
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(r => r.confirmationNumber.toLowerCase().includes(q));
    }
    return latency(items);
  }
  getById(id: string): Observable<Reservation | undefined> {
    return latency(getSeedDataset().reservations.find(r => r.id === id));
  }
  getByDateRange(propertyId: string, from: Date, to: Date): Observable<Reservation[]> {
    const items = getSeedDataset().reservations.filter(r =>
      r.propertyId === propertyId &&
      r.status !== ReservationStatus.Cancelled &&
      r.checkOut > from && r.checkIn < to,
    );
    return latency(items);
  }
  create(data: Partial<Reservation>): Observable<Reservation> {
    const ds = getSeedDataset();
    const id = `res-${ds.reservations.length + 1}`;
    const created: Reservation = {
      id,
      confirmationNumber: `LUX-2026-${String(ds.reservations.length + 1).padStart(5, '0')}`,
      propertyId: data.propertyId!,
      guestId: data.guestId!,
      roomTypeId: data.roomTypeId!,
      ratePlanId: data.ratePlanId ?? 'bar',
      checkIn: data.checkIn!,
      checkOut: data.checkOut!,
      nights: data.nights ?? 1,
      adults: data.adults ?? 1,
      children: data.children ?? 0,
      status: ReservationStatus.Confirmed,
      source: data.source ?? ('direct' as any),
      totalRoomCharge: data.totalRoomCharge ?? 0,
      totalTax: data.totalTax ?? 0,
      totalExtras: 0,
      totalPaid: 0,
      totalAmount: (data.totalRoomCharge ?? 0) + (data.totalTax ?? 0),
      balance: (data.totalRoomCharge ?? 0) + (data.totalTax ?? 0),
      createdAt: new Date(),
      ...data,
    } as Reservation;
    ds.reservations.push(created);
    return latency(created);
  }
  updateStatus(id: string, status: ReservationStatus): Observable<Reservation> {
    const r = getSeedDataset().reservations.find(x => x.id === id);
    if (!r) return throwError(() => new Error('Reservation not found'));
    r.status = status;
    return latency(r);
  }
  cancel(id: string, reason: string): Observable<Reservation> {
    const r = getSeedDataset().reservations.find(x => x.id === id);
    if (!r) return throwError(() => new Error('Reservation not found'));
    r.status = ReservationStatus.Cancelled;
    r.cancelledAt = new Date();
    r.cancellationReason = reason;
    return latency(r);
  }
  getFolio(reservationId: string): Observable<Folio | undefined> {
    const r = getSeedDataset().reservations.find(x => x.id === reservationId);
    if (!r) return latency(undefined);
    // Build a synthetic folio on demand
    const folio: Folio = {
      id: `folio-${r.id}`,
      reservationId: r.id,
      isOpen: r.status === ReservationStatus.CheckedIn,
      items: Array.from({ length: r.nights }, (_, i) => ({
        id: `fi-${r.id}-${i}`,
        date: new Date(r.checkIn.getTime() + i * 86400000),
        description: `Room charge - night ${i + 1}`,
        category: 'room' as const,
        quantity: 1,
        unitPrice: r.totalRoomCharge / r.nights,
        amount: r.totalRoomCharge / r.nights,
      })),
      payments: r.totalPaid > 0 ? [{
        id: `pay-${r.id}`,
        reservationId: r.id,
        date: r.createdAt,
        amount: r.totalPaid,
        method: 'card' as any,
        reference: '**** 4242',
      }] : [],
    };
    return latency(folio);
  }
}

/* ---------- Guest ---------- */
@Injectable({ providedIn: 'root' })
export class MockGuestService implements IGuestService {
  list(params: GuestQuery = {}): Observable<Guest[]> {
    let items = [...getSeedDataset().guests];
    if (params.vipOnly) items = items.filter(g => g.isVip);
    if (params.loyaltyTier) items = items.filter(g => g.loyaltyTier === params.loyaltyTier);
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(g =>
        g.firstName.toLowerCase().includes(q) ||
        g.lastName.toLowerCase().includes(q) ||
        g.email.toLowerCase().includes(q),
      );
    }
    return latency(items);
  }
  getById(id: string): Observable<Guest | undefined> {
    return latency(getSeedDataset().guests.find(g => g.id === id));
  }
  search(query: string): Observable<Guest[]> {
    return this.list({ search: query });
  }
}

/* ---------- Staff ---------- */
@Injectable({ providedIn: 'root' })
export class MockStaffService implements IStaffService {
  list(propertyId?: string): Observable<Staff[]> {
    let items = getSeedDataset().staff;
    if (propertyId) items = items.filter(s => s.propertyIds.includes(propertyId));
    return latency(items);
  }
  getById(id: string): Observable<Staff | undefined> {
    return latency(getSeedDataset().staff.find(s => s.id === id));
  }
}

/* ---------- Housekeeping ---------- */
@Injectable({ providedIn: 'root' })
export class MockHousekeepingService implements IHousekeepingService {
  listTasks(propertyId: string): Observable<HousekeepingTask[]> {
    return latency(getSeedDataset().housekeepingTasks.filter(t => t.propertyId === propertyId));
  }
  assignTask(taskId: string, staffId: string): Observable<HousekeepingTask> {
    const t = getSeedDataset().housekeepingTasks.find(x => x.id === taskId);
    if (!t) return throwError(() => new Error('Task not found'));
    t.assignedTo = staffId;
    return latency(t);
  }
  startTask(taskId: string): Observable<HousekeepingTask> {
    const t = getSeedDataset().housekeepingTasks.find(x => x.id === taskId);
    if (!t) return throwError(() => new Error('Task not found'));
    t.status = HousekeepingStatus.InProgress;
    t.startedAt = new Date();
    return latency(t);
  }
  completeTask(taskId: string): Observable<HousekeepingTask> {
    const t = getSeedDataset().housekeepingTasks.find(x => x.id === taskId);
    if (!t) return throwError(() => new Error('Task not found'));
    t.status = HousekeepingStatus.Clean;
    t.completedAt = new Date();
    if (t.startedAt) t.durationMinutes = Math.round((t.completedAt.getTime() - t.startedAt.getTime()) / 60000);
    return latency(t);
  }
}

/* ---------- Maintenance ---------- */
@Injectable({ providedIn: 'root' })
export class MockMaintenanceService implements IMaintenanceService {
  list(propertyId: string): Observable<MaintenanceRequest[]> {
    return latency(getSeedDataset().maintenance.filter(m => m.propertyId === propertyId));
  }
  create(data: Partial<MaintenanceRequest>): Observable<MaintenanceRequest> {
    const ds = getSeedDataset();
    const item: MaintenanceRequest = {
      id: `mnt-new-${ds.maintenance.length + 1}`,
      propertyId: data.propertyId!,
      reportedBy: data.reportedBy!,
      category: data.category ?? 'other',
      priority: data.priority ?? ('medium' as any),
      status: 'open' as any,
      title: data.title ?? '',
      description: data.description ?? '',
      reportedAt: new Date(),
      ...data,
    } as MaintenanceRequest;
    ds.maintenance.push(item);
    return latency(item);
  }
}

/* ---------- Concierge ---------- */
@Injectable({ providedIn: 'root' })
export class MockConciergeService implements IConciergeService {
  list(propertyId: string): Observable<ConciergeRequest[]> {
    return latency(getSeedDataset().concierge.filter(c => c.propertyId === propertyId));
  }
  updateStatus(id: string, status: string): Observable<ConciergeRequest> {
    const c = getSeedDataset().concierge.find(x => x.id === id);
    if (!c) return throwError(() => new Error('Request not found'));
    c.status = status as any;
    if (status === 'completed') c.completedAt = new Date();
    return latency(c);
  }
}

/* ---------- Analytics ---------- */
@Injectable({ providedIn: 'root' })
export class MockAnalyticsService implements IAnalyticsService {
  listSnapshots(propertyId: string): Observable<AnalyticsSnapshot[]> {
    return latency(
      getSeedDataset().analyticsSnapshots
        .filter(s => s.propertyId === propertyId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    );
  }
  getSnapshot(propertyId: string, date: string): Observable<AnalyticsSnapshot | undefined> {
    return latency(
      getSeedDataset().analyticsSnapshots
        .find(s => s.propertyId === propertyId && s.date === date),
    );
  }
}
