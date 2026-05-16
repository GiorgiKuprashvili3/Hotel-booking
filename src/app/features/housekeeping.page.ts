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
  template: `
<div class="hk-page">

  <!-- ── TOP HEADER ─────────────────────────────────────── -->
  <header class="hk-header">
    <div class="hk-title-block">
      <div class="hk-icon-wrap">
        <span class="hk-icon">🧹</span>
      </div>
      <div>
        <h1 class="hk-title">Housekeeping</h1>
        <p class="hk-sub">{{ today | date:'EEEE, MMMM d' }} · {{ propertyCtx.active()?.name }}</p>
      </div>
    </div>

    <div class="hk-toolbar">
      <div class="search-box">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input type="text" placeholder="Search room…" [ngModel]="search()" (ngModelChange)="search.set($event)" class="search-input" />
      </div>
      <select class="filter-select" [ngModel]="filterAssignee()" (ngModelChange)="filterAssignee.set($event)">
        <option value="">All Staff</option>
        @for (s of housekeepers(); track s.id) {
          <option [value]="s.id">{{ s.firstName }} {{ s.lastName }}</option>
        }
      </select>
      <select class="filter-select" [ngModel]="filterPriority()" (ngModelChange)="filterPriority.set($event)">
        <option value="">All Priority</option>
        <option value="high">High</option>
        <option value="normal">Normal</option>
        <option value="low">Low</option>
      </select>
    </div>
  </header>

  <!-- ── KPI STRIP ──────────────────────────────────────── -->
  <div class="kpi-strip">
    @for (col of columns; track col.status) {
      <button class="kpi-tile" [class.active]="colFilter() === col.status"
              (click)="toggleColFilter(col.status)"
              [style.--col-color]="col.color" [style.--col-bg]="col.bg">
        <span class="kpi-count">{{ countByStatus(col.status) }}</span>
        <span class="kpi-label">{{ col.label }}</span>
        <span class="kpi-bar" [style.background]="col.color"></span>
      </button>
    }
    <div class="kpi-tile kpi-total">
      <span class="kpi-count">{{ tasks().length }}</span>
      <span class="kpi-label">Total</span>
    </div>
  </div>

  <!-- ── KANBAN BOARD ───────────────────────────────────── -->
  @if (loading()) {
    <div class="skeleton-board">
      @for (_ of [1,2,3,4]; track $index) {
        <div class="skeleton-col">
          <div class="skel skel-head"></div>
          @for (__ of [1,2,3]; track $index) {
            <div class="skel skel-card"></div>
          }
        </div>
      }
    </div>
  } @else {
    <div class="kanban-board">
      @for (col of visibleColumns(); track col.status) {
        <div class="kanban-col">

          <!-- column header -->
          <div class="col-header" [style.--col-color]="col.color">
            <div class="col-header-left">
              <span class="col-dot" [style.background]="col.color"></span>
              <span class="col-label">{{ col.label }}</span>
            </div>
            <span class="col-count" [style.background]="col.bg" [style.color]="col.color">
              {{ filteredByCol(col.status).length }}
            </span>
          </div>

          <!-- cards -->
          <div class="col-body">
            @if (filteredByCol(col.status).length === 0) {
              <div class="col-empty">
                <span class="col-empty-icon">{{ col.icon }}</span>
                <span>No rooms</span>
              </div>
            }
            @for (task of filteredByCol(col.status); track task.id) {
              <button class="task-card"
                      [class.selected]="selectedTask()?.id === task.id"
                      (click)="selectTask(task)">
                <div class="card-top">
                  <span class="card-room">Room {{ roomNumber(task.roomId) }}</span>
                  <span class="priority-dot"
                        [style.background]="PRIORITY_META[task.priority]?.dot ?? '#9CA3AF'"
                        [title]="task.priority"></span>
                </div>
                <div class="card-sub">Floor {{ roomFloor(task.roomId) }}</div>

                @if (task.assignedTo) {
                  <div class="card-assignee">
                    <span class="avatar-xs">{{ staffInitials(task.assignedTo) }}</span>
                    <span class="assignee-name">{{ staffName(task.assignedTo) }}</span>
                  </div>
                } @else {
                  <div class="card-unassigned">Unassigned</div>
                }

                <!-- live timer for in-progress -->
                @if (task.status === HkStatus.InProgress && task.startedAt) {
                  <div class="card-timer">
                    <span class="timer-dot"></span>
                    {{ elapsedTime(task) }}
                  </div>
                }

                <!-- completed duration -->
                @if (task.durationMinutes && task.status !== HkStatus.InProgress) {
                  <div class="card-duration">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    {{ task.durationMinutes }}m
                  </div>
                }
              </button>
            }
          </div>
        </div>
      }
    </div>
  }

  <!-- ── TASK DETAIL DRAWER ─────────────────────────────── -->
  @if (selectedTask()) {
    <div class="drawer-overlay" (click)="closeDrawer()"></div>
    <aside class="task-drawer" [class.open]="selectedTask() !== null">
      <div class="drawer-head">
        <div>
          <div class="drawer-room">Room {{ roomNumber(selectedTask()!.roomId) }}</div>
          <div class="drawer-floor">Floor {{ roomFloor(selectedTask()!.roomId) }} · {{ selectedTask()!.priority }} priority</div>
        </div>
        <button class="drawer-close" (click)="closeDrawer()">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- status pill row -->
      <div class="drawer-status-row">
        @for (col of columns; track col.status) {
          <button class="status-pill"
                  [class.active]="selectedTask()!.status === col.status"
                  [style.--pill-color]="col.color"
                  [style.--pill-bg]="col.bg"
                  (click)="changeStatus(col.status)"
                  [disabled]="actionBusy()">
            {{ col.label }}
          </button>
        }
      </div>

      <!-- assign -->
      <div class="drawer-section">
        <label class="field-label">Assigned To</label>
        <select class="field-select"
                [ngModel]="selectedTask()!.assignedTo ?? ''"
                (ngModelChange)="assignStaff($event)"
                [disabled]="actionBusy()">
          <option value="">— Unassigned —</option>
          @for (s of housekeepers(); track s.id) {
            <option [value]="s.id">{{ s.firstName }} {{ s.lastName }}</option>
          }
        </select>
      </div>

      <!-- timer control -->
      <div class="drawer-section">
        <label class="field-label">Timer</label>
        <div class="timer-block">
          @if (selectedTask()!.status === HkStatus.InProgress && selectedTask()!.startedAt) {
            <div class="timer-display">
              <span class="timer-dot pulsing"></span>
              <span class="timer-value">{{ elapsedTime(selectedTask()!) }}</span>
              <span class="timer-since">since {{ selectedTask()!.startedAt | date:'HH:mm' }}</span>
            </div>
            <button class="btn-stop" (click)="completeTask()" [disabled]="actionBusy()">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/>
              </svg>
              Mark Clean
            </button>
          } @else if (selectedTask()!.status === HkStatus.Dirty || selectedTask()!.status === HkStatus.Clean) {
            <button class="btn-start" (click)="startTask()" [disabled]="actionBusy() || !selectedTask()!.assignedTo">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M5 3l8 5-8 5V3z" fill="currentColor"/>
              </svg>
              {{ selectedTask()!.status === HkStatus.Dirty ? 'Start Cleaning' : 'Re-open' }}
            </button>
            @if (!selectedTask()!.assignedTo) {
              <span class="timer-hint">Assign staff first</span>
            }
          } @else if (selectedTask()!.status === HkStatus.Clean) {
            <button class="btn-inspect" (click)="inspectTask()" [disabled]="actionBusy()">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Mark Inspected
            </button>
          } @else if (selectedTask()!.status === HkStatus.Inspected) {
            <div class="inspect-done">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l4 4 6-7" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Inspected at {{ selectedTask()!.inspectedAt | date:'HH:mm' }}
            </div>
          }
          @if (selectedTask()!.durationMinutes) {
            <div class="duration-badge">{{ selectedTask()!.durationMinutes }}m total</div>
          }
        </div>
      </div>

      <!-- quick actions for Clean status -->
      @if (selectedTask()!.status === HkStatus.Clean) {
        <div class="drawer-section">
          <button class="btn-inspect" style="width:100%" (click)="inspectTask()" [disabled]="actionBusy()">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Mark as Inspected
          </button>
        </div>
      }

      <!-- photo upload mockup -->
      <div class="drawer-section">
        <label class="field-label">Photos</label>
        <div class="photo-upload-zone" (click)="mockPhotoUpload()">
          @if (mockPhotos().length === 0) {
            <div class="photo-placeholder">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
                <circle cx="12" cy="13" r="3" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 6V5a2 2 0 012-2h4a2 2 0 012 2v1" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              <span>Tap to add photos</span>
            </div>
          } @else {
            <div class="photo-grid">
              @for (p of mockPhotos(); track $index) {
                <div class="photo-thumb" [style.background]="p"></div>
              }
              <div class="photo-add">+</div>
            </div>
          }
        </div>
      </div>

      <!-- notes -->
      <div class="drawer-section">
        <label class="field-label">Notes</label>
        <textarea class="field-textarea"
                  [(ngModel)]="notesDraft"
                  placeholder="Add notes about room condition…"
                  rows="3"></textarea>
        @if (notesDraft !== (selectedTask()!.notes ?? '')) {
          <button class="btn-save-notes" (click)="saveNotes()" [disabled]="actionBusy()">Save Notes</button>
        }
      </div>

      <!-- scheduled -->
      <div class="drawer-section drawer-meta">
        <div class="meta-row">
          <span class="meta-label">Scheduled</span>
          <span class="meta-val">{{ selectedTask()!.scheduledFor | date:'MMM d, HH:mm' }}</span>
        </div>
        @if (selectedTask()!.completedAt) {
          <div class="meta-row">
            <span class="meta-label">Completed</span>
            <span class="meta-val">{{ selectedTask()!.completedAt | date:'HH:mm' }}</span>
          </div>
        }
      </div>
    </aside>
  }
</div>
  `,
  styles: [`
    .hk-page {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg);
    }

    /* ── header ── */
    .hk-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-6);
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .hk-title-block { display: flex; align-items: center; gap: var(--space-3); }
    .hk-icon-wrap {
      width: 40px; height: 40px; border-radius: var(--radius-lg);
      background: var(--warning-bg); display: flex; align-items: center; justify-content: center;
      font-size: 20px; flex-shrink: 0;
    }
    .hk-title { font-size: var(--text-xl); font-weight: 700; margin: 0; }
    .hk-sub   { font-size: var(--text-sm); color: var(--text-muted); margin: 0; }

    .hk-toolbar { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
    .search-box {
      display: flex; align-items: center; gap: var(--space-2);
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: 6px 10px;
      color: var(--text-muted); min-width: 140px;
    }
    .search-input {
      border: none; background: transparent; outline: none;
      font-size: var(--text-sm); color: var(--text); width: 120px;
    }
    .filter-select {
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface-2); padding: 6px 10px;
      font-size: var(--text-sm); color: var(--text); cursor: pointer; outline: none;
    }

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
      position: relative; overflow: hidden; transition: border-color var(--t-fast);
      display: flex; flex-direction: column; align-items: center; gap: 2px;
    }
    .kpi-tile.active {
      border-color: var(--col-color, var(--primary));
      background: var(--col-bg, var(--surface-2));
    }
    .kpi-tile:hover { border-color: var(--col-color, var(--primary)); }
    .kpi-count { font-size: var(--text-2xl); font-weight: 800; line-height: 1; color: var(--text); }
    .kpi-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    .kpi-bar   { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; }
    .kpi-total { border-style: dashed; }
    .kpi-total .kpi-count { color: var(--text-muted); }

    /* ── kanban board ── */
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
    .col-header-left { display: flex; align-items: center; gap: var(--space-2); }
    .col-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .col-label { font-size: var(--text-sm); font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
    .col-count {
      font-size: 11px; font-weight: 700; padding: 2px 8px;
      border-radius: var(--radius-full); min-width: 24px; text-align: center;
    }

    .col-body {
      flex: 1; overflow-y: auto; padding: var(--space-3);
      display: flex; flex-direction: column; gap: var(--space-2);
    }
    .col-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: var(--space-8); gap: var(--space-2);
      color: var(--text-subtle); font-size: var(--text-sm);
    }
    .col-empty-icon { font-size: 28px; }

    /* ── task card ── */
    .task-card {
      background: var(--surface); border: 1.5px solid var(--border);
      border-radius: var(--radius-lg); padding: var(--space-3) var(--space-3);
      cursor: pointer; text-align: left; width: 100%;
      transition: border-color var(--t-fast), box-shadow var(--t-fast), transform var(--t-fast);
      display: flex; flex-direction: column; gap: 6px;
    }
    .task-card:hover {
      border-color: var(--primary); box-shadow: 0 2px 10px rgba(37,99,235,.1);
      transform: translateY(-1px);
    }
    .task-card.selected {
      border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37,99,235,.12);
    }

    .card-top { display: flex; align-items: center; justify-content: space-between; }
    .card-room { font-size: var(--text-base); font-weight: 700; color: var(--text); }
    .priority-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .card-sub { font-size: var(--text-xs); color: var(--text-muted); }

    .card-assignee {
      display: flex; align-items: center; gap: var(--space-1);
      margin-top: 4px;
    }
    .avatar-xs {
      width: 20px; height: 20px; border-radius: 50%;
      background: var(--primary); color: white;
      font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .assignee-name { font-size: 11px; color: var(--text-muted); }
    .card-unassigned { font-size: 11px; color: var(--text-subtle); font-style: italic; }

    .card-timer {
      display: flex; align-items: center; gap: 5px;
      font-size: 11px; font-weight: 600; color: var(--warning);
      margin-top: 2px;
    }
    .timer-dot {
      width: 6px; height: 6px; border-radius: 50%; background: var(--warning);
      animation: pulse 1s ease-in-out infinite;
    }
    .timer-dot.pulsing { animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; } 50% { opacity: .3; }
    }

    .card-duration {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; color: var(--text-muted);
    }

    /* ── skeleton ── */
    .skeleton-board {
      display: flex; gap: var(--space-4); padding: var(--space-4) var(--space-6);
      flex: 1; overflow: hidden;
    }
    .skeleton-col { flex: 0 0 280px; display: flex; flex-direction: column; gap: var(--space-2); }
    .skel { background: var(--border); border-radius: var(--radius-md); animation: shimmer 1.4s ease-in-out infinite; }
    .skel-head { height: 44px; border-radius: var(--radius-lg); }
    .skel-card { height: 80px; border-radius: var(--radius-lg); }
    @keyframes shimmer {
      0%,100% { opacity: .7; } 50% { opacity: .3; }
    }

    /* ── drawer overlay ── */
    .drawer-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.3); z-index: 100;
      animation: fadeIn 150ms ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* ── task drawer ── */
    .task-drawer {
      position: fixed; top: 0; right: 0; bottom: 0; width: min(400px, 100vw);
      background: var(--surface); border-left: 1px solid var(--border);
      z-index: 101; display: flex; flex-direction: column;
      overflow-y: auto; padding: var(--space-6);
      animation: slideIn 200ms cubic-bezier(.4,0,.2,1);
    }
    @keyframes slideIn {
      from { transform: translateX(100%); }
      to   { transform: translateX(0); }
    }

    .drawer-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-4);
    }
    .drawer-room  { font-size: var(--text-2xl); font-weight: 800; color: var(--text); }
    .drawer-floor { font-size: var(--text-sm); color: var(--text-muted); margin-top: 2px; text-transform: capitalize; }
    .drawer-close {
      width: 32px; height: 32px; border-radius: var(--radius-md);
      border: 1px solid var(--border); background: var(--surface-2);
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      color: var(--text-muted); flex-shrink: 0;
    }
    .drawer-close:hover { background: var(--danger-bg); color: var(--danger); border-color: var(--danger); }

    .drawer-status-row {
      display: flex; gap: var(--space-1); margin-bottom: var(--space-5);
      flex-wrap: wrap;
    }
    .status-pill {
      padding: 5px 12px; border-radius: var(--radius-full);
      font-size: 11px; font-weight: 600; cursor: pointer;
      border: 1.5px solid var(--border); background: var(--surface-2);
      color: var(--text-muted); transition: all var(--t-fast);
    }
    .status-pill.active {
      background: var(--pill-bg); color: var(--pill-color);
      border-color: var(--pill-color);
    }
    .status-pill:disabled { opacity: .5; cursor: not-allowed; }

    .drawer-section {
      margin-bottom: var(--space-5); padding-bottom: var(--space-5);
      border-bottom: 1px solid var(--border);
    }
    .drawer-section:last-child { border-bottom: none; }
    .field-label { display: block; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: var(--space-2); }

    .field-select, .field-textarea {
      width: 100%; border: 1.5px solid var(--border); border-radius: var(--radius-md);
      padding: 8px 10px; font-size: var(--text-sm); color: var(--text);
      background: var(--surface-2); outline: none;
    }
    .field-select:focus, .field-textarea:focus { border-color: var(--primary); }
    .field-textarea { resize: vertical; font-family: inherit; }

    /* timer block */
    .timer-block { display: flex; flex-direction: column; gap: var(--space-2); }
    .timer-display {
      display: flex; align-items: center; gap: var(--space-2);
      background: var(--warning-bg); border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-3);
    }
    .timer-value { font-size: var(--text-xl); font-weight: 800; color: var(--warning); font-variant-numeric: tabular-nums; }
    .timer-since { font-size: var(--text-xs); color: var(--warning); opacity: .7; }
    .timer-hint { font-size: var(--text-xs); color: var(--text-muted); text-align: center; }
    .inspect-done {
      display: flex; align-items: center; gap: var(--space-2);
      color: var(--success); font-size: var(--text-sm); font-weight: 600;
      background: var(--success-bg); padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
    }
    .duration-badge {
      font-size: 11px; color: var(--text-muted); font-weight: 600;
      align-self: flex-start;
    }

    .btn-start, .btn-stop, .btn-inspect, .btn-save-notes {
      display: inline-flex; align-items: center; gap: var(--space-2);
      padding: 9px 16px; border-radius: var(--radius-md);
      font-size: var(--text-sm); font-weight: 600; cursor: pointer;
      border: none; transition: opacity var(--t-fast), transform var(--t-fast);
    }
    .btn-start:disabled, .btn-stop:disabled, .btn-inspect:disabled, .btn-save-notes:disabled {
      opacity: .5; cursor: not-allowed;
    }
    .btn-start   { background: var(--primary); color: white; }
    .btn-stop    { background: var(--warning); color: white; }
    .btn-inspect { background: var(--success); color: white; }
    .btn-save-notes { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); font-size: 12px; margin-top: var(--space-2); }
    .btn-start:hover:not(:disabled)   { opacity: .9; transform: translateY(-1px); }
    .btn-stop:hover:not(:disabled)    { opacity: .9; transform: translateY(-1px); }
    .btn-inspect:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }

    /* photo upload */
    .photo-upload-zone {
      border: 2px dashed var(--border); border-radius: var(--radius-lg);
      cursor: pointer; transition: border-color var(--t-fast);
      overflow: hidden;
    }
    .photo-upload-zone:hover { border-color: var(--primary); }
    .photo-placeholder {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: var(--space-2); padding: var(--space-6); color: var(--text-muted);
      font-size: var(--text-sm);
    }
    .photo-grid { display: flex; flex-wrap: wrap; gap: var(--space-2); padding: var(--space-3); }
    .photo-thumb { width: 56px; height: 56px; border-radius: var(--radius-md); }
    .photo-add {
      width: 56px; height: 56px; border-radius: var(--radius-md);
      background: var(--surface-2); border: 2px dashed var(--border);
      display: flex; align-items: center; justify-content: center;
      color: var(--text-muted); font-size: 20px; cursor: pointer;
    }

    /* meta */
    .drawer-meta { display: flex; flex-direction: column; gap: var(--space-2); }
    .meta-row { display: flex; justify-content: space-between; align-items: center; }
    .meta-label { font-size: var(--text-xs); color: var(--text-muted); }
    .meta-val   { font-size: var(--text-sm); font-weight: 600; color: var(--text); }

    /* ── responsive ── */
    @media (max-width: 768px) {
      .hk-header { padding: var(--space-3) var(--space-4); }
      .hk-toolbar { width: 100%; }
      .search-box { flex: 1; }
      .search-input { width: 100%; }
      .kpi-strip { padding: var(--space-2) var(--space-4); }
      .kanban-board { padding: var(--space-3) var(--space-4) var(--space-3); gap: var(--space-3); }
      .kanban-col { flex: 0 0 260px; }
      .task-drawer { width: 100vw; border-left: none; border-top: 1px solid var(--border); top: auto; height: 90vh; border-radius: var(--radius-xl) var(--radius-xl) 0 0; }
    }
  `],
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
