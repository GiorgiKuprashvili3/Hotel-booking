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
  template: `
<div class="cal-page">

  <!-- ── Header ─────────────────────────────────── -->
  <header class="cal-header">
    <div class="cal-header__left">
      <h1 class="cal-title">Reservation Calendar</h1>
      <span class="cal-subtitle">{{ propertyCtx.active()?.name }}</span>
    </div>

    <div class="cal-header__controls">
      <!-- Date range navigation -->
      <div class="date-nav">
        <button class="btn-icon" (click)="shiftDays(-30)" title="Back 30 days">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="btn-today" (click)="goToday()">Today</button>
        <button class="btn-icon" (click)="shiftDays(30)" title="Forward 30 days">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <!-- Window size selector -->
      <div class="window-select">
        @for (w of windowOptions; track w.days) {
          <button
            class="btn-window"
            [class.active]="windowDays() === w.days"
            (click)="setWindow(w.days)">
            {{ w.label }}
          </button>
        }
      </div>
    </div>

    <div class="cal-header__right">
      <!-- Filters toggle -->
      <button class="btn-filters" [class.active]="showFilters()" (click)="showFilters.set(!showFilters())">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        Filters
        @if (activeFilterCount() > 0) {
          <span class="filter-badge">{{ activeFilterCount() }}</span>
        }
      </button>
    </div>
  </header>

  <!-- ── Filter bar ──────────────────────────────── -->
  @if (showFilters()) {
    <div class="filter-bar">
      <!-- Room type filter -->
      <div class="filter-group">
        <span class="filter-label">Room Type</span>
        <div class="filter-chips">
          @for (rt of roomTypes(); track rt.id) {
            <button
              class="chip"
              [class.active]="filters().roomTypeIds.includes(rt.id)"
              (click)="toggleRoomType(rt.id)">
              {{ rt.code }}
            </button>
          }
        </div>
      </div>

      <!-- Status filter -->
      <div class="filter-group">
        <span class="filter-label">Status</span>
        <div class="filter-chips">
          @for (s of statusOptions; track s.value) {
            <button
              class="chip chip--status"
              [class.active]="filters().statuses.includes(s.value)"
              [style.--chip-color]="s.color"
              (click)="toggleStatus(s.value)">
              {{ s.label }}
            </button>
          }
        </div>
      </div>

      <!-- Floor filter -->
      @if (floors().length > 1) {
        <div class="filter-group">
          <span class="filter-label">Floor</span>
          <div class="filter-chips">
            @for (f of floors(); track f) {
              <button
                class="chip"
                [class.active]="filters().floors.includes(f)"
                (click)="toggleFloor(f)">
                {{ f }}F
              </button>
            }
          </div>
        </div>
      }

      <button class="btn-clear" (click)="clearFilters()">Clear all</button>
    </div>
  }

  <!-- ── Legend ─────────────────────────────────── -->
  <div class="cal-legend">
    @for (s of statusOptions; track s.value) {
      <span class="legend-item">
        <span class="legend-dot" [style.background]="s.color"></span>
        {{ s.label }}
      </span>
    }
    <span class="legend-item">
      <span class="legend-dot legend-dot--weekend"></span>
      Weekend
    </span>
  </div>

  <!-- ── Grid ───────────────────────────────────── -->
  <div class="cal-body">
    @if (loading()) {
      <div class="cal-loading">
        <div class="spinner"></div>
        <span>Loading reservations…</span>
      </div>
    } @else {
      <app-calendar-grid
        [rooms]="filteredRooms()"
        [reservations]="filteredReservations()"
        [roomTypes]="roomTypes()"
        [startDate]="startDate()"
        [windowDays]="windowDays()"
        (reservationClick)="openDrawer($event)"
        (reservationCreate)="handleCreate($event)"
        (reservationMove)="handleMove($event)"
        (reservationResize)="handleResize($event)"
      />
    }
  </div>

  <!-- ── Drawer ─────────────────────────────────── -->
  @if (drawerReservation()) {
    <app-reservation-drawer
      [reservation]="drawerReservation()!"
      [rooms]="allRooms()"
      [roomTypes]="roomTypes()"
      (close)="closeDrawer()"
      (statusChange)="handleStatusChange($event)"
    />
  }

  <!-- ── New Reservation Modal ──────────────────── -->
  @if (pendingCreate(); as pc) {
    <app-new-reservation-modal
      [roomId]="pc.roomId"
      [roomTypeId]="pc.roomTypeId"
      [checkIn]="pc.checkIn"
      [checkOut]="pc.checkOut"
      [nights]="pc.nights"
      [room]="getRoomById(pc.roomId)"
      [roomType]="getRoomTypeById(pc.roomTypeId)"
      [ratePlans]="getRatePlansForType(pc.roomTypeId)"
      (confirm)="handleModalConfirm($event)"
      (cancel)="pendingCreate.set(null)"
    />
  }

</div>
  `,
  styles: [`
    .cal-page {
      display: flex;
      flex-direction: column;
      height: calc(75vh - var(--topbar-height));
      background: var(--bg);
      overflow: hidden;
    }

    /* ── Header ── */
    .cal-header {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-6);
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .cal-header__left { flex: 1; }
    .cal-title {
      font-family: var(--font-display);
      font-size: var(--text-xl);
      font-weight: 600;
      color: var(--text);
      margin: 0;
      line-height: 1.2;
    }
    .cal-subtitle {
      font-size: var(--text-sm);
      color: var(--text-muted);
    }
    .cal-header__controls {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .cal-header__right {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    /* Date nav */
    .date-nav {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      background: var(--surface-2);
      border-radius: var(--radius-md);
      padding: 2px;
    }
    .btn-icon {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border: none; background: transparent; cursor: pointer;
      color: var(--text-muted);
      border-radius: var(--radius-sm);
      transition: background var(--t-fast), color var(--t-fast);
      &:hover { background: var(--surface-3); color: var(--text); }
    }
    .btn-today {
      height: 32px;
      padding: 0 var(--space-3);
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: var(--text-sm);
      font-weight: 500;
      color: var(--primary);
      border-radius: var(--radius-sm);
      transition: background var(--t-fast);
      &:hover { background: var(--surface-3); }
    }

    /* Window selector */
    .window-select {
      display: flex;
      background: var(--surface-2);
      border-radius: var(--radius-md);
      padding: 2px;
      gap: 2px;
    }
    .btn-window {
      height: 32px;
      padding: 0 var(--space-3);
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: var(--text-sm);
      color: var(--text-muted);
      border-radius: var(--radius-sm);
      transition: all var(--t-fast);
      &.active {
        background: var(--surface);
        color: var(--text);
        font-weight: 500;
        box-shadow: var(--shadow-1);
      }
      &:not(.active):hover { color: var(--text); }
    }

    /* Filters button */
    .btn-filters {
      display: flex; align-items: center; gap: var(--space-2);
      height: 36px; padding: 0 var(--space-4);
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: var(--text-sm);
      color: var(--text-muted);
      transition: all var(--t-fast);
      &.active, &:hover {
        border-color: var(--primary);
        color: var(--primary);
      }
    }
    .filter-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px;
      background: var(--primary); color: var(--on-primary);
      border-radius: var(--radius-full);
      font-size: 10px; font-weight: 600;
    }

    /* ── Filter bar ── */
    .filter-bar {
      display: flex;
      align-items: center;
      gap: var(--space-6);
      padding: var(--space-3) var(--space-6);
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .filter-group {
      display: flex; align-items: center; gap: var(--space-2);
    }
    .filter-label {
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-subtle);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    .filter-chips {
      display: flex; gap: var(--space-1);
    }
    .chip {
      height: 28px; padding: 0 var(--space-3);
      border: 1px solid var(--border);
      background: transparent;
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      cursor: pointer;
      color: var(--text-muted);
      transition: all var(--t-fast);
      &.active {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--on-primary);
      }
      &:not(.active):hover {
        border-color: var(--border-strong);
        color: var(--text);
      }
    }
    .chip--status.active {
      background: var(--chip-color);
      border-color: var(--chip-color);
    }
    .btn-clear {
      margin-left: auto;
      height: 28px; padding: 0 var(--space-3);
      border: none; background: none; cursor: pointer;
      font-size: var(--text-xs); color: var(--text-muted);
      text-decoration: underline;
      &:hover { color: var(--danger); }
    }

    /* ── Legend ── */
    .cal-legend {
      display: flex;
      align-items: center;
      gap: var(--space-5);
      padding: var(--space-2) var(--space-6);
      background: var(--surface-2);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .legend-item {
      display: flex; align-items: center; gap: 6px;
      font-size: var(--text-xs); color: var(--text-muted);
    }
    .legend-dot {
      width: 10px; height: 10px; border-radius: 2px;
    }
    .legend-dot--weekend { background: rgba(var(--ink-300-rgb, 184,184,184), 0.3); border: 1px solid var(--border); }

    /* ── Body ── */
    .cal-body {
      flex: 1;
      overflow: hidden;
      position: relative;
    }
    .cal-loading {
      display: flex; align-items: center; justify-content: center;
      gap: var(--space-3);
      height: 100%;
      color: var(--text-muted);
      font-size: var(--text-sm);
    }
    .spinner {
      width: 20px; height: 20px;
      border: 2px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
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
