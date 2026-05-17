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
  templateUrl: './check-out-wizard.component.html',
  styleUrl: './check-out-wizard.component.scss',
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

  // Confirm is allowed when:
  // - balance is already zero (nothing to collect), OR
  // - there IS a balance and the user has entered a positive payment amount with a method selected
  canSubmit = computed(() => {
    const balance = this.reservation().balance;
    if (balance <= 0) return true;
    return this.paymentAmount() > 0 && !!this.paymentMethod();
  });

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