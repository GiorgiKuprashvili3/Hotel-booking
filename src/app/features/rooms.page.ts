import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { animate, style, transition, trigger } from '@angular/animations';

import { ROOM_SERVICE } from '../data/services/service-tokens';
import { PropertyContextService } from '../core/config/property-context.service';
import { Room, RoomType, RoomStatusHistory } from '../domain';
import { RoomStatus, HousekeepingStatus } from '../domain/enums';

type ViewMode = 'map' | 'table';

interface FloorGroup {
  floor: number;
  rooms: Room[];
}

const STATUS_META: Record<RoomStatus, { label: string; color: string; bg: string }> = {
  [RoomStatus.Available]:   { label: 'Available',   color: 'var(--success)', bg: 'var(--success-bg)' },
  [RoomStatus.Occupied]:    { label: 'Occupied',    color: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 14%, transparent)' },
  [RoomStatus.Cleaning]:    { label: 'Cleaning',    color: 'var(--warning)', bg: 'var(--warning-bg)' },
  [RoomStatus.Maintenance]: { label: 'Maintenance', color: 'var(--danger)',  bg: 'var(--danger-bg)' },
  [RoomStatus.Reserved]:    { label: 'Reserved',    color: 'var(--info)',    bg: 'var(--info-bg)' },
  [RoomStatus.Blocked]:     { label: 'Blocked',     color: 'var(--text)',    bg: 'var(--surface-3)' },
};

@Component({
  selector: 'lux-rooms-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)' }),
        animate('200ms cubic-bezier(0.4,0,0.2,1)', style({ transform: 'translateX(0)' })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ transform: 'translateX(100%)' })),
      ]),
    ]),
  ],
  templateUrl: './rooms.page.html',
  styleUrl: './rooms.page.scss',
})
export class RoomsPageComponent implements OnInit {
  protected propertyCtx = inject(PropertyContextService);
  private roomSvc       = inject(ROOM_SERVICE);
  private destroyRef    = inject(DestroyRef);

  // Expose for template
  readonly RoomStatus = RoomStatus;
  readonly statusList: RoomStatus[] = [
    RoomStatus.Available, RoomStatus.Occupied, RoomStatus.Cleaning,
    RoomStatus.Maintenance, RoomStatus.Reserved, RoomStatus.Blocked,
  ];

  view             = signal<ViewMode>('map');
  loading          = signal(true);
  rooms            = signal<Room[]>([]);
  roomTypes        = signal<RoomType[]>([]);
  selected         = signal<Room | null>(null);
  history          = signal<RoomStatusHistory[]>([]);
  changing         = signal(false);
  statusNote       = signal('');
  pendingStatus    = signal<RoomStatus | null>(null);

  // Table state
  tableSearch       = signal('');
  tableStatusFilter = signal<string>('');
  selectedIds       = signal<Set<string>>(new Set());
  bulkPending       = signal<RoomStatus | null>(null);
  bulkRunning       = signal(false);

