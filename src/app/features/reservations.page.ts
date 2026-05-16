import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import {
  RESERVATION_SERVICE, ROOM_SERVICE, GUEST_SERVICE,
} from '../data/services/service-tokens';
import { PropertyContextService } from '../core/config/property-context.service';
import { Reservation, RoomType, Guest } from '../domain';
import { ReservationStatus, BookingSource } from '../domain/enums';

interface SavedView {
  id: string;
  name: string;
  filters: ReservationFilters;
}

interface ReservationFilters {
  statuses: ReservationStatus[];
  sources: BookingSource[];
  roomTypeIds: string[];
  fromDate?: string;        // ISO date input format yyyy-MM-dd
  toDate?: string;
  search: string;
}

const SAVED_VIEWS_KEY = 'luxstay.reservations.savedViews';

const STATUS_META: Record<ReservationStatus, { label: string; color: string; bg: string }> = {
  [ReservationStatus.Pending]:    { label: 'Pending',     color: 'var(--warning)', bg: 'var(--warning-bg)' },
  [ReservationStatus.Confirmed]:  { label: 'Confirmed',   color: 'var(--info)',    bg: 'var(--info-bg)' },
  [ReservationStatus.CheckedIn]:  { label: 'Checked-in',  color: 'var(--success)', bg: 'var(--success-bg)' },
  [ReservationStatus.CheckedOut]: { label: 'Checked-out', color: 'var(--text-muted)', bg: 'var(--surface-2)' },
  [ReservationStatus.Cancelled]:  { label: 'Cancelled',   color: 'var(--danger)',  bg: 'var(--danger-bg)' },
  [ReservationStatus.NoShow]:     { label: 'No-show',     color: 'var(--danger)',  bg: 'var(--danger-bg)' },
};

const SOURCE_LABELS: Record<string, string> = {
  [BookingSource.Direct]:          'Direct',
  [BookingSource.BookingCom]:      'Booking.com',
  [BookingSource.Airbnb]:          'Airbnb',
  [BookingSource.Expedia]:         'Expedia',
  [BookingSource.Walk_in]:         'Walk-in',
  [BookingSource.Phone]:           'Phone',
  [BookingSource.CorporateClient]: 'Corporate',
};

const DEFAULT_FILTERS: ReservationFilters = {
  statuses: [], sources: [], roomTypeIds: [], search: '',
};

