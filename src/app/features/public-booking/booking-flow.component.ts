import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ToastService } from '../../core/ui/toast.service';
import { BookingBroadcastService } from '../../core/realtime/booking-broadcast.service';
import {
  GUEST_SERVICE, PROPERTY_SERVICE, RESERVATION_SERVICE, ROOM_SERVICE,
} from '../../data/services/service-tokens';
import { Property, RoomType, BookingSource } from '../../domain';

const FEATURED_PROPERTY_ID = 'prop-1';

const ROOM_IMAGES: Record<string, string> = {
  STD:  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=80',
  DLX:  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&q=80',
  STE:  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=900&q=80',
  EXC:  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900&q=80',
  PRES: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&q=80',
};
const ROOM_FALLBACK = 'https://images.unsplash.com/photo-1590490359683-658d3d23f972?w=900&q=80';

type Step = 'dates' | 'room' | 'guest' | 'payment' | 'confirmation';

const STEP_ORDER: Step[] = ['dates', 'room', 'guest', 'payment', 'confirmation'];
const STEP_LABELS: Record<Step, { num: number; label: string }> = {
  dates:        { num: 1, label: 'Dates & guests' },
  room:         { num: 2, label: 'Choose room' },
  guest:        { num: 3, label: 'Your details' },
  payment:      { num: 4, label: 'Payment' },
  confirmation: { num: 5, label: 'Confirmation' },
};

interface ConfirmationView {
  confirmationNumber: string;
  roomTypeName: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guestName: string;
  email: string;
  totalAmount: number;
}

@Component({
  selector: 'lux-booking-flow',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatIconModule, MatButtonModule,
    SkeletonComponent, EmptyStateComponent,
  ],
  templateUrl: './booking-flow.component.html',
  styleUrl: './booking-flow.component.scss',
})
export class BookingFlowComponent {
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private propSvc     = inject(PROPERTY_SERVICE);
  private roomSvc     = inject(ROOM_SERVICE);
  private resSvc      = inject(RESERVATION_SERVICE);
  private guestSvc    = inject(GUEST_SERVICE);
  private toast       = inject(ToastService);
  private broadcast   = inject(BookingBroadcastService);

  stepLabels = STEP_LABELS;
  stepsList  = STEP_ORDER;

  step             = signal<Step>('dates');
  property         = signal<Property | undefined>(undefined);
  availableRooms   = signal<RoomType[]>([]);
  loadingRooms     = signal(false);
  submitting       = signal(false);
  submitError      = signal<string | null>(null);
  touched          = signal(false);
  paymentTouched   = signal(false);
  confirmation     = signal<ConfirmationView | null>(null);

  /* Step 1 inputs */
  todayIso = new Date().toISOString().slice(0, 10);
  checkIn  = this.todayIso;
  checkOut = this.tomorrow(this.todayIso);
  adults   = 2;
  children = 0;

  /* Step 2 */
  selectedRoomTypeId = signal<string | null>(null);

  /* Step 3 */
  firstName       = '';
  lastName        = '';
  email           = '';
  phone           = '';
  country         = '';
  specialRequests = '';

  /* Step 4 — local-only display state, never sent anywhere */
  cardName    = '';
  cardNumber  = signal('');
  cardExpiry  = signal('');
  cardCvc     = '';
  termsAccepted = false;

  /* ─────── derived ─────── */
  checkInDate  = computed(() => new Date(this.checkIn));
  checkOutDate = computed(() => new Date(this.checkOut));
  minCheckoutIso = computed(() => this.tomorrow(this.checkIn));
  nights = computed(() => {
    const ms = this.checkOutDate().getTime() - this.checkInDate().getTime();
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  });
  totalGuests = computed(() => this.adults + this.children);
  dateError = computed(() => {
    if (this.nights() <= 0) return 'Check-out must be after check-in.';
    if (this.checkInDate() < new Date(this.todayIso)) return 'Check-in cannot be in the past.';
    return null;
  });
  selectedRoomType = computed(() =>
    this.availableRooms().find(r => r.id === this.selectedRoomTypeId()) ?? null);
  subtotal = computed(() => {
    const rt = this.selectedRoomType();
    return rt ? rt.basePrice * this.nights() : 0;
  });
  tax    = computed(() => Math.round(this.subtotal() * 0.18));
  total  = computed(() => this.subtotal() + this.tax());

