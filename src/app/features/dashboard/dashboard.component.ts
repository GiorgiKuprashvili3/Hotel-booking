import { Component, computed, effect, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { KpiTileComponent } from '../../shared/components/kpi-tile.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { PropertyContextService } from '../../core/config/property-context.service';
import { BookingBroadcastService, BookingCreatedEvent } from '../../core/realtime/booking-broadcast.service';
import { ToastService } from '../../core/ui/toast.service';
import {
  ANALYTICS_SERVICE, AnalyticsSnapshot,
  GUEST_SERVICE, HOUSEKEEPING_SERVICE, MAINTENANCE_SERVICE,
  RESERVATION_SERVICE, ROOM_SERVICE,
} from '../../data/services/service-tokens';
import {
  Guest, HousekeepingTask, MaintenanceRequest, Reservation, Room,
  HousekeepingStatus, MaintenancePriority, MaintenanceStatus,
  ReservationStatus, RoomStatus,
} from '../../domain';

@Component({
  selector: 'lux-dashboard',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule,
    KpiTileComponent, PageHeaderComponent, StatusChipComponent,
  ],
  template: `
    <lux-page-header
      [title]="greeting()"
      [subtitle]="subtitle()">
      <button mat-stroked-button>
        <mat-icon>file_download</mat-icon>
        Export
      </button>
      <button mat-flat-button color="primary">
        <mat-icon>add</mat-icon>
        New reservation
      </button>
    </lux-page-header>

    @if (liveBookings().length > 0) {
      <div class="live-strip" role="status" aria-live="polite">
        <div class="live-strip-pulse" aria-hidden="true">
          <span class="dot"></span>
          <span>LIVE</span>
        </div>
        <span class="live-strip-text">
          {{ liveBookings().length }} new
          {{ liveBookings().length === 1 ? 'booking' : 'bookings' }}
          since you opened the dashboard
        </span>
        <div class="live-strip-spacer"></div>
        <button class="live-strip-dismiss" type="button"
                (click)="dismissLive()"
                aria-label="Dismiss live booking notifications">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    }

    <div class="kpi-grid">
      <lux-kpi-tile
        label="Occupancy"
        icon="meeting_room"
        [value]="occupancyPct()"
        suffix="%"
        [delta]="occupancyDelta()"
        deltaLabel="vs last week"
        [loading]="loading()" />
      <lux-kpi-tile
        label="Revenue (today)"
        icon="payments"
        prefix="₾"
        [value]="(revenueToday() | number:'1.0-0') ?? '0'"
        [delta]="revenueDelta()"
        deltaLabel="vs yesterday"
        [loading]="loading()" />
      <lux-kpi-tile
        label="ADR"
        icon="trending_up"
        prefix="₾"
        [value]="(adr() | number:'1.0-0') ?? '0'"
        [delta]="adrDelta()"
        deltaLabel="MTD"
        [loading]="loading()" />
      <lux-kpi-tile
        label="Arrivals today"
        icon="flight_land"
        [value]="arrivalsToday()"
        [delta]="0"
        [loading]="loading()" />
      <lux-kpi-tile
        label="Departures today"
        icon="flight_takeoff"
        [value]="departuresToday()"
        [delta]="0"
        [loading]="loading()" />
      <lux-kpi-tile
        label="In-house guests"
        icon="hotel"
        [value]="inHouse()"
        [delta]="0"
        [loading]="loading()" />
    </div>

    <div class="two-col">
      <section class="surface card">
        <header class="card-header">
          <div>
            <h3>Room status</h3>
            <p class="muted">Live snapshot across the property</p>
          </div>
          <a class="link">View room map →</a>
        </header>
        <div class="status-grid">
          @for (s of roomStatusBreakdown(); track s.status) {
            <div class="status-row">
              <lux-status-chip [variant]="statusVariant(s.status)" [label]="s.label">
                {{ s.label }}
              </lux-status-chip>
              <div class="bar">
                <div class="bar-fill" [style.width.%]="s.pct" [attr.data-status]="s.status"></div>
              </div>
              <span class="count tabular-nums">{{ s.count }}</span>
            </div>
          }
        </div>
      </section>

      <section class="surface card">
        <header class="card-header">
          <div>
            <h3>Today at a glance</h3>
            <p class="muted">Front-desk priorities</p>
          </div>
        </header>
        <ul class="agenda">
          <li>
            <div class="agenda-icon" data-tone="info"><mat-icon>flight_land</mat-icon></div>
            <div class="agenda-body">
              <div class="agenda-title">{{ arrivalsToday() }} arrivals expected</div>
              <div class="agenda-meta">
                First check-in {{ checkInTime() }}
                @if (vipArrivalsToday() > 0) {
                  · {{ vipArrivalsToday() }} VIP {{ vipArrivalsToday() === 1 ? 'guest' : 'guests' }}
                }
              </div>
            </div>
            <span class="agenda-chip">→</span>
          </li>
          <li>
            <div class="agenda-icon" data-tone="warning"><mat-icon>flight_takeoff</mat-icon></div>
            <div class="agenda-body">
              <div class="agenda-title">{{ departuresToday() }} departures</div>
              <div class="agenda-meta">
                {{ departuresToday() }} {{ departuresToday() === 1 ? 'room' : 'rooms' }} to flip by {{ checkOutTime() }}
              </div>
            </div>
            <span class="agenda-chip">→</span>
          </li>
          <li>
            <div class="agenda-icon" data-tone="success"><mat-icon>cleaning_services</mat-icon></div>
            <div class="agenda-body">
              <div class="agenda-title">{{ cleaningCount() }} rooms in housekeeping</div>
              <div class="agenda-meta">
                @if (avgCleaningTime() > 0) {
                  Avg cleaning time today: {{ avgCleaningTime() }} min
                } @else {
                  No completed tasks yet today
                }
              </div>
            </div>
            <span class="agenda-chip">→</span>
          </li>
          <li>
            <div class="agenda-icon" data-tone="danger"><mat-icon>build</mat-icon></div>
            <div class="agenda-body">
              <div class="agenda-title">{{ openMaintenanceCount() }} open maintenance ticket{{ openMaintenanceCount() === 1 ? '' : 's' }}</div>
              <div class="agenda-meta">
                @if (topMaintenanceTicket(); as ticket) {
                  {{ ticket.priorityLabel }} priority — {{ ticket.title }}{{ ticket.room ? ', ' + ticket.room : '' }}
                } @else {
                  No open issues
                }
              </div>
            </div>
            <span class="agenda-chip">→</span>
          </li>
        </ul>
      </section>
    </div>

    <section class="surface card mt-6">
      <header class="card-header">
        <div>
          <h3>Recent reservations</h3>
          <p class="muted">{{ recentReservations().length }} most recent bookings across all sources</p>
        </div>
        <a class="link">All reservations →</a>
      </header>
      <table class="table">
        <thead>
          <tr>
            <th>Confirmation</th>
            <th>Status</th>
            <th>Check-in</th>
            <th>Nights</th>
            <th>Source</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          @for (r of recentReservations(); track r.id) {
            <tr>
              <td class="mono">{{ r.confirmationNumber }}</td>
              <td>
                <lux-status-chip [variant]="resStatusVariant(r.status)">
                  {{ statusLabel(r.status) }}
                </lux-status-chip>
              </td>
              <td class="tabular-nums">{{ r.checkIn | date:'MMM d' }}</td>
              <td class="tabular-nums">{{ r.nights }}</td>
              <td><span class="source">{{ r.source }}</span></td>
              <td class="num tabular-nums">₾{{ r.totalAmount | number:'1.0-0' }}</td>
            </tr>
          }
        </tbody>
      </table>
      <div class="show-more-row">
        @if (reservationLimit() < reservations().length) {
          <button mat-button (click)="showMoreReservations()">
            Show more
            <mat-icon>expand_more</mat-icon>
          </button>
        }
        @if (reservationLimit() > 8) {
          <button mat-button (click)="showLessReservations()">
            Show less
            <mat-icon>expand_less</mat-icon>
          </button>
        }
        <span class="show-more-count">Showing {{ recentReservations().length }} of {{ reservations().length }}</span>
      </div>
    </section>
  `,
  styles: [`
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    .two-col {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: var(--space-4);
    }
    @media (max-width: 1024px) { .two-col { grid-template-columns: 1fr; } }

    .card { padding: var(--space-5); }
    .card-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: var(--space-4);
    }
    .card-header h3 { font-size: var(--text-lg); margin: 0; }
    .muted { color: var(--text-muted); font-size: var(--text-xs); margin: 2px 0 0; }
    .link { font-size: var(--text-xs); color: var(--primary); font-weight: 500; }

    /* Status bars */
    .status-grid { display: flex; flex-direction: column; gap: var(--space-3); }
    .status-row {
      display: grid;
      grid-template-columns: 110px 1fr 32px;
      align-items: center;
      gap: var(--space-3);
    }
    .bar {
      height: 8px;
      background: var(--surface-2);
      border-radius: var(--radius-full);
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: var(--radius-full);
      transition: width var(--t-base);
    }
    .bar-fill[data-status="available"]   { background: var(--success); }
    .bar-fill[data-status="occupied"]    { background: var(--info); }
    .bar-fill[data-status="cleaning"]    { background: var(--accent); }
    .bar-fill[data-status="maintenance"] { background: var(--danger); }
    .bar-fill[data-status="reserved"]    { background: var(--warning); }
    .bar-fill[data-status="blocked"]     { background: var(--text-subtle); }
    .count { text-align: right; font-weight: 600; font-size: var(--text-sm); }

    /* Agenda */
    .agenda { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-1); }
    .agenda li {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background var(--t-fast);
    }
    .agenda li:hover { background: var(--surface-2); }
    .agenda-icon {
      width: 36px; height: 36px; border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .agenda-icon[data-tone="info"]    { background: var(--info-bg); color: var(--info); }
    .agenda-icon[data-tone="warning"] { background: var(--warning-bg); color: var(--warning); }
    .agenda-icon[data-tone="success"] { background: var(--success-bg); color: var(--success); }
    .agenda-icon[data-tone="danger"]  { background: var(--danger-bg); color: var(--danger); }
    .agenda-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .agenda-body { flex: 1; }
    .agenda-title { font-size: var(--text-sm); font-weight: 500; }
    .agenda-meta { font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }
    .agenda-chip { color: var(--text-subtle); }

    /* Table */
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td {
      padding: var(--space-3) var(--space-3);
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: var(--text-sm);
    }
    .table th {
      font-size: var(--text-xs);
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .table tr:last-child td { border-bottom: none; }
    .table .num { text-align: right; }
    .source {
      font-size: var(--text-xs);
      text-transform: capitalize;
      color: var(--text-muted);
    }

    .show-more-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-3) 0;
      border-top: 1px solid var(--border);
      margin-top: var(--space-2);
    }
    .show-more-count {
      margin-left: auto;
      font-size: var(--text-xs);
      color: var(--text-subtle);
    }

    /* ── Live bookings strip ─────────────────────────────────── */
    .live-strip {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-4);
      background: linear-gradient(90deg,
        rgba(74, 124, 89, 0.10),
        rgba(74, 124, 89, 0.04));
      border: 1px solid rgba(74, 124, 89, 0.25);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      animation: live-strip-in 320ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .live-strip-pulse {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
      color: var(--success);
    }
    .live-strip-pulse .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 0 0 rgba(74, 124, 89, 0.5);
      animation: live-pulse 1.8s ease-out infinite;
    }
    .live-strip-text { color: var(--text); font-weight: 500; }
    .live-strip-spacer { flex: 1; }
    .live-strip-dismiss {
      background: transparent; border: none;
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
    }
    .live-strip-dismiss:hover { background: rgba(0,0,0,0.05); color: var(--text); }
    .live-strip-dismiss mat-icon {
      font-size: 16px !important; width: 16px !important; height: 16px !important;
    }
    @keyframes live-pulse {
      0%   { box-shadow: 0 0 0 0   rgba(74, 124, 89, 0.55); }
      70%  { box-shadow: 0 0 0 8px rgba(74, 124, 89, 0);    }
      100% { box-shadow: 0 0 0 0   rgba(74, 124, 89, 0);    }
    }
    @keyframes live-strip-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .live-strip { animation: none; }
      .live-strip-pulse .dot { animation: none; }
    }
  `],
})
export class DashboardComponent implements OnDestroy {
  private ctx          = inject(PropertyContextService);
  private roomSvc      = inject(ROOM_SERVICE);
  private resSvc       = inject(RESERVATION_SERVICE);
  private guestSvc     = inject(GUEST_SERVICE);
  private housekeepingSvc = inject(HOUSEKEEPING_SERVICE);
  private maintenanceSvc  = inject(MAINTENANCE_SERVICE);
  private analyticsSvc    = inject(ANALYTICS_SERVICE);
  private broadcast       = inject(BookingBroadcastService);
  private toast           = inject(ToastService);

