import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { STAFF_SERVICE, PROPERTY_SERVICE } from '../../data/services/service-tokens';
import { PropertyContextService } from '../../core/config/property-context.service';
import { Staff, Property } from '../../domain';
import { Role, Permission } from '../../domain/enums';
import { DEFAULT_ROLE_PERMISSIONS } from '../../domain/staff.model';
import { InviteStaffPayload } from '../../data/services/service-tokens';

/* ── Role meta ──────────────────────────────────────────── */
const ROLE_META: Record<Role, { label: string; color: string; bg: string; icon: string }> = {
  [Role.Admin]:        { label: 'Admin',        color: '#7C3AED', bg: '#EDE9FE', icon: '👑' },
  [Role.Manager]:      { label: 'Manager',      color: '#2563EB', bg: '#DBEAFE', icon: '🏨' },
  [Role.Receptionist]: { label: 'Receptionist', color: '#0891B2', bg: '#CFFAFE', icon: '🎯' },
  [Role.Housekeeper]:  { label: 'Housekeeper',  color: '#16A34A', bg: '#DCFCE7', icon: '🧹' },
  [Role.Accountant]:   { label: 'Accountant',   color: '#D97706', bg: '#FEF3C7', icon: '💼' },
};

const PERMISSION_GROUPS: { group: string; perms: { perm: Permission; label: string; short: string }[] }[] = [
  {
    group: 'Reservations',
    perms: [
      { perm: Permission.ViewReservations,   label: 'View Reservations',   short: 'View' },
      { perm: Permission.ManageReservations, label: 'Manage Reservations', short: 'Manage' },
    ],
  },
  {
    group: 'Guests',
    perms: [
      { perm: Permission.ViewGuests,   label: 'View Guests',   short: 'View' },
      { perm: Permission.ManageGuests, label: 'Manage Guests', short: 'Manage' },
    ],
  },
  {
    group: 'Housekeeping',
    perms: [
      { perm: Permission.ViewHousekeeping,   label: 'View Housekeeping',   short: 'View' },
      { perm: Permission.ManageHousekeeping, label: 'Manage Housekeeping', short: 'Manage' },
    ],
  },
  {
    group: 'Maintenance',
    perms: [
      { perm: Permission.ViewMaintenance,   label: 'View Maintenance',   short: 'View' },
      { perm: Permission.ManageMaintenance, label: 'Manage Maintenance', short: 'Manage' },
    ],
  },
  {
    group: 'Finance',
    perms: [
      { perm: Permission.ViewFinance,   label: 'View Finance',   short: 'View' },
      { perm: Permission.ManageFinance, label: 'Manage Finance', short: 'Manage' },
    ],
  },
  {
    group: 'Staff',
    perms: [
      { perm: Permission.ViewStaff,   label: 'View Staff',   short: 'View' },
      { perm: Permission.ManageStaff, label: 'Manage Staff', short: 'Manage' },
    ],
  },
];

const ALL_ROLES  = Object.values(Role);
const ALL_PERMS  = Object.values(Permission);

type Tab = 'directory' | 'matrix';

@Component({
  selector: 'lux-staff-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './staff.page.html',
})
export class StaffPageComponent implements OnInit {
  private staffSvc    = inject(STAFF_SERVICE);
  private propertySvc = inject(PROPERTY_SERVICE);
  readonly propertyCtx = inject(PropertyContextService);
  private destroyRef  = inject(DestroyRef);

  readonly ROLE_META              = ROLE_META;
  readonly DEFAULT_ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;
  readonly allRoles               = ALL_ROLES;
  readonly allPerms               = ALL_PERMS;
  readonly permGroups             = PERMISSION_GROUPS;

  /* ── State ──────────────────────────────────────────────── */
  tab          = signal<Tab>('directory');
  loading      = signal(true);
  staff        = signal<Staff[]>([]);
  properties   = signal<Property[]>([]);

  search       = signal('');
  filterRole   = signal('');
  filterStatus = signal('');

  dialogOpen      = signal(false);
  editingStaff    = signal<Staff | null>(null);
  deactivateTarget = signal<Staff | null>(null);
  saving          = signal(false);
  dialogError     = signal('');

  form = {
    firstName: '', lastName: '', email: '', phone: '', role: '', shift: '', propertyIds: [] as string[],
  };

