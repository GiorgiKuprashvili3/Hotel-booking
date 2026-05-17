import {
  Component, inject, OnInit, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { RESERVATION_SERVICE, ROOM_SERVICE } from '../data/services/service-tokens';
import { PropertyContextService } from '../core/config/property-context.service';
import { Reservation, Room, RoomType } from '../domain';
import { ReservationStatus, RoomStatus } from '../domain/enums';

import { CalendarGridComponent }   from './calendar/calendar-grid.component';
import { ReservationDrawerComponent } from './calendar/reservation-drawer.component';
import { NewReservationModalComponent, NewReservationPayload } from './calendar/new-reservation-modal.component';

export interface CalendarFilters {
  roomTypeIds: string[];
  floors: number[];
  statuses: ReservationStatus[];
}

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [CommonModule, FormsModule, CalendarGridComponent, ReservationDrawerComponent, NewReservationModalComponent],
  templateUrl: './calendar.page.html',
  styleUrl: './calendar.page.scss',
})
export class CalendarPageComponent implements OnInit {
  private reservationSvc = inject(RESERVATION_SERVICE);
  private roomSvc        = inject(ROOM_SERVICE);
  readonly propertyCtx   = inject(PropertyContextService);
  private destroyRef     = inject(DestroyRef);
  private router         = inject(Router);
  private route          = inject(ActivatedRoute);

  // ── State ────────────────────────────────────────
  loading      = signal(true);
  allRooms     = signal<Room[]>([]);
  roomTypes    = signal<RoomType[]>([]);
  reservations = signal<Reservation[]>([]);
  startDate    = signal<Date>(this.todayMidnight());
  windowDays   = signal(60);
  showFilters  = signal(false);
  drawerReservation  = signal<Reservation | null>(null);
  pendingCreate      = signal<{ roomId: string; roomTypeId: string; checkIn: Date; checkOut: Date; nights: number } | null>(null);

  filters = signal<CalendarFilters>({
    roomTypeIds: [],
    floors: [],
    statuses: [],
  });

  readonly windowOptions = [
    { label: '30d', days: 30 },
    { label: '60d', days: 60 },
    { label: '90d', days: 90 },
  ];

  readonly statusOptions = [
    { value: ReservationStatus.Confirmed,   label: 'Confirmed',   color: '#4A7C59' },
    { value: ReservationStatus.CheckedIn,   label: 'Checked In',  color: '#2D5A87' },
    { value: ReservationStatus.CheckedOut,  label: 'Checked Out', color: '#8A8A8A' },
    { value: ReservationStatus.Cancelled,   label: 'Cancelled',   color: '#9E3B3B' },
    { value: ReservationStatus.Pending,     label: 'Pending',     color: '#C8862E' },
    { value: ReservationStatus.NoShow,      label: 'No-Show',     color: '#5C5C5C' },
  ];

  // ── Derived ──────────────────────────────────────
  floors = computed(() =>
    [...new Set(this.allRooms().map(r => r.floor))].sort((a, b) => a - b)
  );

  activeFilterCount = computed(() => {
    const f = this.filters();
    return f.roomTypeIds.length + f.floors.length + f.statuses.length;
  });

  filteredRooms = computed(() => {
    const f = this.filters();
    let rooms = this.allRooms();
    if (f.roomTypeIds.length) rooms = rooms.filter(r => f.roomTypeIds.includes(r.roomTypeId));
    if (f.floors.length)      rooms = rooms.filter(r => f.floors.includes(r.floor));
    return rooms;
  });

  filteredReservations = computed(() => {
    const f = this.filters();
    let res = this.reservations();
    if (f.statuses.length) res = res.filter(r => f.statuses.includes(r.status));
    if (f.roomTypeIds.length) res = res.filter(r => f.roomTypeIds.includes(r.roomTypeId));
    return res;
  });

  // ── Lifecycle ────────────────────────────────────
  ngOnInit(): void {
    // 1. Hydrate state from query params (makes URL shareable / survives refresh)
    const qp = this.route.snapshot.queryParamMap;
    const fromParam   = qp.get('from');
    const windowParam = qp.get('window');

    if (fromParam) {
      const parsed = new Date(fromParam);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(0, 0, 0, 0);
        this.startDate.set(parsed);
      }
    }
    if (windowParam) {
      const w = parseInt(windowParam, 10);
      if ([30, 60, 90].includes(w)) this.windowDays.set(w);
    }

    // If no ?from param, no URL push needed on init — grid will scroll-to-today
    if (!fromParam) this.pushUrl();