  loading      = signal(true);
  rooms        = signal<Room[]>([]);
  reservations = signal<Reservation[]>([]);
  guests       = signal<Guest[]>([]);
  hskTasks     = signal<HousekeepingTask[]>([]);
  maintenance  = signal<MaintenanceRequest[]>([]);
  snapshots    = signal<AnalyticsSnapshot[]>([]);

  /** Bookings received via the realtime channel since this session began. */
  liveBookings = signal<BookingCreatedEvent[]>([]);

  /** Held subscription so we can tear down cleanly on destroy. */
  private broadcastSub?: Subscription;

  /* ── Greeting ─────────────────────────────────────────────── */

  greeting = computed(() => {
    const hour  = new Date().getHours();
    const phase = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return `${phase} — ${this.ctx.active()?.name ?? 'Dashboard'}`;
  });

  subtitle = computed(() => {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    const prop = this.ctx.active();
    return prop ? `${today} · ${prop.city}, ${prop.country}` : today;
  });

  /* ── Property time settings ───────────────────────────────── */

  checkInTime  = computed(() => this.ctx.active()?.checkInTime  ?? '14:00');
  checkOutTime = computed(() => this.ctx.active()?.checkOutTime ?? '12:00');

  /* ── Data loading ─────────────────────────────────────────── */

