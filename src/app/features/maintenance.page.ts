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
  template: `
<div class="mnt-page">

  <!-- ── HEADER ─────────────────────────────────────────── -->
  <header class="mnt-header">
    <div class="mnt-title-block">
      <div class="mnt-icon-wrap">🔧</div>
      <div>
        <h1 class="mnt-title">Maintenance</h1>
        <p class="mnt-sub">{{ requests().length }} requests · {{ propertyCtx.active()?.name }}</p>
      </div>
    </div>

    <div class="mnt-toolbar">
      <div class="search-box">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input type="text" placeholder="Search…" [ngModel]="search()" (ngModelChange)="search.set($event)" class="search-input" />
      </div>
      <select class="filter-select" [ngModel]="filterPriority()" (ngModelChange)="filterPriority.set($event)">
        <option value="">All Priority</option>
        @for (p of priorities; track p.value) {
          <option [value]="p.value">{{ p.label }}</option>
        }
      </select>
      <select class="filter-select" [ngModel]="filterCategory()" (ngModelChange)="filterCategory.set($event)">
        <option value="">All Categories</option>
        @for (c of categories; track c.value) {
          <option [value]="c.value">{{ c.icon }} {{ c.label }}</option>
        }
      </select>
      <div class="view-toggle">
        <button class="view-btn" [class.active]="view() === 'kanban'" (click)="view.set('kanban')" title="Kanban">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="2" width="4" height="12" rx="1" fill="currentColor"/>
            <rect x="6" y="2" width="4" height="9"  rx="1" fill="currentColor"/>
            <rect x="11" y="2" width="4" height="6" rx="1" fill="currentColor"/>
          </svg>
        </button>
        <button class="view-btn" [class.active]="view() === 'list'" (click)="view.set('list')" title="List">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <button class="btn-new" (click)="openNewForm()">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        New Request
      </button>
    </div>
  </header>

  <!-- ── KPI STRIP ──────────────────────────────────────── -->
  <div class="kpi-strip">
    @for (col of columns; track col.status) {
      <button class="kpi-tile"
              [class.kpi-active]="statusFilter() === col.status"
              (click)="toggleStatus(col.status)"
              [style.--col]="col.color">
        <span class="kpi-num">{{ countByStatus(col.status) }}</span>
        <span class="kpi-lbl">{{ col.label }}</span>
        <span class="kpi-bar" [style.background]="col.color"></span>
      </button>
    }
    <div class="kpi-tile kpi-urgent" [class.kpi-active]="filterPriority() === 'urgent'">
      <span class="kpi-num urgent-num">{{ countByPriority('urgent') }}</span>
      <span class="kpi-lbl">Urgent</span>
    </div>
  </div>

  <!-- ── LOADING ─────────────────────────────────────────── -->
  @if (loading()) {
    <div class="mnt-loading">
      <div class="spinner"></div>
      <span>Loading requests…</span>
    </div>
  } @else {

    <!-- ── KANBAN VIEW ─────────────────────────────────────── -->
    @if (view() === 'kanban') {
      <div class="kanban-board">
        @for (col of visibleColumns(); track col.status) {
          <div class="kanban-col">
            <div class="col-header" [style.--col-color]="col.color">
              <div class="col-hl">
                <span class="col-dot" [style.background]="col.color"></span>
                <span class="col-label">{{ col.label }}</span>
              </div>
              <span class="col-count" [style.color]="col.color" [style.background]="col.bg">
                {{ filteredByCol(col.status).length }}
              </span>
            </div>
            <div class="col-body">
              @if (filteredByCol(col.status).length === 0) {
                <div class="col-empty">No requests</div>
              }
              @for (req of filteredByCol(col.status); track req.id) {
                <button class="req-card" [class.selected]="selectedReq()?.id === req.id"
                        (click)="selectReq(req)">
                  <div class="req-card-top">
                    <span class="priority-chip"
                          [style.background]="PRIORITY_META[req.priority]?.bg"
                          [style.color]="PRIORITY_META[req.priority]?.color">
                      {{ PRIORITY_META[req.priority]?.label }}
                    </span>
                    <span class="cat-icon">{{ catIcon(req.category) }}</span>
                  </div>
                  <div class="req-title">{{ req.title }}</div>
                  @if (req.roomId) {
                    <div class="req-loc">Room {{ roomNumber(req.roomId) }}</div>
                  } @else if (req.location) {
                    <div class="req-loc">{{ req.location }}</div>
                  }
                  @if (req.assignedTo) {
                    <div class="req-assignee">
                      <span class="avatar-xs">{{ staffInitials(req.assignedTo) }}</span>
                      <span>{{ staffName(req.assignedTo) }}</span>
                    </div>
                  } @else {
                    <div class="req-unassigned">Unassigned</div>
                  }
                  <div class="req-time">{{ req.reportedAt | date:'MMM d, HH:mm' }}</div>
                </button>
              }
            </div>
          </div>
        }
      </div>
    }

    <!-- ── LIST VIEW ──────────────────────────────────────── -->
    @if (view() === 'list') {
      <div class="list-view">
        <div class="list-table">
          <div class="list-head">
            <div class="lh lh-priority">Priority</div>
            <div class="lh lh-title">Issue</div>
            <div class="lh lh-cat">Category</div>
            <div class="lh lh-loc">Location</div>
            <div class="lh lh-assignee">Assignee</div>
            <div class="lh lh-status">Status</div>
            <div class="lh lh-date">Reported</div>
          </div>
          @for (req of filteredList(); track req.id) {
            <button class="list-row" [class.selected]="selectedReq()?.id === req.id"
                    (click)="selectReq(req)">
              <div class="ld ld-priority">
                <span class="priority-chip"
                      [style.background]="PRIORITY_META[req.priority]?.bg"
                      [style.color]="PRIORITY_META[req.priority]?.color">
                  {{ PRIORITY_META[req.priority]?.label }}
                </span>
              </div>
              <div class="ld ld-title">{{ req.title }}</div>
              <div class="ld ld-cat">{{ catIcon(req.category) }} {{ catLabel(req.category) }}</div>
              <div class="ld ld-loc">
                {{ req.roomId ? 'Room ' + roomNumber(req.roomId) : (req.location ?? '—') }}
              </div>
              <div class="ld ld-assignee">
                @if (req.assignedTo) {
                  <span class="avatar-xs">{{ staffInitials(req.assignedTo) }}</span>
                  <span class="assignee-name">{{ staffName(req.assignedTo) }}</span>
                } @else {
                  <span class="unassigned-txt">—</span>
                }
              </div>
              <div class="ld ld-status">
                <span class="status-chip" [attr.data-status]="req.status">
                  {{ statusLabel(req.status) }}
                </span>
              </div>
              <div class="ld ld-date">{{ req.reportedAt | date:'MMM d' }}</div>
            </button>
          }
        </div>
      </div>
    }
  }

  <!-- ── DETAIL DRAWER ──────────────────────────────────── -->
  @if (selectedReq()) {
    <div class="drawer-overlay" (click)="closeDrawer()"></div>
    <aside class="detail-drawer">
      <div class="drawer-head">
        <div>
          <div class="drawer-req-title">{{ selectedReq()!.title }}</div>
          <div class="drawer-req-sub">
            {{ catIcon(selectedReq()!.category) }} {{ catLabel(selectedReq()!.category) }}
            @if (selectedReq()!.roomId) { · Room {{ roomNumber(selectedReq()!.roomId!) }} }
            @else if (selectedReq()!.location) { · {{ selectedReq()!.location }} }
          </div>
        </div>
        <button class="drawer-close" (click)="closeDrawer()">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- priority -->
      <div class="drawer-section">
        <label class="field-label">Priority</label>
        <div class="priority-row">
          @for (p of priorities; track p.value) {
            <button class="priority-btn"
                    [class.active]="selectedReq()!.priority === p.value"
                    [style.--pc]="p.color" [style.--pb]="p.bg"
                    (click)="changePriority(p.value)">
              {{ p.label }}
            </button>
          }
        </div>
      </div>

      <!-- status progression -->
      <div class="drawer-section">
        <label class="field-label">Status</label>
        <div class="status-flow">
          @for (col of columns; track col.status; let i = $index) {
            <button class="flow-step"
                    [class.done]="isStatusDone(col.status)"
                    [class.current]="selectedReq()!.status === col.status"
                    [style.--sc]="col.color" [style.--sb]="col.bg"
                    (click)="changeStatus(col.status)"
                    [disabled]="actionBusy()">
              <span class="flow-num">{{ i + 1 }}</span>
              <span class="flow-label">{{ col.label }}</span>
            </button>
            @if (i < columns.length - 1) {
              <span class="flow-arrow">→</span>
            }
          }
        </div>
      </div>

      <!-- assign -->
      <div class="drawer-section">
        <label class="field-label">Assigned To</label>
        <select class="field-select"
                [ngModel]="selectedReq()!.assignedTo ?? ''"
                (ngModelChange)="assignStaff($event)"
                [disabled]="actionBusy()">
          <option value="">— Unassigned —</option>
          @for (s of techStaff(); track s.id) {
            <option [value]="s.id">{{ s.firstName }} {{ s.lastName }}</option>
          }
        </select>
      </div>

      <!-- description -->
      <div class="drawer-section">
        <label class="field-label">Description</label>
        <div class="field-body">{{ selectedReq()!.description || 'No description.' }}</div>
      </div>

      <!-- resolution notes (for resolved/closed) -->
      @if (selectedReq()!.status === MntStatus.Resolved || selectedReq()!.status === MntStatus.Closed) {
        <div class="drawer-section">
          <label class="field-label">Resolution Notes</label>
          <textarea class="field-textarea" [(ngModel)]="resolutionDraft" rows="3"
                    placeholder="Describe how the issue was resolved…"></textarea>
          @if (resolutionDraft !== (selectedReq()!.resolutionNotes ?? '')) {
            <button class="btn-save" (click)="saveResolution()" [disabled]="actionBusy()">Save</button>
          }
        </div>
      }

      <!-- mark resolved shortcut -->
      @if (selectedReq()!.status === MntStatus.InProgress) {
        <div class="drawer-section">
          <button class="btn-resolve" (click)="changeStatus(MntStatus.Resolved)" [disabled]="actionBusy()">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Mark as Resolved
          </button>
        </div>
      }

      <!-- meta -->
      <div class="drawer-section drawer-meta">
        <div class="meta-row">
          <span class="meta-k">Reported by</span>
          <span class="meta-v">{{ staffName(selectedReq()!.reportedBy) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-k">Reported at</span>
          <span class="meta-v">{{ selectedReq()!.reportedAt | date:'MMM d, HH:mm' }}</span>
        </div>
        @if (selectedReq()!.resolvedAt) {
          <div class="meta-row">
            <span class="meta-k">Resolved at</span>
            <span class="meta-v success">{{ selectedReq()!.resolvedAt | date:'MMM d, HH:mm' }}</span>
          </div>
        }
        <div class="meta-row">
          <span class="meta-k">ID</span>
          <span class="meta-v mono">{{ selectedReq()!.id }}</span>
        </div>
      </div>
    </aside>
  }

  <!-- ── NEW REQUEST FORM ────────────────────────────────── -->
  @if (showNewForm()) {
    <div class="drawer-overlay" (click)="closeNewForm()"></div>
    <aside class="new-form-drawer">
      <div class="drawer-head">
        <div>
          <div class="drawer-req-title">New Maintenance Request</div>
          <div class="drawer-req-sub">Report an issue</div>
        </div>
        <button class="drawer-close" (click)="closeNewForm()">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="drawer-section">
        <label class="field-label">Title *</label>
        <input class="field-input" [(ngModel)]="newTitle" placeholder="e.g. Leaking pipe in bathroom" />
      </div>

      <div class="drawer-section">
        <label class="field-label">Category</label>
        <div class="cat-grid">
          @for (c of categories; track c.value) {
            <button class="cat-btn" [class.active]="newCategory === c.value"
                    (click)="newCategory = c.value">
              <span class="cat-btn-icon">{{ c.icon }}</span>
              <span>{{ c.label }}</span>
            </button>
          }
        </div>
      </div>

      <div class="drawer-section">
        <label class="field-label">Priority</label>
        <div class="priority-row">
          @for (p of priorities; track p.value) {
            <button class="priority-btn" [class.active]="newPriority === p.value"
                    [style.--pc]="p.color" [style.--pb]="p.bg"
                    (click)="newPriority = p.value">
              {{ p.label }}
            </button>
          }
        </div>
      </div>

      <div class="form-row">
        <div class="drawer-section" style="flex:1">
          <label class="field-label">Room (optional)</label>
          <select class="field-select" [(ngModel)]="newRoomId">
            <option value="">— Common Area —</option>
            @for (r of rooms(); track r.id) {
              <option [value]="r.id">Room {{ r.number }}</option>
            }
          </select>
        </div>
        <div class="drawer-section" style="flex:1">
          <label class="field-label">Location (if no room)</label>
          <input class="field-input" [(ngModel)]="newLocation" placeholder="e.g. Pool deck" [disabled]="!!newRoomId" />
        </div>
      </div>

      <div class="drawer-section">
        <label class="field-label">Description</label>
        <textarea class="field-textarea" [(ngModel)]="newDescription" rows="3"
                  placeholder="Describe the issue in detail…"></textarea>
      </div>

      <div class="drawer-section">
        <label class="field-label">Assign To (optional)</label>
        <select class="field-select" [(ngModel)]="newAssignedTo">
          <option value="">— Unassigned —</option>
          @for (s of techStaff(); track s.id) {
            <option [value]="s.id">{{ s.firstName }} {{ s.lastName }}</option>
          }
        </select>
      </div>

      <div class="form-actions">
        <button class="btn-cancel" (click)="closeNewForm()">Cancel</button>
        <button class="btn-submit" (click)="submitNew()" [disabled]="!newTitle.trim() || actionBusy()">
          @if (actionBusy()) { Submitting… } @else { Submit Request }
        </button>
      </div>
    </aside>
  }
</div>
  `,
  styles: [`
    .mnt-page {
      height: 100%; display: flex; flex-direction: column; overflow: hidden;
      background: var(--bg);
    }

    /* ── header ── */
    .mnt-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-3); padding: var(--space-4) var(--space-6);
      background: var(--surface); border-bottom: 1px solid var(--border);
      flex-shrink: 0; flex-wrap: wrap;
    }
    .mnt-title-block { display: flex; align-items: center; gap: var(--space-3); }
    .mnt-icon-wrap {
      width: 40px; height: 40px; border-radius: var(--radius-lg);
      background: #F0FDF4; display: flex; align-items: center; justify-content: center;
      font-size: 20px; flex-shrink: 0;
    }
    .mnt-title { font-size: var(--text-xl); font-weight: 700; margin: 0; }
    .mnt-sub   { font-size: var(--text-sm); color: var(--text-muted); margin: 0; }

    .mnt-toolbar { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
    .search-box {
      display: flex; align-items: center; gap: var(--space-2);
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: 6px 10px; color: var(--text-muted);
    }
    .search-input { border: none; background: transparent; outline: none; font-size: var(--text-sm); color: var(--text); width: 120px; }
    .filter-select {
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface-2); padding: 6px 10px;
      font-size: var(--text-sm); color: var(--text); outline: none; cursor: pointer;
    }
    .view-toggle { display: flex; border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
    .view-btn {
      padding: 6px 10px; background: var(--surface-2); border: none; cursor: pointer;
      color: var(--text-muted); transition: all var(--t-fast);
    }
    .view-btn.active { background: var(--primary); color: white; }
    .btn-new {
      display: flex; align-items: center; gap: var(--space-1);
      background: var(--primary); color: white; border: none;
      border-radius: var(--radius-md); padding: 7px 14px;
      font-size: var(--text-sm); font-weight: 600; cursor: pointer;
      transition: opacity var(--t-fast);
    }
    .btn-new:hover { opacity: .9; }

    /* ── kpi strip ── */
    .kpi-strip {
      display: flex; gap: var(--space-2); padding: var(--space-3) var(--space-6);
      background: var(--surface); border-bottom: 1px solid var(--border);
      flex-shrink: 0; overflow-x: auto;
    }
    .kpi-tile {
      flex: 1; min-width: 80px; padding: var(--space-2) var(--space-3);
      border: 1.5px solid var(--border); border-radius: var(--radius-lg);
      background: var(--surface); cursor: pointer; text-align: center;
      position: relative; overflow: hidden;
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      transition: border-color var(--t-fast);
    }
    .kpi-tile.kpi-active { border-color: var(--col, var(--primary)); background: color-mix(in srgb, var(--col, var(--primary)) 8%, white); }
    .kpi-num { font-size: var(--text-2xl); font-weight: 800; color: var(--text); line-height: 1; }
    .kpi-lbl { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); }
    .kpi-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; }
    .kpi-urgent { border-style: dashed; }
    .urgent-num { color: var(--danger); }

    /* ── kanban ── */
    .kanban-board {
      display: flex; gap: var(--space-4); padding: var(--space-4) var(--space-6);
      flex: 1; overflow-x: auto; overflow-y: hidden; align-items: flex-start;
    }
    .kanban-col {
      flex: 0 0 280px; display: flex; flex-direction: column;
      background: var(--surface-2); border-radius: var(--radius-xl);
      border: 1px solid var(--border); overflow: hidden; height: 100%;
    }
    .col-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 2px solid var(--col-color);
      background: var(--surface); flex-shrink: 0;
    }
    .col-hl { display: flex; align-items: center; gap: var(--space-2); }
    .col-dot { width: 8px; height: 8px; border-radius: 50%; }
    .col-label { font-size: var(--text-sm); font-weight: 700; }
    .col-count { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-full); }
    .col-body { flex: 1; overflow-y: auto; padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
    .col-empty { text-align: center; padding: var(--space-8); font-size: var(--text-sm); color: var(--text-subtle); }

    /* ── request card ── */
    .req-card {
      background: var(--surface); border: 1.5px solid var(--border);
      border-radius: var(--radius-lg); padding: var(--space-3);
      cursor: pointer; text-align: left; width: 100%;
      transition: border-color var(--t-fast), box-shadow var(--t-fast), transform var(--t-fast);
      display: flex; flex-direction: column; gap: 5px;
    }
    .req-card:hover { border-color: var(--primary); box-shadow: 0 2px 10px rgba(37,99,235,.1); transform: translateY(-1px); }
    .req-card.selected { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
    .req-card-top { display: flex; align-items: center; justify-content: space-between; }
    .priority-chip {
      font-size: 10px; font-weight: 700; padding: 2px 8px;
      border-radius: var(--radius-full); letter-spacing: .03em;
    }
    .cat-icon { font-size: 14px; }
    .req-title { font-size: var(--text-sm); font-weight: 600; color: var(--text); line-height: 1.3; }
    .req-loc { font-size: 11px; color: var(--text-muted); }
    .req-assignee { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); }
    .req-unassigned { font-size: 11px; color: var(--text-subtle); font-style: italic; }
    .req-time { font-size: 10px; color: var(--text-subtle); }

    /* ── list view ── */
    .list-view { flex: 1; overflow: auto; padding: var(--space-4) var(--space-6); }
    .list-table { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); overflow: hidden; }
    .list-head {
      display: grid; grid-template-columns: 80px 1fr 110px 110px 130px 100px 80px;
      padding: 10px var(--space-4); background: var(--surface-2);
      border-bottom: 1px solid var(--border); font-size: 11px; font-weight: 700;
      color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em;
    }
    .list-row {
      display: grid; grid-template-columns: 80px 1fr 110px 110px 130px 100px 80px;
      padding: 12px var(--space-4); border-bottom: 1px solid var(--border);
      cursor: pointer; text-align: left; width: 100%; background: transparent;
      transition: background var(--t-fast);
      align-items: center;
    }
    .list-row:last-child { border-bottom: none; }
    .list-row:hover { background: var(--surface-2); }
    .list-row.selected { background: color-mix(in srgb, var(--primary) 6%, white); }
    .ld { font-size: var(--text-sm); color: var(--text); display: flex; align-items: center; gap: 5px; }
    .ld-title { font-weight: 500; }
    .ld-cat, .ld-date { color: var(--text-muted); }
    .status-chip {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: var(--radius-full);
    }
    .status-chip[data-status="open"]        { background: var(--danger-bg);  color: var(--danger); }
    .status-chip[data-status="assigned"]    { background: var(--warning-bg); color: var(--warning); }
    .status-chip[data-status="in_progress"] { background: var(--info-bg);    color: var(--info); }
    .status-chip[data-status="resolved"]    { background: var(--success-bg); color: var(--success); }
    .status-chip[data-status="closed"]      { background: var(--surface-2);  color: var(--text-muted); }
    .assignee-name { font-size: 11px; color: var(--text-muted); }
    .unassigned-txt { color: var(--text-subtle); }

    /* ── loading ── */
    .mnt-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: var(--space-3); color: var(--text-muted); }
    .spinner { width: 32px; height: 32px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 700ms linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── drawer shared ── */
    .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.3); z-index: 100; animation: fadeIn 150ms ease; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .detail-drawer, .new-form-drawer {
      position: fixed; top: 0; right: 0; bottom: 0; width: min(420px, 100vw);
      background: var(--surface); border-left: 1px solid var(--border); z-index: 101;
      display: flex; flex-direction: column; overflow-y: auto; padding: var(--space-6);
      animation: slideIn 200ms cubic-bezier(.4,0,.2,1);
    }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

    .drawer-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-5); }
    .drawer-req-title { font-size: var(--text-xl); font-weight: 800; color: var(--text); line-height: 1.2; }
    .drawer-req-sub   { font-size: var(--text-sm); color: var(--text-muted); margin-top: 4px; }
    .drawer-close {
      width: 32px; height: 32px; border-radius: var(--radius-md);
      border: 1px solid var(--border); background: var(--surface-2);
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      color: var(--text-muted); flex-shrink: 0;
    }
    .drawer-close:hover { background: var(--danger-bg); color: var(--danger); border-color: var(--danger); }

    .drawer-section { margin-bottom: var(--space-5); padding-bottom: var(--space-5); border-bottom: 1px solid var(--border); }
    .drawer-section:last-child { border-bottom: none; }
    .field-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin-bottom: var(--space-2); }
    .field-select, .field-input, .field-textarea {
      width: 100%; border: 1.5px solid var(--border); border-radius: var(--radius-md);
      padding: 8px 10px; font-size: var(--text-sm); color: var(--text);
      background: var(--surface-2); outline: none; font-family: inherit;
    }
    .field-select:focus, .field-input:focus, .field-textarea:focus { border-color: var(--primary); }
    .field-textarea { resize: vertical; }
    .field-body { font-size: var(--text-sm); color: var(--text); line-height: 1.6; }

    /* priority row */
    .priority-row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
    .priority-btn {
      padding: 5px 14px; border-radius: var(--radius-full);
      font-size: 11px; font-weight: 600; cursor: pointer;
      border: 1.5px solid var(--border); background: var(--surface-2);
      color: var(--text-muted); transition: all var(--t-fast);
    }
    .priority-btn.active { background: var(--pb); color: var(--pc); border-color: var(--pc); }

    /* status flow */
    .status-flow { display: flex; align-items: center; gap: var(--space-1); flex-wrap: wrap; }
    .flow-step {
      display: flex; align-items: center; gap: 5px;
      padding: 6px 10px; border-radius: var(--radius-md);
      border: 1.5px solid var(--border); background: var(--surface-2);
      font-size: 11px; font-weight: 600; cursor: pointer;
      color: var(--text-muted); transition: all var(--t-fast);
    }
    .flow-step.done    { background: var(--sb); color: var(--sc); border-color: var(--sc); opacity: .7; }
    .flow-step.current { background: var(--sb); color: var(--sc); border-color: var(--sc); opacity: 1; font-weight: 800; }
    .flow-step:disabled { cursor: not-allowed; opacity: .5; }
    .flow-num { width: 16px; height: 16px; border-radius: 50%; background: currentColor; color: white; font-size: 9px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
    .flow-label { font-size: 11px; }
    .flow-arrow { color: var(--text-subtle); font-size: 12px; }

    /* buttons */
    .btn-resolve, .btn-save, .btn-submit, .btn-cancel {
      display: inline-flex; align-items: center; gap: var(--space-2);
      padding: 9px 16px; border-radius: var(--radius-md);
      font-size: var(--text-sm); font-weight: 600; cursor: pointer;
      border: none; transition: opacity var(--t-fast);
    }
    .btn-resolve { background: var(--success); color: white; width: 100%; justify-content: center; }
    .btn-save    { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); font-size: 12px; margin-top: var(--space-2); }
    .btn-submit  { background: var(--primary); color: white; }
    .btn-cancel  { background: var(--surface-2); border: 1px solid var(--border); color: var(--text-muted); }
    .btn-resolve:hover:not(:disabled), .btn-save:hover, .btn-submit:hover:not(:disabled) { opacity: .9; }
    .btn-submit:disabled { opacity: .5; cursor: not-allowed; }

    /* meta */
    .drawer-meta { display: flex; flex-direction: column; gap: var(--space-2); }
    .meta-row { display: flex; justify-content: space-between; align-items: center; }
    .meta-k { font-size: var(--text-xs); color: var(--text-muted); }
    .meta-v { font-size: var(--text-sm); font-weight: 600; color: var(--text); }
    .meta-v.success { color: var(--success); }
    .meta-v.mono { font-family: monospace; font-size: 11px; }

    /* avatars */
    .avatar-xs {
      width: 20px; height: 20px; border-radius: 50%;
      background: var(--primary); color: white; font-size: 9px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }

    /* new form */
    .cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
    .cat-btn {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: var(--space-2) var(--space-1); border-radius: var(--radius-md);
      border: 1.5px solid var(--border); background: var(--surface-2);
      cursor: pointer; font-size: 11px; color: var(--text-muted);
      transition: all var(--t-fast);
    }
    .cat-btn.active { border-color: var(--primary); background: var(--info-bg); color: var(--primary); }
    .cat-btn-icon { font-size: 18px; }
    .form-row { display: flex; gap: var(--space-3); }
    .form-actions {
      display: flex; gap: var(--space-3); justify-content: flex-end;
      padding-top: var(--space-4);
    }

    /* ── responsive ── */
    @media (max-width: 768px) {
      .mnt-header { padding: var(--space-3) var(--space-4); }
      .mnt-toolbar { width: 100%; }
      .kanban-board { padding: var(--space-3) var(--space-4); gap: var(--space-3); }
      .kanban-col { flex: 0 0 260px; }
      .list-head, .list-row { grid-template-columns: 70px 1fr 90px 90px; }
      .lh-assignee, .lh-date, .ld-assignee, .ld-date { display: none; }
      .detail-drawer, .new-form-drawer { width: 100vw; top: auto; height: 90vh; border-radius: var(--radius-xl) var(--radius-xl) 0 0; border-left: none; border-top: 1px solid var(--border); }
      .form-row { flex-direction: column; }
    }
  `],
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