  floorGroups = computed<FloorGroup[]>(() => {
    const byFloor = new Map<number, Room[]>();
    for (const r of this.rooms()) {
      if (!byFloor.has(r.floor)) byFloor.set(r.floor, []);
      byFloor.get(r.floor)!.push(r);
    }
    return [...byFloor.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([floor, rooms]) => ({
        floor,
        rooms: [...rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
      }));
  });

  filteredRooms = computed<Room[]>(() => {
    const q = this.tableSearch().toLowerCase().trim();
    const s = this.tableStatusFilter();
    return this.rooms().filter(r => {
      if (q && !r.number.toLowerCase().includes(q)) return false;
      if (s && r.status !== s) return false;
      return true;
    });
  });

  allVisibleSelected = computed(() => {
    const visible = this.filteredRooms();
    if (!visible.length) return false;
    return visible.every(r => this.selectedIds().has(r.id));
  });

  ngOnInit(): void {
    this.load();
    // Reload when property changes
    this.propertyCtx.active$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  private load(): void {
    const prop = this.propertyCtx.active();
    if (!prop) return;
    this.loading.set(true);
    forkJoin({
      rooms: this.roomSvc.list(prop.id),
      types: this.roomSvc.listTypes(prop.id),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ rooms, types }) => {
      this.rooms.set(rooms);
      this.roomTypes.set(types);
      this.loading.set(false);
    });
  }

  meta(s: RoomStatus) { return STATUS_META[s]; }
  typeName(id: string): string { return this.roomTypes().find(t => t.id === id)?.name ?? '—'; }
  hkLabel(s: HousekeepingStatus): string {
    return s.replace(/_/g, ' ');
  }
  countByStatus(s: RoomStatus): number {
    return this.rooms().filter(r => r.status === s).length;
  }

  selectRoom(r: Room): void {
    this.selected.set(r);
    this.statusNote.set('');
    this.pendingStatus.set(null);
    this.roomSvc.listStatusHistory(r.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(h => this.history.set(h));
  }
  closeDrawer(): void {
    this.selected.set(null);
    this.history.set([]);
    this.pendingStatus.set(null);
    this.statusNote.set('');
  }

  /** Suggest a context-appropriate note placeholder per target status. */
  notePlaceholder(s: RoomStatus): string {
    switch (s) {
      case RoomStatus.Maintenance: return "Reason (e.g. 'AC unit not cooling')";
      case RoomStatus.Cleaning:    return "Optional note (e.g. 'Deep clean requested')";
      case RoomStatus.Blocked:     return "Reason for block (e.g. 'Reserved for VIP arrival')";
      case RoomStatus.Reserved:    return "Optional note";
      case RoomStatus.Occupied:    return "Optional note";
      case RoomStatus.Available:   return "Optional note";
      default: return 'Optional note';
    }
  }

  /** Stage a status change — does NOT commit. Shows confirm card. */
  stageStatus(s: RoomStatus): void {
    const r = this.selected();
    if (!r || r.status === s) return;
    this.pendingStatus.set(s);
    // Clear note when switching between staged options
    this.statusNote.set('');
  }

  cancelStaged(): void {
    this.pendingStatus.set(null);
    this.statusNote.set('');
  }

  /** Commit the staged change. */
  confirmStaged(): void {
    const r = this.selected();
    const next = this.pendingStatus();
    if (!r || !next || r.status === next) return;
    this.changing.set(true);
    this.roomSvc.updateStatus(r.id, next, this.statusNote().trim() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.rooms.update(list => list.map(x => x.id === updated.id ? updated : x));
          this.selected.set(updated);
          this.statusNote.set('');
          this.pendingStatus.set(null);
          this.roomSvc.listStatusHistory(r.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(h => this.history.set(h));
          this.changing.set(false);
        },
        error: () => this.changing.set(false),
      });
  }

  /* ---------- Table bulk selection ---------- */
  toggleSelect(id: string): void {
    this.selectedIds.update(set => {
      const copy = new Set(set);
      if (copy.has(id)) copy.delete(id); else copy.add(id);
      return copy;
    });
  }
  toggleAllVisible(ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    const visible = this.filteredRooms().map(r => r.id);
    this.selectedIds.update(set => {
      const copy = new Set(set);
      if (checked) visible.forEach(id => copy.add(id));
      else         visible.forEach(id => copy.delete(id));
      return copy;
    });
  }
  bulkSet(status: RoomStatus): void {
    if (!this.selectedIds().size) return;
    this.bulkPending.set(status);
  }
  cancelBulk(): void {
    this.bulkPending.set(null);
  }
  confirmBulk(): void {
    const status = this.bulkPending();
    const ids = [...this.selectedIds()];
    if (!status || !ids.length) return;
    this.bulkRunning.set(true);
    let remaining = ids.length;
    ids.forEach(id => {
      this.roomSvc.updateStatus(id, status)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: updated => {
            this.rooms.update(list => list.map(x => x.id === updated.id ? updated : x));
          },
          complete: () => {
            remaining--;
            if (remaining === 0) {
              this.selectedIds.set(new Set());
              this.bulkPending.set(null);
              this.bulkRunning.set(false);
            }
          },
        });
    });
  }
}
