import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import {
  IPropertyService, IRoomService, IReservationService, IGuestService,
  IStaffService, IHousekeepingService, IMaintenanceService, IConciergeService,
  IAnalyticsService, AnalyticsSnapshot,
  ReservationQuery, GuestQuery, CheckInOptions, CheckOutOptions,
} from '../../services/service-tokens';
import {
  Property, Room, RoomType, Guest, Reservation, Staff,
  HousekeepingTask, MaintenanceRequest, ConciergeRequest,
  RoomStatus, ReservationStatus, HousekeepingStatus, MaintenanceStatus, Folio, FolioItem, Payment,
  PaymentMethod, RoomStatusHistory,
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

/** Per-process room status history (mock-only — would be a DB table in real life). */
const roomStatusHistory: RoomStatusHistory[] = [];

/** Per-process folio overlays — initialised lazily, mutated by folio operations. */
const folioStore = new Map<string, Folio>();

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
  updateStatus(id: string, status: RoomStatus, note?: string): Observable<Room> {
    const room = getSeedDataset().rooms.find(r => r.id === id);
    if (!room) return throwError(() => new Error('Room not found'));
    if (room.status !== status) {
      roomStatusHistory.unshift({
        id: `rsh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        roomId: id,
        from: room.status,
        to: status,
        at: new Date(),
        note,
      });
      room.status = status;
    }
    return latency(room);
  }
  listStatusHistory(roomId: string): Observable<RoomStatusHistory[]> {
    return latency(roomStatusHistory.filter(h => h.roomId === roomId));
  }
}

/* ---------- Reservation ---------- */
@Injectable({ providedIn: 'root' })
export class MockReservationService implements IReservationService {
  list(propertyId: string, params: ReservationQuery = {}): Observable<Reservation[]> {
    let items = getSeedDataset().reservations.filter(r => r.propertyId === propertyId);
    if (params.status?.length)     items = items.filter(r => params.status!.includes(r.status));
    if (params.guestId)            items = items.filter(r => r.guestId === params.guestId);
    if (params.roomTypeId)         items = items.filter(r => r.roomTypeId === params.roomTypeId);
    if (params.source?.length)     items = items.filter(r => params.source!.includes(r.source));
    if (params.from)               items = items.filter(r => r.checkOut >= params.from!);
    if (params.to)                 items = items.filter(r => r.checkIn  <= params.to!);
    if (params.search) {
      const q = params.search.toLowerCase();
      const guests = getSeedDataset().guests;
      items = items.filter(r => {
        if (r.confirmationNumber.toLowerCase().includes(q)) return true;
        const g = guests.find(x => x.id === r.guestId);
        if (!g) return false;
        return g.firstName.toLowerCase().includes(q) ||
               g.lastName.toLowerCase().includes(q)  ||
               g.email.toLowerCase().includes(q);
      });
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
  update(id: string, patch: Partial<Reservation>): Observable<Reservation> {
    const r = getSeedDataset().reservations.find(x => x.id === id);
    if (!r) return throwError(() => new Error('Reservation not found'));
    Object.assign(r, patch);
    return latency(r);
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
  checkIn(id: string, opts: CheckInOptions): Observable<Reservation> {
    const ds = getSeedDataset();
    const r = ds.reservations.find(x => x.id === id);
    if (!r) return throwError(() => new Error('Reservation not found'));
    const room = ds.rooms.find(x => x.id === opts.roomId);
    if (!room) return throwError(() => new Error('Room not found'));

    r.roomId = opts.roomId;
    r.status = ReservationStatus.CheckedIn;
    if (opts.notes) r.internalNotes = (r.internalNotes ? r.internalNotes + '\n' : '') + opts.notes;

    // Update room state
    const prevStatus = room.status;
    room.status = RoomStatus.Occupied;
    if (prevStatus !== RoomStatus.Occupied) {
      roomStatusHistory.unshift({
        id: `rsh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        roomId: room.id, from: prevStatus, to: RoomStatus.Occupied,
        at: new Date(), note: `Check-in: ${r.confirmationNumber}`,
      });
    }

    // Record payment if any
    if (opts.paymentAmount && opts.paymentAmount > 0) {
      r.totalPaid += opts.paymentAmount;
      r.balance = Math.max(0, r.totalAmount - r.totalPaid);
      this.appendPayment(r, opts.paymentAmount, opts.paymentMethod);
    }
    return latency(r);
  }
  checkOut(id: string, opts: CheckOutOptions): Observable<Reservation> {
    const ds = getSeedDataset();
    const r = ds.reservations.find(x => x.id === id);
    if (!r) return throwError(() => new Error('Reservation not found'));
    if (opts.paymentAmount && opts.paymentAmount > 0) {
      r.totalPaid += opts.paymentAmount;
      r.balance = Math.max(0, r.totalAmount - r.totalPaid);
      this.appendPayment(r, opts.paymentAmount, opts.paymentMethod);
    }
    r.status = ReservationStatus.CheckedOut;
    if (opts.notes) r.internalNotes = (r.internalNotes ? r.internalNotes + '\n' : '') + opts.notes;

    if (r.roomId) {
      const room = ds.rooms.find(x => x.id === r.roomId);
      if (room && room.status !== RoomStatus.Cleaning) {
        const prevStatus = room.status;
        room.status = RoomStatus.Cleaning;
        room.housekeepingStatus = HousekeepingStatus.Dirty;
        roomStatusHistory.unshift({
          id: `rsh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          roomId: room.id, from: prevStatus, to: RoomStatus.Cleaning,
          at: new Date(), note: `Check-out: ${r.confirmationNumber}`,
        });
      }
    }

    // Close folio
    const f = folioStore.get(r.id);
    if (f) {
      f.isOpen = false;
      f.closedAt = new Date();
    }
    return latency(r);
  }
  getFolio(reservationId: string): Observable<Folio | undefined> {
    return latency(this.ensureFolio(reservationId));
  }
  postFolioItem(reservationId: string, item: Partial<FolioItem>): Observable<Folio> {
    const folio = this.ensureFolio(reservationId);
    if (!folio) return throwError(() => new Error('Reservation not found'));
    const newItem: FolioItem = {
      id: `fi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: item.date ?? new Date(),
      description: item.description ?? '',
      category: (item.category ?? 'misc') as FolioItem['category'],
      quantity: item.quantity ?? 1,
      unitPrice: item.unitPrice ?? 0,
      amount: item.amount ?? (item.unitPrice ?? 0) * (item.quantity ?? 1),
      postedBy: item.postedBy,
    };
    folio.items.push(newItem);
    // Update reservation totals
    const r = getSeedDataset().reservations.find(x => x.id === reservationId);
    if (r) {
      r.totalExtras = (r.totalExtras ?? 0) + newItem.amount;
      r.totalAmount = r.totalRoomCharge + r.totalTax + r.totalExtras;
      r.balance = Math.max(0, r.totalAmount - r.totalPaid);
    }
    return latency(folio);
  }
  recordPayment(reservationId: string, payment: Partial<Payment>): Observable<Folio> {
    const folio = this.ensureFolio(reservationId);
    if (!folio) return throwError(() => new Error('Reservation not found'));
    const r = getSeedDataset().reservations.find(x => x.id === reservationId);
    if (!r) return throwError(() => new Error('Reservation not found'));
    const p: Payment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      reservationId,
      date: payment.date ?? new Date(),
      amount: payment.amount ?? 0,
      method: (payment.method ?? PaymentMethod.Card),
      reference: payment.reference,
      receivedBy: payment.receivedBy,
      notes: payment.notes,
    };
    folio.payments.push(p);
    r.totalPaid += p.amount;
    r.balance = Math.max(0, r.totalAmount - r.totalPaid);
    return latency(folio);
  }

  /** Build a folio if first time; otherwise return cached one. */
  private ensureFolio(reservationId: string): Folio | undefined {
    if (folioStore.has(reservationId)) return folioStore.get(reservationId);
    const r = getSeedDataset().reservations.find(x => x.id === reservationId);
    if (!r) return undefined;
    const folio: Folio = {
      id: `folio-${r.id}`,
      reservationId: r.id,
      isOpen: r.status === ReservationStatus.CheckedIn || r.status === ReservationStatus.Confirmed,
      closedAt: r.status === ReservationStatus.CheckedOut ? new Date() : undefined,
      items: Array.from({ length: r.nights }, (_, i) => ({
        id: `fi-${r.id}-n${i}`,
        date: new Date(r.checkIn.getTime() + i * 86400000),
        description: `Room charge - night ${i + 1}`,
        category: 'room' as const,
        quantity: 1,
        unitPrice: r.totalRoomCharge / Math.max(1, r.nights),
        amount: r.totalRoomCharge / Math.max(1, r.nights),
      })),
      payments: r.totalPaid > 0 ? [{
        id: `pay-${r.id}-init`,
        reservationId: r.id,
        date: r.createdAt,
        amount: r.totalPaid,
        method: PaymentMethod.Card,
        reference: '**** 4242',
      }] : [],
    };
    folioStore.set(reservationId, folio);
    return folio;
  }

  private appendPayment(r: Reservation, amount: number, method?: string): void {
    const folio = this.ensureFolio(r.id);
    if (!folio) return;
    folio.payments.push({
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      reservationId: r.id,
      date: new Date(),
      amount,
      method: (method as PaymentMethod) ?? PaymentMethod.Card,
    });
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
  create(data: Partial<Guest>): Observable<Guest> {
    const now = new Date();
    const guest: Guest = {
      id:            `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      firstName:     data.firstName ?? '',
      lastName:      data.lastName ?? '',
      email:         data.email ?? '',
      phone:         data.phone ?? '',
      nationality:   data.nationality ?? 'Unknown',
      idType:        data.idType ?? 'passport',
      idNumber:      data.idNumber ?? '',
      idPhotoUrl:    data.idPhotoUrl,
      dateOfBirth:   data.dateOfBirth,
      address:       data.address,
      isVip:         data.isVip ?? false,
      loyaltyTier:   data.loyaltyTier,
      loyaltyPoints: data.loyaltyPoints ?? 0,
      preferences:   data.preferences ?? {
        smokingPreference: false,
        dietary: [],
      },
      tags:          data.tags ?? [],
      notes:         data.notes,
      totalStays:    data.totalStays ?? 0,
      totalSpent:    data.totalSpent ?? 0,
      lastStayDate:  data.lastStayDate,
      createdAt:     now,
    };
    getSeedDataset().guests.push(guest);
    return latency(guest);
  }
  update(id: string, patch: Partial<Guest>): Observable<Guest> {
    const g = getSeedDataset().guests.find(x => x.id === id);
    if (!g) return throwError(() => new Error('Guest not found'));
    // Preserve preferences nesting if partial preferences provided
    if (patch.preferences) {
      patch.preferences = { ...g.preferences, ...patch.preferences };
    }
    Object.assign(g, patch);
    return latency(g);
  }
  getStays(guestId: string): Observable<Reservation[]> {
    const items = getSeedDataset().reservations
      .filter(r => r.guestId === guestId)
      .sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime());
    return latency(items);
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
  inspectTask(taskId: string, inspectorId: string): Observable<HousekeepingTask> {
    const t = getSeedDataset().housekeepingTasks.find(x => x.id === taskId);
    if (!t) return throwError(() => new Error('Task not found'));
    t.status = HousekeepingStatus.Inspected;
    t.inspectedAt = new Date();
    t.inspectedBy = inspectorId;
    return latency(t);
  }
  updateNotes(taskId: string, notes: string): Observable<HousekeepingTask> {
    const t = getSeedDataset().housekeepingTasks.find(x => x.id === taskId);
    if (!t) return throwError(() => new Error('Task not found'));
    t.notes = notes;
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
  updateStatus(
    id: string,
    status: MaintenanceStatus,
    assignedTo?: string,
    resolutionNotes?: string,
  ): Observable<MaintenanceRequest> {
    const m = getSeedDataset().maintenance.find(x => x.id === id);
    if (!m) return throwError(() => new Error('Request not found'));
    m.status = status;
    if (assignedTo !== undefined) m.assignedTo = assignedTo;
    if (resolutionNotes !== undefined) m.resolutionNotes = resolutionNotes;
    if (status === MaintenanceStatus.Resolved || status === MaintenanceStatus.Closed) {
      m.resolvedAt = new Date();
    }
    return latency(m);
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
