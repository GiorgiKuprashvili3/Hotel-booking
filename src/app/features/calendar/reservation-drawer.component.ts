import {
  Component, input, output, inject, OnInit, OnChanges, SimpleChanges,
  signal, DestroyRef, computed
} from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { animate, style, transition, trigger } from '@angular/animations';

import { RESERVATION_SERVICE, GUEST_SERVICE } from '../../data/services/service-tokens';
import { Reservation, Room, RoomType, Guest, Folio, FolioItem, Payment } from '../../domain';
import { ReservationStatus } from '../../domain/enums';
import { STATUS_COLORS } from './calendar-grid.component';

type DrawerTab = 'details' | 'folio';

interface FolioGroup {
  date: Date;
  items: FolioItem[];
}

@Component({
  selector: 'app-reservation-drawer',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('220ms cubic-bezier(0.4,0,0.2,1)', style({ transform: 'translateX(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('180ms cubic-bezier(0.4,0,0.2,1)', style({ transform: 'translateX(100%)', opacity: 0 })),
      ]),
    ]),
  ],
  templateUrl: './reservation-drawer.component.html',
  styleUrl: './reservation-drawer.component.scss',
})
export class ReservationDrawerComponent implements OnInit, OnChanges {
  private resSvc     = inject(RESERVATION_SERVICE);
  private guestSvc   = inject(GUEST_SERVICE);
  private destroyRef = inject(DestroyRef);

  // Inputs
  reservation = input.required<Reservation>();
  rooms       = input.required<Room[]>();
  roomTypes   = input.required<RoomType[]>();

  // Outputs
  close        = output<void>();
  statusChange = output<{ id: string; status: ReservationStatus }>();

  // Status constants exposed to template
  readonly CheckedInStatus  = ReservationStatus.CheckedIn;
  readonly CheckedOutStatus = ReservationStatus.CheckedOut;
  readonly CancelledStatus  = ReservationStatus.Cancelled;

  // State
  activeTab    = signal<DrawerTab>('details');
  guest        = signal<Guest | null>(null);
  guestLoading = signal(false);
  folio        = signal<Folio | null>(null);
  folioLoading = signal(false);

  // ── Computed ─────────────────────────────────────
  statusColor = computed(() => STATUS_COLORS[this.reservation().status] ?? '#8A8A8A');

  currentRoom = computed(() =>
    this.rooms().find(r => r.id === this.reservation().roomId)
  );

  currentRoomType = computed(() =>
    this.roomTypes().find(t => t.id === this.reservation().roomTypeId)
  );

  initials = computed(() => {
    const g = this.guest();
    if (!g) return '?';
    return `${g.firstName[0] ?? ''}${g.lastName[0] ?? ''}`.toUpperCase();
  });

  canCheckIn = computed(() =>
    this.reservation().status === ReservationStatus.Confirmed ||
    this.reservation().status === ReservationStatus.Pending
  );
  canCheckOut = computed(() =>
    this.reservation().status === ReservationStatus.CheckedIn
  );
  canCancel = computed(() =>
    this.reservation().status !== ReservationStatus.Cancelled &&
    this.reservation().status !== ReservationStatus.CheckedOut
  );

  /** Folio charge items grouped by calendar date, sorted ascending */
  folioGroups = computed<FolioGroup[]>(() => {
    const f = this.folio();
    if (!f) return [];
    const map = new Map<number, FolioItem[]>();
    for (const item of f.items) {
      const key = new Date(item.date).setHours(0, 0, 0, 0);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([key, items]) => ({ date: new Date(key), items }));
  });

  folioTotalCharges = computed(() =>
    (this.folio()?.items ?? []).reduce((s, i) => s + i.amount, 0)
  );
  folioTotalPaid = computed(() =>
    (this.folio()?.payments ?? []).reduce((s, p) => s + p.amount, 0)
  );
  folioBalance = computed(() => this.folioTotalCharges() - this.folioTotalPaid());

  /** Badge count = number of folio line items; 0 hides the badge */
  folioBadge = computed(() => this.folio()?.items.length ?? 0);

  // ── Lifecycle ────────────────────────────────────
  ngOnInit(): void {
    this.loadGuest();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When a different reservation opens, reset tab + cached data
    if (changes['reservation'] && !changes['reservation'].firstChange) {
      this.activeTab.set('details');
      this.folio.set(null);
      this.guest.set(null);
      this.loadGuest();
    }
  }

  private loadGuest(): void {
    const guestId = this.reservation().guestId;
    if (!guestId) return;
    this.guestLoading.set(true);
    this.guestSvc.getById(guestId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(g => {
        this.guest.set(g ?? null);
        this.guestLoading.set(false);
      });
  }

  /** Lazy-loads folio on first Folio tab click */
  switchToFolio(): void {
    this.activeTab.set('folio');
    if (!this.folio() && !this.folioLoading()) {
      this.folioLoading.set(true);
      this.resSvc.getFolio(this.reservation().id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(f => {
          this.folio.set(f ?? null);
          this.folioLoading.set(false);
        });
    }
  }

  changeStatus(status: ReservationStatus): void {
    this.statusChange.emit({ id: this.reservation().id, status });
  }

  /** Stub — logs to console per Prompt 4D spec */
  postCharge(): void {
    console.log('[LuxStay] Post Charge stub — reservation:', this.reservation().confirmationNumber);
  }
}
