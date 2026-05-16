import {
  Component, OnInit, inject, signal, computed, DestroyRef, input, output,
} from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { animate, style, transition, trigger } from '@angular/animations';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ROOM_SERVICE, RESERVATION_SERVICE } from '../../data/services/service-tokens';
import { Reservation, Room, Guest } from '../../domain';
import { RoomStatus, PaymentMethod } from '../../domain/enums';

@Component({
  selector: 'lux-check-in-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CurrencyPipe],
  animations: [
    trigger('fade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.96)' }),
        animate('180ms cubic-bezier(0.34,1.56,0.64,1)', style({ opacity: 1, transform: 'scale(1)' })),
      ]),
      transition(':leave', [animate('120ms ease-in', style({ opacity: 0 }))]),
    ]),
  ],
  template: `
<div class="wiz-backdrop" (click)="cancel.emit()"></div>
<div class="wiz" role="dialog" aria-modal="true" aria-label="Check in" [@fade]>

  <!-- Header -->
  <header class="wiz-head">
    <div>
      <h2 class="wiz-title">Check in guest</h2>
      <p class="wiz-sub">{{ reservation().confirmationNumber }} · {{ guest()?.firstName }} {{ guest()?.lastName }}</p>
    </div>
    <button class="btn-close" (click)="cancel.emit()" aria-label="Close">
      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
  </header>

  <!-- Stepper -->
  <div class="stepper">
    @for (s of steps; track s.n; let i = $index) {
      <div class="step"
           [class.active]="step() === s.n"
           [class.done]="step() > s.n">
        <span class="step-dot">
          @if (step() > s.n) {
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2 2 4-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
          } @else {
            {{ s.n }}
          }
        </span>
        <span class="step-label">{{ s.label }}</span>
        @if (i < steps.length - 1) {
          <span class="step-line"></span>
        }
      </div>
    }
  </div>

  <!-- Step content -->
  <div class="wiz-body">

    @if (step() === 1) {
      <!-- Step 1: Verify guest -->
      <h3 class="step-title">Verify guest identity</h3>
      <p class="step-help">Confirm the guest's ID matches the reservation. This is for the front-desk audit log.</p>
      <div class="guest-card">
        <div class="guest-avatar">{{ initials() }}</div>
        <div class="guest-info">
          <div class="guest-name">{{ guest()?.firstName }} {{ guest()?.lastName }}</div>
          <div class="guest-meta">{{ guest()?.email }} · {{ guest()?.phone }}</div>
          <div class="guest-id">
            <span class="id-label">{{ guest()?.idType | titlecase }}:</span>
            <span class="id-num">{{ guest()?.idNumber || 'Not on file' }}</span>
          </div>
        </div>
      </div>
      <label class="checkbox-row">
        <input type="checkbox" [ngModel]="idVerified()" (ngModelChange)="idVerified.set($event)" />
        <span>I have verified the guest's identity document</span>
      </label>
    }

    @if (step() === 2) {
      <!-- Step 2: Assign room -->
      <h3 class="step-title">Assign a room</h3>
      <p class="step-help">
        Suggested rooms match the reservation's type ({{ reservation().roomTypeId }}) and are currently available.
      </p>

      @if (loadingRooms()) {
        <div class="loading">Loading rooms…</div>
      } @else if (eligibleRooms().length === 0) {
        <div class="empty-pane">
          <p>No matching rooms are immediately available.</p>
          <p class="empty-hint">Showing all available rooms instead:</p>
          <div class="room-pick">
            @for (r of allAvailable(); track r.id) {
              <button
                class="room-btn"
                [class.selected]="selectedRoomId() === r.id"
                (click)="selectedRoomId.set(r.id)">
                <span class="rb-num">{{ r.number }}</span>
                <span class="rb-floor">Floor {{ r.floor }}</span>
              </button>
            }
          </div>
        </div>
      } @else {
        <div class="room-pick">
          @for (r of eligibleRooms(); track r.id) {
            <button
              class="room-btn"
              [class.selected]="selectedRoomId() === r.id"
              (click)="selectedRoomId.set(r.id)">
              <span class="rb-num">{{ r.number }}</span>
              <span class="rb-floor">Floor {{ r.floor }}</span>
            </button>
          }
        </div>
        @if (allAvailable().length > eligibleRooms().length) {
          <details class="other-rooms">
            <summary>Show {{ allAvailable().length - eligibleRooms().length }} other available rooms</summary>
            <div class="room-pick room-pick--secondary">
              @for (r of otherAvailable(); track r.id) {
                <button
                  class="room-btn"
                  [class.selected]="selectedRoomId() === r.id"
                  (click)="selectedRoomId.set(r.id)">
                  <span class="rb-num">{{ r.number }}</span>
                  <span class="rb-floor">Floor {{ r.floor }}</span>
                </button>
              }
            </div>
          </details>
        }
      }

      <label class="field">
        <span class="field-lbl">Key cards to issue</span>
        <div class="counter">
          <button class="counter-btn" (click)="keyCards.set(Math.max(0, keyCards() - 1))">−</button>
          <span class="counter-val">{{ keyCards() }}</span>
          <button class="counter-btn" (click)="keyCards.set(Math.min(4, keyCards() + 1))">+</button>
        </div>
      </label>
    }

    @if (step() === 3) {
      <!-- Step 3: Payment & confirm -->
      <h3 class="step-title">Payment & confirmation</h3>

      <div class="summary">
        <div class="summary-row">
          <span>Guest</span>
          <span class="summary-val">{{ guest()?.firstName }} {{ guest()?.lastName }}</span>
        </div>
        <div class="summary-row">
          <span>Stay</span>
          <span class="summary-val">
            {{ reservation().checkIn | date:'MMM d' }}
            <span class="arrow">→</span>
            {{ reservation().checkOut | date:'MMM d, y' }}
            ({{ reservation().nights }}n)
          </span>
        </div>
        <div class="summary-row">
          <span>Room</span>
          <span class="summary-val">{{ assignedRoomLabel() }}</span>
        </div>
        <div class="summary-row summary-row--total">
          <span>Total amount</span>
          <span class="summary-val">{{ reservation().totalAmount | currency:'GEL':'symbol-narrow':'1.0-0' }}</span>
        </div>
        <div class="summary-row summary-row--bal">
          <span>Balance due</span>
          <span class="summary-val balance">{{ reservation().balance | currency:'GEL':'symbol-narrow':'1.0-0' }}</span>
        </div>
      </div>

      @if (reservation().balance > 0) {
        <div class="payment-section">
          <h4 class="payment-title">Collect payment (optional)</h4>
          <div class="pay-row">
            <label class="field field--grow">
              <span class="field-lbl">Amount</span>
              <input
                class="field-input"
                type="number"
                min="0"
                [max]="reservation().balance"
                [ngModel]="paymentAmount()"
                (ngModelChange)="paymentAmount.set($event)" />
            </label>
            <label class="field">
              <span class="field-lbl">Method</span>
              <select class="field-input" [ngModel]="paymentMethod()" (ngModelChange)="paymentMethod.set($event)">
                <option [value]="PaymentMethod.Card">Card</option>
                <option [value]="PaymentMethod.Cash">Cash</option>
                <option [value]="PaymentMethod.BankTransfer">Bank transfer</option>
                <option [value]="PaymentMethod.Voucher">Voucher</option>
              </select>
            </label>
          </div>
          <div class="quick-pay">
            <button class="qp-btn" (click)="paymentAmount.set(reservation().balance)">Full balance</button>
            <button class="qp-btn" (click)="paymentAmount.set(0)">Skip</button>
          </div>
        </div>
      }

      <label class="field">
        <span class="field-lbl">Notes (optional)</span>
        <textarea
          class="field-input"
          rows="2"
          placeholder="Special arrangements, early arrival reason, etc."
          [ngModel]="notes()"
          (ngModelChange)="notes.set($event)"></textarea>
      </label>
    }

  </div>

  <!-- Footer -->
  <footer class="wiz-foot">
    <button
      class="btn-back"
      (click)="back()"
      [disabled]="step() === 1 || submitting()">
      Back
    </button>
    <div class="foot-right">
      @if (step() < 3) {
        <button
          class="btn-next"
          [disabled]="!canNext()"
          (click)="next()">
          Next
        </button>
      } @else {
        <button
          class="btn-confirm"
          [disabled]="!canSubmit() || submitting()"
          (click)="submit()">
          @if (submitting()) { <span class="spinner"></span> } @else { Confirm check-in }
        </button>
      }
    </div>
  </footer>
</div>
  `,
  styles: [`
    .wiz-backdrop {
      position: fixed; inset: 0; background: rgba(11,31,58,0.35);
      backdrop-filter: blur(3px); z-index: 300;
    }
    .wiz {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 301;
      width: min(640px, calc(100vw - 32px));
      max-height: calc(100vh - 64px);
      background: var(--surface); border-radius: var(--radius-xl);
      box-shadow: var(--shadow-3);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .wiz-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: var(--space-5) var(--space-6) var(--space-3);
      border-bottom: 1px solid var(--border);
    }
    .wiz-title { font-size: var(--text-xl); font-weight: 700; margin: 0; color: var(--text); }
    .wiz-sub { font-size: var(--text-xs); color: var(--text-muted); margin: 2px 0 0; }
    .btn-close {
      width: 30px; height: 30px;
      border: none; background: var(--surface-2);
      border-radius: var(--radius-full);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-muted);
    }
    .btn-close:hover { background: var(--danger-bg); color: var(--danger); }

    .stepper {
      display: flex; align-items: center;
      padding: var(--space-3) var(--space-6);
      background: var(--surface-2);
      border-bottom: 1px solid var(--border);
    }
    .step { display: flex; align-items: center; gap: 8px; flex: 1; position: relative; }
    .step-dot {
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--surface); border: 1.5px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      font-size: var(--text-xs); font-weight: 700;
      color: var(--text-muted); flex-shrink: 0;
      transition: all var(--t-fast);
    }
    .step.active .step-dot {
      background: var(--primary); color: var(--on-primary); border-color: var(--primary);
    }
    .step.done .step-dot {
      background: var(--success); color: #fff; border-color: var(--success);
    }
    .step-label {
      font-size: var(--text-xs); font-weight: 600; color: var(--text-muted);
      white-space: nowrap;
    }
    .step.active .step-label { color: var(--text); }
    .step.done .step-label { color: var(--text-muted); }
    .step-line {
      flex: 1; height: 1.5px; background: var(--border); margin: 0 8px;
    }
    .step.done .step-line { background: var(--success); }

    .wiz-body {
      flex: 1; overflow-y: auto;
      padding: var(--space-5) var(--space-6);
    }
    .step-title { font-size: var(--text-lg); font-weight: 700; margin: 0 0 4px; color: var(--text); }
    .step-help { font-size: var(--text-sm); color: var(--text-muted); margin: 0 0 var(--space-4); }
    .loading { padding: var(--space-6); text-align: center; color: var(--text-muted); }

    /* Guest card */
    .guest-card {
      display: flex; gap: var(--space-3);
      padding: var(--space-4);
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius-md);
      margin-bottom: var(--space-4);
    }
    .guest-avatar {
      width: 48px; height: 48px; border-radius: 50%;
      background: var(--primary); color: var(--on-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: var(--text-md); font-weight: 700; flex-shrink: 0;
    }
    .guest-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .guest-name { font-size: var(--text-md); font-weight: 600; color: var(--text); }
    .guest-meta { font-size: var(--text-xs); color: var(--text-muted); }
    .guest-id { display: flex; gap: 6px; margin-top: 4px; font-size: var(--text-xs); }
    .id-label { color: var(--text-subtle); }
    .id-num { color: var(--text); font-family: var(--font-mono); }

    .checkbox-row {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-3); background: var(--surface-2);
      border-radius: var(--radius-md); cursor: pointer;
      font-size: var(--text-sm); color: var(--text);
    }
    .checkbox-row input { width: 18px; height: 18px; cursor: pointer; }

    /* Room picker */
    .room-pick {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
      gap: var(--space-2); margin-bottom: var(--space-3);
    }
    .room-pick--secondary { margin-top: var(--space-2); }
    .room-btn {
      display: flex; flex-direction: column; gap: 2px;
      padding: 12px 8px;
      border: 1.5px solid var(--border); background: var(--surface);
      border-radius: var(--radius-md); cursor: pointer;
      text-align: center; transition: all var(--t-fast);
    }
    .room-btn:hover { border-color: var(--border-strong); }
    .room-btn.selected {
      border-color: var(--primary);
      background: color-mix(in srgb, var(--primary) 6%, var(--surface));
    }
    .rb-num { font-size: var(--text-md); font-weight: 700; color: var(--text); }
    .rb-floor { font-size: 11px; color: var(--text-muted); }

    .empty-pane { text-align: center; padding: var(--space-4) 0; }
    .empty-pane p { margin: 0 0 var(--space-2); color: var(--text-muted); font-size: var(--text-sm); }
    .empty-hint { font-style: italic; font-size: var(--text-xs); }
    .other-rooms summary {
      cursor: pointer; font-size: var(--text-sm); color: var(--text-muted);
      padding: 8px 0; user-select: none;
    }
    .other-rooms summary:hover { color: var(--primary); }

    /* Fields */
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: var(--space-3); }
    .field--grow { flex: 1; }
    .field-lbl {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-subtle);
    }
    .field-input {
      height: 38px; padding: 0 var(--space-3);
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface); color: var(--text);
      font-size: var(--text-sm); font-family: inherit; outline: none;
      box-sizing: border-box;
    }
    textarea.field-input { height: auto; padding: var(--space-2) var(--space-3); resize: vertical; }
    .field-input:focus { border-color: var(--primary); }

    .counter {
      display: inline-flex; align-items: center;
      border: 1px solid var(--border); border-radius: var(--radius-md);
      width: max-content;
    }
    .counter-btn {
      width: 32px; height: 34px;
      border: none; background: var(--surface-2); cursor: pointer;
      font-size: var(--text-md); color: var(--text);
    }
    .counter-btn:hover { background: var(--surface-3); }
    .counter-val { padding: 0 16px; font-weight: 600; font-size: var(--text-sm); }

    /* Summary card */
    .summary {
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: var(--space-4);
      margin-bottom: var(--space-4);
      display: flex; flex-direction: column; gap: var(--space-2);
    }
    .summary-row {
      display: flex; justify-content: space-between;
      font-size: var(--text-sm); color: var(--text-muted);
    }
    .summary-val { color: var(--text); font-weight: 500; }
    .arrow { color: var(--text-subtle); margin: 0 4px; }
    .summary-row--total {
      padding-top: var(--space-2); border-top: 1px solid var(--border);
      font-weight: 600;
    }
    .summary-row--total .summary-val { color: var(--text); font-weight: 700; }
    .summary-row--bal .balance { color: var(--danger); font-weight: 700; }

    .payment-section {
      padding: var(--space-3); background: var(--surface-2);
      border-radius: var(--radius-md); margin-bottom: var(--space-3);
    }
    .payment-title {
      font-size: var(--text-sm); font-weight: 700; color: var(--text);
      margin: 0 0 var(--space-3);
    }
    .pay-row { display: flex; gap: var(--space-2); margin-bottom: var(--space-2); }
    .quick-pay { display: flex; gap: var(--space-2); }
    .qp-btn {
      padding: 4px 10px;
      border: 1px solid var(--border); background: var(--surface);
      border-radius: var(--radius-sm); cursor: pointer;
      font-size: 11px; font-weight: 600; color: var(--text-muted);
    }
    .qp-btn:hover { color: var(--primary); border-color: var(--primary); }

    /* Footer */
    .wiz-foot {
      display: flex; justify-content: space-between; align-items: center;
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid var(--border);
      background: var(--surface);
    }
    .btn-back, .btn-next, .btn-confirm {
      height: 40px; padding: 0 var(--space-5);
      border-radius: var(--radius-md); cursor: pointer;
      font-size: var(--text-sm); font-weight: 600;
      transition: all var(--t-fast);
    }
    .btn-back {
      background: transparent; border: 1px solid var(--border);
      color: var(--text-muted);
    }
    .btn-back:hover:not(:disabled) { color: var(--text); border-color: var(--border-strong); }
    .btn-back:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-next, .btn-confirm {
      background: var(--primary); color: var(--on-primary); border: none;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .btn-next:hover:not(:disabled), .btn-confirm:hover:not(:disabled) { filter: brightness(1.08); }
    .btn-next:disabled, .btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-confirm { background: var(--success); }
    .spinner {
      width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class CheckInWizardComponent implements OnInit {
  // Inputs
  reservation = input.required<Reservation>();
  guest       = input<Guest | null>(null);
  rooms       = input<Room[]>([]);

  // Outputs
  completed = output<Reservation>();
  cancel    = output<void>();

  private resSvc     = inject(RESERVATION_SERVICE);
  private destroyRef = inject(DestroyRef);

  readonly PaymentMethod = PaymentMethod;
  readonly Math = Math;
  readonly steps = [
    { n: 1, label: 'Verify guest' },
    { n: 2, label: 'Assign room' },
    { n: 3, label: 'Payment' },
  ];

  step            = signal(1);
  idVerified      = signal(false);
  selectedRoomId  = signal<string | null>(null);
  keyCards        = signal(1);
  paymentAmount   = signal(0);
  paymentMethod   = signal<string>(PaymentMethod.Card);
  notes           = signal('');
  submitting      = signal(false);
  loadingRooms    = signal(false);

  allAvailable = computed(() =>
    this.rooms().filter(r => r.status === RoomStatus.Available));

  eligibleRooms = computed(() =>
    this.allAvailable().filter(r => r.roomTypeId === this.reservation().roomTypeId));

  otherAvailable = computed(() =>
    this.allAvailable().filter(r => r.roomTypeId !== this.reservation().roomTypeId));

  initials = computed(() => {
    const g = this.guest();
    return g ? `${g.firstName[0] ?? ''}${g.lastName[0] ?? ''}`.toUpperCase() : '?';
  });

  assignedRoomLabel = computed(() => {
    const id = this.selectedRoomId();
    if (!id) return 'Not assigned';
    const r = this.rooms().find(x => x.id === id);
    return r ? `Room ${r.number} (Floor ${r.floor})` : 'Unknown';
  });

  canNext = computed(() => {
    if (this.step() === 1) return this.idVerified();
    if (this.step() === 2) return !!this.selectedRoomId();
    return false;
  });

  canSubmit = computed(() => !!this.selectedRoomId() && this.idVerified());

  ngOnInit(): void {
    // Pre-pick first eligible room if exactly one
    const eligible = this.eligibleRooms();
    if (eligible.length === 1) this.selectedRoomId.set(eligible[0].id);
  }

  next(): void { if (this.canNext()) this.step.update(n => n + 1); }
  back(): void { this.step.update(n => Math.max(1, n - 1)); }

  submit(): void {
    if (!this.canSubmit() || this.submitting()) return;
    const roomId = this.selectedRoomId()!;
    this.submitting.set(true);

    this.resSvc.checkIn(this.reservation().id, {
      roomId,
      idVerified: this.idVerified(),
      keyCardsIssued: this.keyCards(),
      paymentAmount: this.paymentAmount() > 0 ? this.paymentAmount() : undefined,
      paymentMethod: this.paymentAmount() > 0 ? this.paymentMethod() : undefined,
      notes: this.notes().trim() || undefined,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: r => {
          this.submitting.set(false);
          this.completed.emit(r);
        },
        error: () => this.submitting.set(false),
      });
  }
}
