import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { KpiTileComponent } from '../../shared/components/kpi-tile.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { PropertyContextService } from '../../core/config/property-context.service';
import { RESERVATION_SERVICE, ROOM_SERVICE } from '../../data/services/service-tokens';
import {
  Reservation, Room, ReservationStatus, RoomStatus,
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

    <div class="kpi-grid">
      <lux-kpi-tile
        label="Occupancy"
        icon="meeting_room"
        [value]="occupancyPct()"
        suffix="%"
        [delta]="3.2"
        deltaLabel="vs last week"
        [loading]="loading()" />
      <lux-kpi-tile
        label="Revenue (today)"
        icon="payments"
        prefix="₾"
        [value]="(revenueToday() | number:'1.0-0') ?? '0'"
        [delta]="-1.8"
        deltaLabel="vs yesterday"
        [loading]="loading()" />
      <lux-kpi-tile
        label="ADR"
        icon="trending_up"
        prefix="₾"
        [value]="(adr() | number:'1.0-0') ?? '0'"
        [delta]="5.4"
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
              <div class="agenda-meta">First check-in 14:00 · 3 VIP guests</div>
            </div>
            <span class="agenda-chip">→</span>
          </li>
          <li>
            <div class="agenda-icon" data-tone="warning"><mat-icon>flight_takeoff</mat-icon></div>
            <div class="agenda-body">
              <div class="agenda-title">{{ departuresToday() }} departures</div>
              <div class="agenda-meta">12 rooms to flip by 15:00</div>
            </div>
            <span class="agenda-chip">→</span>
          </li>
          <li>
            <div class="agenda-icon" data-tone="success"><mat-icon>cleaning_services</mat-icon></div>
            <div class="agenda-body">
              <div class="agenda-title">{{ cleaningCount() }} rooms in housekeeping</div>
              <div class="agenda-meta">Avg cleaning time today: 28 min</div>
            </div>
            <span class="agenda-chip">→</span>
          </li>
          <li>
            <div class="agenda-icon" data-tone="danger"><mat-icon>build</mat-icon></div>
            <div class="agenda-body">
              <div class="agenda-title">3 open maintenance tickets</div>
              <div class="agenda-meta">1 high priority — AC unit, Room 401</div>
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
          <p class="muted">Last 8 bookings across all sources</p>
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
  `],
})
export class DashboardComponent {
  private ctx = inject(PropertyContextService);
  private roomSvc = inject(ROOM_SERVICE);
  private resSvc  = inject(RESERVATION_SERVICE);

  loading = signal(true);
  rooms = signal<Room[]>([]);
  reservations = signal<Reservation[]>([]);

  greeting = computed(() => {
    const hour = new Date().getHours();
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

  constructor() {
    effect(() => {
      const propId = this.ctx.activeId();
      if (!propId) return;
      this.loading.set(true);
      this.roomSvc.list(propId).subscribe(rooms => {
        this.rooms.set(rooms);
      });
      this.resSvc.list(propId).subscribe(res => {
        this.reservations.set(res);
        this.loading.set(false);
      });
    });
  }

  occupancyPct = computed(() => {
    const rooms = this.rooms();
    if (!rooms.length) return 0;
    const occupied = rooms.filter(r => r.status === RoomStatus.Occupied).length;
    return Math.round((occupied / rooms.length) * 100);
  });

  revenueToday = computed(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    // Revenue today = per-night rate of all active in-house guests + today's checkouts
    return this.reservations()
      .filter(r => r.status === ReservationStatus.CheckedIn || r.status === ReservationStatus.CheckedOut)
      .filter(r => {
        // Include if the guest is currently in-house (checked in before/on today, checks out after today)
        const ci = new Date(r.checkIn);  ci.setHours(0,0,0,0);
        const co = new Date(r.checkOut); co.setHours(0,0,0,0);
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
    const today = new Date(); today.setHours(0,0,0,0);
    return this.reservations().filter(r => {
      if (r.status !== ReservationStatus.Confirmed && r.status !== ReservationStatus.CheckedIn) return false;
      const d = new Date(r.checkIn); d.setHours(0,0,0,0);
      return d.getTime() === today.getTime();
    }).length;
  });

  departuresToday = computed(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return this.reservations().filter(r => {
      const d = new Date(r.checkOut); d.setHours(0,0,0,0);
      return d.getTime() === today.getTime() && r.status === ReservationStatus.CheckedIn;
    }).length;
  });

  inHouse = computed(() =>
    this.reservations().filter(r => r.status === ReservationStatus.CheckedIn).length,
  );

  cleaningCount = computed(() =>
    this.rooms().filter(r => r.status === RoomStatus.Cleaning).length,
  );

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
      .slice(0, 8),
  );

  statusVariant(s: RoomStatus): any {
    return {
      [RoomStatus.Available]:  'success',
      [RoomStatus.Occupied]:   'info',
      [RoomStatus.Reserved]:   'warning',
      [RoomStatus.Cleaning]:   'accent',
      [RoomStatus.Maintenance]:'danger',
      [RoomStatus.Blocked]:    'neutral',
    }[s];
  }

  resStatusVariant(s: ReservationStatus): any {
    return {
      [ReservationStatus.Pending]:    'neutral',
      [ReservationStatus.Confirmed]:  'info',
      [ReservationStatus.CheckedIn]:  'success',
      [ReservationStatus.CheckedOut]: 'neutral',
      [ReservationStatus.Cancelled]:  'danger',
      [ReservationStatus.NoShow]:     'warning',
    }[s];
  }

  statusLabel(s: ReservationStatus): string {
    return ({
      [ReservationStatus.Pending]: 'Pending',
      [ReservationStatus.Confirmed]: 'Confirmed',
      [ReservationStatus.CheckedIn]: 'Checked in',
      [ReservationStatus.CheckedOut]: 'Checked out',
      [ReservationStatus.Cancelled]: 'Cancelled',
      [ReservationStatus.NoShow]: 'No show',
    } as Record<string, string>)[s] ?? s;
  }
}