  /* ── Computed ───────────────────────────────────────────── */
  filteredStaff = computed(() => {
    let list = this.staff();
    const q   = this.search().toLowerCase();
    const role   = this.filterRole();
    const status = this.filterStatus();

    if (q)      list = list.filter(s =>
      `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(q));
    if (role)   list = list.filter(s => s.role === role);
    if (status === 'active')   list = list.filter(s => s.isActive && s.inviteStatus !== 'pending');
    if (status === 'inactive') list = list.filter(s => !s.isActive);
    if (status === 'pending')  list = list.filter(s => s.inviteStatus === 'pending');

    return list.sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
  });

  countByRole   = (r: Role) => this.staff().filter(s => s.role === r).length;
  countPending  = ()        => this.staff().filter(s => s.inviteStatus === 'pending').length;
  propName      = (id: string) => this.properties().find(p => p.id === id)?.name ?? id;
  hasPermission = (role: Role, perm: Permission) => DEFAULT_ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
  permCountForRole = (role: Role) => DEFAULT_ROLE_PERMISSIONS[role]?.length ?? 0;

  roleLabel = (role: string) => (ROLE_META as any)[role]?.label ?? role;
  rolePerms = (role: string): Permission[] => DEFAULT_ROLE_PERMISSIONS[role] ?? [];
  permLabel = (perm: string) => perm.replace(/_/g, ' ');

  /* ── Lifecycle ──────────────────────────────────────────── */
  ngOnInit() {
    const pid = this.propertyCtx.active()?.id ?? '';
    forkJoin({
      staff:      this.staffSvc.list(pid),
      properties: this.propertySvc.list(),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ staff, properties }) => {
        this.staff.set(staff);
        this.properties.set(properties);
        this.loading.set(false);
      });
  }

  /* ── Dialog ──────────────────────────────────────────────── */
  openInvite() {
    this.editingStaff.set(null);
    this.form = { firstName:'', lastName:'', email:'', phone:'', role:'', shift:'', propertyIds:[] };
    this.dialogError.set('');
    this.dialogOpen.set(true);
  }

  openEdit(s: Staff) {
    this.editingStaff.set(s);
    this.form = {
      firstName: s.firstName, lastName: s.lastName, email: s.email,
      phone: s.phone ?? '', role: s.role, shift: s.shift ?? '', propertyIds: [...s.propertyIds],
    };
    this.dialogError.set('');
    this.dialogOpen.set(true);
  }

  closeDialog() {
    if (!this.saving()) {
      this.dialogOpen.set(false);
      this.editingStaff.set(null);
    }
  }

  toggleProperty(pid: string) {
    const idx = this.form.propertyIds.indexOf(pid);
    if (idx >= 0) this.form.propertyIds.splice(idx, 1);
    else          this.form.propertyIds.push(pid);
  }

  submitDialog() {
    if (!this.form.firstName.trim() || !this.form.lastName.trim() || !this.form.email.trim() || !this.form.role) {
      this.dialogError.set('Please fill in all required fields.');
      return;
    }
    this.saving.set(true);
    this.dialogError.set('');

    const editing = this.editingStaff();
    if (editing) {
      this.staffSvc.update(editing.id, {
        firstName: this.form.firstName, lastName: this.form.lastName,
        email: this.form.email, phone: this.form.phone || undefined,
        role: this.form.role as Role, shift: (this.form.shift as any) || undefined,
        propertyIds: this.form.propertyIds,
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: updated => {
          this.staff.update(list => list.map(s => s.id === updated.id ? updated : s));
          this.saving.set(false);
          this.dialogOpen.set(false);
        },
        error: () => { this.saving.set(false); this.dialogError.set('Failed to save changes.'); },
      });
    } else {
      const payload: InviteStaffPayload = {
        firstName: this.form.firstName, lastName: this.form.lastName,
        email: this.form.email, phone: this.form.phone || undefined,
        role: this.form.role, propertyIds: this.form.propertyIds,
      };
      this.staffSvc.invite(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: newStaff => {
          this.staff.update(list => [newStaff, ...list]);
          this.saving.set(false);
          this.dialogOpen.set(false);
        },
        error: () => { this.saving.set(false); this.dialogError.set('Failed to send invite.'); },
      });
    }
  }

  /* ── Deactivate ──────────────────────────────────────────── */
  promptDeactivate(s: Staff) { this.deactivateTarget.set(s); }

  confirmDeactivate() {
    const target = this.deactivateTarget();
    if (!target) return;
    this.saving.set(true);
    this.staffSvc.deactivate(target.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.staff.update(list => list.map(s => s.id === updated.id ? updated : s));
          this.saving.set(false);
          this.deactivateTarget.set(null);
        },
        error: () => { this.saving.set(false); },
      });
  }
}
