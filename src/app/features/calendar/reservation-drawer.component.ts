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
  template: `
<!-- Backdrop -->
<div class="drawer-backdrop" (click)="close.emit()"></div>

<!-- Drawer panel -->
<aside class="drawer" [@slideIn]>

  <!-- Header -->
  <div class="drawer-header">
    <div class="drawer-header__top">
      <span class="confirmation-num">{{ reservation().confirmationNumber }}</span>
      <button class="btn-close" (click)="close.emit()" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- Status badge -->
    <div class="status-row">
      <span class="status-badge" [style.background]="statusColor()">
        {{ reservation().status | titlecase }}
      </span>
      <span class="nights-badge">{{ reservation().nights }} night{{ reservation().nights !== 1 ? 's' : '' }}</span>
    </div>

    <!-- Dates -->
    <div class="date-strip">
      <div class="date-block">
        <span class="date-label">Check-in</span>
        <span class="date-val">{{ reservation().checkIn | date:'EEE, MMM d' }}</span>
      </div>
      <div class="date-arrow">→</div>
      <div class="date-block">
        <span class="date-label">Check-out</span>
        <span class="date-val">{{ reservation().checkOut | date:'EEE, MMM d' }}</span>
      </div>
    </div>
  </div>

  <!-- Tab bar -->
  <div class="tab-bar">
    <button
      class="tab-btn"
      [class.active]="activeTab() === 'details'"
      (click)="activeTab.set('details')">
      Details
    </button>
    <button
      class="tab-btn"
      [class.active]="activeTab() === 'folio'"
      (click)="switchToFolio()">
      Folio
      @if (folioBadge() > 0) {
        <span class="tab-badge">{{ folioBadge() }}</span>
      }
    </button>
  </div>

  <!-- ── DETAILS TAB ─────────────────────────────── -->
  @if (activeTab() === 'details') {
    <div class="drawer-body">

      <!-- Guest section -->
      <section class="drawer-section">
        <h3 class="section-title">Guest</h3>
        @if (guest()) {
          <div class="guest-card">
            <div class="guest-avatar">{{ initials() }}</div>
            <div class="guest-info">
              <span class="guest-name">{{ guest()!.firstName }} {{ guest()!.lastName }}</span>
              <span class="guest-email">{{ guest()!.email }}</span>
              <span class="guest-phone">{{ guest()!.phone }}</span>
            </div>
            @if (guest()!.loyaltyTier) {
              <span class="loyalty-badge loyalty-badge--{{ guest()!.loyaltyTier }}">
                {{ guest()!.loyaltyTier | titlecase }}
              </span>
            }
          </div>
        } @else if (guestLoading()) {
          <div class="skeleton-row"></div>
        } @else {
          <p class="text-muted">Guest data unavailable</p>
        }
      </section>

      <!-- Room section -->
      <section class="drawer-section">
        <h3 class="section-title">Room</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Room</span>
            <span class="info-val">{{ currentRoom()?.number ?? 'Unassigned' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Type</span>
            <span class="info-val">{{ currentRoomType()?.name ?? '—' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Guests</span>
            <span class="info-val">{{ reservation().adults }} adults{{ reservation().children ? ', ' + reservation().children + ' child' : '' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Source</span>
            <span class="info-val">{{ reservation().source }}</span>
          </div>
        </div>
      </section>

      <!-- Financials -->
      <section class="drawer-section">
        <h3 class="section-title">Charges</h3>
        <div class="folio-lines">
          <div class="folio-line">
            <span>Room charge</span>
            <span>{{ reservation().totalRoomCharge | currency }}</span>
          </div>
          <div class="folio-line">
            <span>Tax</span>
            <span>{{ reservation().totalTax | currency }}</span>
          </div>
          @if (reservation().totalExtras > 0) {
            <div class="folio-line">
              <span>Extras</span>
              <span>{{ reservation().totalExtras | currency }}</span>
            </div>
          }
          <div class="folio-line folio-line--total">
            <span>Total</span>
            <span>{{ reservation().totalAmount | currency }}</span>
          </div>
          <div class="folio-line folio-line--paid">
            <span>Paid</span>
            <span>{{ reservation().totalPaid | currency }}</span>
          </div>
          @if (reservation().balance > 0) {
            <div class="folio-line folio-line--balance">
              <span>Balance due</span>
              <span>{{ reservation().balance | currency }}</span>
            </div>
          }
        </div>
      </section>

      <!-- Special requests -->
      @if (reservation().specialRequests) {
        <section class="drawer-section">
          <h3 class="section-title">Special Requests</h3>
          <p class="notes-text">{{ reservation().specialRequests }}</p>
        </section>
      }

      <!-- Internal notes -->
      @if (reservation().internalNotes) {
        <section class="drawer-section">
          <h3 class="section-title">Internal Notes</h3>
          <p class="notes-text notes-text--internal">{{ reservation().internalNotes }}</p>
        </section>
      }

      <!-- Cancellation info -->
      @if (reservation().cancelledAt) {
        <section class="drawer-section">
          <h3 class="section-title">Cancellation</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Cancelled</span>
              <span class="info-val">{{ reservation().cancelledAt | date:'MMM d, y' }}</span>
            </div>
            @if (reservation().cancellationReason) {
              <div class="info-item">
                <span class="info-label">Reason</span>
                <span class="info-val">{{ reservation().cancellationReason }}</span>
              </div>
            }
          </div>
        </section>
      }

    </div>
  }

  <!-- ── FOLIO TAB ────────────────────────────────── -->
  @if (activeTab() === 'folio') {
    <div class="drawer-body">

      @if (folioLoading()) {
        <div class="folio-skeleton">
          <div class="skeleton-row"></div>
          <div class="skeleton-row skeleton-row--sm"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row skeleton-row--sm"></div>
        </div>
      } @else if (folio()) {

        <!-- Charges grouped by date -->
        <section class="drawer-section">
          <h3 class="section-title">Charges</h3>

          @for (group of folioGroups(); track group.date.getTime()) {
            <div class="folio-group">
              <div class="folio-group__date">{{ group.date | date:'EEE, MMM d' }}</div>
              @for (item of group.items; track item.id) {
                <div class="folio-item-row">
                  <div class="folio-item-row__left">
                    <span class="folio-item-desc">{{ item.description }}</span>
                    @if (item.quantity > 1) {
                      <span class="folio-item-qty">× {{ item.quantity }}</span>
                    }
                  </div>
                  <span class="folio-item-amount">{{ item.amount | currency }}</span>
                </div>
              }
            </div>
          }
        </section>

        <!-- Payments section -->
        @if (folio()!.payments.length > 0) {
          <section class="drawer-section">
            <h3 class="section-title">Payments</h3>
            @for (pay of folio()!.payments; track pay.id) {
              <div class="payment-row">
                <div class="payment-row__left">
                  <span class="payment-method">{{ pay.method | titlecase }}</span>
                  @if (pay.reference) {
                    <span class="payment-ref">{{ pay.reference }}</span>
                  }
                  <span class="payment-date">{{ pay.date | date:'MMM d, y' }}</span>
                </div>
                <span class="payment-amount">{{ pay.amount | currency }}</span>
              </div>
            }
          </section>
        }

        <!-- Running balance summary -->
        <section class="drawer-section">
          <h3 class="section-title">Summary</h3>
          <div class="folio-lines">
            <div class="folio-line">
              <span>Total charges</span>
              <span>{{ folioTotalCharges() | currency }}</span>
            </div>
            <div class="folio-line folio-line--paid">
              <span>Total paid</span>
              <span>{{ folioTotalPaid() | currency }}</span>
            </div>
            <div class="folio-line"
              [class.folio-line--balance]="folioBalance() > 0"
              [class.folio-line--credit]="folioBalance() < 0">
              <span>{{ folioBalance() >= 0 ? 'Balance due' : 'Credit' }}</span>
              <span>{{ (folioBalance() < 0 ? -folioBalance() : folioBalance()) | currency }}</span>
            </div>
          </div>
        </section>

        <!-- Post Charge (stub) -->
        <div class="folio-actions">
          <button class="btn-post-charge" (click)="postCharge()">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            Post Charge
          </button>
        </div>

      } @else {
        <div class="folio-empty">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="8" y="4" width="24" height="32" rx="3" stroke="var(--border-strong)" stroke-width="1.5"/>
            <path d="M14 13h12M14 19h12M14 25h8" stroke="var(--border-strong)" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <p>No folio available</p>
        </div>
      }

    </div>
  }

  <!-- Actions footer -->
  <div class="drawer-footer">
    @if (canCheckIn()) {
      <button class="btn-action btn-action--primary"
              (click)="changeStatus(CheckedInStatus)">
        Check In
      </button>
    }
    @if (canCheckOut()) {
      <button class="btn-action btn-action--primary"
              (click)="changeStatus(CheckedOutStatus)">
        Check Out
      </button>
    }
    @if (canCancel()) {
      <button class="btn-action btn-action--danger"
              (click)="changeStatus(CancelledStatus)">
        Cancel
      </button>
    }
  </div>

</aside>
  `,
  styles: [`
    .drawer-backdrop {
      position: fixed; inset: 0;
      background: rgba(11, 31, 58, 0.25);
      backdrop-filter: blur(2px);
      z-index: calc(var(--z-overlay) - 1);
    }

    .drawer {
      position: fixed;
      top: 0; right: 0; bottom: 0;
      width: 400px;
      background: var(--surface);
      box-shadow: var(--shadow-3);
      z-index: var(--z-overlay);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Header ── */
    .drawer-header {
      padding: var(--space-5) var(--space-6) var(--space-4);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .drawer-header__top {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: var(--space-3);
    }
    .confirmation-num {
      font-family: var(--font-mono);
      font-size: var(--text-sm); font-weight: 600;
      color: var(--text-muted); letter-spacing: 0.04em;
    }
    .btn-close {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border: none; background: var(--surface-2);
      border-radius: var(--radius-full); cursor: pointer;
      color: var(--text-muted);
      transition: background var(--t-fast), color var(--t-fast);
      &:hover { background: var(--danger-bg); color: var(--danger); }
    }
    .status-row { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); }
    .status-badge {
      display: inline-flex; align-items: center;
      height: 24px; padding: 0 var(--space-3);
      border-radius: var(--radius-full);
      font-size: var(--text-xs); font-weight: 600; color: #fff; letter-spacing: 0.02em;
    }
    .nights-badge {
      font-size: var(--text-xs); color: var(--text-subtle);
      background: var(--surface-2); padding: 3px var(--space-3);
      border-radius: var(--radius-full);
    }
    .date-strip { display: flex; align-items: center; gap: var(--space-3); }
    .date-block { display: flex; flex-direction: column; gap: 2px; }
    .date-label {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--text-subtle); font-weight: 600;
    }
    .date-val { font-size: var(--text-md); font-weight: 600; color: var(--text); }
    .date-arrow { color: var(--text-subtle); font-size: var(--text-lg); margin-top: 12px; }

    /* ── Tab bar ── */
    .tab-bar {
      display: flex; gap: var(--space-1);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      padding: 0 var(--space-6);
    }
    .tab-btn {
      display: flex; align-items: center; gap: var(--space-2);
      height: 40px; padding: 0 var(--space-3);
      border: none; background: none; cursor: pointer;
      font-size: var(--text-sm); font-weight: 500;
      color: var(--text-muted);
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color var(--t-fast), border-color var(--t-fast);
      &.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
      &:not(.active):hover { color: var(--text); }
    }
    .tab-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 18px; height: 18px; padding: 0 4px;
      background: var(--primary); color: var(--on-primary);
      border-radius: var(--radius-full); font-size: 10px; font-weight: 700;
    }

    /* ── Body ── */
    .drawer-body {
      flex: 1; overflow-y: auto;
      padding: var(--space-4) var(--space-6);
      display: flex; flex-direction: column; gap: var(--space-2);
    }
    .drawer-section {
      padding: var(--space-4) 0;
      border-bottom: 1px solid var(--border);
      &:last-child { border-bottom: none; }
    }
    .section-title {
      font-size: var(--text-xs); font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--text-subtle); margin: 0 0 var(--space-3);
    }

    /* Guest card */
    .guest-card { display: flex; align-items: center; gap: var(--space-3); }
    .guest-avatar {
      width: 40px; height: 40px; border-radius: var(--radius-full);
      background: var(--primary); color: var(--on-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: var(--text-sm); font-weight: 700; flex-shrink: 0;
    }
    .guest-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .guest-name { font-size: var(--text-base); font-weight: 600; color: var(--text); }
    .guest-email, .guest-phone { font-size: var(--text-xs); color: var(--text-muted); }
    .loyalty-badge {
      font-size: 10px; font-weight: 700; padding: 2px var(--space-2);
      border-radius: var(--radius-sm); text-transform: uppercase; letter-spacing: 0.06em;
    }
    .loyalty-badge--gold    { background: var(--gold-100); color: var(--gold-700); }
    .loyalty-badge--silver  { background: var(--ink-100);  color: var(--ink-600); }
    .loyalty-badge--platinum{ background: var(--navy-800); color: var(--gold-300); }
    .loyalty-badge--bronze  { background: #f0e8dd; color: #8b6a4a; }

    /* Info grid */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-subtle);
    }
    .info-val { font-size: var(--text-sm); font-weight: 500; color: var(--text); }

    /* Folio lines (shared) */
    .folio-lines { display: flex; flex-direction: column; gap: var(--space-2); }
    .folio-line {
      display: flex; justify-content: space-between;
      font-size: var(--text-sm); color: var(--text-muted);
    }
    .folio-line--total {
      border-top: 1px solid var(--border); padding-top: var(--space-2);
      margin-top: var(--space-1); font-weight: 700; color: var(--text);
    }
    .folio-line--paid   { color: var(--success); }
    .folio-line--balance{ color: var(--danger); font-weight: 600; }
    .folio-line--credit { color: var(--success); font-weight: 600; }

    /* Notes */
    .notes-text {
      font-size: var(--text-sm); color: var(--text-muted); line-height: 1.5; margin: 0;
    }
    .notes-text--internal {
      background: var(--warning-bg); border-left: 3px solid var(--warning);
      padding: var(--space-3); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      color: var(--text);
    }

    /* ── Folio tab specific ── */
    .folio-group { margin-bottom: var(--space-4); &:last-child { margin-bottom: 0; } }
    .folio-group__date {
      font-size: var(--text-xs); font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-subtle);
      margin-bottom: var(--space-2); padding-bottom: var(--space-1);
      border-bottom: 1px dashed var(--border);
    }
    .folio-item-row {
      display: flex; justify-content: space-between; align-items: baseline;
      gap: var(--space-3); padding: var(--space-1) 0;
    }
    .folio-item-row__left {
      display: flex; align-items: baseline; gap: var(--space-2);
      flex: 1; min-width: 0;
    }
    .folio-item-desc {
      font-size: var(--text-sm); color: var(--text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .folio-item-qty { font-size: var(--text-xs); color: var(--text-subtle); flex-shrink: 0; }
    .folio-item-amount {
      font-size: var(--text-sm); font-weight: 500; color: var(--text);
      white-space: nowrap; flex-shrink: 0;
    }

    /* Payments */
    .payment-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--border);
      &:last-child { border-bottom: none; }
    }
    .payment-row__left { display: flex; flex-direction: column; gap: 2px; }
    .payment-method { font-size: var(--text-sm); font-weight: 500; color: var(--text); }
    .payment-ref { font-size: var(--text-xs); color: var(--text-muted); font-family: var(--font-mono); }
    .payment-date { font-size: var(--text-xs); color: var(--text-subtle); }
    .payment-amount { font-size: var(--text-sm); font-weight: 600; color: var(--success); }

    /* Post Charge */
    .folio-actions { padding: var(--space-4) 0 var(--space-2); }
    .btn-post-charge {
      display: flex; align-items: center; gap: var(--space-2);
      width: 100%; height: 38px; padding: 0 var(--space-4);
      border: 1px dashed var(--border-strong); background: transparent;
      border-radius: var(--radius-md); cursor: pointer;
      font-size: var(--text-sm); font-weight: 500; color: var(--text-muted);
      justify-content: center; transition: all var(--t-fast);
      &:hover {
        border-color: var(--primary); color: var(--primary);
        background: color-mix(in srgb, var(--primary) 5%, transparent);
      }
    }

    /* Empty state */
    .folio-empty {
      display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
      padding: var(--space-8) var(--space-4);
      color: var(--text-subtle); font-size: var(--text-sm);
      p { margin: 0; }
    }

    /* Skeleton */
    .skeleton-row {
      height: 40px; border-radius: var(--radius-md);
      background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      margin-bottom: var(--space-2);
    }
    .skeleton-row--sm { height: 24px; width: 60%; }
    .folio-skeleton { padding-top: var(--space-4); }
    @keyframes shimmer { to { background-position: -200% 0; } }

    .text-muted { font-size: var(--text-sm); color: var(--text-muted); margin: 0; }

    /* Footer */
    .drawer-footer {
      display: flex; gap: var(--space-2);
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid var(--border); flex-shrink: 0;
    }
    .btn-action {
      flex: 1; height: 40px; border: none; border-radius: var(--radius-md);
      font-size: var(--text-sm); font-weight: 600; cursor: pointer;
      transition: all var(--t-fast);
    }
    .btn-action--primary {
      background: var(--primary); color: var(--on-primary);
      &:hover { background: var(--primary-hover); }
    }
    .btn-action--danger {
      background: var(--danger-bg); color: var(--danger);
      &:hover { background: var(--danger); color: #fff; }
    }
  `],
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
