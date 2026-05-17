import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';

import {
  RESERVATION_SERVICE, ROOM_SERVICE, GUEST_SERVICE,
} from '../../data/services/service-tokens';
import {
  Reservation, Room, RoomType, Guest, Folio, FolioItem,
} from '../../domain';
import {
  ReservationStatus, PaymentMethod, BookingSource,
} from '../../domain/enums';

import { CheckInWizardComponent }  from './check-in-wizard/check-in-wizard.component';
import { CheckOutWizardComponent } from './check-out-wizard/check-out-wizard.component';

type Tab = 'overview' | 'folio' | 'notes' | 'documents';

interface AttachedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;     // base64 preview (no real storage)
  uploadedAt: Date;
}

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

@Component({
  selector: 'lux-reservation-detail-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe, CurrencyPipe, RouterLink,
    CheckInWizardComponent, CheckOutWizardComponent,
  ],
  templateUrl: './reservation-detail.page.html',
  styleUrl: './reservation-detail.page.scss',
})
export class ReservationDetailPageComponent implements OnInit {
  private resSvc     = inject(RESERVATION_SERVICE);
  private roomSvc    = inject(ROOM_SERVICE);
  private guestSvc   = inject(GUEST_SERVICE);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly PaymentMethod = PaymentMethod;
  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'folio',     label: 'Folio' },
    { id: 'notes',     label: 'Notes' },
    { id: 'documents', label: 'Documents' },
  ];

  loading       = signal(true);
  reservation   = signal<Reservation | null>(null);
  guest         = signal<Guest | null>(null);
  room          = signal<Room | null>(null);
  rooms         = signal<Room[]>([]);
  roomType      = signal<RoomType | null>(null);
  folio         = signal<Folio | null>(null);
  documents     = signal<AttachedDoc[]>([]);

  activeTab     = signal<Tab>('overview');

  // Notes editing
  specialRequestsDraft = signal('');
  internalNotesDraft   = signal('');
  savingNotes          = signal(false);

  // Folio inline forms
  showChargeForm  = signal(false);
  showPaymentForm = signal(false);
  newCharge = { category: 'misc' as 'food' | 'minibar' | 'service' | 'misc' | 'tax' | 'room', description: '', quantity: 1, unitPrice: 0 };
  newPayment = { amount: 0, method: PaymentMethod.Card as string, reference: '' };

  // Wizards
  showCheckInWizard  = signal(false);
  showCheckOutWizard = signal(false);

  notesDirty = computed(() => {
    const r = this.reservation();
    if (!r) return false;
    return (r.specialRequests ?? '') !== this.specialRequestsDraft() ||
           (r.internalNotes  ?? '') !== this.internalNotesDraft();
  });

  initials = computed(() => {
    const g = this.guest();
    return g ? `${g.firstName[0] ?? ''}${g.lastName[0] ?? ''}`.toUpperCase() : '?';
  });

  canCheckIn  = computed(() => this.reservation()?.status === ReservationStatus.Confirmed
                              || this.reservation()?.status === ReservationStatus.Pending);
  canCheckOut = computed(() => this.reservation()?.status === ReservationStatus.CheckedIn);
  canCancel   = computed(() => {
    const s = this.reservation()?.status;
    return s === ReservationStatus.Pending || s === ReservationStatus.Confirmed;
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(params => {
        const id = params.get('id');
        if (!id) return of(null);
        return this.resSvc.getById(id);
      }),
    ).subscribe(r => {
      if (!r) {
        this.reservation.set(null);
        this.loading.set(false);
        return;
      }
      this.reservation.set(r);
      this.specialRequestsDraft.set(r.specialRequests ?? '');
      this.internalNotesDraft.set(r.internalNotes ?? '');
      this.loadRelated(r);
    });
  }

  private loadRelated(r: Reservation): void {
    forkJoin({
      guest:  this.guestSvc.getById(r.guestId),
      room:   r.roomId ? this.roomSvc.getById(r.roomId) : of(null),
      rooms:  this.roomSvc.list(r.propertyId),
      types:  this.roomSvc.listTypes(r.propertyId),
      folio:  this.resSvc.getFolio(r.id),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ guest, room, rooms, types, folio }) => {
      this.guest.set(guest ?? null);
      this.room.set(room ?? null);
      this.rooms.set(rooms);
      this.roomType.set(types.find(t => t.id === r.roomTypeId) ?? null);
      this.folio.set(folio ?? null);
      this.loading.set(false);
    });
  }

  meta(s: ReservationStatus) { return STATUS_META[s]; }
  srcLabel(s: string): string { return SOURCE_LABELS[s] ?? s; }
  typeName(): string { return this.roomType()?.name ?? '—'; }

  payMethodLabel(m: string): string {
    switch (m) {
      case PaymentMethod.Card:         return 'Card';
      case PaymentMethod.Cash:         return 'Cash';
      case PaymentMethod.BankTransfer: return 'Bank transfer';
      case PaymentMethod.Voucher:      return 'Voucher';
      default: return m;
    }
  }

  /* ---------- Wizards ---------- */
  openCheckIn():  void { this.showCheckInWizard.set(true); }
  openCheckOut(): void { this.showCheckOutWizard.set(true); }

  onCheckedIn(updated: Reservation): void {
    this.reservation.set(updated);
    this.showCheckInWizard.set(false);
    // Refresh room reference + folio
    if (updated.roomId) this.roomSvc.getById(updated.roomId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(room => this.room.set(room ?? null));
    this.resSvc.getFolio(updated.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(f => this.folio.set(f ?? null));
  }

  onCheckedOut(updated: Reservation): void {
    this.reservation.set(updated);
    this.showCheckOutWizard.set(false);
    this.resSvc.getFolio(updated.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(f => this.folio.set(f ?? null));
  }

  /* ---------- Cancel ---------- */
  cancelReservation(): void {
    const r = this.reservation();
    if (!r) return;
    const reason = prompt('Cancellation reason:');
    if (!reason) return;
    this.resSvc.cancel(r.id, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => this.reservation.set(updated));
  }

  /* ---------- Notes ---------- */
  saveNotes(): void {
    const r = this.reservation();
    if (!r || this.savingNotes()) return;
    this.savingNotes.set(true);
    this.resSvc.update(r.id, {
      specialRequests: this.specialRequestsDraft().trim() || undefined,
      internalNotes:   this.internalNotesDraft().trim() || undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.reservation.set(updated);
        this.savingNotes.set(false);
      },
      error: () => this.savingNotes.set(false),
    });
  }
  resetNotes(): void {
    const r = this.reservation();
    if (!r) return;
    this.specialRequestsDraft.set(r.specialRequests ?? '');
    this.internalNotesDraft.set(r.internalNotes ?? '');
  }

  /* ---------- Folio inline operations ---------- */
  canPostCharge(): boolean {
    return this.newCharge.description.trim().length > 0 &&
           this.newCharge.unitPrice > 0 &&
           this.newCharge.quantity > 0;
  }
  postCharge(): void {
    const r = this.reservation();
    if (!r || !this.canPostCharge()) return;
    const q = this.newCharge.quantity;
    const u = this.newCharge.unitPrice;
    this.resSvc.postFolioItem(r.id, {
      description: this.newCharge.description.trim(),
      category: this.newCharge.category as FolioItem['category'],
      quantity: q,
      unitPrice: u,
      amount: q * u,
      date: new Date(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(updated => {
      this.folio.set(updated);
      // Refresh reservation totals
      this.resSvc.getById(r.id).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(refreshed => refreshed && this.reservation.set(refreshed));
      this.newCharge = { category: 'misc', description: '', quantity: 1, unitPrice: 0 };
      this.showChargeForm.set(false);
    });
  }

  canRecordPayment(): boolean { return this.newPayment.amount > 0; }
  recordPayment(): void {
    const r = this.reservation();
    if (!r || !this.canRecordPayment()) return;
    this.resSvc.recordPayment(r.id, {
      amount: this.newPayment.amount,
      method: this.newPayment.method as PaymentMethod,
      reference: this.newPayment.reference.trim() || undefined,
      date: new Date(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(updated => {
      this.folio.set(updated);
      this.resSvc.getById(r.id).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(refreshed => refreshed && this.reservation.set(refreshed));
      this.newPayment = { amount: 0, method: PaymentMethod.Card, reference: '' };
      this.showPaymentForm.set(false);
    });
  }

  /* ---------- Documents ---------- */
  onFiles(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    files.forEach(f => this.readFile(f));
    input.value = '';
  }
  private readFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const doc: AttachedDoc = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: reader.result as string,
        uploadedAt: new Date(),
      };
      this.documents.update(list => [doc, ...list]);
    };
    reader.readAsDataURL(file);
  }
  removeDoc(id: string): void {
    this.documents.update(list => list.filter(d => d.id !== id));
  }
  formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }
}
