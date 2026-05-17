import {
  Component, OnInit, inject, signal, computed, DestroyRef, input, output,
} from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { animate, style, transition, trigger } from '@angular/animations';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ROOM_SERVICE, RESERVATION_SERVICE } from '../../../data/services/service-tokens';
import { Reservation, Room, Guest } from '../../../domain';
import { RoomStatus, PaymentMethod } from '../../../domain/enums';

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
  templateUrl: './check-in-wizard.component.html',
  styleUrl: './check-in-wizard.component.scss',
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