  constructor() {
    effect(() => {
      const propId = this.ctx.activeId();
      if (!propId) return;

      this.loading.set(true);

      this.roomSvc.list(propId).subscribe(rooms => this.rooms.set(rooms));

      this.resSvc.list(propId).subscribe(res => {
        this.reservations.set(res);
        this.loading.set(false);
      });

      this.guestSvc.list().subscribe(guests => this.guests.set(guests));

      this.housekeepingSvc.listTasks(propId).subscribe(tasks => this.hskTasks.set(tasks));

      this.maintenanceSvc.list(propId).subscribe(items => this.maintenance.set(items));

      this.analyticsSvc.listSnapshots(propId).subscribe({
        next: snaps => this.snapshots.set(snaps),
        error: err   => console.error('analytics error:', err),
      });
    });

    /* Realtime: surface bookings made from the public site. Works
       same-tab (via the local subject) and across tabs (via BroadcastChannel). */
    this.broadcastSub = this.broadcast.events$().subscribe(evt => {
      if (evt.type !== 'booking.created') return;

      const propId = this.ctx.activeId();
      // Only react when the event is for the property currently being viewed.
      if (propId && evt.propertyId !== propId) return;

      this.liveBookings.update(list => [evt, ...list].slice(0, 50));

      // Pull the fresh reservation list so the new row shows in the table.
      if (propId) {
        this.resSvc.list(propId).subscribe(res => this.reservations.set(res));
      }

      this.toast.success(
        'New booking received',
        `${evt.confirmationNumber} · ${evt.guestName} · ${evt.roomTypeName}`,
      );
    });
  }

