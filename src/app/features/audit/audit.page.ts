import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { AUDIT_SERVICE, STAFF_SERVICE } from '../../data/services/service-tokens';
import { AuditQuery } from '../../data/services/service-tokens';
import { PropertyContextService } from '../../core/config/property-context.service';
import { AuditLog, Staff } from '../../domain';
import { AuditAction, AuditEntityType } from '../../domain/enums';

/* ── Meta ───────────────────────────────────────────── */
const ACTION_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  [AuditAction.Created]:       { label: 'Created',        color: '#16A34A', bg: '#DCFCE7', icon: '✨' },
  [AuditAction.Updated]:       { label: 'Updated',        color: '#2563EB', bg: '#DBEAFE', icon: '✏️' },
  [AuditAction.Deleted]:       { label: 'Deleted',        color: '#DC2626', bg: '#FEE2E2', icon: '🗑' },
  [AuditAction.CheckedIn]:     { label: 'Check-in',       color: '#0891B2', bg: '#CFFAFE', icon: '🏨' },
  [AuditAction.CheckedOut]:    { label: 'Check-out',      color: '#7C3AED', bg: '#EDE9FE', icon: '🚪' },
  [AuditAction.Cancelled]:     { label: 'Cancelled',      color: '#DC2626', bg: '#FEE2E2', icon: '❌' },
  [AuditAction.StatusChanged]: { label: 'Status Changed', color: '#D97706', bg: '#FEF3C7', icon: '🔄' },
  [AuditAction.Login]:         { label: 'Login',          color: '#16A34A', bg: '#DCFCE7', icon: '🔐' },
  [AuditAction.Logout]:        { label: 'Logout',         color: '#6B7280', bg: '#F3F4F6', icon: '🚶' },
  [AuditAction.InviteSent]:    { label: 'Invite Sent',    color: '#7C3AED', bg: '#EDE9FE', icon: '📧' },
  [AuditAction.PointsAdjusted]:{ label: 'Points Adj.',   color: '#D97706', bg: '#FEF3C7', icon: '⭐' },
};

const ENTITY_META: Record<string, { label: string; icon: string }> = {
  [AuditEntityType.Reservation]:  { label: 'Reservation',  icon: '📋' },
  [AuditEntityType.Guest]:        { label: 'Guest',        icon: '👤' },
  [AuditEntityType.Room]:         { label: 'Room',         icon: '🛏' },
  [AuditEntityType.Staff]:        { label: 'Staff',        icon: '👥' },
  [AuditEntityType.Maintenance]:  { label: 'Maintenance',  icon: '🔧' },
  [AuditEntityType.Concierge]:    { label: 'Concierge',    icon: '🎩' },
  [AuditEntityType.Housekeeping]: { label: 'Housekeeping', icon: '🧹' },
  [AuditEntityType.Payment]:      { label: 'Payment',      icon: '💳' },
  [AuditEntityType.Setting]:      { label: 'Setting',      icon: '⚙️' },
  [AuditEntityType.Loyalty]:      { label: 'Loyalty',      icon: '💎' },
};

type ViewMode = 'timeline' | 'table';

@Component({
  selector: 'lux-audit-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './audit.page.html',
})
export class AuditPageComponent implements OnInit {
  private auditSvc  = inject(AUDIT_SERVICE);
  private staffSvc  = inject(STAFF_SERVICE);
  readonly propertyCtx = inject(PropertyContextService);
  private destroyRef = inject(DestroyRef);

  readonly allActions  = Object.values(AuditAction);
  readonly allEntities = Object.values(AuditEntityType);
  readonly ACTION_META = ACTION_META;
  readonly ENTITY_META = ENTITY_META;

  /* ── State ──────────────────────────────────────────── */
  view    = signal<ViewMode>('timeline');
  loading = signal(true);
  logs    = signal<AuditLog[]>([]);
  staff   = signal<Staff[]>([]);

  search       = signal('');
  filterEntity = signal('');
  filterAction = signal('');
  filterUser   = signal('');
  dateFrom     = signal('');
  dateTo       = signal('');

  selectedEntry = signal<AuditLog | null>(null);

  /* ── Computed ────────────────────────────────────────── */
  hasFilters = computed(() =>
    !!this.search() || !!this.filterEntity() || !!this.filterAction() ||
    !!this.filterUser() || !!this.dateFrom() || !!this.dateTo());

  filtered = computed(() => {
    let list = this.logs();
    const q      = this.search().toLowerCase();
    const entity = this.filterEntity();
    const action = this.filterAction();
    const user   = this.filterUser();
    const from   = this.dateFrom() ? new Date(this.dateFrom()) : null;
    const to     = this.dateTo()   ? new Date(this.dateTo() + 'T23:59:59') : null;

    if (q)      list = list.filter(l => `${l.entityId} ${l.entityType} ${JSON.stringify(l.details ?? {})}`.toLowerCase().includes(q));
    if (entity) list = list.filter(l => l.entityType === entity);
    if (action) list = list.filter(l => l.action === action);
    if (user)   list = list.filter(l => l.userId === user);
    if (from)   list = list.filter(l => l.timestamp >= from!);
    if (to)     list = list.filter(l => l.timestamp <= to!);

    return list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  });

  groupedByDay = computed(() => {
    const map = new Map<string, AuditLog[]>();
    for (const entry of this.filtered()) {
      const key = entry.timestamp.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries()).map(([date, entries]) => ({ date, entries }));
  });

  /* ── Helpers ─────────────────────────────────────────── */
  private staffMap = computed(() => {
    const m = new Map<string, Staff>();
    for (const s of this.staff()) m.set(s.id, s);
    return m;
  });

  staffName    = (id: string) => {
    const s = this.staffMap().get(id);
    return s ? `${s.firstName} ${s.lastName}` : id;
  };
  staffInitials = (id: string) => {
    const s = this.staffMap().get(id);
    return s ? `${s.firstName[0]}${s.lastName[0]}` : '?';
  };
  staffColor = (id: string) => {
    const colors = ['#7C3AED','#2563EB','#0891B2','#16A34A','#D97706','#DC2626'];
    let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF;
    return colors[Math.abs(h) % colors.length];
  };

  actionMeta  = (a: string) => ACTION_META[a]  ?? { label: a, color: '#6B7280', bg: '#F3F4F6', icon: '•' };
  entityMeta  = (e: string) => ENTITY_META[e]  ?? { label: e, icon: '📄' };
  objectKeys  = (o: Record<string, unknown> | undefined) => o ? Object.keys(o) : [];
  formatVal   = (v: unknown) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (v instanceof Date) return v.toLocaleString();
    const s = String(v);
    return s.length > 60 ? s.slice(0, 57) + '…' : s;
  };

  /* ── Lifecycle ───────────────────────────────────────── */
  ngOnInit() {
    forkJoin({
      logs:  this.auditSvc.list({ limit: 500 }),
      staff: this.staffSvc.list(),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ logs, staff }) => {
        this.logs.set(logs);
        this.staff.set(staff);
        this.loading.set(false);
      });
  }

  refresh() {
    this.loading.set(true);
    this.auditSvc.list({ limit: 500 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(logs => {
        this.logs.set(logs);
        this.loading.set(false);
      });
  }

  clearFilters() {
    this.search.set(''); this.filterEntity.set(''); this.filterAction.set('');
    this.filterUser.set(''); this.dateFrom.set(''); this.dateTo.set('');
  }

  selectEntry(e: AuditLog) {
    this.selectedEntry.set(this.selectedEntry()?.id === e.id ? null : e);
  }
}
