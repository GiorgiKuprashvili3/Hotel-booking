import {
  Component, input, output, inject, signal, computed, OnInit, DestroyRef,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { animate, style, transition, trigger } from '@angular/animations';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';

import { GUEST_SERVICE, RESERVATION_SERVICE } from '../../../data/services/service-tokens';
import { Guest, Room, RoomType, RatePlan } from '../../../domain';
import { ReservationStatus, BookingSource } from '../../../domain/enums';

export interface NewReservationPayload {
  roomId: string;
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guestId: string;
  adults: number;
  children: number;
  ratePlanId: string;
  totalRoomCharge: number;
  totalTax: number;
  totalAmount: number;
  totalPaid: number;
  totalExtras: number;
  balance: number;
  status: ReservationStatus;
  source: BookingSource;
  specialRequests?: string;
}

/** Lightweight email check — good enough for client-side new-guest creation. */
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

@Component({
  selector: 'app-new-reservation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  animations: [
    trigger('fadeScale', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.96) translateY(8px)' }),
        animate('200ms cubic-bezier(0.34,1.56,0.64,1)',
          style({ opacity: 1, transform: 'scale(1) translateY(0)' })),
      ]),
      transition(':leave', [
        animate('150ms ease-in',
          style({ opacity: 0, transform: 'scale(0.96) translateY(4px)' })),
      ]),
    ]),
  ],
  templateUrl: './new-reservation-modal.component.html',
  styleUrl: './new-reservation-modal.component.scss',
})
export class NewReservationModalComponent implements OnInit {
  private guestSvc  = inject(GUEST_SERVICE);
  private destroyRef = inject(DestroyRef);

  // Inputs
  roomId     = input.required<string>();
  roomTypeId = input.required<string>();
  checkIn    = input.required<Date>();
  checkOut   = input.required<Date>();
  nights     = input.required<number>();
  room       = input<Room | null>(null);
  roomType   = input<RoomType | null>(null);
  ratePlans  = input<RatePlan[]>([]);

  // Outputs
  confirm = output<NewReservationPayload>();
  cancel  = output<void>();

  // State
  searchQuery      = signal('');
  searchResults    = signal<Guest[]>([]);
  searchLoading    = signal(false);
  showResults      = signal(false);
  selectedGuest    = signal<Guest | null>(null);
  adults           = signal(1);
  children         = signal(0);
  selectedRatePlanId = signal('');
  specialRequests  = signal('');

  // New-guest creation state
  showCreateForm = signal(false);
  newFirstName   = signal('');
  newLastName    = signal('');
  newEmail       = signal('');
  newPhone       = signal('');
  creating       = signal(false);
  createError    = signal<string | null>(null);

  // Expose Math for template
  readonly Math = Math;

  maxOcc = computed(() => this.roomType()?.maxOccupancy ?? 4);

  selectedPlan = computed(() =>
    this.ratePlans().find(rp => rp.id === this.selectedRatePlanId()) ?? null
  );

  nightlyRate(rp: RatePlan): number {
    return (this.roomType()?.basePrice ?? 0) * (rp.multiplier ?? 1);
  }

  totalRoomCharge = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) return 0;
    return this.nightlyRate(plan) * this.nights();
  });

  totalAmount = computed(() => {
    const charge = this.totalRoomCharge();
    return charge + charge * 0.12; // 12% tax
  });

  canConfirm = computed(() =>
    !!this.selectedGuest() && !!this.selectedPlan()
  );

  canCreateGuest = computed(() =>
    this.newFirstName().trim().length > 0 &&
    this.newLastName().trim().length > 0 &&
    isValidEmail(this.newEmail()) &&
    this.newPhone().trim().length >= 4
  );

  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    // Auto-select first rate plan
    if (this.ratePlans().length) {
      this.selectedRatePlanId.set(this.ratePlans()[0].id);
    }

    // Debounced search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q.length > 1
        ? this.guestSvc.search(q)
        : of([])
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => {
      this.searchResults.set(results);
      this.searchLoading.set(false);
    });
  }

  onSearchChange(q: string): void {
    this.searchQuery.set(q);
    if (q.length > 1) {
      this.searchLoading.set(true);
      this.searchSubject.next(q);
    } else {
      this.searchResults.set([]);
      this.searchLoading.set(false);
    }
  }

  selectGuest(g: Guest): void {
    this.selectedGuest.set(g);
    this.showResults.set(false);
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  clearGuest(): void {
    this.selectedGuest.set(null);
  }

  openCreateForm(): void {
    // Smart-prefill from current search query
    const q = this.searchQuery().trim();
    if (q) {
      if (q.includes('@')) {
        this.newEmail.set(q);
      } else if (/^[\+\d][\d\s\-()]{3,}$/.test(q)) {
        this.newPhone.set(q);
      } else {
        const parts = q.split(/\s+/);
        this.newFirstName.set(parts[0] ?? '');
        if (parts.length > 1) {
          this.newLastName.set(parts.slice(1).join(' '));
        }
      }
    }
    this.createError.set(null);
    this.showResults.set(false);
    this.showCreateForm.set(true);
  }

  cancelCreateForm(): void {
    this.showCreateForm.set(false);
    this.newFirstName.set('');
    this.newLastName.set('');
    this.newEmail.set('');
    this.newPhone.set('');
    this.createError.set(null);
    this.creating.set(false);
  }

  submitNewGuest(): void {
    if (!this.canCreateGuest() || this.creating()) return;
    this.creating.set(true);
    this.createError.set(null);

    this.guestSvc.create({
      firstName: this.newFirstName().trim(),
      lastName:  this.newLastName().trim(),
      email:     this.newEmail().trim(),
      phone:     this.newPhone().trim(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (g) => {
          this.creating.set(false);
          this.showCreateForm.set(false);
          // Reset fields after a successful save
          this.newFirstName.set('');
          this.newLastName.set('');
          this.newEmail.set('');
          this.newPhone.set('');
          this.selectGuest(g);
        },
        error: () => {
          this.creating.set(false);
          this.createError.set('Could not save guest. Please try again.');
        },
      });
  }

  initials(g: Guest): string {
    return `${g.firstName[0] ?? ''}${g.lastName[0] ?? ''}`.toUpperCase();
  }

  onConfirm(): void {
    const guest = this.selectedGuest();
    const plan  = this.selectedPlan();
    if (!guest || !plan) return;

    const charge = this.totalRoomCharge();
    const tax    = charge * 0.12;

    this.confirm.emit({
      roomId:           this.roomId(),
      roomTypeId:       this.roomTypeId(),
      checkIn:          this.checkIn(),
      checkOut:         this.checkOut(),
      nights:           this.nights(),
      guestId:          guest.id,
      adults:           this.adults(),
      children:         this.children(),
      ratePlanId:       plan.id,
      totalRoomCharge:  charge,
      totalTax:         tax,
      totalAmount:      charge + tax,
      totalPaid:        0,
      totalExtras:      0,
      balance:          charge + tax,
      status:           ReservationStatus.Confirmed,
      source:           BookingSource.Direct,
      specialRequests:  this.specialRequests() || undefined,
    });
  }
}