  ngOnDestroy(): void {
    this.broadcastSub?.unsubscribe();
  }

  dismissLive(): void {
    this.liveBookings.set([]);
  }

  /* ── KPI signals ──────────────────────────────────────────── */

  occupancyPct = computed(() => {
    const rooms = this.rooms();
    if (!rooms.length) return 0;
    const occupied = rooms.filter(r => r.status === RoomStatus.Occupied).length;
    return Math.round((occupied / rooms.length) * 100);
  });

  revenueToday = computed(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return this.reservations()
      .filter(r =>
        r.status === ReservationStatus.CheckedIn ||
        r.status === ReservationStatus.CheckedOut,
      )
      .filter(r => {
        const ci = new Date(r.checkIn);  ci.setHours(0, 0, 0, 0);
        const co = new Date(r.checkOut); co.setHours(0, 0, 0, 0);
        return ci.getTime() <= today.getTime() && co.getTime() > today.getTime();
      })
      .reduce((sum, r) => sum + (r.nights > 0 ? r.totalRoomCharge / r.nights : 0), 0);
  });

  adr = computed(() => {
    const res = this.reservations().filter(r => r.status === ReservationStatus.CheckedOut);
    if (!res.length) return 0;
    const totalNights = res.reduce((s, r) => s + r.nights, 0);
    const totalRev    = res.reduce((s, r) => s + r.totalRoomCharge, 0);
    return totalNights ? totalRev / totalNights : 0;
  });

  arrivalsToday = computed(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return this.reservations().filter(r => {
      if (r.status !== ReservationStatus.Confirmed && r.status !== ReservationStatus.CheckedIn) return false;
      const d = new Date(r.checkIn); d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;
  });

  departuresToday = computed(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return this.reservations().filter(r => {
      const d = new Date(r.checkOut); d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime() && r.status === ReservationStatus.CheckedIn;
    }).length;
  });

  inHouse = computed(() =>
    this.reservations().filter(r => r.status === ReservationStatus.CheckedIn).length,
  );

  cleaningCount = computed(() =>
    this.rooms().filter(r => r.status === RoomStatus.Cleaning).length,
  );

  /* ── KPI delta signals (derived from analyticsSnapshots) ─────── */

  /**
   * Returns the percentage-point change in occupancy rate
   * between today's snapshot and 7 days ago. Positive = improved.
   */
  occupancyDelta = computed(() => {
    const snaps = this.snapshots();
    if (snaps.length < 2) return 0;
    const today    = snaps[snaps.length - 1];
    const weekAgo  = snaps[snaps.length - 8] ?? snaps[0];
    if (!weekAgo) return 0;
    return Math.round(((today.occupancyRate - weekAgo.occupancyRate) * 100) * 10) / 10;
  });

  /**
   * Returns the percentage change in total revenue
   * between today's snapshot and yesterday's snapshot.
   */
  revenueDelta = computed(() => {
    const snaps = this.snapshots();
    if (snaps.length < 2) return 0;
    const today     = snaps[snaps.length - 1];
    const yesterday = snaps[snaps.length - 2];
    if (!yesterday.totalRevenue) return 0;
    const pct = ((today.totalRevenue - yesterday.totalRevenue) / yesterday.totalRevenue) * 100;
    return Math.round(pct * 10) / 10;
  });

  /**
   * Returns the percentage change in ADR comparing today's snapshot
   * against the MTD average (all prior snapshots this month).
   */
  adrDelta = computed(() => {
    const snaps = this.snapshots();
    if (snaps.length < 2) return 0;
    const today  = snaps[snaps.length - 1];
    const month  = today.date.slice(0, 7); // 'YYYY-MM'
    const mtd    = snaps.filter(s => s.date.startsWith(month) && s.date < today.date);
    if (!mtd.length) return 0;
    const avgAdr = mtd.reduce((sum, s) => sum + s.adr, 0) / mtd.length;
    if (!avgAdr) return 0;
    const pct = ((today.adr - avgAdr) / avgAdr) * 100;
    return Math.round(pct * 10) / 10;
  });

  /* ── Agenda computed signals ──────────────────────────────── */

  /** Number of VIP guests arriving today. */
  vipArrivalsToday = computed(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayResGuestIds = new Set(
      this.reservations()
        .filter(r => {
          if (r.status !== ReservationStatus.Confirmed && r.status !== ReservationStatus.CheckedIn) return false;
          const d = new Date(r.checkIn); d.setHours(0, 0, 0, 0);
          return d.getTime() === today.getTime();
        })
        .map(r => r.guestId),
    );
    return this.guests().filter(g => g.isVip && todayResGuestIds.has(g.id)).length;
  });

  /** Average duration (minutes) of housekeeping tasks completed today. */
  avgCleaningTime = computed(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const completed = this.hskTasks().filter(t => {
      if (!t.completedAt || !t.durationMinutes) return false;
      const d = new Date(t.completedAt); d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
    if (!completed.length) return 0;
    const total = completed.reduce((s, t) => s + (t.durationMinutes ?? 0), 0);
    return Math.round(total / completed.length);
  });

  /** Count of open or in-progress maintenance requests. */
  openMaintenanceCount = computed(() =>
    this.maintenance().filter(m =>
      m.status === MaintenanceStatus.Open ||
      m.status === MaintenanceStatus.Assigned ||
      m.status === MaintenanceStatus.InProgress,
    ).length,
  );

  /**
   * The most urgent open maintenance ticket — highest priority first,
   * then most recently reported. Returns a display-ready object or null.
   */
  topMaintenanceTicket = computed(() => {
    const priorityOrder: Record<string, number> = {
      [MaintenancePriority.Urgent]: 0,
      [MaintenancePriority.High]:   1,
      [MaintenancePriority.Medium]: 2,
      [MaintenancePriority.Low]:    3,
    };

    const open = this.maintenance()
      .filter(m =>
        m.status === MaintenanceStatus.Open ||
        m.status === MaintenanceStatus.Assigned ||
        m.status === MaintenanceStatus.InProgress,
      )
      .sort((a, b) => {
        const pd = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
        if (pd !== 0) return pd;
        return b.reportedAt.getTime() - a.reportedAt.getTime();
      });

    if (!open.length) return null;

    const top = open[0];
    const roomNum = top.roomId
      ? top.roomId.split('-r-')[1]   // e.g. 'prop-1-r-401' → '401'
      : top.location ?? null;

    return {
      title:         top.title,
      priorityLabel: top.priority.charAt(0).toUpperCase() + top.priority.slice(1),
      room:          roomNum ? `Room ${roomNum}` : null,
    };
  });

  /* ── Room status breakdown ────────────────────────────────── */

  roomStatusBreakdown = computed(() => {
    const rooms = this.rooms();
    const total = rooms.length || 1;
    const statuses: { status: RoomStatus; label: string }[] = [
      { status: RoomStatus.Available,   label: 'Available' },
      { status: RoomStatus.Occupied,    label: 'Occupied' },
      { status: RoomStatus.Reserved,    label: 'Reserved' },
      { status: RoomStatus.Cleaning,    label: 'Cleaning' },
      { status: RoomStatus.Maintenance, label: 'Maintenance' },
      { status: RoomStatus.Blocked,     label: 'Blocked' },
    ];
    return statuses.map(s => {
      const count = rooms.filter(r => r.status === s.status).length;
      return { ...s, count, pct: (count / total) * 100 };
    });
  });

  recentReservations = computed(() =>
    [...this.reservations()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, this.reservationLimit()),
  );

  reservationLimit = signal(8);

  showMoreReservations() {
    this.reservationLimit.update(n => n + 8);
  }

  showLessReservations() {
    this.reservationLimit.set(8);
  }

  /* ── Helpers ──────────────────────────────────────────────── */

  statusVariant(s: RoomStatus): any {
    return ({
      [RoomStatus.Available]:   'success',
      [RoomStatus.Occupied]:    'info',
      [RoomStatus.Reserved]:    'warning',
      [RoomStatus.Cleaning]:    'accent',
      [RoomStatus.Maintenance]: 'danger',
      [RoomStatus.Blocked]:     'neutral',
    } as Record<string, string>)[s];
  }

  resStatusVariant(s: ReservationStatus): any {
    return ({
      [ReservationStatus.Pending]:    'neutral',
      [ReservationStatus.Confirmed]:  'info',
      [ReservationStatus.CheckedIn]:  'success',
      [ReservationStatus.CheckedOut]: 'neutral',
      [ReservationStatus.Cancelled]:  'danger',
      [ReservationStatus.NoShow]:     'warning',
    } as Record<string, string>)[s];
  }

  statusLabel(s: ReservationStatus): string {
    return ({
      [ReservationStatus.Pending]:    'Pending',
      [ReservationStatus.Confirmed]:  'Confirmed',
      [ReservationStatus.CheckedIn]:  'Checked in',
      [ReservationStatus.CheckedOut]: 'Checked out',
      [ReservationStatus.Cancelled]:  'Cancelled',
      [ReservationStatus.NoShow]:     'No show',
    } as Record<string, string>)[s] ?? s;
  }
}
