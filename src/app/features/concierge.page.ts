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
  template: `
<div class="con-page">

  <!-- ── HEADER ─────────────────────────────────────────── -->
  <header class="con-header">
    <div class="con-title-block">
      <div class="con-icon-wrap">🛎️</div>
      <div>
        <h1 class="con-title">Concierge</h1>
        <p class="con-sub">{{ requests().length }} requests · {{ propertyCtx.active()?.name }}</p>
      </div>
    </div>

    <div class="con-toolbar">
      <div class="search-box">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input type="text" placeholder="Search guest or request…"
               [ngModel]="search()" (ngModelChange)="search.set($event)" class="search-input" />
      </div>
      <select class="filter-select" [ngModel]="filterType()" (ngModelChange)="filterType.set($event)">
        <option value="">All Types</option>
        @for (t of uniqueTypes(); track t.value) {
          <option [value]="t.value">{{ t.icon }} {{ t.label }}</option>
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
    <div class="kpi-tile kpi-sla">
      <span class="kpi-num overdue-num">{{ countOverdue() }}</span>
      <span class="kpi-lbl">Overdue SLA</span>
    </div>
  </div>

  <!-- ── LOADING ─────────────────────────────────────────── -->
  @if (loading()) {
    <div class="con-loading">
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
                    <span class="type-chip">
                      {{ typeIcon(req.type) }} {{ typeLabel(req.type) }}
                    </span>
                    @if (isOverdue(req)) {
                      <span class="sla-chip overdue">⚡ Overdue</span>
                    }
                  </div>
                  <p class="req-details">{{ req.details }}</p>
                  <div class="req-card-meta">
                    <span class="req-guest">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                      {{ guestName(req.guestId) }}
                    </span>
                    <span class="req-room">Rm {{ roomNumber(req.roomId) }}</span>
                  </div>
                  <div class="req-card-footer">
                    <span class="req-time">{{ req.requestedAt | date:'HH:mm' }}</span>
                    @if (req.assignedTo) {
                      <span class="req-assignee">{{ staffInitials(req.assignedTo) }}</span>
                    }
                  </div>
                </button>
              }
            </div>
          </div>
        }
      </div>
    }

    <!-- ── LIST VIEW ──────────────────────────────────────── -->
    @if (view() === 'list') {
      <div class="list-wrap">
        <table class="req-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Guest</th>
              <th>Room</th>
              <th>Details</th>
              <th>Assignee</th>
              <th>Status</th>
              <th>Requested</th>
              <th>SLA</th>
            </tr>
          </thead>
          <tbody>
            @for (req of filteredList(); track req.id) {
              <tr class="req-row" [class.selected]="selectedReq()?.id === req.id" (click)="selectReq(req)">
                <td>
                  <span class="type-chip sm">{{ typeIcon(req.type) }} {{ typeLabel(req.type) }}</span>
                </td>
                <td class="td-guest">{{ guestName(req.guestId) }}</td>
                <td class="td-room">{{ roomNumber(req.roomId) }}</td>
                <td class="td-details">{{ req.details }}</td>
                <td class="td-assignee">
                  @if (req.assignedTo) {
                    <span class="assignee-badge">{{ staffInitials(req.assignedTo) }}</span>
                    <span class="assignee-name">{{ staffName(req.assignedTo) }}</span>
                  } @else {
                    <span class="unassigned">—</span>
                  }
                </td>
                <td>
                  <span class="status-badge" [style.color]="statusColor(req.status)" [style.background]="statusBg(req.status)">
                    {{ statusLabel(req.status) }}
                  </span>
                </td>
                <td class="td-time">{{ req.requestedAt | date:'MMM d, HH:mm' }}</td>
                <td>
                  @if (isOverdue(req)) {
                    <span class="sla-chip overdue">Overdue</span>
                  } @else if (req.status === ConStatus.Completed || req.status === ConStatus.Cancelled) {
                    <span class="sla-chip done">Done</span>
                  } @else {
                    <span class="sla-chip ok">{{ slaRemaining(req) }}</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (filteredList().length === 0) {
          <div class="empty-list">No requests match your filters.</div>
        }
      </div>
    }

  }

  <!-- ── DETAIL DRAWER ──────────────────────────────────── -->
  @if (selectedReq()) {
    <div class="drawer-backdrop" (click)="closeDrawer()"></div>
    <aside class="detail-drawer">
      <div class="drawer-header">
        <div class="drawer-title-row">
          <span class="drawer-type">{{ typeIcon(selectedReq()!.type) }} {{ typeLabel(selectedReq()!.type) }}</span>
          <button class="drawer-close" (click)="closeDrawer()">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <span class="status-badge lg"
              [style.color]="statusColor(selectedReq()!.status)"
              [style.background]="statusBg(selectedReq()!.status)">
          {{ statusLabel(selectedReq()!.status) }}
        </span>
      </div>

      <!-- Guest card -->
      <div class="drawer-section">
        <div class="guest-card">
          <div class="guest-avatar">{{ guestInitials(selectedReq()!.guestId) }}</div>
          <div class="guest-info">
            <span class="guest-name-lg">{{ guestName(selectedReq()!.guestId) }}</span>
            <span class="guest-room">Room {{ roomNumber(selectedReq()!.roomId) }}</span>
          </div>
        </div>
      </div>

      <!-- Details -->
      <div class="drawer-section">
        <p class="section-label">Request Details</p>
        <p class="details-text">{{ selectedReq()!.details }}</p>
      </div>

      @if (selectedReq()!.scheduledFor) {
        <div class="drawer-section">
          <p class="section-label">Scheduled For</p>
          <p class="details-text">{{ selectedReq()!.scheduledFor | date:'EEE, MMM d · HH:mm' }}</p>
        </div>
      }

      <!-- SLA indicator -->
      <div class="drawer-section">
        <p class="section-label">Timeline</p>
        <div class="timeline-row">
          <div class="timeline-item">
            <span class="tl-label">Requested</span>
            <span class="tl-value">{{ selectedReq()!.requestedAt | date:'HH:mm' }}</span>
          </div>
          <div class="timeline-item">
            <span class="tl-label">SLA</span>
            <span class="tl-value">{{ getSla(selectedReq()!.type) }} min</span>
          </div>
          @if (selectedReq()!.completedAt) {
            <div class="timeline-item">
              <span class="tl-label">Completed</span>
              <span class="tl-value">{{ selectedReq()!.completedAt | date:'HH:mm' }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Assign staff -->
      <div class="drawer-section">
        <p class="section-label">Assigned To</p>
        <select class="form-select" [ngModel]="selectedReq()!.assignedTo ?? ''"
                (ngModelChange)="assignStaff($event)"
                [disabled]="actionBusy()">
          <option value="">— Unassigned —</option>
          @for (s of staffList(); track s.id) {
            <option [value]="s.id">{{ s.firstName }} {{ s.lastName }}</option>
          }
        </select>
      </div>

      <!-- Status actions -->
      <div class="drawer-section">
        <p class="section-label">Update Status</p>
        <div class="status-actions">
          @for (col of columns; track col.status) {
            <button class="status-action-btn"
                    [class.current]="selectedReq()!.status === col.status"
                    [style.--col]="col.color"
                    [disabled]="selectedReq()!.status === col.status || actionBusy()"
                    (click)="changeStatus(col.status)">
              {{ col.label }}
            </button>
          }
        </div>
      </div>

      @if (actionBusy()) {
        <div class="drawer-busy">
          <div class="spinner sm"></div> Saving…
        </div>
      }
    </aside>
  }

  <!-- ── NEW REQUEST FORM ───────────────────────────────── -->
  @if (showNewForm()) {
    <div class="drawer-backdrop" (click)="closeNewForm()"></div>
    <aside class="detail-drawer new-form-drawer">
      <div class="drawer-header">
        <div class="drawer-title-row">
          <span class="drawer-type">🛎️ New Concierge Request</span>
          <button class="drawer-close" (click)="closeNewForm()">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="drawer-section">
        <label class="form-label">Request Type *</label>
        <select class="form-select" [(ngModel)]="newType">
          @for (t of REQUEST_TYPES; track t.value) {
            <option [value]="t.value">{{ t.icon }} {{ t.label }}</option>
          }
        </select>
      </div>

      <div class="drawer-section">
        <label class="form-label">Guest / Reservation *</label>
        <select class="form-select" [(ngModel)]="newReservationId" (ngModelChange)="onReservationChange($event)">
          <option value="">— Select guest —</option>
          @for (r of activeReservations(); track r.id) {
            <option [value]="r.id">{{ guestName(r.guestId) }} · Rm {{ roomNumber(r.roomId) }}</option>
          }
        </select>
      </div>

      <div class="drawer-section">
        <label class="form-label">Details *</label>
        <textarea class="form-textarea" [(ngModel)]="newDetails"
                  placeholder="Describe the request…" rows="3"></textarea>
      </div>

      <div class="drawer-section">
        <label class="form-label">Scheduled For (optional)</label>
        <input class="form-input" type="datetime-local" [(ngModel)]="newScheduledFor" />
      </div>

      <div class="drawer-section">
        <label class="form-label">Assign To</label>
        <select class="form-select" [(ngModel)]="newAssignedTo">
          <option value="">— Unassigned —</option>
          @for (s of staffList(); track s.id) {
            <option [value]="s.id">{{ s.firstName }} {{ s.lastName }}</option>
          }
        </select>
      </div>

      <div class="form-actions">
        <button class="btn-cancel" (click)="closeNewForm()">Cancel</button>
        <button class="btn-submit" (click)="submitNew()"
                [disabled]="!newType || !newReservationId || !newDetails.trim() || actionBusy()">
          @if (actionBusy()) { Saving… } @else { Create Request }
        </button>
      </div>
    </aside>
  }

</div>
  `,
  styles: [`
    .con-page {
      min-height: 100%;
      background: var(--surface-bg, #F8F7F4);
      font-family: var(--font-sans, 'Inter', sans-serif);
      position: relative;
    }
    .con-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; padding: 20px 24px 0; flex-wrap: wrap;
    }
    .con-title-block { display: flex; align-items: center; gap: 12px; }
    .con-icon-wrap {
      width: 44px; height: 44px; background: #EDE9FE; border-radius: 12px;
      display: flex; align-items: center; justify-content: center; font-size: 22px;
    }
    .con-title { margin: 0; font-size: 22px; font-weight: 700; color: var(--text-primary, #1C1917); letter-spacing: -0.4px; }
    .con-sub { margin: 2px 0 0; font-size: 12px; color: var(--text-muted, #78716C); }
    .con-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

    .search-box {
      display: flex; align-items: center; gap: 6px;
      background: var(--surface-card, #fff);
      border: 1px solid var(--border, #E7E5E4); border-radius: 8px;
      padding: 0 10px; height: 34px; color: var(--text-muted, #78716C);
    }
    .search-input {
      border: none; outline: none; background: transparent;
      font-size: 13px; color: var(--text-primary, #1C1917); width: 180px;
    }
    .search-input::placeholder { color: var(--text-muted, #78716C); }
    .filter-select {
      height: 34px; border-radius: 8px; font-size: 13px;
      border: 1px solid var(--border, #E7E5E4);
      background: var(--surface-card, #fff);
      color: var(--text-primary, #1C1917); padding: 0 10px; cursor: pointer;
    }
    .view-toggle {
      display: flex; background: var(--surface-card, #fff);
      border: 1px solid var(--border, #E7E5E4); border-radius: 8px; overflow: hidden;
    }
    .view-btn {
      width: 34px; height: 34px; border: none; background: transparent;
      cursor: pointer; color: var(--text-muted, #78716C);
      display: flex; align-items: center; justify-content: center; transition: background .15s, color .15s;
    }
    .view-btn.active { background: #EDE9FE; color: #7C3AED; }
    .view-btn:hover:not(.active) { background: var(--surface-hover, #F5F5F4); }
    .btn-new {
      display: flex; align-items: center; gap: 6px;
      height: 34px; padding: 0 14px;
      background: #7C3AED; color: #fff;
      border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: background .15s;
    }
    .btn-new:hover { background: #6D28D9; }

    .kpi-strip { display: flex; gap: 10px; padding: 16px 24px; overflow-x: auto; }
    .kpi-tile {
      flex: 0 0 auto; min-width: 90px;
      background: var(--surface-card, #fff);
      border: 1.5px solid var(--border, #E7E5E4); border-radius: 12px; padding: 12px 14px;
      cursor: pointer; text-align: left; position: relative; overflow: hidden;
      transition: border-color .15s, box-shadow .15s;
    }
    .kpi-tile:hover { border-color: var(--col, #7C3AED); }
    .kpi-tile.kpi-active { border-color: var(--col, #7C3AED); box-shadow: 0 0 0 2px color-mix(in srgb, var(--col, #7C3AED) 20%, transparent); }
    .kpi-num { display: block; font-size: 24px; font-weight: 700; color: var(--text-primary, #1C1917); line-height: 1; }
    .kpi-lbl { display: block; font-size: 11px; color: var(--text-muted, #78716C); margin-top: 3px; }
    .kpi-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; }
    .kpi-sla { --col: #DC2626; }
    .overdue-num { color: #DC2626; }

    .con-loading {
      display: flex; align-items: center; gap: 10px;
      padding: 48px 24px; color: var(--text-muted, #78716C); font-size: 14px;
    }
    .spinner {
      width: 18px; height: 18px; border: 2px solid var(--border, #E7E5E4);
      border-top-color: #7C3AED; border-radius: 50%; animation: spin .7s linear infinite;
    }
    .spinner.sm { width: 14px; height: 14px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .kanban-board {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 12px; padding: 0 24px 24px; align-items: start;
    }
    .kanban-col {
      background: var(--surface-card, #fff);
      border: 1px solid var(--border, #E7E5E4); border-radius: 14px; overflow: hidden;
    }
    .col-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; border-bottom: 1px solid var(--border, #E7E5E4);
      background: var(--surface-bg, #F8F7F4);
    }
    .col-hl { display: flex; align-items: center; gap: 7px; }
    .col-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .col-label { font-size: 13px; font-weight: 600; color: var(--text-primary, #1C1917); }
    .col-count { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
    .col-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 80px; }
    .col-empty { font-size: 12px; color: var(--text-muted, #78716C); text-align: center; padding: 16px 0; }

    .req-card {
      width: 100%; text-align: left;
      background: var(--surface-bg, #F8F7F4);
      border: 1.5px solid var(--border, #E7E5E4); border-radius: 10px; padding: 10px 12px;
      cursor: pointer; transition: border-color .15s, box-shadow .15s;
    }
    .req-card:hover { border-color: #7C3AED; box-shadow: 0 1px 6px rgba(124,58,237,.08); }
    .req-card.selected { border-color: #7C3AED; box-shadow: 0 0 0 2px rgba(124,58,237,.15); }
    .req-card-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px; }
    .req-details {
      font-size: 12px; color: var(--text-secondary, #57534E); margin: 0 0 8px; line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .req-card-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px; }
    .req-guest { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted, #78716C); }
    .req-room { font-size: 11px; color: var(--text-muted, #78716C); }
    .req-card-footer { display: flex; align-items: center; justify-content: space-between; }
    .req-time { font-size: 11px; color: var(--text-muted, #78716C); }
    .req-assignee {
      width: 22px; height: 22px; background: #7C3AED; color: #fff;
      border-radius: 50%; font-size: 9px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }

    .type-chip {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 6px;
      background: #EDE9FE; color: #6D28D9; white-space: nowrap;
    }
    .sla-chip { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 5px; white-space: nowrap; }
    .sla-chip.overdue { background: #FEE2E2; color: #DC2626; }
    .sla-chip.done    { background: #DCFCE7; color: #16A34A; }
    .sla-chip.ok      { background: #F1EDE7; color: #6B7280; }
    .status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
    .status-badge.lg { font-size: 13px; padding: 4px 12px; }

    .list-wrap { padding: 0 24px 24px; overflow-x: auto; }
    .req-table {
      width: 100%; border-collapse: collapse;
      background: var(--surface-card, #fff);
      border: 1px solid var(--border, #E7E5E4); border-radius: 14px; overflow: hidden; font-size: 13px;
    }
    .req-table thead th {
      padding: 10px 14px; text-align: left;
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
      color: var(--text-muted, #78716C); background: var(--surface-bg, #F8F7F4);
      border-bottom: 1px solid var(--border, #E7E5E4);
    }
    .req-table tbody tr { border-bottom: 1px solid var(--border, #E7E5E4); cursor: pointer; transition: background .1s; }
    .req-table tbody tr:last-child { border-bottom: none; }
    .req-table tbody tr:hover { background: #F5F3FF; }
    .req-table tbody tr.selected { background: #EDE9FE; }
    .req-table td { padding: 10px 14px; vertical-align: middle; }
    .td-guest { font-weight: 500; color: var(--text-primary, #1C1917); }
    .td-room { white-space: nowrap; color: var(--text-muted, #78716C); }
    .td-details { max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-secondary, #57534E); }
    .td-assignee { display: flex; align-items: center; gap: 6px; }
    .assignee-badge {
      width: 24px; height: 24px; background: #7C3AED; color: #fff;
      border-radius: 50%; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .assignee-name { font-size: 12px; color: var(--text-secondary, #57534E); }
    .unassigned { color: var(--text-muted, #78716C); }
    .td-time { white-space: nowrap; color: var(--text-muted, #78716C); font-size: 12px; }
    .empty-list { padding: 32px; text-align: center; font-size: 13px; color: var(--text-muted, #78716C); }

    .drawer-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.2);
      z-index: 1200; animation: fadeIn .2s;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .detail-drawer {
      position: fixed; top: var(--topbar-height, 64px); right: 0; bottom: 0; width: 360px;
      background: var(--surface-card, #fff); border-left: 1px solid var(--border, #E7E5E4);
      z-index: 1201; overflow-y: auto;
      animation: slideIn .22s cubic-bezier(.32,.72,0,1);
      display: flex; flex-direction: column;
    }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .drawer-header {
      padding: 20px 20px 16px; border-bottom: 1px solid var(--border, #E7E5E4);
      background: var(--surface-bg, #F8F7F4);
    }
    .drawer-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .drawer-type { font-size: 16px; font-weight: 700; color: var(--text-primary, #1C1917); }
    .drawer-close {
      width: 28px; height: 28px; border: none; background: transparent;
      border-radius: 8px; cursor: pointer; color: var(--text-muted, #78716C);
      display: flex; align-items: center; justify-content: center; transition: background .1s;
    }
    .drawer-close:hover { background: var(--surface-hover, #F5F5F4); }
    .drawer-section { padding: 14px 20px; border-bottom: 1px solid var(--border, #E7E5E4); }
    .section-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .06em; color: var(--text-muted, #78716C); margin: 0 0 8px;
    }
    .guest-card { display: flex; align-items: center; gap: 12px; }
    .guest-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #7C3AED, #A855F7);
      color: #fff; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .guest-name-lg { display: block; font-size: 15px; font-weight: 600; color: var(--text-primary, #1C1917); }
    .guest-room { display: block; font-size: 12px; color: var(--text-muted, #78716C); margin-top: 2px; }
    .details-text { margin: 0; font-size: 13px; color: var(--text-secondary, #57534E); line-height: 1.5; }
    .timeline-row { display: flex; gap: 20px; flex-wrap: wrap; }
    .timeline-item { display: flex; flex-direction: column; gap: 2px; }
    .tl-label { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted, #78716C); }
    .tl-value { font-size: 14px; font-weight: 600; color: var(--text-primary, #1C1917); }
    .status-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .status-action-btn {
      flex: 1 1 auto; min-width: 70px; padding: 7px 10px; border-radius: 8px;
      font-size: 12px; font-weight: 600; border: 1.5px solid var(--col, #7C3AED);
      color: var(--col, #7C3AED); background: transparent; cursor: pointer; transition: background .15s, color .15s;
    }
    .status-action-btn:hover:not(:disabled):not(.current) { background: color-mix(in srgb, var(--col, #7C3AED) 10%, transparent); }
    .status-action-btn.current { background: var(--col, #7C3AED); color: #fff; cursor: default; }
    .status-action-btn:disabled:not(.current) { opacity: .4; cursor: not-allowed; }

    .form-select, .form-input, .form-textarea {
      width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; font-size: 13px;
      border: 1.5px solid var(--border, #E7E5E4); background: var(--surface-card, #fff);
      color: var(--text-primary, #1C1917); outline: none; transition: border-color .15s; font-family: inherit;
    }
    .form-select:focus, .form-input:focus, .form-textarea:focus { border-color: #7C3AED; }
    .form-textarea { resize: vertical; }
    .form-label {
      display: block; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .06em;
      color: var(--text-muted, #78716C); margin-bottom: 6px;
    }
    .form-actions {
      display: flex; gap: 8px; padding: 16px 20px;
      margin-top: auto; border-top: 1px solid var(--border, #E7E5E4);
    }
    .btn-cancel {
      flex: 1; padding: 9px; border-radius: 8px; font-size: 13px; font-weight: 600;
      border: 1.5px solid var(--border, #E7E5E4); background: transparent;
      color: var(--text-secondary, #57534E); cursor: pointer;
    }
    .btn-submit {
      flex: 2; padding: 9px; border-radius: 8px; font-size: 13px; font-weight: 600;
      border: none; background: #7C3AED; color: #fff; cursor: pointer; transition: background .15s;
    }
    .btn-submit:hover:not(:disabled) { background: #6D28D9; }
    .btn-submit:disabled { opacity: .5; cursor: not-allowed; }
    .drawer-busy { display: flex; align-items: center; gap: 8px; padding: 12px 20px; font-size: 13px; color: var(--text-muted, #78716C); }

    @media (max-width: 1100px) { .kanban-board { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 700px) { .kanban-board { grid-template-columns: 1fr; } .detail-drawer { width: 100%; } }
  `],
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