  /* Plain methods rather than computed() — these depend on non-signal
     ngModel-bound string fields (firstName, lastName, email), and a
     computed() wouldn't track them. The template re-evaluates these
     each change-detection cycle, which is what we want. */
  validEmail(): boolean {
    return /\S+@\S+\.\S+/.test(this.email);
  }
  canContinueGuestStep(): boolean {
    return !!this.firstName.trim() &&
           !!this.lastName.trim() &&
           this.validEmail();
  }

  validCardNumber(): boolean {
    return this.cardNumber().replace(/\s/g, '').length === 16;
  }
  validExpiry(): boolean {
    return /^(0[1-9]|1[0-2])\/\d{2}$/.test(this.cardExpiry());
  }
  validCvc(): boolean {
    return /^\d{3,4}$/.test(this.cardCvc.trim());
  }
  canSubmitPayment(): boolean {
    return !!this.cardName.trim() &&
           this.validCardNumber() &&
           this.validExpiry() &&
           this.validCvc() &&
           this.termsAccepted;
  }

  constructor() {
    this.propSvc.getById(FEATURED_PROPERTY_ID).subscribe(p => this.property.set(p));

    // Seed inputs from query params (deep link from hero)
    this.route.queryParams.subscribe(q => {
      if (q['checkIn'])   this.checkIn  = q['checkIn'];
      if (q['checkOut'])  this.checkOut = q['checkOut'];
      if (q['guests'])    this.adults   = Number(q['guests']);
      if (q['roomType']) {
        // pre-select the room type; we'll resolve it once rooms load
        this.preselectRoomTypeId = q['roomType'];
        this.step.set('room');
        this.loadAvailableRooms();
      }
    });

    // Clamp checkout to be > checkIn whenever checkIn moves
    effect(() => {
      const min = this.minCheckoutIso();
      if (this.checkOut < min) this.checkOut = min;
    });
  }

  private preselectRoomTypeId: string | null = null;

  /* ─────── navigation ─────── */
  isDone(s: Step): boolean {
    return STEP_ORDER.indexOf(s) < STEP_ORDER.indexOf(this.step());
  }

  goNext(): void {
    const current = this.step();
    if (current === 'dates') {
      if (this.dateError()) return;
      this.step.set('room');
      this.loadAvailableRooms();
      this.scrollToTop();
      return;
    }
    if (current === 'room') {
      if (!this.selectedRoomTypeId()) return;
      this.step.set('guest');
      this.scrollToTop();
      return;
    }
    if (current === 'guest') {
      this.touched.set(true);
      if (!this.canContinueGuestStep()) return;
      this.step.set('payment');
      this.scrollToTop();
      return;
    }
  }

  goBack(): void {
    const order = STEP_ORDER;
    const idx = order.indexOf(this.step());
    if (idx > 0) {
      this.step.set(order[idx - 1]);
      this.scrollToTop();
    }
  }

  loadAvailableRooms(): void {
    this.loadingRooms.set(true);
    this.roomSvc.listTypes(FEATURED_PROPERTY_ID).subscribe({
      next: types => {
        // Filter by occupancy capability
        const filtered = types.filter(t => t.maxOccupancy >= this.totalGuests());
        this.availableRooms.set(filtered);
        if (this.preselectRoomTypeId &&
            filtered.some(t => t.id === this.preselectRoomTypeId)) {
          this.selectedRoomTypeId.set(this.preselectRoomTypeId);
          this.preselectRoomTypeId = null;
        }
        this.loadingRooms.set(false);
      },
      error: () => {
        this.toast.error('Could not load rooms', 'Please retry in a moment.');
        this.loadingRooms.set(false);
      },
    });
  }

