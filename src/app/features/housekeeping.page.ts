import {
  Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, interval } from 'rxjs';

import {
  HOUSEKEEPING_SERVICE, ROOM_SERVICE, STAFF_SERVICE,
} from '../data/services/service-tokens';
import { PropertyContextService } from '../core/config/property-context.service';
import { HousekeepingTask, Room, Staff } from '../domain';
import { HousekeepingStatus, Role } from '../domain/enums';

/* ── column meta ─────────────────────────────────────────── */
const COLUMNS: { status: HousekeepingStatus; label: string; color: string; bg: string; icon: string }[] = [
  { status: HousekeepingStatus.Dirty,      label: 'Dirty',       color: '#DC2626', bg: '#FEE2E2', icon: 'delete_sweep'       },
  { status: HousekeepingStatus.InProgress, label: 'In Progress', color: '#D97706', bg: '#FEF3C7', icon: 'cleaning_services'   },
  { status: HousekeepingStatus.Clean,      label: 'Clean',       color: '#16A34A', bg: '#DCFCE7', icon: 'check_circle'        },
  { status: HousekeepingStatus.Inspected,  label: 'Inspected',   color: '#2563EB', bg: '#DBEAFE', icon: 'verified'            },
];

const PRIORITY_META: Record<string, { label: string; color: string; dot: string }> = {
  high:   { label: 'High',   color: '#DC2626', dot: '#DC2626' },
  normal: { label: 'Normal', color: '#D97706', dot: '#D97706' },
  low:    { label: 'Low',    color: '#6B7280', dot: '#9CA3AF' },
};

@Component({
  selector: 'lux-housekeeping-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './housekeeping.page.html',
  styleUrl: './housekeeping.page.scss',
})
export class HousekeepingPageComponent implements OnInit, OnDestroy {
  private hkSvc    = inject(HOUSEKEEPING_SERVICE);
  private roomSvc  = inject(ROOM_SERVICE);
  private staffSvc = inject(STAFF_SERVICE);
  readonly propertyCtx = inject(PropertyContextService);
  private destroyRef   = inject(DestroyRef);

  readonly HkStatus   = HousekeepingStatus;
  readonly PRIORITY_META = PRIORITY_META;
  readonly columns    = COLUMNS;
  readonly today      = new Date();

  /* state */
  loading      = signal(true);
  tasks        = signal<HousekeepingTask[]>([]);
  rooms        = signal<Room[]>([]);
  staffList    = signal<Staff[]>([]);
  selectedTask = signal<HousekeepingTask | null>(null);
  actionBusy   = signal(false);
  colFilter    = signal<HousekeepingStatus | null>(null);
  mockPhotos   = signal<string[]>([]);
  notesDraft   = '';

  /* filters – must be signals so computed() can track changes */
  search          = signal('');
  filterAssignee  = signal('');
  filterPriority  = signal('');

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  tick = signal(0); // drives live timer recompute

  housekeepers = computed(() =>
    this.staffList().filter(s => s.role === Role.Housekeeper || s.role === Role.Manager)
  );

  /* computed: filtered columns */
  filteredTasks = computed(() => {
    let list = this.tasks();
    const q   = this.search().trim();
    const asg = this.filterAssignee();
    const pri = this.filterPriority();
    if (q)   list = list.filter(t => this.roomNumber(t.roomId).includes(q));
    if (asg) list = list.filter(t => t.assignedTo === asg);
    if (pri) list = list.filter(t => t.priority === pri);
    return list;
  });

  visibleColumns = computed(() =>
    this.colFilter() ? COLUMNS.filter(c => c.status === this.colFilter()) : COLUMNS
  );

