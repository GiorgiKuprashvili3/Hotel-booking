import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import {
  CONCIERGE_SERVICE, GUEST_SERVICE, STAFF_SERVICE, RESERVATION_SERVICE,
} from '../data/services/service-tokens';
import { PropertyContextService } from '../core/config/property-context.service';
import { ConciergeRequest, Guest, Staff, Reservation } from '../domain';
import { ConciergeStatus } from '../domain/enums';

/* ── column meta ─────────────────────────────────────────── */
const COLUMNS: { status: ConciergeStatus; label: string; color: string; bg: string; icon: string }[] = [
  { status: ConciergeStatus.New,        label: 'New',         color: '#7C3AED', bg: '#EDE9FE', icon: 'fiber_new'      },
  { status: ConciergeStatus.InProgress, label: 'In Progress', color: '#2563EB', bg: '#DBEAFE', icon: 'sync'           },
  { status: ConciergeStatus.Completed,  label: 'Completed',   color: '#16A34A', bg: '#DCFCE7', icon: 'check_circle'   },
  { status: ConciergeStatus.Cancelled,  label: 'Cancelled',   color: '#6B7280', bg: '#F3F4F6', icon: 'cancel'         },
];

/* ── request types ───────────────────────────────────────── */
const REQUEST_TYPES = [
  { value: 'extra_towels',      label: 'Extra Towels',      icon: '🛁' },
  { value: 'room_service',      label: 'Room Service',      icon: '🍽️' },
  { value: 'taxi',              label: 'Taxi / Transfer',   icon: '🚖' },
  { value: 'wake_up_call',      label: 'Wake-up Call',      icon: '⏰' },
  { value: 'spa_booking',       label: 'Spa Booking',       icon: '💆' },
  { value: 'spa',               label: 'Spa',               icon: '💆' },
  { value: 'restaurant',        label: 'Restaurant',        icon: '🍴' },
  { value: 'transportation',    label: 'Transportation',    icon: '🚗' },
  { value: 'airport_transfer',  label: 'Airport Transfer',  icon: '✈️' },
  { value: 'tour',              label: 'Tour / Activity',   icon: '🗺️' },
  { value: 'laundry',           label: 'Laundry',           icon: '👔' },
  { value: 'extra_amenity',     label: 'Extra Amenity',     icon: '🎁' },
  { value: 'other',             label: 'Other',             icon: '💬' },
];

/* ── SLA thresholds (minutes) ───────────────────────────── */
const SLA_MINUTES: Record<string, number> = {
  taxi: 15, airport_transfer: 20, wake_up_call: 5,
  room_service: 30, spa_booking: 60, spa: 60, restaurant: 60,
  transportation: 20, tour: 120, laundry: 240,
  extra_towels: 20, extra_amenity: 30, other: 60,
};

type ViewMode = 'kanban' | 'list';

@Component({
  selector: 'lux-concierge-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './concierge.page.html',
  styleUrl: './concierge.page.scss',
})
export class ConciergePageComponent implements OnInit {
  private conSvc       = inject(CONCIERGE_SERVICE);
  private guestSvc     = inject(GUEST_SERVICE);
  private staffSvc     = inject(STAFF_SERVICE);
  private resSvc       = inject(RESERVATION_SERVICE);
  readonly propertyCtx = inject(PropertyContextService);
  private destroyRef   = inject(DestroyRef);

  readonly ConStatus    = ConciergeStatus;
  readonly columns      = COLUMNS;
  readonly REQUEST_TYPES = REQUEST_TYPES;
  readonly SLA_MINUTES  = SLA_MINUTES;

  loading      = signal(true);
  requests     = signal<ConciergeRequest[]>([]);
  guests       = signal<Guest[]>([]);
  staffList    = signal<Staff[]>([]);
  reservations = signal<Reservation[]>([]);
  selectedReq  = signal<ConciergeRequest | null>(null);
  showNewForm  = signal(false);
  actionBusy   = signal(false);
  view         = signal<ViewMode>('kanban');
  statusFilter = signal<ConciergeStatus | null>(null);

  search     = signal('');
  filterType = signal('');

  /* new form state */
  newType          = 'other';
  newReservationId = '';
  newGuestId       = '';
  newRoomId        = '';
  newDetails       = '';
  newScheduledFor  = '';
  newAssignedTo    = '';

  activeReservations = computed(() =>
    this.reservations().filter(r => r.status === 'checked_in' || r.status === 'confirmed')
  );

  uniqueTypes = computed(() => {
    const used = new Set(this.requests().map(r => r.type as string));
    return REQUEST_TYPES.filter(t => used.has(t.value));
  });

  visibleColumns = computed(() =>
    this.statusFilter() ? COLUMNS.filter(c => c.status === this.statusFilter()) : COLUMNS
  );

  filteredList = computed(() => {
    let list = this.requests();
    const q   = this.search().trim().toLowerCase();
    const typ = this.filterType();
    if (q)   list = list.filter(r =>
      this.guestName(r.guestId).toLowerCase().includes(q) ||
      r.details.toLowerCase().includes(q)
    );
    if (typ) list = list.filter(r => (r.type as string) === typ);
    if (this.statusFilter()) list = list.filter(r => r.status === this.statusFilter());
    return list.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  });

  ngOnInit(): void {
    const propId = this.propertyCtx.activeId();
    if (!propId) return;
    forkJoin([
      this.conSvc.list(propId),
      this.guestSvc.list(),
      this.staffSvc.list(propId),
      this.resSvc.list(propId),
    ]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([reqs, guests, staff, res]) => {
      this.requests.set(reqs);
      this.guests.set(guests);
      this.staffList.set(staff);
      this.reservations.set(res);
      this.loading.set(false);
    });
  }