  /* ─────── card input formatters ─────── */
  onCardChange(raw: string): void {
    const digits = (raw ?? '').replace(/\D/g, '').slice(0, 16);
    const grouped = digits.match(/.{1,4}/g)?.join(' ') ?? '';
    this.cardNumber.set(grouped);
  }
  onExpiryChange(raw: string): void {
    const digits = (raw ?? '').replace(/\D/g, '').slice(0, 4);
    const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    this.cardExpiry.set(formatted);
  }

  /* ─────── submission ─────── */
  imageFor(rt: RoomType): string {
    return ROOM_IMAGES[rt.code] ?? rt.photoUrl ?? ROOM_FALLBACK;
  }

  submitBooking(): void {
    this.paymentTouched.set(true);
    if (!this.canSubmitPayment()) return;
    const rt = this.selectedRoomType();
    if (!rt) return;

    this.submitting.set(true);
    this.submitError.set(null);

    // 1. Create the guest record (mock create)
    this.guestSvc.create({
      firstName: this.firstName.trim(),
      lastName:  this.lastName.trim(),
      email:     this.email.trim(),
      phone:     this.phone.trim(),
      nationality: this.country.trim() || 'Unknown',
      isVip: false,
      loyaltyPoints: 0,
      totalStays: 0,
      totalSpent: 0,
      tags: [],
      preferences: { smokingPreference: false, dietary: [] },
    }).subscribe({
      next: guest => {
        // 2. Create the reservation
        this.resSvc.create({
          propertyId: FEATURED_PROPERTY_ID,
          guestId:    guest.id,
          roomTypeId: rt.id,
          ratePlanId: 'bar',
          checkIn:    this.checkInDate(),
          checkOut:   this.checkOutDate(),
          nights:     this.nights(),
          adults:     this.adults,
          children:   this.children,
          source:     BookingSource.Direct,
          totalRoomCharge: this.subtotal(),
          totalTax:   this.tax(),
          specialRequests: this.specialRequests.trim() || undefined,
        }).subscribe({
          next: res => {
            const view: ConfirmationView = {
              confirmationNumber: res.confirmationNumber,
              roomTypeName: rt.name,
              checkIn:   res.checkIn,
              checkOut:  res.checkOut,
              nights:    res.nights,
              guestName: `${guest.firstName} ${guest.lastName}`,
              email:     guest.email,
              totalAmount: res.totalAmount,
            };
            this.confirmation.set(view);

            // Broadcast to admin dashboard — same tab via signal, other tabs via BroadcastChannel.
            this.broadcast.publish({
              type: 'booking.created',
              reservationId: res.id,
              confirmationNumber: res.confirmationNumber,
              propertyId: res.propertyId,
              guestName: view.guestName,
              roomTypeName: rt.name,
              checkIn:  res.checkIn.toISOString(),
              checkOut: res.checkOut.toISOString(),
              totalAmount: res.totalAmount,
              at: new Date().toISOString(),
            });

            this.submitting.set(false);
            this.step.set('confirmation');
            this.scrollToTop();
          },
          error: () => this.failSubmit(),
        });
      },
      error: () => this.failSubmit(),
    });
  }

  private failSubmit(): void {
    this.submitting.set(false);
    this.submitError.set('Something went wrong creating your booking. Please try again.');
  }

  startNew(): void {
    this.step.set('dates');
    this.selectedRoomTypeId.set(null);
    this.confirmation.set(null);
    this.firstName = this.lastName = this.email = this.phone = this.country = '';
    this.specialRequests = '';
    this.cardName = this.cardCvc = '';
    this.cardNumber.set('');
    this.cardExpiry.set('');
    this.termsAccepted = false;
    this.touched.set(false);
    this.scrollToTop();
  }

  private scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private tomorrow(iso: string): string {
    const d = new Date(iso);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
}