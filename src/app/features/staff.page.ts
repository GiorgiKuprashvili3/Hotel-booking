import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { STAFF_SERVICE, PROPERTY_SERVICE } from '../data/services/service-tokens';
import { PropertyContextService } from '../core/config/property-context.service';
import { Staff, Property } from '../domain';
import { Role, Permission } from '../domain/enums';
import { DEFAULT_ROLE_PERMISSIONS } from '../domain/staff.model';
import { InviteStaffPayload } from '../data/services/service-tokens';

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
  template: `
<div class="staff-page">

  <!-- ── HEADER ───────────────────────────────────────────── -->
  <header class="staff-header">
    <div class="staff-title-block">
      <div class="staff-icon">👥</div>
      <div>
        <h1 class="staff-title">Staff</h1>
        <p class="staff-sub">{{ staff().length }} team members · {{ propertyCtx.active()?.name }}</p>
      </div>
    </div>
    <div class="staff-toolbar">
      <div class="tab-pills">
        <button class="tab-pill" [class.active]="tab() === 'directory'" (click)="tab.set('directory')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor"/>
            <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor"/>
            <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor"/>
            <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor"/>
          </svg>
          Directory
        </button>
        <button class="tab-pill" [class.active]="tab() === 'matrix'" (click)="tab.set('matrix')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12M4 2v12M8 2v12M12 2v12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          Permission Matrix
        </button>
      </div>
      @if (tab() === 'directory') {
        <div class="search-box">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <input class="search-input" type="text" placeholder="Search staff…"
                 [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </div>
        <select class="filter-select" [ngModel]="filterRole()" (ngModelChange)="filterRole.set($event)">
          <option value="">All Roles</option>
          @for (r of allRoles; track r) {
            <option [value]="r">{{ ROLE_META[r].icon }} {{ ROLE_META[r].label }}</option>
          }
        </select>
        <select class="filter-select" [ngModel]="filterStatus()" (ngModelChange)="filterStatus.set($event)">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
        <button class="btn-invite" (click)="openInvite()">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Invite Staff
        </button>
      }
    </div>
  </header>

  @if (loading()) {
    <div class="staff-loading">
      <div class="spinner"></div>
      <span>Loading staff…</span>
    </div>
  } @else {

    <!-- ── KPI STRIP ──────────────────────────────────────── -->
    @if (tab() === 'directory') {
      <div class="kpi-strip">
        @for (r of allRoles; track r) {
          <button class="kpi-tile" [class.kpi-active]="filterRole() === r"
                  (click)="filterRole.set(filterRole() === r ? '' : r)"
                  [style.--col]="ROLE_META[r].color">
            <span class="kpi-icon">{{ ROLE_META[r].icon }}</span>
            <span class="kpi-num">{{ countByRole(r) }}</span>
            <span class="kpi-lbl">{{ ROLE_META[r].label }}</span>
          </button>
        }
        <div class="kpi-tile kpi-pending">
          <span class="kpi-icon">⏳</span>
          <span class="kpi-num">{{ countPending() }}</span>
          <span class="kpi-lbl">Pending</span>
        </div>
      </div>

      <!-- ── DIRECTORY TABLE ─────────────────────────────── -->
      <div class="table-wrap">
        <div class="staff-table">
          <div class="thead">
            <div class="th th-avatar"></div>
            <div class="th th-name">Name</div>
            <div class="th th-role">Role</div>
            <div class="th th-props">Properties</div>
            <div class="th th-shift">Shift</div>
            <div class="th th-status">Status</div>
            <div class="th th-hired">Hired</div>
            <div class="th th-actions"></div>
          </div>

          @if (filteredStaff().length === 0) {
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <div class="empty-msg">No staff members match your filters.</div>
            </div>
          }

          @for (s of filteredStaff(); track s.id) {
            <div class="tbody-row" [class.inactive-row]="!s.isActive">
              <!-- Avatar -->
              <div class="td td-avatar">
                @if (s.avatarUrl) {
                  <img class="avatar" [src]="s.avatarUrl" [alt]="s.firstName" />
                } @else {
                  <div class="avatar-fallback" [style.background]="ROLE_META[s.role]?.bg"
                       [style.color]="ROLE_META[s.role]?.color">
                    {{ s.firstName[0] }}{{ s.lastName[0] }}
                  </div>
                }
              </div>
              <!-- Name + email -->
              <div class="td td-name">
                <span class="staff-full-name">{{ s.firstName }} {{ s.lastName }}</span>
                <span class="staff-email">{{ s.email }}</span>
                @if (s.inviteStatus === 'pending') {
                  <span class="invite-badge">Invite pending</span>
                }
              </div>
              <!-- Role -->
              <div class="td td-role">
                <span class="role-chip"
                      [style.background]="ROLE_META[s.role]?.bg"
                      [style.color]="ROLE_META[s.role]?.color">
                  {{ ROLE_META[s.role]?.icon }} {{ ROLE_META[s.role]?.label }}
                </span>
              </div>
              <!-- Properties -->
              <div class="td td-props">
                @for (pid of s.propertyIds.slice(0, 2); track pid) {
                  <span class="prop-chip">{{ propName(pid) }}</span>
                }
                @if (s.propertyIds.length > 2) {
                  <span class="prop-more">+{{ s.propertyIds.length - 2 }}</span>
                }
              </div>
              <!-- Shift -->
              <div class="td td-shift">
                @if (s.shift) {
                  <span class="shift-badge shift-{{ s.shift }}">{{ s.shift | titlecase }}</span>
                } @else {
                  <span class="no-shift">—</span>
                }
              </div>
              <!-- Status -->
              <div class="td td-status">
                @if (s.inviteStatus === 'pending') {
                  <span class="status-dot pending"></span>
                  <span class="status-txt pending">Pending</span>
                } @else if (s.isActive) {
                  <span class="status-dot active"></span>
                  <span class="status-txt active">Active</span>
                } @else {
                  <span class="status-dot inactive"></span>
                  <span class="status-txt inactive">Inactive</span>
                }
              </div>
              <!-- Hired -->
              <div class="td td-hired">{{ s.hiredAt | date:'MMM d, y' }}</div>
              <!-- Actions -->
              <div class="td td-actions">
                <button class="action-btn" title="Edit" (click)="openEdit(s)">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 2.5a1.5 1.5 0 012.1 2.1L5 13H3v-2L11.5 2.5z"
                          stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
                  </svg>
                </button>
                @if (s.isActive) {
                  <button class="action-btn danger" title="Deactivate" (click)="promptDeactivate(s)">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/>
                      <path d="M5 8h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    </svg>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </div>
    }

    <!-- ── PERMISSION MATRIX ───────────────────────────────── -->
    @if (tab() === 'matrix') {
      <div class="matrix-wrap">
        <div class="matrix-info">
          <div class="matrix-info-icon">🔐</div>
          <div>
            <div class="matrix-info-title">Role × Permission Matrix</div>
            <div class="matrix-info-sub">Read-only view of default RBAC configuration. Overrides can be set per property in a real backend.</div>
          </div>
        </div>
        <div class="matrix-scroll">
          <table class="matrix-table">
            <thead>
              <tr>
                <th class="matrix-th-perm">Permission</th>
                @for (role of allRoles; track role) {
                  <th class="matrix-th-role">
                    <div class="matrix-role-header" [style.color]="ROLE_META[role].color">
                      <span class="matrix-role-icon">{{ ROLE_META[role].icon }}</span>
                      <span class="matrix-role-label">{{ ROLE_META[role].label }}</span>
                      <span class="matrix-role-count" [style.background]="ROLE_META[role].bg" [style.color]="ROLE_META[role].color">
                        {{ permCountForRole(role) }}/{{ allPerms.length }}
                      </span>
                    </div>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (group of permGroups; track group.group) {
                <tr class="matrix-group-row">
                  <td class="matrix-group-label" [attr.colspan]="allRoles.length + 1">
                    {{ group.group }}
                  </td>
                </tr>
                @for (p of group.perms; track p.perm) {
                  <tr class="matrix-perm-row">
                    <td class="matrix-perm-label">
                      <span class="perm-action">{{ p.short }}</span>
                      <span class="perm-full">{{ p.label }}</span>
                    </td>
                    @for (role of allRoles; track role) {
                      <td class="matrix-cell" [class.matrix-cell-granted]="hasPermission(role, p.perm)">
                        @if (hasPermission(role, p.perm)) {
                          <span class="check-granted" [style.color]="ROLE_META[role].color">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="7" [attr.fill]="ROLE_META[role].bg"/>
                              <path d="M4.5 8l2.5 2.5L11.5 5" [attr.stroke]="ROLE_META[role].color"
                                    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                          </span>
                        } @else {
                          <span class="check-denied">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="7" fill="#F3F4F6"/>
                              <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#D1D5DB"
                                    stroke-width="1.4" stroke-linecap="round"/>
                            </svg>
                          </span>
                        }
                      </td>
                    }
                  </tr>
                }
              }
            </tbody>
            <tfoot>
              <tr class="matrix-total-row">
                <td class="matrix-total-label">Total granted</td>
                @for (role of allRoles; track role) {
                  <td class="matrix-total-cell" [style.color]="ROLE_META[role].color">
                    <strong>{{ permCountForRole(role) }}</strong>
                  </td>
                }
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Legend -->
        <div class="matrix-legend">
          <span class="legend-item">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill="#DBEAFE"/>
              <path d="M4.5 8l2.5 2.5L11.5 5" stroke="#2563EB" stroke-width="1.6"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Permission granted
          </span>
          <span class="legend-item">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill="#F3F4F6"/>
              <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#D1D5DB" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            Not granted
          </span>
        </div>
      </div>
    }
  }
</div>

<!-- ── INVITE / EDIT DIALOG ──────────────────────────────── -->
@if (dialogOpen()) {
  <div class="dialog-backdrop" (click)="closeDialog()">
    <div class="dialog-panel" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="dialog-title">{{ editingStaff() ? 'Edit Staff Member' : 'Invite Staff Member' }}</h2>
        <button class="dialog-close" (click)="closeDialog()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="dialog-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">First Name *</label>
            <input class="form-input" type="text" [(ngModel)]="form.firstName" placeholder="John" />
          </div>
          <div class="form-group">
            <label class="form-label">Last Name *</label>
            <input class="form-input" type="text" [(ngModel)]="form.lastName" placeholder="Smith" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input class="form-input" type="email" [(ngModel)]="form.email" placeholder="john.smith@hotel.com" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-input" type="tel" [(ngModel)]="form.phone" placeholder="+995 555 000 000" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Role *</label>
            <select class="form-select" [(ngModel)]="form.role">
              <option value="">Select role…</option>
              @for (r of allRoles; track r) {
                <option [value]="r">{{ ROLE_META[r].icon }} {{ ROLE_META[r].label }}</option>
              }
            </select>
          </div>
          @if (editingStaff()) {
            <div class="form-group">
              <label class="form-label">Shift</label>
              <select class="form-select" [(ngModel)]="form.shift">
                <option value="">No shift</option>
                <option value="day">Day</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </select>
            </div>
          }
        </div>
        <div class="form-group">
          <label class="form-label">Properties</label>
          <div class="prop-checkboxes">
            @for (p of properties(); track p.id) {
              <label class="prop-check-item">
                <input type="checkbox" [checked]="form.propertyIds.includes(p.id)"
                       (change)="toggleProperty(p.id)" />
                <span>{{ p.name }}</span>
              </label>
            }
          </div>
        </div>
        @if (form.role) {
          <div class="form-perm-preview">
            <div class="preview-label">Permissions for {{ roleLabel(form.role) }}</div>
            <div class="preview-chips">
              @for (perm of rolePerms(form.role); track perm) {
                <span class="preview-chip">{{ permLabel(perm) }}</span>
              }
            </div>
          </div>
        }
        @if (dialogError()) {
          <div class="form-error">{{ dialogError() }}</div>
        }
      </div>
      <div class="dialog-footer">
        <button class="btn-cancel" (click)="closeDialog()">Cancel</button>
        <button class="btn-submit" [disabled]="saving()" (click)="submitDialog()">
          @if (saving()) { Saving… } @else { {{ editingStaff() ? 'Save Changes' : 'Send Invite' }} }
        </button>
      </div>
    </div>
  </div>
}

<!-- ── DEACTIVATE CONFIRM ─────────────────────────────────── -->
@if (deactivateTarget()) {
  <div class="dialog-backdrop" (click)="deactivateTarget.set(null)">
    <div class="dialog-panel dialog-sm" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="dialog-title">Deactivate Staff Member</h2>
      </div>
      <div class="dialog-body">
        <p class="confirm-msg">
          Are you sure you want to deactivate
          <strong>{{ deactivateTarget()?.firstName }} {{ deactivateTarget()?.lastName }}</strong>?
          They will lose access to the system immediately.
        </p>
      </div>
      <div class="dialog-footer">
        <button class="btn-cancel" (click)="deactivateTarget.set(null)">Cancel</button>
        <button class="btn-danger" [disabled]="saving()" (click)="confirmDeactivate()">
          {{ saving() ? 'Deactivating…' : 'Deactivate' }}
        </button>
      </div>
    </div>
  </div>
}

<style>
/* ── Layout ──────────────────────────────────────────────── */
.staff-page { display:flex; flex-direction:column; gap:0; height:100%; background:var(--surface-ground, #F8F7F4); }

/* Header */
.staff-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap;
  gap:12px; padding:20px 24px 16px; background:#fff; border-bottom:1px solid #E5E7EB; }
.staff-title-block { display:flex; align-items:center; gap:12px; }
.staff-icon { width:40px; height:40px; background:#EDE9FE; border-radius:10px;
  display:flex; align-items:center; justify-content:center; font-size:18px; }
.staff-title { font-size:1.25rem; font-weight:700; color:#111827; margin:0; }
.staff-sub { font-size:.8rem; color:#6B7280; margin:0; }
.staff-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }

/* Tab pills */
.tab-pills { display:flex; background:#F3F4F6; border-radius:8px; padding:3px; gap:2px; }
.tab-pill { display:flex; align-items:center; gap:5px; padding:6px 12px; border:none;
  background:transparent; border-radius:6px; font-size:.8rem; font-weight:500;
  color:#6B7280; cursor:pointer; transition:.15s; }
.tab-pill.active { background:#fff; color:#111827; box-shadow:0 1px 3px rgba(0,0,0,.12); }

/* Search / filter */
.search-box { display:flex; align-items:center; gap:6px; background:#F9FAFB;
  border:1px solid #E5E7EB; border-radius:7px; padding:0 10px; }
.search-input { border:none; background:transparent; outline:none; font-size:.82rem;
  color:#374151; width:160px; height:34px; }
.filter-select { padding:0 10px; height:34px; border:1px solid #E5E7EB;
  border-radius:7px; background:#F9FAFB; font-size:.82rem; color:#374151; cursor:pointer; }
.btn-invite { display:flex; align-items:center; gap:6px; padding:0 14px; height:34px;
  background:#7C3AED; color:#fff; border:none; border-radius:7px;
  font-size:.82rem; font-weight:600; cursor:pointer; transition:.15s; }
.btn-invite:hover { background:#6D28D9; }

/* Loading */
.staff-loading { display:flex; align-items:center; justify-content:center; gap:10px;
  padding:80px 0; color:#6B7280; font-size:.9rem; }
.spinner { width:20px; height:20px; border:2px solid #E5E7EB; border-top-color:#7C3AED;
  border-radius:50%; animation:spin .7s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

/* KPI strip */
.kpi-strip { display:flex; gap:10px; padding:16px 24px; overflow-x:auto; background:#fff;
  border-bottom:1px solid #E5E7EB; }
.kpi-tile { display:flex; flex-direction:column; align-items:center; gap:2px;
  min-width:90px; padding:10px 14px; border:1.5px solid #E5E7EB; border-radius:10px;
  background:#fff; cursor:pointer; transition:.15s; }
.kpi-tile:hover { border-color:var(--col,#7C3AED); }
.kpi-tile.kpi-active { border-color:var(--col,#7C3AED); background:color-mix(in srgb, var(--col,#7C3AED) 8%, white); }
.kpi-icon { font-size:1rem; }
.kpi-num { font-size:1.3rem; font-weight:700; color:#111827; line-height:1; }
.kpi-lbl { font-size:.72rem; color:#6B7280; }
.kpi-pending { border-color:#F59E0B; }

/* Table */
.table-wrap { flex:1; overflow:auto; padding:16px 24px 24px; }
.staff-table { background:#fff; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; }
.thead { display:grid; grid-template-columns:48px 1fr 130px 180px 90px 110px 100px 80px;
  padding:0 16px; background:#F9FAFB; border-bottom:1px solid #E5E7EB; }
.th { padding:10px 8px; font-size:.72rem; font-weight:600; color:#6B7280; text-transform:uppercase;
  letter-spacing:.04em; }
.tbody-row { display:grid; grid-template-columns:48px 1fr 130px 180px 90px 110px 100px 80px;
  padding:0 16px; border-bottom:1px solid #F3F4F6; align-items:center; transition:.15s; }
.tbody-row:hover { background:#FAFAFA; }
.tbody-row:last-child { border-bottom:none; }
.inactive-row { opacity:.55; }
.td { padding:10px 8px; font-size:.82rem; color:#374151; }

/* Avatar */
.avatar, .avatar-fallback { width:32px; height:32px; border-radius:50%; object-fit:cover; }
.avatar-fallback { display:flex; align-items:center; justify-content:center;
  font-size:.7rem; font-weight:700; }

/* Name / email */
.td-name { display:flex; flex-direction:column; gap:2px; }
.staff-full-name { font-weight:600; color:#111827; font-size:.85rem; }
.staff-email { font-size:.75rem; color:#9CA3AF; }
.invite-badge { display:inline-block; font-size:.65rem; padding:1px 6px;
  background:#FEF3C7; color:#D97706; border-radius:4px; border:1px solid #FDE68A; margin-top:2px; }

/* Role chip */
.role-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 8px;
  border-radius:6px; font-size:.75rem; font-weight:600; }

/* Property chips */
.td-props { display:flex; flex-wrap:wrap; gap:4px; }
.prop-chip { padding:2px 6px; background:#F3F4F6; border-radius:4px; font-size:.72rem; color:#374151; }
.prop-more { font-size:.72rem; color:#9CA3AF; }

/* Shift badge */
.shift-badge { padding:2px 8px; border-radius:4px; font-size:.72rem; font-weight:500; }
.shift-day     { background:#DCFCE7; color:#16A34A; }
.shift-evening { background:#FEF3C7; color:#D97706; }
.shift-night   { background:#EDE9FE; color:#7C3AED; }
.no-shift { color:#D1D5DB; }

/* Status */
.td-status { display:flex; align-items:center; gap:5px; }
.status-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.status-dot.active   { background:#16A34A; }
.status-dot.inactive { background:#9CA3AF; }
.status-dot.pending  { background:#F59E0B; }
.status-txt { font-size:.78rem; font-weight:500; }
.status-txt.active   { color:#16A34A; }
.status-txt.inactive { color:#9CA3AF; }
.status-txt.pending  { color:#F59E0B; }

/* Actions */
.td-actions { display:flex; gap:4px; }
.action-btn { width:28px; height:28px; border:1px solid #E5E7EB; border-radius:6px;
  background:#fff; display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:#6B7280; transition:.15s; }
.action-btn:hover { border-color:#7C3AED; color:#7C3AED; }
.action-btn.danger:hover { border-color:#DC2626; color:#DC2626; }

/* Empty */
.empty-state { display:flex; flex-direction:column; align-items:center; gap:8px;
  padding:60px 0; color:#9CA3AF; }
.empty-icon { font-size:2rem; }
.empty-msg { font-size:.85rem; }

/* ── Matrix ──────────────────────────────────────────────── */
.matrix-wrap { flex:1; overflow:auto; padding:16px 24px 24px; }
.matrix-info { display:flex; align-items:flex-start; gap:12px; background:#fff;
  border:1px solid #E5E7EB; border-radius:10px; padding:14px 16px; margin-bottom:14px; }
.matrix-info-icon { font-size:1.2rem; }
.matrix-info-title { font-size:.9rem; font-weight:700; color:#111827; }
.matrix-info-sub { font-size:.78rem; color:#6B7280; margin-top:2px; }

.matrix-scroll { overflow-x:auto; background:#fff; border:1px solid #E5E7EB; border-radius:12px; }
.matrix-table { width:100%; border-collapse:collapse; min-width:760px; }

.matrix-th-perm { padding:14px 20px; text-align:left; font-size:.78rem; font-weight:600;
  color:#6B7280; text-transform:uppercase; letter-spacing:.04em; background:#F9FAFB;
  border-bottom:1px solid #E5E7EB; min-width:200px; }
.matrix-th-role { padding:12px 16px; text-align:center; background:#F9FAFB;
  border-bottom:1px solid #E5E7EB; min-width:120px; border-left:1px solid #F3F4F6; }
.matrix-role-header { display:flex; flex-direction:column; align-items:center; gap:4px; }
.matrix-role-icon { font-size:1rem; }
.matrix-role-label { font-size:.78rem; font-weight:700; }
.matrix-role-count { font-size:.68rem; padding:2px 6px; border-radius:10px; font-weight:600; }

.matrix-group-row td { padding:10px 20px 4px; font-size:.7rem; font-weight:700;
  text-transform:uppercase; letter-spacing:.08em; color:#9CA3AF;
  background:#FAFAFA; border-top:1px solid #E5E7EB; border-bottom:1px solid #F3F4F6; }

.matrix-perm-row { transition:.1s; }
.matrix-perm-row:hover { background:#FAFAFA; }
.matrix-perm-label { padding:10px 20px; min-width:200px; }
.perm-action { display:block; font-size:.75rem; font-weight:600; color:#374151; }
.perm-full   { display:block; font-size:.68rem; color:#9CA3AF; }
.matrix-cell { text-align:center; padding:10px 16px; border-left:1px solid #F3F4F6; }
.matrix-cell-granted { background:color-mix(in srgb, var(--cell-color,#DBEAFE) 30%, white); }

.matrix-total-row { background:#F9FAFB; border-top:2px solid #E5E7EB; }
.matrix-total-label { padding:12px 20px; font-size:.78rem; font-weight:700; color:#374151; }
.matrix-total-cell { text-align:center; padding:12px 16px; border-left:1px solid #F3F4F6;
  font-size:.9rem; }

.matrix-legend { display:flex; align-items:center; gap:20px; padding:12px 4px;
  font-size:.78rem; color:#6B7280; }
.legend-item { display:flex; align-items:center; gap:6px; }

/* ── Dialog ──────────────────────────────────────────────── */
.dialog-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex;
  align-items:center; justify-content:center; z-index:1000; padding:16px; }
.dialog-panel { background:#fff; border-radius:14px; width:100%; max-width:520px;
  box-shadow:0 20px 60px rgba(0,0,0,.2); overflow:hidden; }
.dialog-sm { max-width:380px; }
.dialog-header { display:flex; align-items:center; justify-content:space-between;
  padding:18px 20px 14px; border-bottom:1px solid #F3F4F6; }
.dialog-title { font-size:1rem; font-weight:700; color:#111827; margin:0; }
.dialog-close { width:30px; height:30px; border:none; background:#F9FAFB; border-radius:6px;
  display:flex; align-items:center; justify-content:center; cursor:pointer; color:#6B7280; }
.dialog-body { padding:20px; display:flex; flex-direction:column; gap:14px;
  max-height:60vh; overflow-y:auto; }
.dialog-footer { display:flex; justify-content:flex-end; gap:8px;
  padding:14px 20px; border-top:1px solid #F3F4F6; background:#FAFAFA; }

.form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.form-group { display:flex; flex-direction:column; gap:5px; }
.form-label { font-size:.78rem; font-weight:600; color:#374151; }
.form-input, .form-select { padding:8px 10px; border:1px solid #E5E7EB; border-radius:7px;
  font-size:.85rem; color:#111827; background:#fff; outline:none; transition:.15s; }
.form-input:focus, .form-select:focus { border-color:#7C3AED; box-shadow:0 0 0 3px #EDE9FE; }
.prop-checkboxes { display:flex; flex-direction:column; gap:6px; }
.prop-check-item { display:flex; align-items:center; gap:8px; font-size:.85rem; color:#374151; cursor:pointer; }
.prop-check-item input { accent-color:#7C3AED; }

.form-perm-preview { background:#F9FAFB; border:1px solid #E5E7EB; border-radius:8px; padding:10px; }
.preview-label { font-size:.72rem; font-weight:600; color:#6B7280; margin-bottom:6px; }
.preview-chips { display:flex; flex-wrap:wrap; gap:4px; }
.preview-chip { padding:2px 8px; background:#EDE9FE; color:#7C3AED; border-radius:4px; font-size:.7rem; font-weight:500; text-transform:capitalize; }

.form-error { background:#FEE2E2; color:#DC2626; border-radius:7px; padding:8px 10px; font-size:.8rem; }

.confirm-msg { font-size:.88rem; color:#374151; line-height:1.5; margin:0; }

.btn-cancel { padding:0 16px; height:36px; border:1px solid #E5E7EB; border-radius:7px;
  background:#fff; color:#374151; font-size:.85rem; cursor:pointer; }
.btn-submit { padding:0 20px; height:36px; background:#7C3AED; color:#fff; border:none;
  border-radius:7px; font-size:.85rem; font-weight:600; cursor:pointer; transition:.15s; }
.btn-submit:hover { background:#6D28D9; }
.btn-submit:disabled { opacity:.6; cursor:not-allowed; }
.btn-danger { padding:0 20px; height:36px; background:#DC2626; color:#fff; border:none;
  border-radius:7px; font-size:.85rem; font-weight:600; cursor:pointer; }
.btn-danger:disabled { opacity:.6; cursor:not-allowed; }
</style>
  `,
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