  /* helpers */
  guestName(guestId: string): string {
    const g = this.guests().find(x => x.id === guestId);
    return g ? `${g.firstName} ${g.lastName}` : guestId;
  }
  guestInitials(guestId: string): string {
    const g = this.guests().find(x => x.id === guestId);
    return g ? `${g.firstName[0]}${g.lastName[0]}` : '?';
  }
  roomNumber(roomId: string | undefined): string {
    if (!roomId) return '—';
    return roomId.split('-').pop() ?? roomId;
  }
  staffName(id: string): string {
    const s = this.staffList().find(x => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : id;
  }
  staffInitials(id: string | undefined): string {
    if (!id) return '?';
    const s = this.staffList().find(x => x.id === id);
    return s ? `${s.firstName[0]}${s.lastName[0]}` : '?';
  }
  getSla(type: string): number { return (SLA_MINUTES as Record<string, number>)[type] ?? 60; }
  typeIcon(type: string): string { return REQUEST_TYPES.find(t => t.value === type)?.icon ?? '💬'; }
  typeLabel(type: string): string { return REQUEST_TYPES.find(t => t.value === type)?.label ?? type; }
  statusLabel(s: ConciergeStatus): string { return COLUMNS.find(c => c.status === s)?.label ?? s; }
  statusColor(s: ConciergeStatus): string { return COLUMNS.find(c => c.status === s)?.color ?? '#6B7280'; }
  statusBg(s: ConciergeStatus): string { return COLUMNS.find(c => c.status === s)?.bg ?? '#F3F4F6'; }
  countByStatus(status: ConciergeStatus): number { return this.requests().filter(r => r.status === status).length; }
  countOverdue(): number { return this.requests().filter(r => this.isOverdue(r)).length; }
  filteredByCol(status: ConciergeStatus): ConciergeRequest[] { return this.filteredList().filter(r => r.status === status); }

  isOverdue(req: ConciergeRequest): boolean {
    if (req.status === ConciergeStatus.Completed || req.status === ConciergeStatus.Cancelled) return false;
    const sla = SLA_MINUTES[req.type as string] ?? 60;
    const elapsed = (Date.now() - req.requestedAt.getTime()) / 60_000;
    return elapsed > sla;
  }
  slaRemaining(req: ConciergeRequest): string {
    const sla = SLA_MINUTES[req.type as string] ?? 60;
    const elapsed = (Date.now() - req.requestedAt.getTime()) / 60_000;
    const rem = Math.round(sla - elapsed);
    if (rem <= 0) return 'Overdue';
    if (rem < 60) return `${rem}m left`;
    return `${Math.round(rem / 60)}h left`;
  }

  /* interactions */
  toggleStatus(status: ConciergeStatus): void {
    this.statusFilter.set(this.statusFilter() === status ? null : status);
  }
  selectReq(req: ConciergeRequest): void { this.selectedReq.set(req); }
  closeDrawer(): void { this.selectedReq.set(null); }
  openNewForm(): void { this.showNewForm.set(true); this.selectedReq.set(null); }
  closeNewForm(): void { this.showNewForm.set(false); this.resetNewForm(); }

  onReservationChange(resId: string): void {
    const res = this.reservations().find(r => r.id === resId);
    if (res) { this.newGuestId = res.guestId; this.newRoomId = res.roomId ?? ''; }
  }

  changeStatus(status: ConciergeStatus): void {
    const req = this.selectedReq();
    if (!req) return;
    this.actionBusy.set(true);
    this.conSvc.updateStatus(req.id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => { this.patchReq(updated); this.actionBusy.set(false); });
  }

  assignStaff(staffId: string): void {
    const req = this.selectedReq();
    if (!req) return;
    const patched = { ...req, assignedTo: staffId || undefined };
    this.requests.update(list => list.map(r => r.id === req.id ? patched : r));
    this.selectedReq.set(patched);
    if (staffId && req.status === ConciergeStatus.New) {
      this.changeStatus(ConciergeStatus.InProgress);
    }
  }

  submitNew(): void {
    const propId = this.propertyCtx.activeId();
    if (!propId || !this.newType || !this.newReservationId || !this.newDetails.trim()) return;
    this.actionBusy.set(true);
    const created: ConciergeRequest = {
      id:            `con-local-${Date.now()}`,
      propertyId:    propId,
      reservationId: this.newReservationId,
      guestId:       this.newGuestId,
      roomId:        this.newRoomId || undefined,
      type:          this.newType as any,
      status:        ConciergeStatus.New,
      details:       this.newDetails.trim(),
      scheduledFor:  this.newScheduledFor ? new Date(this.newScheduledFor) : undefined,
      requestedAt:   new Date(),
      assignedTo:    this.newAssignedTo || undefined,
    };
    this.requests.update(list => [created, ...list]);
    this.actionBusy.set(false);
    this.closeNewForm();
  }

  private patchReq(updated: ConciergeRequest): void {
    this.requests.update(list => list.map(r => r.id === updated.id ? updated : r));
    this.selectedReq.set(updated);
  }
  private resetNewForm(): void {
    this.newType = 'other'; this.newReservationId = ''; this.newGuestId = '';
    this.newRoomId = ''; this.newDetails = ''; this.newScheduledFor = ''; this.newAssignedTo = '';
  }
}
