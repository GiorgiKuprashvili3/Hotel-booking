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
  template: `
<div class="rooms-page">

  <!-- Header -->
  <header class="rooms-header">
    <div>
      <h1 class="page-title">Rooms</h1>
      <p class="page-sub">{{ propertyCtx.active()?.name }} · {{ rooms().length }} rooms</p>
    </div>

    <div class="view-switch">
      <button
        class="view-tab"
        [class.active]="view() === 'map'"
        (click)="view.set('map')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
          <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
          <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
          <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        Map
      </button>
      <button
        class="view-tab"
        [class.active]="view() === 'table'"
        (click)="view.set('table')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        List
      </button>
    </div>
  </header>

  <!-- Legend -->
  <div class="legend">
    @for (s of statusList; track s) {
      <div class="legend-item">
        <span class="legend-dot" [style.background]="meta(s).color"></span>
        <span>{{ meta(s).label }}</span>
        <span class="legend-count">{{ countByStatus(s) }}</span>
      </div>
    }
  </div>

  @if (loading()) {
    <div class="loading">Loading rooms…</div>
  } @else {

    <!-- Map view -->
    @if (view() === 'map') {
      <div class="floor-list">
        @for (group of floorGroups(); track group.floor) {
          <section class="floor-block">
            <div class="floor-header">
              <h3 class="floor-title">Floor {{ group.floor }}</h3>
              <span class="floor-count">{{ group.rooms.length }} rooms</span>
            </div>
            <div class="room-grid">
              @for (r of group.rooms; track r.id) {
                <button
                  class="room-tile"
                  [style.background]="meta(r.status).bg"
                  [style.border-color]="meta(r.status).color"
                  (click)="selectRoom(r)"
                  [title]="meta(r.status).label">
                  <span class="room-num">{{ r.number }}</span>
                  <span class="room-type">{{ typeName(r.roomTypeId) }}</span>
                  <span class="room-state" [style.color]="meta(r.status).color">
                    {{ meta(r.status).label }}
                  </span>
                </button>
              }
            </div>
          </section>
        }
      </div>
    }

    <!-- Table view -->
    @if (view() === 'table') {
      <div class="table-wrap">

        <!-- Toolbar -->
        <div class="table-toolbar">
          <div class="table-filters">
            <input
              class="filter-input"
              type="search"
              placeholder="Search room number…"
              [ngModel]="tableSearch()"
              (ngModelChange)="tableSearch.set($event)" />
            <select
              class="filter-select"
              [ngModel]="tableStatusFilter()"
              (ngModelChange)="tableStatusFilter.set($event)">
              <option value="">All statuses</option>
              @for (s of statusList; track s) {
                <option [value]="s">{{ meta(s).label }}</option>
              }
            </select>
          </div>
          <div class="bulk-actions">
            <span class="selected-count">{{ selectedIds().size }} selected</span>
            <button
              class="btn-bulk"
              [disabled]="!selectedIds().size"
              (click)="bulkSet(RoomStatus.Cleaning)">
              Mark cleaning
            </button>
            <button
              class="btn-bulk"
              [disabled]="!selectedIds().size"
              (click)="bulkSet(RoomStatus.Available)">
              Mark available
            </button>
            <button
              class="btn-bulk btn-bulk--danger"
              [disabled]="!selectedIds().size"
              (click)="bulkSet(RoomStatus.Maintenance)">
              Maintenance
            </button>
          </div>
        </div>

        <table class="room-table">
          <thead>
            <tr>
              <th class="col-check">
                <input
                  type="checkbox"
                  [checked]="allVisibleSelected()"
                  (change)="toggleAllVisible($event)" />
              </th>
              <th>Room</th>
              <th>Floor</th>
              <th>Type</th>
              <th>Status</th>
              <th>Housekeeping</th>
              <th>Last cleaned</th>
            </tr>
          </thead>
          <tbody>
            @for (r of filteredRooms(); track r.id) {
              <tr (click)="selectRoom(r)" class="row">
                <td class="col-check" (click)="$event.stopPropagation()">
                  <input
                    type="checkbox"
                    [checked]="selectedIds().has(r.id)"
                    (change)="toggleSelect(r.id)" />
                </td>
                <td class="row-num">{{ r.number }}</td>
                <td>{{ r.floor }}</td>
                <td>{{ typeName(r.roomTypeId) }}</td>
                <td>
                  <span class="status-pill"
                        [style.color]="meta(r.status).color"
                        [style.background]="meta(r.status).bg">
                    {{ meta(r.status).label }}
                  </span>
                </td>
                <td class="hk-cell">{{ hkLabel(r.housekeepingStatus) }}</td>
                <td class="cell-muted">
                  {{ r.lastCleanedAt ? (r.lastCleanedAt | date:'MMM d, HH:mm') : '—' }}
                </td>
              </tr>
            }
            @if (!filteredRooms().length) {
              <tr><td colspan="7" class="empty-row">No rooms match the filters.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  }
</div>

<!-- Room drawer -->
@if (selected(); as r) {
  <div class="drawer-backdrop" (click)="closeDrawer()"></div>
  <aside class="room-drawer" role="dialog" aria-label="Room details" [@slideIn]>
    <header class="drawer-head">
      <div>
        <h2 class="drawer-title">Room {{ r.number }}</h2>
        <p class="drawer-sub">Floor {{ r.floor }} · {{ typeName(r.roomTypeId) }}</p>
      </div>
      <button class="btn-close" (click)="closeDrawer()" aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    </header>

    <div class="drawer-body">

      <!-- Current status -->
      <section class="d-section">
        <h3 class="d-section__title">Current status</h3>
        <div class="status-card"
             [style.background]="meta(r.status).bg"
             [style.border-color]="meta(r.status).color">
          <span class="status-card__dot" [style.background]="meta(r.status).color"></span>
          <span class="status-card__label" [style.color]="meta(r.status).color">
            {{ meta(r.status).label }}
          </span>
        </div>
      </section>

      <!-- Change status -->
      <section class="d-section">
        <h3 class="d-section__title">Change status</h3>
        <div class="status-options">
          @for (s of statusList; track s) {
            <button
              class="status-opt"
              [class.active]="r.status === s"
              [class.pending]="pendingStatus() === s"
              [disabled]="r.status === s || changing()"
              (click)="stageStatus(s)">
              <span class="status-opt__dot" [style.background]="meta(s).color"></span>
              {{ meta(s).label }}
            </button>
          }
        </div>

        @if (pendingStatus(); as next) {
          <div class="confirm-card" [style.border-color]="meta(next).color">
            <div class="confirm-card__head">
              <span class="confirm-pill" [style.color]="meta(r.status).color" [style.background]="meta(r.status).bg">
                {{ meta(r.status).label }}
              </span>
              <span class="confirm-arrow">→</span>
              <span class="confirm-pill" [style.color]="meta(next).color" [style.background]="meta(next).bg">
                {{ meta(next).label }}
              </span>
            </div>
            <textarea
              class="status-note"
              rows="2"
              [placeholder]="notePlaceholder(next)"
              [ngModel]="statusNote()"
              (ngModelChange)="statusNote.set($event)"></textarea>
            <div class="confirm-actions">
              <button class="btn-cancel" (click)="cancelStaged()" [disabled]="changing()">
                Cancel
              </button>
              <button class="btn-confirm"
                      [style.background]="meta(next).color"
                      [disabled]="changing()"
                      (click)="confirmStaged()">
                @if (changing()) {
                  <span class="spinner"></span> Saving…
                } @else {
                  Confirm change
                }
              </button>
            </div>
          </div>
        } @else {
          <p class="status-hint">Tap a status above to stage a change.</p>
        }
      </section>

      <!-- History -->
      <section class="d-section">
        <h3 class="d-section__title">History</h3>
        @if (history().length === 0) {
          <p class="d-empty">No status changes yet.</p>
        } @else {
          <ol class="history">
            @for (h of history(); track h.id) {
              <li class="history-item">
                <span class="hist-dot" [style.background]="meta(h.to).color"></span>
                <div class="hist-body">
                  <div class="hist-line">
                    <span class="hist-from">{{ meta(h.from).label }}</span>
                    <span class="hist-arrow">→</span>
                    <span class="hist-to" [style.color]="meta(h.to).color">{{ meta(h.to).label }}</span>
                  </div>
                  <div class="hist-meta">{{ h.at | date:'MMM d, y · HH:mm' }}</div>
                  @if (h.note) {
                    <div class="hist-note">{{ h.note }}</div>
                  }
                </div>
              </li>
            }
          </ol>
        }
      </section>

    </div>
  </aside>
}

<!-- Bulk-action confirm modal -->
@if (bulkPending(); as next) {
  <div class="modal-backdrop" (click)="bulkRunning() || cancelBulk()"></div>
  <div class="bulk-modal" role="dialog" aria-modal="true">
    <div class="bulk-modal__icon" [style.background]="meta(next).bg" [style.color]="meta(next).color">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="9" stroke="currentColor" stroke-width="1.8"/>
        <path d="M11 7v5M11 14.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </div>
    <h3 class="bulk-modal__title">
      Mark {{ selectedIds().size }} {{ selectedIds().size === 1 ? 'room' : 'rooms' }} as
      <span [style.color]="meta(next).color">{{ meta(next).label }}</span>?
    </h3>
    <p class="bulk-modal__sub">
      This will update the status of every selected room. You can change them back individually afterward.
    </p>
    <div class="bulk-modal__actions">
      <button class="btn-cancel" (click)="cancelBulk()" [disabled]="bulkRunning()">
        Cancel
      </button>
      <button class="btn-confirm"
              [style.background]="meta(next).color"
              [disabled]="bulkRunning()"
              (click)="confirmBulk()">
        @if (bulkRunning()) {
          <span class="spinner"></span> Updating…
        } @else {
          Confirm
        }
      </button>
    </div>
  </div>
}
  `,
  styles: [`
    .rooms-page { padding: var(--space-6); }

    .rooms-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--space-4); margin-bottom: var(--space-4); flex-wrap: wrap;
    }
    .page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--text); margin: 0; }
    .page-sub { font-size: var(--text-sm); color: var(--text-muted); margin: 4px 0 0; }

    .view-switch {
      display: flex; background: var(--surface-2);
      border-radius: var(--radius-md); padding: 3px;
    }
    .view-tab {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 14px; border: none; background: transparent;
      border-radius: var(--radius-sm); cursor: pointer;
      font-size: var(--text-sm); font-weight: 600; color: var(--text-muted);
      transition: all var(--t-fast);
    }
    .view-tab:hover { color: var(--text); }
    .view-tab.active { background: var(--surface); color: var(--primary); box-shadow: var(--shadow-1); }

    .legend {
      display: flex; gap: var(--space-4); flex-wrap: wrap;
      margin-bottom: var(--space-4); padding: var(--space-3) var(--space-4);
      background: var(--surface); border-radius: var(--radius-md);
      border: 1px solid var(--border);
    }
    .legend-item {
      display: flex; align-items: center; gap: 6px;
      font-size: var(--text-xs); color: var(--text-muted);
    }
    .legend-dot { width: 10px; height: 10px; border-radius: 2px; }
    .legend-count {
      font-weight: 700; color: var(--text);
      background: var(--surface-2); padding: 1px 6px; border-radius: var(--radius-sm);
    }

    .loading {
      padding: var(--space-12); text-align: center; color: var(--text-muted);
    }

    /* Floor map */
    .floor-list { display: flex; flex-direction: column; gap: var(--space-6); }
    .floor-block {
      background: var(--surface); border-radius: var(--radius-lg);
      border: 1px solid var(--border); padding: var(--space-4);
    }
    .floor-header {
      display: flex; align-items: baseline; gap: var(--space-2);
      margin-bottom: var(--space-3);
    }
    .floor-title { font-size: var(--text-lg); font-weight: 700; margin: 0; color: var(--text); }
    .floor-count { font-size: var(--text-xs); color: var(--text-muted); }
    .room-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: var(--space-3);
    }
    .room-tile {
      display: flex; flex-direction: column; gap: 2px;
      padding: var(--space-3); text-align: left;
      border: 1px solid; border-radius: var(--radius-md);
      cursor: pointer; transition: all var(--t-fast);
      min-height: 78px;
    }
    .room-tile:hover {
      transform: translateY(-2px); box-shadow: var(--shadow-2);
    }
    .room-num { font-size: var(--text-lg); font-weight: 700; color: var(--text); line-height: 1.1; }
    .room-type { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .room-state { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 4px; }

    /* Table */
    .table-wrap {
      background: var(--surface); border-radius: var(--radius-lg);
      border: 1px solid var(--border); overflow: hidden;
    }
    .table-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-3); padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--border); flex-wrap: wrap;
    }
    .table-filters { display: flex; gap: var(--space-2); flex: 1; min-width: 220px; }
    .filter-input, .filter-select {
      height: 34px; padding: 0 var(--space-3);
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface); color: var(--text);
      font-size: var(--text-sm); font-family: inherit; outline: none;
    }
    .filter-input { flex: 1; max-width: 260px; }
    .filter-input:focus, .filter-select:focus { border-color: var(--primary); }
    .bulk-actions { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
    .selected-count { font-size: var(--text-xs); color: var(--text-muted); margin-right: var(--space-2); }
    .btn-bulk {
      height: 30px; padding: 0 var(--space-3);
      border: 1px solid var(--border); background: var(--surface);
      border-radius: var(--radius-md); cursor: pointer;
      font-size: var(--text-xs); font-weight: 600; color: var(--text-muted);
      transition: all var(--t-fast);
    }
    .btn-bulk:hover:not(:disabled) { color: var(--primary); border-color: var(--primary); }
    .btn-bulk:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-bulk--danger:hover:not(:disabled) { color: var(--danger); border-color: var(--danger); }

    .room-table { width: 100%; border-collapse: collapse; }
    .room-table th {
      text-align: left; padding: var(--space-3) var(--space-4);
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-subtle);
      border-bottom: 1px solid var(--border); background: var(--surface-2);
    }
    .room-table td {
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--border);
      font-size: var(--text-sm); color: var(--text);
    }
    .col-check { width: 32px; }
    .row { cursor: pointer; transition: background var(--t-fast); }
    .row:hover { background: var(--surface-2); }
    .row-num { font-weight: 700; }
    .hk-cell { text-transform: capitalize; color: var(--text-muted); }
    .cell-muted { color: var(--text-muted); font-size: var(--text-xs); }
    .empty-row { padding: var(--space-8) !important; text-align: center; color: var(--text-muted); }

    .status-pill {
      display: inline-block; padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
    }

    /* Drawer */
    .drawer-backdrop {
      position: fixed; inset: 0;
      background: rgba(11,31,58,0.3);
      backdrop-filter: blur(2px);
      z-index: 300;
    }
    .room-drawer {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: min(440px, 100vw);
      background: var(--surface);
      box-shadow: var(--shadow-3);
      z-index: 301;
      display: flex; flex-direction: column;
    }
    .drawer-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: var(--space-5) var(--space-5) var(--space-4);
      border-bottom: 1px solid var(--border);
    }
    .drawer-title { font-size: var(--text-xl); font-weight: 700; margin: 0; color: var(--text); }
    .drawer-sub { font-size: var(--text-xs); color: var(--text-muted); margin: 2px 0 0; }
    .btn-close {
      width: 30px; height: 30px;
      border: none; background: var(--surface-2);
      border-radius: var(--radius-full);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-muted);
      transition: all var(--t-fast);
    }
    .btn-close:hover { background: var(--danger-bg); color: var(--danger); }
    .drawer-body {
      flex: 1; overflow-y: auto; padding: var(--space-4) var(--space-5);
    }
    .d-section { padding: var(--space-3) 0; border-bottom: 1px solid var(--border); }
    .d-section:last-child { border-bottom: none; }
    .d-section__title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-subtle);
      margin: 0 0 var(--space-3);
    }
    .d-empty { font-size: var(--text-sm); color: var(--text-muted); margin: 0; }

    .status-card {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      border: 1px solid; border-radius: var(--radius-md);
    }
    .status-card__dot { width: 10px; height: 10px; border-radius: 50%; }
    .status-card__label { font-weight: 700; font-size: var(--text-sm); }

    .status-options {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: var(--space-2); margin-bottom: var(--space-3);
    }
    .status-opt {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 10px;
      border: 1px solid var(--border); background: var(--surface);
      border-radius: var(--radius-md); cursor: pointer;
      font-size: var(--text-sm); font-weight: 500; color: var(--text);
      transition: all var(--t-fast); text-align: left;
    }
    .status-opt:hover:not(:disabled) { border-color: var(--primary); background: var(--surface-2); }
    .status-opt:disabled { opacity: 0.5; cursor: not-allowed; }
    .status-opt.active { background: var(--surface-2); border-color: var(--primary); }
    .status-opt.pending {
      background: var(--surface-2);
      border-color: var(--primary);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent);
    }
    .status-opt__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-note {
      width: 100%; box-sizing: border-box; padding: var(--space-3);
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface); color: var(--text);
      font-size: var(--text-sm); font-family: inherit; outline: none;
      resize: vertical;
    }
    .status-note:focus { border-color: var(--primary); }

    /* Staged-confirmation card */
    .status-hint {
      font-size: var(--text-xs); color: var(--text-subtle);
      margin: var(--space-2) 0 0; text-align: center;
      font-style: italic;
    }
    .confirm-card {
      margin-top: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: 1.5px solid;
      border-radius: var(--radius-md);
      background: var(--surface-2);
      display: flex; flex-direction: column; gap: var(--space-3);
    }
    .confirm-card__head {
      display: flex; align-items: center; justify-content: center;
      gap: var(--space-2);
    }
    .confirm-pill {
      display: inline-block; padding: 4px 10px;
      border-radius: var(--radius-full);
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .confirm-arrow {
      font-size: var(--text-lg);
      color: var(--text-subtle);
      line-height: 1;
    }
    .confirm-actions {
      display: flex; gap: var(--space-2); justify-content: flex-end;
    }
    .btn-cancel, .btn-confirm {
      height: 34px; padding: 0 var(--space-4);
      border-radius: var(--radius-md); cursor: pointer;
      font-size: var(--text-sm); font-weight: 600;
      transition: all var(--t-fast);
      display: inline-flex; align-items: center; gap: 6px;
    }
    .btn-cancel {
      background: transparent; color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .btn-cancel:hover:not(:disabled) { color: var(--text); border-color: var(--border-strong); }
    .btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-confirm {
      color: #fff; border: none;
    }
    .btn-confirm:hover:not(:disabled) { filter: brightness(1.08); }
    .btn-confirm:disabled { opacity: 0.7; cursor: not-allowed; }
    .spinner {
      width: 12px; height: 12px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .history { list-style: none; margin: 0; padding: 0; }
    .history-item {
      display: flex; gap: var(--space-3); padding: var(--space-2) 0;
      position: relative;
    }
    .history-item:not(:last-child)::before {
      content: ''; position: absolute;
      left: 4px; top: 16px; bottom: -8px;
      width: 2px; background: var(--border);
    }
    .hist-dot {
      width: 10px; height: 10px; border-radius: 50%;
      flex-shrink: 0; margin-top: 4px; z-index: 1;
    }
    .hist-body { flex: 1; }
    .hist-line { font-size: var(--text-sm); display: flex; align-items: center; gap: 6px; }
    .hist-from { color: var(--text-muted); text-decoration: line-through; }
    .hist-arrow { color: var(--text-subtle); }
    .hist-to { font-weight: 600; }
    .hist-meta { font-size: var(--text-xs); color: var(--text-subtle); margin-top: 2px; }
    .hist-note {
      font-size: var(--text-xs); color: var(--text-muted);
      margin-top: 4px; padding: 4px 8px;
      background: var(--surface-2); border-radius: var(--radius-sm);
    }

    /* Bulk-action confirm modal */
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(11,31,58,0.4);
      backdrop-filter: blur(3px);
      z-index: 400;
    }
    .bulk-modal {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 401;
      width: min(420px, calc(100vw - 32px));
      background: var(--surface); border-radius: var(--radius-lg);
      padding: var(--space-5);
      box-shadow: var(--shadow-3);
      text-align: center;
    }
    .bulk-modal__icon {
      width: 56px; height: 56px;
      margin: 0 auto var(--space-3);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .bulk-modal__title {
      font-size: var(--text-lg); font-weight: 700;
      color: var(--text); margin: 0 0 var(--space-2);
      line-height: 1.3;
    }
    .bulk-modal__sub {
      font-size: var(--text-sm); color: var(--text-muted);
      margin: 0 0 var(--space-5);
    }
    .bulk-modal__actions {
      display: flex; gap: var(--space-2); justify-content: center;
    }
    .bulk-modal__actions .btn-cancel,
    .bulk-modal__actions .btn-confirm {
      min-width: 120px; justify-content: center;
    }
  `],
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
