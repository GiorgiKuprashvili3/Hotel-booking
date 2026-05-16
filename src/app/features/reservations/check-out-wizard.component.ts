import {
  Component, OnInit, inject, signal, computed, DestroyRef, input, output,
} from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { animate, style, transition, trigger } from '@angular/animations';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { RESERVATION_SERVICE } from '../../data/services/service-tokens';
import { Reservation, Folio, Guest } from '../../domain';
import { PaymentMethod } from '../../domain/enums';

@Component({
  selector: 'lux-check-out-wizard',
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
<div class="wiz" role="dialog" aria-modal="true" aria-label="Check out" [@fade]>

  <header class="wiz-head">
    <div>
      <h2 class="wiz-title">Check out guest</h2>
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
        @if (i < steps.length - 1) { <span class="step-line"></span> }
      </div>
    }
  </div>

  <div class="wiz-body">

    @if (step() === 1) {
      <!-- Step 1: Folio review -->
      <h3 class="step-title">Review folio</h3>
      <p class="step-help">Final review of charges and payments before settling the balance.</p>

      @if (folio(); as f) {
        <div class="folio-table">
          <div class="folio-section-title">Charges</div>
          @for (item of f.items; track item.id) {
            <div class="folio-row">
              <div class="folio-row__left">
                <div class="folio-desc">{{ item.description }}</div>
                <div class="folio-meta">
                  <span class="folio-cat" [attr.data-cat]="item.category">{{ item.category }}</span>
                  <span>{{ item.date | date:'MMM d' }}</span>
                  @if (item.quantity > 1) { <span>× {{ item.quantity }}</span> }
                </div>
              </div>
              <div class="folio-amt">{{ item.amount | currency:'GEL':'symbol-narrow':'1.2-2' }}</div>
            </div>
          }

          @if (f.payments.length > 0) {
            <div class="folio-section-title folio-section-title--payments">Payments</div>
            @for (p of f.payments; track p.id) {
              <div class="folio-row folio-row--payment">
                <div class="folio-row__left">
                  <div class="folio-desc">{{ payMethodLabel(p.method) }}</div>
                  <div class="folio-meta">
                    <span>{{ p.date | date:'MMM d, HH:mm' }}</span>
                    @if (p.reference) { <span class="folio-ref">{{ p.reference }}</span> }
                  </div>
                </div>
                <div class="folio-amt folio-amt--pay">−{{ p.amount | currency:'GEL':'symbol-narrow':'1.2-2' }}</div>
              </div>
            }
          }
        </div>

        <div class="totals-card">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>{{ reservation().totalRoomCharge + reservation().totalExtras | currency:'GEL':'symbol-narrow':'1.2-2' }}</span>
          </div>
          <div class="totals-row">
            <span>Tax</span>
            <span>{{ reservation().totalTax | currency:'GEL':'symbol-narrow':'1.2-2' }}</span>
          </div>
          <div class="totals-row totals-row--total">
            <span>Total</span>
            <span>{{ reservation().totalAmount | currency:'GEL':'symbol-narrow':'1.2-2' }}</span>
          </div>
          <div class="totals-row">
            <span>Paid</span>
            <span>−{{ reservation().totalPaid | currency:'GEL':'symbol-narrow':'1.2-2' }}</span>
          </div>
          <div class="totals-row totals-row--balance">
            <span>Balance due</span>
            <span [class.balance-owed]="reservation().balance > 0" [class.balance-ok]="reservation().balance <= 0">
              {{ reservation().balance | currency:'GEL':'symbol-narrow':'1.2-2' }}
            </span>
          </div>
        </div>
      } @else {
        <div class="loading">Loading folio…</div>
      }
    }

    @if (step() === 2) {
      <!-- Step 2: Settle balance -->
      <h3 class="step-title">Settle balance</h3>

      @if (reservation().balance > 0) {
        <p class="step-help">
          Outstanding balance is <strong>{{ reservation().balance | currency:'GEL':'symbol-narrow':'1.2-2' }}</strong>.
          Collect payment to clear it.
        </p>

        <div class="pay-row">
          <label class="field field--grow">
            <span class="field-lbl">Amount</span>
            <input
              class="field-input"
              type="number"
              min="0"
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
          <button class="qp-btn" (click)="paymentAmount.set(0)">Skip / settle later</button>
        </div>

        @if (paymentAmount() > 0 && paymentAmount() < reservation().balance) {
          <div class="warn-banner">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1.5L13 12H1L7 1.5zM7 5v3M7 10v.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>
            <span>Remaining balance of {{ reservation().balance - paymentAmount() | currency:'GEL':'symbol-narrow':'1.2-2' }} will stay open after check-out.</span>
          </div>
        }
      } @else {
        <div class="ok-banner">
          <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="var(--success)"/><path d="M6 10l3 3 5-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
          <div>
            <div class="ok-title">Balance fully settled</div>
            <div class="ok-sub">No outstanding payment required.</div>
          </div>
        </div>
      }

      <label class="checkbox-row">
        <input type="checkbox" [ngModel]="emailReceipt()" (ngModelChange)="emailReceipt.set($event)" />
        <span>Email receipt to {{ guest()?.email || 'guest' }}</span>
      </label>
    }

    @if (step() === 3) {
      <!-- Step 3: Confirm -->
      <h3 class="step-title">Confirm check-out</h3>

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
            {{ reservation().checkOut | date:'MMM d, y' }} ({{ reservation().nights }}n)
          </span>
        </div>
        @if (paymentAmount() > 0) {
          <div class="summary-row">
            <span>Final payment</span>
            <span class="summary-val">{{ paymentAmount() | currency:'GEL':'symbol-narrow':'1.2-2' }} ({{ payMethodLabel(paymentMethod()) }})</span>
          </div>
        }
        <div class="summary-row summary-row--total">
          <span>Final balance</span>
          <span class="summary-val" [class.balance-owed]="finalBalance() > 0" [class.balance-ok]="finalBalance() <= 0">
            {{ finalBalance() | currency:'GEL':'symbol-narrow':'1.2-2' }}
          </span>
        </div>
      </div>

      <div class="info-banner">
        <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M7 6.5v3.5M7 4v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        <span>Room {{ assignedRoom() }} will be marked as <strong>cleaning</strong> and added to today's housekeeping queue.</span>
      </div>

      <label class="field">
        <span class="field-lbl">Notes (optional)</span>
        <textarea
          class="field-input"
          rows="2"
          placeholder="Late checkout, breakage report, follow-up needed, etc."
          [ngModel]="notes()"
          (ngModelChange)="notes.set($event)"></textarea>
      </label>
    }

  </div>

  <footer class="wiz-foot">
    <button class="btn-back" (click)="back()" [disabled]="step() === 1 || submitting()">Back</button>
    <div class="foot-right">
      @if (step() < 3) {
        <button class="btn-next" (click)="next()">Next</button>
      } @else {
        <button class="btn-confirm" [disabled]="submitting()" (click)="submit()">
          @if (submitting()) { <span class="spinner"></span> } @else { Confirm check-out }
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
      transform: translate(-50%, -50%); z-index: 301;
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
      width: 30px; height: 30px; border: none; background: var(--surface-2);
      border-radius: var(--radius-full); cursor: pointer; color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
    }
    .btn-close:hover { background: var(--danger-bg); color: var(--danger); }

    .stepper {
      display: flex; align-items: center;
      padding: var(--space-3) var(--space-6);
      background: var(--surface-2); border-bottom: 1px solid var(--border);
    }
    .step { display: flex; align-items: center; gap: 8px; flex: 1; }
    .step-dot {
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--surface); border: 1.5px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); flex-shrink: 0;
      transition: all var(--t-fast);
    }
    .step.active .step-dot { background: var(--primary); color: var(--on-primary); border-color: var(--primary); }
    .step.done .step-dot { background: var(--success); color: #fff; border-color: var(--success); }
    .step-label { font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); white-space: nowrap; }
    .step.active .step-label { color: var(--text); }
    .step-line { flex: 1; height: 1.5px; background: var(--border); margin: 0 8px; }
    .step.done .step-line { background: var(--success); }

    .wiz-body { flex: 1; overflow-y: auto; padding: var(--space-5) var(--space-6); }
    .step-title { font-size: var(--text-lg); font-weight: 700; margin: 0 0 4px; color: var(--text); }
    .step-help { font-size: var(--text-sm); color: var(--text-muted); margin: 0 0 var(--space-4); }
    .loading { padding: var(--space-6); text-align: center; color: var(--text-muted); }

    /* Folio table */
    .folio-table {
      border: 1px solid var(--border); border-radius: var(--radius-md);
      overflow: hidden; margin-bottom: var(--space-4);
    }
    .folio-section-title {
      padding: var(--space-2) var(--space-3);
      background: var(--surface-2);
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-subtle);
      border-bottom: 1px solid var(--border);
    }
    .folio-section-title--payments { border-top: 1px solid var(--border); }
    .folio-row {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: var(--space-2) var(--space-3); gap: var(--space-3);
    }
    .folio-row:not(:last-child) { border-bottom: 1px solid var(--border); }
    .folio-desc { font-size: var(--text-sm); color: var(--text); font-weight: 500; }
    .folio-meta {
      display: flex; gap: 8px; align-items: center; margin-top: 2px;
      font-size: 11px; color: var(--text-muted);
    }
    .folio-cat {
      padding: 1px 6px; border-radius: var(--radius-sm);
      background: var(--surface-2); text-transform: capitalize;
      font-weight: 600;
    }
    .folio-cat[data-cat="room"]    { color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); }
    .folio-cat[data-cat="tax"]     { color: var(--text-muted); }
    .folio-cat[data-cat="food"]    { color: var(--success); background: var(--success-bg); }
    .folio-cat[data-cat="minibar"] { color: var(--warning); background: var(--warning-bg); }
    .folio-cat[data-cat="service"] { color: var(--info); background: var(--info-bg); }
    .folio-ref { font-family: var(--font-mono); }
    .folio-amt {
      font-size: var(--text-sm); font-weight: 600; color: var(--text);
      font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    .folio-amt--pay { color: var(--success); }

    .totals-card {
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: var(--space-4);
      display: flex; flex-direction: column; gap: 6px;
    }
    .totals-row {
      display: flex; justify-content: space-between;
      font-size: var(--text-sm); color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
    .totals-row--total {
      padding-top: 8px; border-top: 1px solid var(--border);
      color: var(--text); font-weight: 700;
    }
    .totals-row--balance {
      padding-top: 8px; border-top: 1px solid var(--border);
      font-size: var(--text-md); font-weight: 700;
    }
    .balance-owed { color: var(--danger); }
    .balance-ok   { color: var(--success); }

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
    .pay-row { display: flex; gap: var(--space-2); margin-bottom: var(--space-2); }
    .quick-pay { display: flex; gap: var(--space-2); margin-bottom: var(--space-3); }
    .qp-btn {
      padding: 4px 10px; border: 1px solid var(--border); background: var(--surface);
      border-radius: var(--radius-sm); cursor: pointer;
      font-size: 11px; font-weight: 600; color: var(--text-muted);
    }
    .qp-btn:hover { color: var(--primary); border-color: var(--primary); }

    .warn-banner {
      display: flex; align-items: center; gap: 8px;
      padding: var(--space-3); background: var(--warning-bg);
      border-radius: var(--radius-md); color: var(--warning);
      font-size: var(--text-xs); margin-bottom: var(--space-3);
    }
    .ok-banner {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-4); background: var(--success-bg);
      border-radius: var(--radius-md); margin-bottom: var(--space-3);
    }
    .ok-title { font-weight: 700; color: var(--success); font-size: var(--text-md); }
    .ok-sub { color: var(--text-muted); font-size: var(--text-xs); margin-top: 2px; }

    .info-banner {
      display: flex; align-items: center; gap: 8px;
      padding: var(--space-3); background: var(--info-bg);
      border-radius: var(--radius-md); color: var(--info);
      font-size: var(--text-xs); margin-bottom: var(--space-3);
    }
    .info-banner svg { flex-shrink: 0; }

    .checkbox-row {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-3); background: var(--surface-2);
      border-radius: var(--radius-md); cursor: pointer;
      font-size: var(--text-sm); color: var(--text);
    }
    .checkbox-row input { width: 18px; height: 18px; cursor: pointer; }

    /* Summary */
    .summary {
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: var(--space-4);
      margin-bottom: var(--space-3);
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
    .summary-row--total .summary-val { font-weight: 700; }

    /* Footer */
    .wiz-foot {
      display: flex; justify-content: space-between; align-items: center;
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid var(--border); background: var(--surface);
    }
    .btn-back, .btn-next, .btn-confirm {
      height: 40px; padding: 0 var(--space-5);
      border-radius: var(--radius-md); cursor: pointer;
      font-size: var(--text-sm); font-weight: 600;
      transition: all var(--t-fast);
    }
    .btn-back {
      background: transparent; border: 1px solid var(--border); color: var(--text-muted);
    }
    .btn-back:hover:not(:disabled) { color: var(--text); border-color: var(--border-strong); }
    .btn-back:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-next, .btn-confirm {
      background: var(--primary); color: var(--on-primary); border: none;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .btn-next:hover:not(:disabled), .btn-confirm:hover:not(:disabled) { filter: brightness(1.08); }
    .btn-confirm { background: var(--success); }
    .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
    .spinner {
      width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class CheckOutWizardComponent implements OnInit {
  reservation = input.required<Reservation>();
  guest       = input<Guest | null>(null);
  folio       = input<Folio | null>(null);
  roomNumber  = input<string | null>(null);

  completed = output<Reservation>();
  cancel    = output<void>();

  private resSvc     = inject(RESERVATION_SERVICE);
  private destroyRef = inject(DestroyRef);

  readonly PaymentMethod = PaymentMethod;
  readonly steps = [
    { n: 1, label: 'Folio review' },
    { n: 2, label: 'Settle balance' },
    { n: 3, label: 'Confirm' },
  ];

  step          = signal(1);
  paymentAmount = signal(0);
  paymentMethod = signal<string>(PaymentMethod.Card);
  emailReceipt  = signal(true);
  notes         = signal('');
  submitting    = signal(false);

  finalBalance = computed(() =>
    Math.max(0, this.reservation().balance - this.paymentAmount()));

  assignedRoom = computed(() => this.roomNumber() ?? '—');

  ngOnInit(): void {
    // Pre-fill with full balance if there is one
    if (this.reservation().balance > 0) {
      this.paymentAmount.set(this.reservation().balance);
    }
  }

  next(): void { this.step.update(n => Math.min(3, n + 1)); }
  back(): void { this.step.update(n => Math.max(1, n - 1)); }

  payMethodLabel(m: string): string {
    switch (m) {
      case PaymentMethod.Card:         return 'Card';
      case PaymentMethod.Cash:         return 'Cash';
      case PaymentMethod.BankTransfer: return 'Bank transfer';
      case PaymentMethod.Voucher:      return 'Voucher';
      default: return m;
    }
  }

  submit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.resSvc.checkOut(this.reservation().id, {
      paymentAmount: this.paymentAmount() > 0 ? this.paymentAmount() : undefined,
      paymentMethod: this.paymentAmount() > 0 ? this.paymentMethod() : undefined,
      emailReceipt: this.emailReceipt(),
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
