import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import {
  MAINTENANCE_SERVICE, ROOM_SERVICE, STAFF_SERVICE,
} from '../data/services/service-tokens';
import { PropertyContextService } from '../core/config/property-context.service';
import { MaintenanceRequest, Room, Staff } from '../domain';
import { MaintenancePriority, MaintenanceStatus, Role } from '../domain/enums';

/* ── column meta ─────────────────────────────────────────── */
const COLUMNS: { status: MaintenanceStatus; label: string; color: string; bg: string; icon: string }[] = [
  { status: MaintenanceStatus.Open,       label: 'Open',        color: '#DC2626', bg: '#FEE2E2', icon: 'error_outline'    },
  { status: MaintenanceStatus.Assigned,   label: 'Assigned',    color: '#D97706', bg: '#FEF3C7', icon: 'person'           },
  { status: MaintenanceStatus.InProgress, label: 'In Progress', color: '#2563EB', bg: '#DBEAFE', icon: 'build'            },
  { status: MaintenanceStatus.Resolved,   label: 'Resolved',    color: '#16A34A', bg: '#DCFCE7', icon: 'check_circle'     },
];

const PRIORITY_META: Record<MaintenancePriority, { label: string; color: string; bg: string; order: number }> = {
  [MaintenancePriority.Urgent]: { label: 'Urgent', color: '#DC2626', bg: '#FEE2E2', order: 0 },
  [MaintenancePriority.High]:   { label: 'High',   color: '#D97706', bg: '#FEF3C7', order: 1 },
  [MaintenancePriority.Medium]: { label: 'Medium', color: '#2563EB', bg: '#DBEAFE', order: 2 },
  [MaintenancePriority.Low]:    { label: 'Low',    color: '#6B7280', bg: '#F1EDE7', order: 3 },
};

const CATEGORIES = [
  { value: 'plumbing',    label: 'Plumbing',     icon: '🚿' },
  { value: 'electrical',  label: 'Electrical',   icon: '⚡' },
  { value: 'hvac',        label: 'HVAC',         icon: '🌡️' },
  { value: 'furniture',   label: 'Furniture',    icon: '🪑' },
  { value: 'appliance',   label: 'Appliance',    icon: '📺' },
  { value: 'other',       label: 'Other',        icon: '🔧' },
];

type ViewMode = 'kanban' | 'list';

@Component({
  selector: 'lux-maintenance-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './maintenance.page.html',
  styleUrl: './maintenance.page.scss',
})
export class MaintenancePageComponent implements OnInit {
  private mntSvc  = inject(MAINTENANCE_SERVICE);
  private roomSvc = inject(ROOM_SERVICE);
  private staffSvc = inject(STAFF_SERVICE);
  readonly propertyCtx = inject(PropertyContextService);
  private destroyRef   = inject(DestroyRef);

  readonly MntStatus    = MaintenanceStatus;
  readonly PRIORITY_META = PRIORITY_META;
  readonly columns      = COLUMNS;
  readonly categories   = CATEGORIES;
  readonly priorities   = [
    { value: MaintenancePriority.Urgent, label: 'Urgent', color: '#DC2626', bg: '#FEE2E2' },
    { value: MaintenancePriority.High,   label: 'High',   color: '#D97706', bg: '#FEF3C7' },
    { value: MaintenancePriority.Medium, label: 'Medium', color: '#2563EB', bg: '#DBEAFE' },
    { value: MaintenancePriority.Low,    label: 'Low',    color: '#6B7280', bg: '#F1EDE7' },
  ];

  loading      = signal(true);
  requests     = signal<MaintenanceRequest[]>([]);
  rooms        = signal<Room[]>([]);
  staffList    = signal<Staff[]>([]);
  selectedReq  = signal<MaintenanceRequest | null>(null);
  showNewForm  = signal(false);
  actionBusy   = signal(false);
  view         = signal<ViewMode>('kanban');
  statusFilter = signal<MaintenanceStatus | null>(null);

  /* filters – must be signals so computed() can track changes */
  search          = signal('');
  filterPriority  = signal('');
  filterCategory  = signal('');
  resolutionDraft = '';

  /* new form state */
  newTitle      = '';
  newDescription = '';
  newCategory   = 'other';
  newPriority   = MaintenancePriority.Medium;
  newRoomId     = '';
  newLocation   = '';
  newAssignedTo = '';

  techStaff = computed(() =>
    this.staffList().filter(s => s.role === Role.Admin || s.role === Role.Manager || s.role === Role.Housekeeper)
  );

  visibleColumns = computed(() =>
    this.statusFilter() ? COLUMNS.filter(c => c.status === this.statusFilter()) : COLUMNS
  );

  filteredList = computed(() => {
    let list = this.requests();
    const q   = this.search().trim();
    const pri = this.filterPriority();
    const cat = this.filterCategory();
    if (q)   list = list.filter(r => r.title.toLowerCase().includes(q.toLowerCase()));
    if (pri) list = list.filter(r => r.priority === pri);
    if (cat) list = list.filter(r => r.category === cat);
    if (this.statusFilter()) list = list.filter(r => r.status === this.statusFilter());
    // sort: urgent first
    return list.sort((a, b) => (PRIORITY_META[a.priority]?.order ?? 9) - (PRIORITY_META[b.priority]?.order ?? 9));
  });

