import { Component, computed, effect, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { KpiTileComponent } from '../../shared/components/kpi-tile/kpi-tile.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusChipComponent } from '../../shared/components/status-chip/status-chip.component';
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
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnDestroy {
  private ctx          = inject(PropertyContextService);
  private router       = inject(Router);
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

  /* ── Header actions ──────────────────────────────────────── */

  newReservation(): void {
    this.router.navigate(['/app/calendar']);
  }

  exportCsv(): void {
    const rows = this.reservations();
    if (!rows.length) return;

    const headers = [
      'Confirmation #', 'Guest ID', 'Room ID', 'Room Type ID', 'Status',
      'Source', 'Check-in', 'Check-out', 'Nights',
      'Adults', 'Children', 'Total Amount', 'Balance', 'Created At',
    ];

    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const toDate = (d: Date | string | undefined) =>
      d instanceof Date ? d.toISOString().slice(0, 10) : (d ?? '');

    const lines = [
      headers.join(','),
      ...rows.map(r => [
        r.confirmationNumber,
        r.guestId,
        r.roomId ?? '',
        r.roomTypeId,
        r.status,
        r.source,
        toDate(r.checkIn),
        toDate(r.checkOut),
        r.nights,
        r.adults,
        r.children,
        r.totalAmount,
        r.balance,
        toDate(r.createdAt),
      ].map(escape).join(',')),
    ];

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = `reservations-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}