@Component({
  selector: 'lux-reservations-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CurrencyPipe],
  template: `
<div class="res-page">

  <!-- Header -->
  <header class="res-header">
    <div>
      <h1 class="page-title">Reservations</h1>
      <p class="page-sub">
        {{ filtered().length }} of {{ reservations().length }}
        <span class="dot-sep">·</span>
        {{ propertyCtx.active()?.name }}
      </p>
    </div>
    <div class="header-actions">
      <button class="btn-primary" (click)="goToCalendar()">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        New reservation
      </button>
    </div>
  </header>

  <!-- Saved views bar -->
  <div class="views-bar">
    <button
      class="view-chip"
      [class.active]="!activeViewId()"
      (click)="loadView(null)">
      All
    </button>
    @for (v of savedViews(); track v.id) {
      <div class="view-chip-wrap">
        <button
          class="view-chip"
          [class.active]="activeViewId() === v.id"
          (click)="loadView(v.id)">
          {{ v.name }}
        </button>
        <button class="view-del" (click)="deleteView(v.id, $event)" title="Delete view">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    }
    <button class="view-chip view-chip--save" (click)="saveCurrentView()" [disabled]="!hasActiveFilters()">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      Save view
    </button>
  </div>

  <!-- Filters -->
  <div class="filters">

    <div class="filter-row">
      <div class="filter-group filter-group--grow">
        <label class="filter-lbl">Search</label>
        <input
          class="filter-input"
          type="search"
          placeholder="Confirmation #, guest name or email…"
          [ngModel]="filters().search"
          (ngModelChange)="updateFilter('search', $event)" />
      </div>

      <div class="filter-group">
        <label class="filter-lbl">From</label>
        <input
          class="filter-input"
          type="date"
          [ngModel]="filters().fromDate ?? ''"
          (ngModelChange)="updateFilter('fromDate', $event || undefined)" />
      </div>

      <div class="filter-group">
        <label class="filter-lbl">To</label>
        <input
          class="filter-input"
          type="date"
          [ngModel]="filters().toDate ?? ''"
          (ngModelChange)="updateFilter('toDate', $event || undefined)" />
      </div>
    </div>

    <div class="filter-row">
      <div class="filter-group filter-group--grow">
        <label class="filter-lbl">Status</label>
        <div class="chip-group">
          @for (s of allStatuses; track s) {
            <button
              class="filter-chip"
              [class.active]="filters().statuses.includes(s)"
              [style.--c]="meta(s).color"
              (click)="toggleStatus(s)">
              {{ meta(s).label }}
            </button>
          }
        </div>
      </div>
    </div>

    <div class="filter-row">
      <div class="filter-group filter-group--grow">
        <label class="filter-lbl">Source</label>
        <div class="chip-group">
          @for (src of allSources; track src) {
            <button
              class="filter-chip"
              [class.active]="filters().sources.includes(src)"
              (click)="toggleSource(src)">
              {{ srcLabel(src) }}
            </button>
          }
        </div>
      </div>
      <div class="filter-group">
        <label class="filter-lbl">&nbsp;</label>
        <button class="btn-clear" (click)="clearFilters()" [disabled]="!hasActiveFilters()">
          Clear filters
        </button>
      </div>
    </div>
  </div>

  <!-- Table -->
  <div class="table-wrap">
    @if (loading()) {
      <div class="loading">Loading reservations…</div>
    } @else if (!filtered().length) {
      <div class="empty">
        <p>No reservations match your filters.</p>
        @if (hasActiveFilters()) {
          <button class="btn-link" (click)="clearFilters()">Clear filters</button>
        }
      </div>
    } @else {
      <table class="res-table">
        <thead>
          <tr>
            <th>Confirmation</th>
            <th>Guest</th>
            <th>Room type</th>
            <th>Dates</th>
            <th class="num-col">Nights</th>
            <th>Status</th>
            <th>Source</th>
            <th class="num-col">Total</th>
            <th class="num-col">Balance</th>
          </tr>
        </thead>
        <tbody>
          @for (r of filtered(); track r.id) {
            <tr class="row" (click)="openDetail(r.id)">
              <td class="row-conf">{{ r.confirmationNumber }}</td>
              <td>
                <div class="guest-cell">
                  <span class="guest-name">{{ guestName(r.guestId) }}</span>
                  <span class="guest-email">{{ guestEmail(r.guestId) }}</span>
                </div>
              </td>
              <td>{{ typeName(r.roomTypeId) }}</td>
              <td class="dates-cell">
                <span>{{ r.checkIn | date:'MMM d' }}</span>
                <span class="arrow">→</span>
                <span>{{ r.checkOut | date:'MMM d, y' }}</span>
              </td>
              <td class="num-col">{{ r.nights }}</td>
              <td>
                <span class="status-pill"
                      [style.color]="meta(r.status).color"
                      [style.background]="meta(r.status).bg">
                  {{ meta(r.status).label }}
                </span>
              </td>
              <td class="src-cell">{{ srcLabel(r.source) }}</td>
              <td class="num-col">{{ r.totalAmount | currency:'GEL':'symbol-narrow':'1.0-0' }}</td>
              <td class="num-col">
                @if (r.balance > 0) {
                  <span class="balance">{{ r.balance | currency:'GEL':'symbol-narrow':'1.0-0' }}</span>
                } @else {
                  <span class="paid">Paid</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    }
  </div>
</div>

<!-- Save view modal -->
@if (showSaveModal()) {
  <div class="modal-backdrop" (click)="cancelSave()"></div>
  <div class="save-modal" role="dialog">
    <h3 class="save-title">Save current view</h3>
    <p class="save-sub">Give this filter combination a name. It will be saved to this browser.</p>
    <input
      class="save-input"
      type="text"
      placeholder="e.g. 'Arrivals this week'"
      [ngModel]="newViewName()"
      (ngModelChange)="newViewName.set($event)"
      autofocus
      (keyup.enter)="confirmSave()" />
    <div class="save-actions">
      <button class="btn-secondary" (click)="cancelSave()">Cancel</button>
      <button class="btn-primary" (click)="confirmSave()" [disabled]="!newViewName().trim()">Save</button>
    </div>
  </div>
}
  `,
  styles: [`
    .res-page { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); }
    .res-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--space-4); flex-wrap: wrap;
    }
    .page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--text); margin: 0; }
    .page-sub { font-size: var(--text-sm); color: var(--text-muted); margin: 4px 0 0; }
    .dot-sep { margin: 0 4px; }
    .header-actions { display: flex; gap: var(--space-2); }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      height: 36px; padding: 0 var(--space-4);
      background: var(--primary); color: var(--on-primary);
      border: none; border-radius: var(--radius-md);
      font-size: var(--text-sm); font-weight: 600; cursor: pointer;
      transition: filter var(--t-fast);
    }
    .btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      height: 36px; padding: 0 var(--space-4);
      background: transparent; color: var(--text-muted);
      border: 1px solid var(--border); border-radius: var(--radius-md);
      font-size: var(--text-sm); font-weight: 500; cursor: pointer;
      transition: all var(--t-fast);
    }
    .btn-secondary:hover { color: var(--text); border-color: var(--border-strong); }

    /* Saved views */
    .views-bar {
      display: flex; align-items: center; gap: var(--space-2);
      flex-wrap: wrap;
      padding: var(--space-3) var(--space-4);
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    .view-chip {
      height: 28px; padding: 0 var(--space-3);
      background: transparent; border: 1px solid transparent;
      border-radius: var(--radius-full); cursor: pointer;
      font-size: var(--text-xs); font-weight: 600; color: var(--text-muted);
      transition: all var(--t-fast);
    }
    .view-chip:hover { color: var(--text); background: var(--surface-2); }
    .view-chip.active {
      background: var(--primary); color: var(--on-primary); border-color: var(--primary);
    }
    .view-chip-wrap {
      display: flex; align-items: center;
      background: var(--surface-2); border-radius: var(--radius-full);
    }
    .view-chip-wrap .view-chip { background: transparent; }
    .view-chip-wrap .view-chip.active { background: var(--primary); }
    .view-del {
      width: 18px; height: 18px; margin-right: 4px;
      border: none; background: transparent; cursor: pointer;
      color: var(--text-subtle); border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      transition: all var(--t-fast);
    }
    .view-del:hover { background: var(--danger-bg); color: var(--danger); }
    .view-chip--save {
      display: inline-flex; align-items: center; gap: 4px;
      margin-left: auto; border: 1px dashed var(--border-strong);
      color: var(--text-muted);
    }
    .view-chip--save:hover:not(:disabled) {
      color: var(--primary); border-color: var(--primary);
      background: color-mix(in srgb, var(--primary) 6%, transparent);
    }
    .view-chip--save:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Filters */
    .filters {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      display: flex; flex-direction: column; gap: var(--space-3);
    }
    .filter-row { display: flex; gap: var(--space-3); flex-wrap: wrap; align-items: flex-end; }
    .filter-group { display: flex; flex-direction: column; gap: 4px; }
    .filter-group--grow { flex: 1; min-width: 240px; }
    .filter-lbl {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-subtle);
    }
    .filter-input {
      height: 36px; padding: 0 var(--space-3);
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface); color: var(--text);
      font-size: var(--text-sm); font-family: inherit; outline: none;
      min-width: 140px;
    }
    .filter-input:focus { border-color: var(--primary); }
    .chip-group { display: flex; gap: 6px; flex-wrap: wrap; }
    .filter-chip {
      height: 28px; padding: 0 var(--space-3);
      border: 1px solid var(--border); background: var(--surface);
      border-radius: var(--radius-full); cursor: pointer;
      font-size: var(--text-xs); font-weight: 600; color: var(--text-muted);
      transition: all var(--t-fast);
    }
    .filter-chip:hover { color: var(--text); border-color: var(--border-strong); }
    .filter-chip.active {
      background: var(--c, var(--primary)); color: var(--on-primary); border-color: var(--c, var(--primary));
    }
    .btn-clear {
      height: 36px; padding: 0 var(--space-3);
      background: transparent; border: 1px solid var(--border);
      border-radius: var(--radius-md); cursor: pointer;
      font-size: var(--text-sm); color: var(--text-muted);
      transition: all var(--t-fast);
    }
    .btn-clear:hover:not(:disabled) { color: var(--danger); border-color: var(--danger); }
    .btn-clear:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Table */
    .table-wrap {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-md); overflow: hidden;
    }
    .loading, .empty {
      padding: var(--space-12); text-align: center; color: var(--text-muted);
    }
    .empty p { margin: 0 0 var(--space-2); }
    .btn-link {
      background: none; border: none; cursor: pointer;
      color: var(--primary); font-size: var(--text-sm); font-weight: 600;
      text-decoration: underline;
    }
    .res-table { width: 100%; border-collapse: collapse; }
    .res-table th {
      text-align: left; padding: var(--space-3) var(--space-4);
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-subtle);
      background: var(--surface-2); border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .res-table td {
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--border);
      font-size: var(--text-sm); color: var(--text); vertical-align: middle;
    }
    .num-col { text-align: right; }
    .row { cursor: pointer; transition: background var(--t-fast); }
    .row:hover { background: var(--surface-2); }
    .row-conf { font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); }
    .guest-cell { display: flex; flex-direction: column; gap: 1px; }
    .guest-name { font-weight: 600; color: var(--text); }
    .guest-email { font-size: var(--text-xs); color: var(--text-muted); }
    .dates-cell { display: flex; align-items: center; gap: 6px; color: var(--text-muted); white-space: nowrap; }
    .arrow { color: var(--text-subtle); }
    .src-cell { color: var(--text-muted); font-size: var(--text-xs); }
    .status-pill {
      display: inline-block; padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .balance { color: var(--danger); font-weight: 600; }
    .paid { color: var(--success); font-weight: 600; font-size: var(--text-xs); }

    /* Save view modal */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(11,31,58,0.3);
      backdrop-filter: blur(2px); z-index: 300;
    }
    .save-modal {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 301;
      width: min(420px, calc(100vw - 32px));
      background: var(--surface); border-radius: var(--radius-lg);
      padding: var(--space-5); box-shadow: var(--shadow-3);
    }
    .save-title { font-size: var(--text-lg); font-weight: 700; margin: 0 0 4px; color: var(--text); }
    .save-sub { font-size: var(--text-sm); color: var(--text-muted); margin: 0 0 var(--space-4); }
    .save-input {
      width: 100%; box-sizing: border-box;
      height: 40px; padding: 0 var(--space-3);
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface); color: var(--text);
      font-size: var(--text-sm); outline: none;
      margin-bottom: var(--space-4);
    }
    .save-input:focus { border-color: var(--primary); }
    .save-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
  `],
})
export class ReservationsPageComponent implements OnInit {
  protected propertyCtx = inject(PropertyContextService);
  private resSvc      = inject(RESERVATION_SERVICE);
  private roomSvc     = inject(ROOM_SERVICE);
  private guestSvc    = inject(GUEST_SERVICE);
  private router      = inject(Router);
  private destroyRef  = inject(DestroyRef);

