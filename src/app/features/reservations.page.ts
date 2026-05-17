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
  templateUrl: './reservations.page.html',
  styleUrl: './reservations.page.scss',
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