    // 2. Load data whenever property changes
    this.propertyCtx.active$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(prop => {
        if (prop) this.load(prop.id);
      });
  }

  /** Push current startDate + windowDays to query params without full navigation */
  private pushUrl(): void {
    const from = this.startDate().toISOString().slice(0, 10);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from, window: this.windowDays() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private load(propertyId: string): void {
    this.loading.set(true);
    const end = new Date(this.startDate());
    end.setDate(end.getDate() + this.windowDays() + 30);

    forkJoin({
      rooms:     this.roomSvc.list(propertyId),
      types:     this.roomSvc.listTypes(propertyId),
      reservations: this.reservationSvc.getByDateRange(
        propertyId,
        new Date(this.startDate().getTime() - 30 * 86400000),
        end,
      ),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ rooms, types, reservations }) => {
        this.allRooms.set(rooms.filter(r => r.status !== RoomStatus.Maintenance));
        this.roomTypes.set(types);
        this.reservations.set(reservations);
        this.loading.set(false);
      });
  }

  // ── Navigation ───────────────────────────────────
  shiftDays(delta: number): void {
    const d = new Date(this.startDate());
    d.setDate(d.getDate() + delta);
    this.startDate.set(d);
    this.pushUrl();
  }

  goToday(): void {
    this.startDate.set(this.todayMidnight());
    this.pushUrl();
  }

  setWindow(days: number): void {
    this.windowDays.set(days);
    this.pushUrl();
  }

  // ── Filters ──────────────────────────────────────
  toggleRoomType(id: string): void {
    this.filters.update(f => {
      const ids = f.roomTypeIds.includes(id)
        ? f.roomTypeIds.filter(x => x !== id)
        : [...f.roomTypeIds, id];
      return { ...f, roomTypeIds: ids };
    });
  }

  toggleStatus(s: ReservationStatus): void {
    this.filters.update(f => {
      const statuses = f.statuses.includes(s)
        ? f.statuses.filter(x => x !== s)
        : [...f.statuses, s];
      return { ...f, statuses };
    });
  }

  toggleFloor(floor: number): void {
    this.filters.update(f => {
      const floors = f.floors.includes(floor)
        ? f.floors.filter(x => x !== floor)
        : [...f.floors, floor];
      return { ...f, floors };
    });
  }

  clearFilters(): void {
    this.filters.set({ roomTypeIds: [], floors: [], statuses: [] });
  }

  // ── Drawer ───────────────────────────────────────
  openDrawer(res: Reservation): void {
    this.drawerReservation.set(res);
  }
  closeDrawer(): void {
    this.drawerReservation.set(null);
  }

  // ── Mutations ────────────────────────────────────
  handleCreate(partial: Partial<Reservation>): void {
    if (!partial.roomId || !partial.roomTypeId || !partial.checkIn || !partial.checkOut || !partial.nights) return;
    this.pendingCreate.set({
      roomId:     partial.roomId,
      roomTypeId: partial.roomTypeId,
      checkIn:    partial.checkIn,
      checkOut:   partial.checkOut,
      nights:     partial.nights,
    });
  }

  handleModalConfirm(payload: NewReservationPayload): void {
    const prop = this.propertyCtx.active();
    if (!prop) return;
    this.pendingCreate.set(null);
    this.reservationSvc.create({ ...payload, propertyId: prop.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(r => this.reservations.update(list => [...list, r]));
  }

  getRoomById(id: string): import('../domain').Room | null {
    return this.allRooms().find(r => r.id === id) ?? null;
  }

  getRoomTypeById(id: string): import('../domain').RoomType | null {
    return this.roomTypes().find(t => t.id === id) ?? null;
  }

  getRatePlansForType(roomTypeId: string): import('../domain/room.model').RatePlan[] {
    // Rate plans are loaded per room type; stub returns empty — wire to real service when available
    return [];
  }

  handleMove(event: { reservation: Reservation; newRoomId: string; newCheckIn: Date }): void {
    // Optimistic update — in real app, call API
    this.reservations.update(list =>
      list.map(r => r.id === event.reservation.id
        ? {
            ...r,
            roomId: event.newRoomId,
            checkIn: event.newCheckIn,
            checkOut: new Date(event.newCheckIn.getTime() + r.nights * 86400000),
          }
        : r
      )
    );
  }

  handleResize(event: { reservation: Reservation; newCheckOut: Date }): void {
    this.reservations.update(list =>
      list.map(r => r.id === event.reservation.id
        ? {
            ...r,
            checkOut: event.newCheckOut,
            nights: Math.round(
              (event.newCheckOut.getTime() - r.checkIn.getTime()) / 86400000
            ),
          }
        : r
      )
    );
  }

  handleStatusChange(event: { id: string; status: ReservationStatus }): void {
    this.reservationSvc.updateStatus(event.id, event.status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated =>
        this.reservations.update(list =>
          list.map(r => r.id === updated.id ? updated : r)
        )
      );
  }

  private todayMidnight(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