  readonly allStatuses: ReservationStatus[] = [
    ReservationStatus.Pending, ReservationStatus.Confirmed,
    ReservationStatus.CheckedIn, ReservationStatus.CheckedOut,
    ReservationStatus.Cancelled, ReservationStatus.NoShow,
  ];
  readonly allSources: BookingSource[] = [
    BookingSource.Direct, BookingSource.BookingCom, BookingSource.Airbnb,
    BookingSource.Expedia, BookingSource.Walk_in, BookingSource.Phone,
    BookingSource.CorporateClient,
  ];

  loading       = signal(true);
  reservations  = signal<Reservation[]>([]);
  roomTypes     = signal<RoomType[]>([]);
  guests        = signal<Guest[]>([]);

  filters       = signal<ReservationFilters>({ ...DEFAULT_FILTERS });
  savedViews    = signal<SavedView[]>(this.loadViewsFromStorage());
  activeViewId  = signal<string | null>(null);
  showSaveModal = signal(false);
  newViewName   = signal('');

  filtered = computed<Reservation[]>(() => {
    const f = this.filters();
    const q = f.search.trim().toLowerCase();
    const fromTs = f.fromDate ? new Date(f.fromDate).getTime() : null;
    const toTs   = f.toDate   ? new Date(f.toDate).getTime() + 86_400_000 : null;
    return this.reservations()
      .filter(r => {
        if (f.statuses.length    && !f.statuses.includes(r.status)) return false;
        if (f.sources.length     && !f.sources.includes(r.source as BookingSource)) return false;
        if (f.roomTypeIds.length && !f.roomTypeIds.includes(r.roomTypeId)) return false;
        if (fromTs !== null && r.checkOut.getTime() < fromTs) return false;
        if (toTs   !== null && r.checkIn.getTime()  >= toTs)  return false;
        if (q) {
          if (r.confirmationNumber.toLowerCase().includes(q)) return true;
          const g = this.guests().find(x => x.id === r.guestId);
          if (g && (
            g.firstName.toLowerCase().includes(q) ||
            g.lastName.toLowerCase().includes(q)  ||
            g.email.toLowerCase().includes(q)
          )) return true;
          return false;
        }
        return true;
      })
      .sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime());
  });

  hasActiveFilters = computed(() => {
    const f = this.filters();
    return f.statuses.length > 0 || f.sources.length > 0 ||
           f.roomTypeIds.length > 0 || !!f.fromDate || !!f.toDate ||
           f.search.trim().length > 0;
  });

  ngOnInit(): void {
    this.load();
    this.propertyCtx.active$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  private load(): void {
    const prop = this.propertyCtx.active();
    if (!prop) return;
    this.loading.set(true);
    forkJoin({
      res: this.resSvc.list(prop.id),
      types: this.roomSvc.listTypes(prop.id),
      guests: this.guestSvc.list(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ res, types, guests }) => {
      this.reservations.set(res);
      this.roomTypes.set(types);
      this.guests.set(guests);
      this.loading.set(false);
    });
  }

  meta(s: ReservationStatus) { return STATUS_META[s]; }
  srcLabel(s: string): string { return SOURCE_LABELS[s] ?? s; }
  typeName(id: string): string { return this.roomTypes().find(t => t.id === id)?.name ?? '—'; }
  guestName(id: string): string {
    const g = this.guests().find(x => x.id === id);
    return g ? `${g.firstName} ${g.lastName}` : '—';
  }
  guestEmail(id: string): string {
    return this.guests().find(x => x.id === id)?.email ?? '';
  }

  openDetail(id: string): void {
    this.router.navigate(['/app/reservations', id]);
  }
  goToCalendar(): void {
    this.router.navigate(['/app/calendar']);
  }

  /* ---------- Filter mutations ---------- */
  updateFilter<K extends keyof ReservationFilters>(key: K, value: ReservationFilters[K]): void {
    this.filters.update(f => ({ ...f, [key]: value }));
    this.activeViewId.set(null); // any change drops the saved-view selection
  }
  toggleStatus(s: ReservationStatus): void {
    this.filters.update(f => {
      const set = new Set(f.statuses);
      if (set.has(s)) set.delete(s); else set.add(s);
      return { ...f, statuses: [...set] };
    });
    this.activeViewId.set(null);
  }
  toggleSource(src: BookingSource): void {
    this.filters.update(f => {
      const set = new Set(f.sources);
      if (set.has(src)) set.delete(src); else set.add(src);
      return { ...f, sources: [...set] };
    });
    this.activeViewId.set(null);
  }
  clearFilters(): void {
    this.filters.set({ ...DEFAULT_FILTERS });
    this.activeViewId.set(null);
  }

  /* ---------- Saved views ---------- */
  private loadViewsFromStorage(): SavedView[] {
    try {
      const raw = localStorage.getItem(SAVED_VIEWS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  private persistViews(views: SavedView[]): void {
    try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views)); } catch {}
  }

  loadView(id: string | null): void {
    if (id === null) {
      this.filters.set({ ...DEFAULT_FILTERS });
      this.activeViewId.set(null);
      return;
    }
    const v = this.savedViews().find(x => x.id === id);
    if (!v) return;
    this.filters.set({ ...DEFAULT_FILTERS, ...v.filters });
    this.activeViewId.set(id);
  }

  saveCurrentView(): void {
    this.newViewName.set('');
    this.showSaveModal.set(true);
  }
  cancelSave(): void {
    this.showSaveModal.set(false);
  }
  confirmSave(): void {
    const name = this.newViewName().trim();
    if (!name) return;
    const view: SavedView = {
      id: `view-${Date.now()}`,
      name,
      filters: { ...this.filters() },
    };
    this.savedViews.update(list => {
      const next = [...list, view];
      this.persistViews(next);
      return next;
    });
    this.activeViewId.set(view.id);
    this.showSaveModal.set(false);
  }
  deleteView(id: string, ev: Event): void {
    ev.stopPropagation();
    this.savedViews.update(list => {
      const next = list.filter(v => v.id !== id);
      this.persistViews(next);
      return next;
    });
    if (this.activeViewId() === id) this.activeViewId.set(null);
  }
}