  ngOnInit(): void {
    const propId = this.propertyCtx.activeId();
    if (!propId) return;
    forkJoin([
      this.mntSvc.list(propId),
      this.roomSvc.list(propId),
      this.staffSvc.list(propId),
    ]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([reqs, rooms, staff]) => {
      this.requests.set(reqs);
      this.rooms.set(rooms);
      this.staffList.set(staff);
      this.loading.set(false);
    });
  }

  /* helpers */
  roomNumber(roomId: string): string { return this.rooms().find(r => r.id === roomId)?.number ?? roomId; }
  staffName(id: string | undefined): string {
    if (!id) return '—';
    const s = this.staffList().find(x => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : id;
  }
  staffInitials(id: string | undefined): string {
    if (!id) return '?';
    const s = this.staffList().find(x => x.id === id);
    return s ? `${s.firstName[0]}${s.lastName[0]}` : '?';
  }
  catIcon(cat: string): string { return CATEGORIES.find(c => c.value === cat)?.icon ?? '🔧'; }
  catLabel(cat: string): string { return CATEGORIES.find(c => c.value === cat)?.label ?? cat; }
  statusLabel(s: MaintenanceStatus): string { return COLUMNS.find(c => c.status === s)?.label ?? s; }
  countByStatus(status: MaintenanceStatus): number { return this.requests().filter(r => r.status === status).length; }
  countByPriority(p: string): number { return this.requests().filter(r => r.priority === p).length; }
  filteredByCol(status: MaintenanceStatus): MaintenanceRequest[] {
    return this.filteredList().filter(r => r.status === status);
  }
  isStatusDone(status: MaintenanceStatus): boolean {
    const order = [MaintenanceStatus.Open, MaintenanceStatus.Assigned, MaintenanceStatus.InProgress, MaintenanceStatus.Resolved];
    const cur = this.selectedReq()?.status;
    if (!cur) return false;
    return order.indexOf(status) < order.indexOf(cur);
  }

  /* interactions */
  toggleStatus(status: MaintenanceStatus): void {
    this.statusFilter.set(this.statusFilter() === status ? null : status);
  }
  selectReq(req: MaintenanceRequest): void {
    this.selectedReq.set(req);
    this.resolutionDraft = req.resolutionNotes ?? '';
  }
  closeDrawer(): void { this.selectedReq.set(null); }
  openNewForm(): void { this.showNewForm.set(true); this.selectedReq.set(null); }
  closeNewForm(): void { this.showNewForm.set(false); }

  changeStatus(status: MaintenanceStatus): void {
    const req = this.selectedReq();
    if (!req) return;
    this.actionBusy.set(true);
    this.mntSvc.updateStatus(req.id, status, undefined, undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => {
        this.patchReq(updated);
        this.actionBusy.set(false);
      });
  }

  changePriority(priority: MaintenancePriority): void {
    const req = this.selectedReq();
    if (!req) return;
    // local patch only (no service method for priority update — future enhancement)
    const updated = { ...req, priority };
    this.requests.update(list => list.map(r => r.id === req.id ? updated : r));
    this.selectedReq.set(updated);
  }

  assignStaff(staffId: string): void {
    const req = this.selectedReq();
    if (!req) return;
    const newStatus = req.status === MaintenanceStatus.Open ? MaintenanceStatus.Assigned : req.status;
    this.actionBusy.set(true);
    this.mntSvc.updateStatus(req.id, newStatus, staffId, undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => {
        this.patchReq(updated);
        this.actionBusy.set(false);
      });
  }

  saveResolution(): void {
    const req = this.selectedReq();
    if (!req) return;
    this.actionBusy.set(true);
    this.mntSvc.updateStatus(req.id, req.status, undefined, this.resolutionDraft)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => {
        this.patchReq(updated);
        this.actionBusy.set(false);
      });
  }

  submitNew(): void {
    const propId = this.propertyCtx.activeId();
    if (!propId || !this.newTitle.trim()) return;
    this.actionBusy.set(true);
    this.mntSvc.create({
      propertyId: propId,
      title: this.newTitle.trim(),
      description: this.newDescription.trim(),
      category: this.newCategory as any,
      priority: this.newPriority,
      roomId: this.newRoomId || undefined,
      location: !this.newRoomId && this.newLocation ? this.newLocation : undefined,
      assignedTo: this.newAssignedTo || undefined,
      reportedBy: 'current-user',
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(created => {
      this.requests.update(list => [created, ...list]);
      this.actionBusy.set(false);
      this.closeNewForm();
      this.resetNewForm();
    });
  }

  private patchReq(updated: MaintenanceRequest): void {
    this.requests.update(list => list.map(r => r.id === updated.id ? updated : r));
    this.selectedReq.set(updated);
  }
  private resetNewForm(): void {
    this.newTitle = ''; this.newDescription = ''; this.newCategory = 'other';
    this.newPriority = MaintenancePriority.Medium; this.newRoomId = '';
    this.newLocation = ''; this.newAssignedTo = '';
  }
}