  ngOnInit(): void {
    const propId = this.propertyCtx.activeId();
    if (!propId) return;

    forkJoin([
      this.hkSvc.listTasks(propId),
      this.roomSvc.list(propId),
      this.staffSvc.list(propId),
    ]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([tasks, rooms, staff]) => {
      this.tasks.set(tasks);
      this.rooms.set(rooms);
      this.staffList.set(staff);
      this.loading.set(false);
    });

    // tick every second for live timers
    this.timerInterval = setInterval(() => this.tick.update(n => n + 1), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  /* ── helpers ── */
  roomNumber(roomId: string): string {
    return this.rooms().find(r => r.id === roomId)?.number ?? roomId;
  }
  roomFloor(roomId: string): number | string {
    return this.rooms().find(r => r.id === roomId)?.floor ?? '?';
  }
  staffName(staffId: string | undefined): string {
    if (!staffId) return '';
    const s = this.staffList().find(x => x.id === staffId);
    return s ? `${s.firstName} ${s.lastName}` : staffId;
  }
  staffInitials(staffId: string | undefined): string {
    if (!staffId) return '?';
    const s = this.staffList().find(x => x.id === staffId);
    return s ? `${s.firstName[0]}${s.lastName[0]}` : '?';
  }
  countByStatus(status: HousekeepingStatus): number {
    return this.tasks().filter(t => t.status === status).length;
  }
  filteredByCol(status: HousekeepingStatus): HousekeepingTask[] {
    return this.filteredTasks().filter(t => t.status === status);
  }
  elapsedTime(task: HousekeepingTask): string {
    void this.tick(); // reactive dep
    if (!task.startedAt) return '0:00';
    const secs = Math.floor((Date.now() - new Date(task.startedAt).getTime()) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /* ── interactions ── */
  toggleColFilter(status: HousekeepingStatus): void {
    this.colFilter.set(this.colFilter() === status ? null : status);
  }

  selectTask(task: HousekeepingTask): void {
    this.selectedTask.set(task);
    this.notesDraft = task.notes ?? '';
    this.mockPhotos.set([]);
  }

  closeDrawer(): void {
    this.selectedTask.set(null);
  }

  changeStatus(status: HousekeepingStatus): void {
    const task = this.selectedTask();
    if (!task || task.status === status) return;
    if (status === HousekeepingStatus.InProgress) { this.startTask(); return; }
    if (status === HousekeepingStatus.Clean)       { this.completeTask(); return; }
    if (status === HousekeepingStatus.Inspected)   { this.inspectTask(); return; }
    // Dirty: just patch locally
    this.tasks.update(list => list.map(t => t.id === task.id ? { ...t, status } : t));
    this.selectedTask.update(t => t ? { ...t, status } : t);
  }

  assignStaff(staffId: string): void {
    const task = this.selectedTask();
    if (!task) return;
    this.actionBusy.set(true);
    this.hkSvc.assignTask(task.id, staffId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => {
        this.patchTask(updated);
        this.actionBusy.set(false);
      });
  }

  startTask(): void {
    const task = this.selectedTask();
    if (!task) return;
    this.actionBusy.set(true);
    this.hkSvc.startTask(task.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => {
        this.patchTask(updated);
        this.actionBusy.set(false);
      });
  }

  completeTask(): void {
    const task = this.selectedTask();
    if (!task) return;
    this.actionBusy.set(true);
    this.hkSvc.completeTask(task.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => {
        this.patchTask(updated);
        this.actionBusy.set(false);
      });
  }

  inspectTask(): void {
    const task = this.selectedTask();
    if (!task) return;
    this.actionBusy.set(true);
    this.hkSvc.inspectTask(task.id, 'current-user')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => {
        this.patchTask(updated);
        this.actionBusy.set(false);
      });
  }

  saveNotes(): void {
    const task = this.selectedTask();
    if (!task) return;
    this.actionBusy.set(true);
    this.hkSvc.updateNotes(task.id, this.notesDraft)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => {
        this.patchTask(updated);
        this.actionBusy.set(false);
      });
  }

  mockPhotoUpload(): void {
    const colors = ['#DBEAFE','#DCFCE7','#FEF3C7','#EDE9FE','#FEE2E2'];
    const c = colors[this.mockPhotos().length % colors.length];
    this.mockPhotos.update(p => [...p, c]);
  }

  private patchTask(updated: HousekeepingTask): void {
    this.tasks.update(list => list.map(t => t.id === updated.id ? updated : t));
    this.selectedTask.set(updated);
    this.notesDraft = updated.notes ?? '';
  }
}
