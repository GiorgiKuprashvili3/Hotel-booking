import {
  Component, input, output, OnChanges, SimpleChanges,
  ElementRef, ViewChild, ChangeDetectionStrategy, signal,
  computed, HostListener, NgZone, inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CdkDragDrop, CdkDrag, CdkDropList, CdkDragStart, CdkDragMove } from '@angular/cdk/drag-drop';
import { Reservation, Room, RoomType } from '../../domain';
import { ReservationStatus } from '../../domain/enums';

export const STATUS_COLORS: Record<ReservationStatus, string> = {
  [ReservationStatus.Confirmed]:  '#4A7C59',
  [ReservationStatus.CheckedIn]:  '#2D5A87',
  [ReservationStatus.CheckedOut]: '#8A8A8A',
  [ReservationStatus.Cancelled]:  '#9E3B3B',
  [ReservationStatus.Pending]:    '#C8862E',
  [ReservationStatus.NoShow]:     '#5C5C5C',
};

export interface OccupancyDay {
  date: Date;
  occupied: number;
  total: number;
  pct: number;
  isWeekend: boolean;
  isToday: boolean;
}

interface DragState {
  type: 'move' | 'resize' | 'create';
  reservation?: Reservation;
  startX: number;
  startY: number;
  startRoomIndex: number;
  startDayOffset: number;
  currentRoomIndex: number;
  currentDayOffset: number;
  previewCheckIn?: Date;
  previewCheckOut?: Date;
  previewRoomId?: string;
  collides?: boolean;
}

interface PendingMove {
  reservation: Reservation;
  newRoomId: string;
  newCheckIn: Date;
  newCheckOut: Date;
  newRoomName: string;
  modalX: number;
  modalY: number;
}

const COL_WIDTH  = 48; // px per day
const ROW_HEIGHT = 44; // px per room row
const ROOM_COL_W = 130; // px for room label column
const UNASSIGNED_ROW_ID = '__unassigned__';

@Component({
  selector: 'app-calendar-grid',
  standalone: true,
  imports: [CommonModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="grid-wrapper" #wrapper>

  <!-- ── Sticky corner ───────────────────────────── -->
  <div class="grid-corner">
    <div class="corner-inner">
      <span>Room</span>
    </div>
  </div>

  <!-- ── Date header row ─────────────────────────── -->
  <div class="date-header" #dateHeader>
    <div class="date-row">
      @for (day of days(); track day.date.getTime()) {
        <div
          class="date-cell"
          [class.is-weekend]="day.isWeekend"
          [class.is-today]="day.isToday"
          [style.width.px]="COL_WIDTH">
          <span class="date-month" *ngIf="day.date.getDate() === 1 || $index === 0">
            {{ day.date | date:'MMM' }}
          </span>
          <span class="date-num">{{ day.date | date:'d' }}</span>
          <span class="date-dow">{{ day.date | date:'EEE' | slice:0:2 }}</span>
        </div>
      }
    </div>

    <!-- Occupancy bar row -->
    <div class="occ-row">
      @for (day of days(); track day.date.getTime()) {
        <div class="occ-cell" [style.width.px]="COL_WIDTH" [title]="day.pct + '% occupied'">
          <div
            class="occ-bar"
            [style.height.%]="day.pct"
            [class.occ-full]="day.pct >= 90"
            [class.occ-high]="day.pct >= 70 && day.pct < 90">
          </div>
          <span class="occ-pct">{{ day.pct }}%</span>
        </div>
      }
    </div>
  </div>

  <!-- ── Scrollable body ──────────────────────────── -->
  <div class="grid-scroll-body" #scrollBody (scroll)="syncScroll($event)">

    <!-- Room rows -->
    <div class="grid-body" [style.width.px]="gridWidth()">

      <!-- ── Unassigned row ──────────────────────── -->
      @if (unassignedReservations().length > 0) {
        <div
          class="grid-row grid-row--unassigned"
          role="row"
          aria-label="Unassigned reservations"
          [style.height.px]="ROW_HEIGHT">

          <!-- Label -->
          <div class="room-label room-label--unassigned">
            <div class="room-label__inner">
              <span class="room-num">Unassigned</span>
              <span class="room-type">{{ unassignedReservations().length }} res.</span>
            </div>
          </div>

          <!-- Day cells (no create drag from unassigned) -->
          <div class="day-cells">
            @for (day of days(); track day.date.getTime()) {
              <div
                class="day-cell"
                role="gridcell"
                [attr.aria-label]="day.date | date:'MMM d, y'"
                [class.is-weekend]="day.isWeekend"
                [class.is-today]="day.isToday"
                [style.width.px]="COL_WIDTH">
              </div>
            }
          </div>

          <!-- Unassigned bars -->
          @for (res of unassignedReservations(); track res.id) {
            @let pos = getBarPosition(res);
            @if (pos) {
              <div
                class="res-bar res-bar--unassigned"
                role="button"
                [tabIndex]="0"
                [attr.aria-label]="res.confirmationNumber + ', ' + (res.checkIn | date:'MMM d') + ' to ' + (res.checkOut | date:'MMM d, y') + ', unassigned'"
                [class.is-cancelled]="res.status === CancelledStatus"
                [class.is-dragging]="dragState()?.reservation?.id === res.id"
                [style.left.px]="pos.left + ROOM_COL_W"
                [style.width.px]="pos.width"
                [style.top.px]="(ROW_HEIGHT - 32) / 2"
                [style.height.px]="32"
                [style.background]="getStatusColor(res.status)"
                [title]="res.confirmationNumber"
                (click)="reservationClick.emit(res)"
                (keydown.enter)="reservationClick.emit(res)"
                (keydown.space)="$event.preventDefault(); reservationClick.emit(res)"
                (mousedown)="onUnassignedBarMouseDown($event, res)"
                (touchstart)="onUnassignedBarTouchStart($event, res)">
                <span class="res-bar__text">
                  {{ res.confirmationNumber }}
                  @if (pos.width > 100) { · {{ res.nights }}n }
                </span>
              </div>
            }
          }
        </div>
      }

      @for (room of rooms(); track room.id; let ri = $index) {
        <div
          class="grid-row"
          role="row"
          [attr.aria-label]="'Room ' + room.number"
          [class.floor-break]="ri > 0 && rooms()[ri-1].floor !== room.floor"
          [style.height.px]="ROW_HEIGHT">

          <!-- Room label (sticky left) -->
          <div class="room-label">
            <div class="room-label__inner">
              <span class="room-num">{{ room.number }}</span>
              <span class="room-type">{{ getRoomType(room.roomTypeId)?.code }}</span>
            </div>
            <span class="room-floor">F{{ room.floor }}</span>
          </div>

          <!-- Day cells background -->
          <div class="day-cells">
            @for (day of days(); track day.date.getTime()) {
              <div
                class="day-cell"
                role="gridcell"
                [attr.aria-label]="day.date | date:'MMM d, y'"
                [class.is-weekend]="day.isWeekend"
                [class.is-today]="day.isToday"
                [style.width.px]="COL_WIDTH"
                (mousedown)="onCellMouseDown($event, ri, $index)"
                (touchstart)="onCellTouchStart($event, ri, $index)">
              </div>
            }
          </div>

          <!-- Reservation bars for this room -->
          @for (res of getReservationsForRoom(room.id); track res.id) {
            @let pos = getBarPosition(res);
            @if (pos) {
              <div
                class="res-bar"
                role="button"
                [tabIndex]="0"
                [attr.aria-label]="res.confirmationNumber + ', ' + (res.checkIn | date:'MMM d') + ' to ' + (res.checkOut | date:'MMM d, y') + ', ' + res.status"
                [class.is-cancelled]="res.status === CancelledStatus"
                [class.is-dragging]="dragState()?.reservation?.id === res.id"
                [style.left.px]="pos.left + ROOM_COL_W"
                [style.width.px]="pos.width"
                [style.top.px]="(ROW_HEIGHT - 32) / 2"
                [style.height.px]="32"
                [style.background]="getStatusColor(res.status)"
                [title]="res.confirmationNumber"
                (click)="reservationClick.emit(res)"
                (keydown.enter)="reservationClick.emit(res)"
                (keydown.space)="$event.preventDefault(); reservationClick.emit(res)"
                (mousedown)="onBarMouseDown($event, res)"
                (touchstart)="onBarTouchStart($event, res)">

                <span class="res-bar__text">
                  {{ res.confirmationNumber }}
                  @if (pos.width > 100) {
                    · {{ res.nights }}n
                  }
                </span>

                <!-- Resize handle -->
                <div
                  class="res-bar__resize"
                  (mousedown)="onResizeMouseDown($event, res)">
                </div>
              </div>
            }
          }
        </div>
      }

      <!-- Today line -->
      @if (todayOffset() >= 0 && todayOffset() <= windowDays()) {
        <div class="today-line" [style.left.px]="todayOffset() * COL_WIDTH + ROOM_COL_W">
          <div class="today-line__label">Today</div>
        </div>
      }

      <!-- Drag preview bar -->
      @if (dragState() && dragState()!.type !== 'move') {
        <div
          class="drag-preview"
          [class.drag-preview--collides]="dragState()!.collides"
          [style.left.px]="dragPreviewLeft()"
          [style.width.px]="dragPreviewWidth()"
          [style.top.px]="dragState()!.currentRoomIndex * ROW_HEIGHT + (ROW_HEIGHT - 32) / 2"
          [style.height.px]="32">
        </div>
      }

    </div><!-- /grid-body -->
  </div><!-- /grid-scroll-body -->

</div><!-- /grid-wrapper -->

<!-- Collision flash overlay -->
@if (collisionFlash()) {
  <div class="collision-overlay"></div>
}

<!-- Move confirmation modal -->
@if (pendingMove(); as pm) {
  <div class="move-backdrop" (click)="cancelMove()"></div>
  <div
    class="move-modal"
    [style.left.px]="pm.modalX"
    [style.top.px]="pm.modalY"
    (click)="$event.stopPropagation()">

    <div class="move-modal__icon">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1v16M1 9h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".4"/>
        <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" stroke-width="0" />
        <rect x="3" y="7" width="5" height="4" rx="1" fill="currentColor" opacity=".15"/>
        <rect x="10" y="7" width="5" height="4" rx="1" fill="currentColor" opacity=".15"/>
        <path d="M7 9h4M9 7v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </div>

    <div class="move-modal__body">
      <p class="move-modal__title">Move reservation?</p>
      <p class="move-modal__conf">{{ pm.reservation.confirmationNumber }}</p>
      <div class="move-modal__detail">
        <span class="move-modal__label">Room</span>
        <span class="move-modal__val">{{ pm.newRoomName }}</span>
      </div>
      <div class="move-modal__detail">
        <span class="move-modal__label">Check-in</span>
        <span class="move-modal__val">{{ pm.newCheckIn | date:'MMM d, y' }}</span>
      </div>
      <div class="move-modal__detail">
        <span class="move-modal__label">Check-out</span>
        <span class="move-modal__val">{{ pm.newCheckOut | date:'MMM d, y' }}</span>
      </div>
    </div>

    <div class="move-modal__actions">
      <button class="btn-modal-cancel" (click)="cancelMove()">Cancel</button>
      <button class="btn-modal-confirm" (click)="confirmMove()">Confirm move</button>
    </div>
  </div>
}
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      position: relative;
      overflow: hidden;
    }

    .grid-wrapper {
      display: grid;
      grid-template-columns: ${ROOM_COL_W}px 1fr;
      grid-template-rows: auto 1fr;
      height: 100%;
      overflow: hidden;
      user-select: none;
    }

    /* ── Corner ── */
    .grid-corner {
      grid-column: 1; grid-row: 1;
      background: var(--surface);
      border-right: 1px solid var(--border);
      border-bottom: 2px solid var(--border);
      z-index: 10;
    }
    .corner-inner {
      display: flex; align-items: flex-end;
      padding: var(--space-2) var(--space-3) var(--space-1);
      height: 100%;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-subtle);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    /* ── Date header ── */
    .date-header {
      grid-column: 2; grid-row: 1;
      background: var(--surface);
      border-bottom: 2px solid var(--border);
      overflow: hidden;
      z-index: 9;
    }
    .date-row {
      display: flex;
      border-bottom: 1px solid var(--border);
    }
    .date-cell {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      padding: var(--space-1) 2px var(--space-2);
      border-right: 1px solid var(--border);
      position: relative;
      min-height: 52px;
      cursor: default;
      &.is-weekend { background: var(--surface-2); }
      &.is-today {
        background: color-mix(in srgb, var(--primary) 8%, transparent);
        &::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 2px;
          background: var(--primary);
        }
      }
    }
    .date-month {
      position: absolute;
      top: 4px; left: 4px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
    }
    .date-num {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text);
      line-height: 1;
    }
    .date-dow {
      font-size: 10px;
      color: var(--text-subtle);
      line-height: 1;
      margin-top: 2px;
    }
    .is-today .date-num { color: var(--primary); }

    /* Occupancy row */
    .occ-row {
      display: flex;
      height: 28px;
    }
    .occ-cell {
      flex-shrink: 0;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column-reverse;
      align-items: center;
      position: relative;
      overflow: hidden;
    }
    .occ-bar {
      width: 100%;
      background: var(--success-bg);
      border-top: 1px solid var(--success);
      transition: height 0.3s;
      &.occ-high { background: var(--warning-bg); border-color: var(--warning); }
      &.occ-full { background: var(--danger-bg);  border-color: var(--danger);  }
    }
    .occ-pct {
      position: absolute;
      bottom: 2px;
      font-size: 9px;
      color: var(--text-subtle);
      z-index: 1;
      pointer-events: none;
    }

    /* ── Scroll body ── */
    .grid-scroll-body {
      grid-column: 1 / -1; grid-row: 2;
      overflow: auto;
      position: relative;
    }

    /* ── Grid body ── */
    .grid-body {
      position: relative;
      min-height: 100%;
    }

    /* ── Unassigned row ── */
    .grid-row--unassigned {
      background: repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 6px,
        rgba(var(--ink-300-rgb, 180,180,180), 0.06) 6px,
        rgba(var(--ink-300-rgb, 180,180,180), 0.06) 12px
      );
      border-bottom: 2px dashed var(--border-strong);
    }
    .room-label--unassigned {
      background: var(--surface-2);
      border-right: 1px dashed var(--border-strong);
      .room-num {
        font-size: 11px;
        color: var(--text-subtle);
        font-style: italic;
      }
      .room-type { color: var(--text-subtle); }
    }
    .res-bar--unassigned {
      opacity: 0.82;
      border: 1.5px dashed rgba(255,255,255,0.5);
    }

    /* ── Room row ── */
    .grid-row {
      display: flex;
      border-bottom: 1px solid var(--border);
      position: relative;
      &.floor-break {
        border-top: 2px solid var(--border-strong);
      }
      &:hover .day-cells { background: rgba(0,0,0,0.01); }
    }

    /* Room label */
    .room-label {
      width: ${ROOM_COL_W}px;
      flex-shrink: 0;
      position: sticky;
      left: 0;
      z-index: 5;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-3);
    }
    .room-label__inner {
      display: flex;
      flex-direction: column;
    }
    .room-num {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text);
    }
    .room-type {
      font-size: 10px;
      color: var(--text-subtle);
    }
    .room-floor {
      font-size: 10px;
      color: var(--text-subtle);
      background: var(--surface-2);
      padding: 1px 5px;
      border-radius: var(--radius-sm);
    }

    /* Day cells */
    .day-cells {
      display: flex;
      flex: 1;
    }
    .day-cell {
      flex-shrink: 0;
      border-right: 1px solid var(--border);
      cursor: crosshair;
      &.is-weekend { background: var(--surface-2); }
      &.is-today   { background: color-mix(in srgb, var(--primary) 4%, transparent); }
    }

    /* ── Reservation bar ── */
    .res-bar {
      position: absolute;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      padding: 0 var(--space-2);
      cursor: grab;
      transition: filter var(--t-fast), transform var(--t-fast), box-shadow var(--t-fast);
      z-index: 3;
      overflow: hidden;
      white-space: nowrap;
      outline: none;

      &:hover {
        filter: brightness(1.08);
        box-shadow: var(--shadow-2);
        z-index: 4;
      }
      &:focus-visible {
        box-shadow: 0 0 0 3px var(--on-primary), 0 0 0 5px var(--primary);
        z-index: 5;
        filter: brightness(1.1);
      }
      &.is-cancelled {
        opacity: 0.45;
        background-image: repeating-linear-gradient(
          45deg, transparent, transparent 4px,
          rgba(255,255,255,0.25) 4px, rgba(255,255,255,0.25) 8px
        ) !important;
      }
      &.is-dragging {
        opacity: 0.5;
        pointer-events: none;
      }
    }
    .res-bar__text {
      font-size: 11px;
      font-weight: 500;
      color: #fff;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    .res-bar__resize {
      position: absolute;
      right: 0; top: 0; bottom: 0;
      width: 8px;
      cursor: col-resize;
      background: rgba(255,255,255,0.2);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      opacity: 0;
      transition: opacity var(--t-fast);
    }
    .res-bar:hover .res-bar__resize { opacity: 1; }

    /* ── Today line ── */
    .today-line {
      position: absolute;
      top: 0; bottom: 0;
      width: 2px;
      background: var(--primary);
      pointer-events: none;
      z-index: 6;
    }
    .today-line__label {
      position: absolute;
      top: -24px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--primary);
      color: var(--on-primary);
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      white-space: nowrap;
    }

    /* ── Drag preview ── */
    .drag-preview {
      position: absolute;
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--primary) 40%, transparent);
      border: 2px dashed var(--primary);
      pointer-events: none;
      z-index: 7;
      transition: left 0.05s, width 0.05s;
      &--collides {
        background: color-mix(in srgb, var(--danger) 40%, transparent);
        border-color: var(--danger);
        animation: flash 0.4s ease;
      }
    }
    @keyframes flash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* Collision overlay */
    .collision-overlay {
      position: fixed;
      inset: 0;
      background: rgba(158, 59, 59, 0.08);
      pointer-events: none;
      z-index: 100;
      animation: flashOverlay 0.5s ease forwards;
    }
    @keyframes flashOverlay {
      0% { opacity: 0; }
      20% { opacity: 1; }
      100% { opacity: 0; }
    }
    /* ── Move confirmation modal ── */
    .move-backdrop {
      position: fixed;
      inset: 0;
      z-index: 200;
      background: transparent;
    }
    .move-modal {
      position: fixed;
      z-index: 201;
      transform: translate(-50%, 12px);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-4, 0 8px 32px rgba(0,0,0,0.18));
      padding: var(--space-4);
      min-width: 220px;
      max-width: 280px;
      animation: modalPop 0.15s cubic-bezier(0.34,1.56,0.64,1) both;
    }
    @keyframes modalPop {
      from { opacity: 0; transform: translate(-50%, 4px) scale(0.94); }
      to   { opacity: 1; transform: translate(-50%, 12px) scale(1); }
    }
    .move-modal__icon {
      width: 32px; height: 32px;
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      color: var(--primary);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: var(--space-3);
    }
    .move-modal__body {
      margin-bottom: var(--space-4);
    }
    .move-modal__title {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text);
      margin: 0 0 var(--space-1);
    }
    .move-modal__conf {
      font-size: var(--text-xs);
      color: var(--text-muted);
      font-family: var(--font-mono, monospace);
      margin: 0 0 var(--space-3);
    }
    .move-modal__detail {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 0;
    }
    .move-modal__label {
      font-size: var(--text-xs);
      color: var(--text-subtle);
    }
    .move-modal__val {
      font-size: var(--text-xs);
      font-weight: 500;
      color: var(--text);
    }
    .move-modal__actions {
      display: flex;
      gap: var(--space-2);
    }
    .btn-modal-cancel {
      flex: 1;
      height: 32px;
      border: 1px solid var(--border);
      background: transparent;
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      color: var(--text-muted);
      cursor: pointer;
      transition: all var(--t-fast);
      &:hover { border-color: var(--border-strong); color: var(--text); }
    }
    .btn-modal-confirm {
      flex: 1;
      height: 32px;
      border: none;
      background: var(--primary);
      color: var(--on-primary);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: 500;
      cursor: pointer;
      transition: filter var(--t-fast);
      &:hover { filter: brightness(1.08); }
    }
  `],
  host: {
    '(mousemove)':  'onMouseMove($event)',
    '(mouseup)':    'onMouseUp($event)',
    '(mouseleave)': 'onMouseUp($event)',
    '(touchmove)':  'onTouchMove($event)',
    '(touchend)':   'onTouchEnd($event)',
    '(touchcancel)':'onTouchEnd($event)',
  },
})
export class CalendarGridComponent implements OnChanges {
  // Inputs
  rooms      = input.required<Room[]>();
  reservations = input.required<Reservation[]>();
  roomTypes  = input.required<RoomType[]>();
  startDate  = input.required<Date>();
  windowDays = input.required<number>();

  // Outputs
  reservationClick  = output<Reservation>();
  reservationCreate = output<Partial<Reservation>>();
  reservationMove   = output<{ reservation: Reservation; newRoomId: string; newCheckIn: Date }>();
  reservationResize = output<{ reservation: Reservation; newCheckOut: Date }>();

  // Expose constants to template
  readonly COL_WIDTH        = COL_WIDTH;
  readonly ROOM_COL_W       = ROOM_COL_W;
  readonly ROW_HEIGHT       = ROW_HEIGHT;
  readonly CancelledStatus  = ReservationStatus.Cancelled;
  readonly UNASSIGNED_ROW_ID = UNASSIGNED_ROW_ID;

  @ViewChild('scrollBody') scrollBodyRef!: ElementRef<HTMLElement>;
  @ViewChild('dateHeader') dateHeaderRef!: ElementRef<HTMLElement>;

  // ── Signals ──────────────────────────────────────
  dragState      = signal<DragState | null>(null);
  collisionFlash = signal(false);
  pendingMove    = signal<PendingMove | null>(null);

  // ── Derived ──────────────────────────────────────
  days = computed<OccupancyDay[]>(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const start = this.startDate();
    const days: OccupancyDay[] = [];
    const rooms = this.rooms();
    const total = rooms.length || 1;

    for (let i = 0; i < this.windowDays(); i++) {
      const d = new Date(start); d.setDate(d.getDate() + i); d.setHours(0,0,0,0);
      const dow = d.getDay();
      const nextDay = new Date(d); nextDay.setDate(nextDay.getDate() + 1);
      const occupied = this.reservations().filter(r =>
        r.roomId && r.checkIn < nextDay && r.checkOut > d &&
        r.status !== ReservationStatus.Cancelled &&
        r.status !== ReservationStatus.CheckedOut
      ).length;
      days.push({
        date: d,
        occupied,
        total,
        pct: Math.round((occupied / total) * 100),
        isWeekend: dow === 0 || dow === 6,
        isToday: d.getTime() === today.getTime(),
      });
    }
    return days;
  });

  gridWidth = computed(() => this.windowDays() * COL_WIDTH + ROOM_COL_W);

  unassignedReservations = computed(() =>
    this.reservations().filter(r => !r.roomId)
  );

  todayOffset = computed(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.round((today.getTime() - this.startDate().getTime()) / 86400000);
  });

  // ── Lifecycle ────────────────────────────────────
  ngOnChanges(c: SimpleChanges): void {
    // Scroll to today on load
    if (c['startDate'] || c['windowDays']) {
      setTimeout(() => this.scrollToToday(), 50);
    }
  }

  private scrollToToday(): void {
    const el = this.scrollBodyRef?.nativeElement;
    if (!el) return;
    const offset = this.todayOffset() * COL_WIDTH - 100;
    if (offset > 0) el.scrollLeft = offset;
  }

  syncScroll(e: Event): void {
    const target = e.target as HTMLElement;
    if (this.dateHeaderRef?.nativeElement) {
      this.dateHeaderRef.nativeElement.scrollLeft = target.scrollLeft;
    }
  }

  // ── Data helpers ─────────────────────────────────
  getRoomType(id: string): RoomType | undefined {
    return this.roomTypes().find(t => t.id === id);
  }

  getStatusColor(status: ReservationStatus): string {
    return STATUS_COLORS[status] ?? '#8A8A8A';
  }

  getReservationsForRoom(roomId: string): Reservation[] {
    return this.reservations().filter(r => r.roomId === roomId);
  }

  getBarPosition(res: Reservation): { left: number; width: number } | null {
    const start = this.startDate().getTime();
    const end   = start + this.windowDays() * 86400000;
    if (res.checkOut.getTime() <= start || res.checkIn.getTime() >= end) return null;

    const left  = Math.max(0, (res.checkIn.getTime()  - start) / 86400000) * COL_WIDTH;
    const right = Math.min(this.windowDays(), (res.checkOut.getTime() - start) / 86400000) * COL_WIDTH;
    const width = Math.max(COL_WIDTH * 0.5, right - left - 2);
    return { left, width };
  }

  // ── Drag interactions ────────────────────────────
  private getEventCoords(e: MouseEvent) {
    const el = this.scrollBodyRef?.nativeElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left + el.scrollLeft - ROOM_COL_W;
    const y = e.clientY - rect.top  + el.scrollTop;
    return { x, y };
  }

  private xToDay(x: number): number {
    return Math.max(0, Math.min(this.windowDays() - 1, Math.floor(x / COL_WIDTH)));
  }

  private dayToDate(offset: number): Date {
    const d = new Date(this.startDate());
    d.setDate(d.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  checkCollision(roomId: string, checkIn: Date, checkOut: Date, excludeId?: string): boolean {
    return this.reservations().some(r =>
      r.id !== excludeId &&
      r.roomId === roomId &&
      r.status !== ReservationStatus.Cancelled &&
      r.checkIn < checkOut && r.checkOut > checkIn
    );
  }

  // Cell mousedown → start "create" drag
  onCellMouseDown(e: MouseEvent, roomIndex: number, dayIndex: number): void {
    if (e.button !== 0) return;
    e.preventDefault();
    const coords = this.getEventCoords(e);
    if (!coords) return;

    this.dragState.set({
      type: 'create',
      startX: coords.x,
      startY: coords.y,
      startRoomIndex: roomIndex,
      startDayOffset: dayIndex,
      currentRoomIndex: roomIndex,
      currentDayOffset: dayIndex,
    });
  }

  // Bar mousedown → start "move" drag
  onBarMouseDown(e: MouseEvent, res: Reservation): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const coords = this.getEventCoords(e);
    if (!coords) return;
    const ri = this.rooms().findIndex(r => r.id === res.roomId);
    const startDay = this.xToDay(coords.x);
    this.dragState.set({
      type: 'move',
      reservation: res,
      startX: coords.x,
      startY: coords.y,
      startRoomIndex: ri,
      startDayOffset: startDay,
      currentRoomIndex: ri,
      currentDayOffset: startDay,
    });
  }

  // Resize handle mousedown → start "resize" drag
  onResizeMouseDown(e: MouseEvent, res: Reservation): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const coords = this.getEventCoords(e);
    if (!coords) return;
    const ri = this.rooms().findIndex(r => r.id === res.roomId);
    this.dragState.set({
      type: 'resize',
      reservation: res,
      startX: coords.x,
      startY: coords.y,
      startRoomIndex: ri,
      startDayOffset: this.xToDay(coords.x),
      currentRoomIndex: ri,
      currentDayOffset: this.xToDay(coords.x),
    });
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    if (!this.dragState()) return;
    e.preventDefault();
    const coords = this.getEventCoords(e);
    if (!coords) return;
    this.processMoveCoords(coords.x, coords.y);
  }

  @HostListener('document:mouseup', ['$event'])
  onMouseUp(e: MouseEvent): void {
    const ds = this.dragState();
    if (!ds) return;

    this.dragState.set(null);

    if (ds.type === 'move' && ds.previewRoomId && ds.previewCheckIn && !ds.collides) {
      // Show confirmation modal instead of committing immediately
      const newRoom = this.rooms().find(r => r.id === ds.previewRoomId);
      const newCheckOut = new Date(ds.previewCheckIn!.getTime() + ds.reservation!.nights * 86400000);
      this.pendingMove.set({
        reservation: ds.reservation!,
        newRoomId:   ds.previewRoomId,
        newCheckIn:  ds.previewCheckIn,
        newCheckOut,
        newRoomName: newRoom?.number ?? ds.previewRoomId,
        modalX:      e.clientX,
        modalY:      e.clientY,
      });
    } else if (ds.type === 'resize' && ds.previewCheckOut && !ds.collides) {
      this.reservationResize.emit({
        reservation:  ds.reservation!,
        newCheckOut:  ds.previewCheckOut,
      });
    } else if (ds.type === 'create' && ds.previewCheckIn && ds.previewCheckOut && !ds.collides) {
      const room = this.rooms()[ds.startRoomIndex];
      const nights = Math.round(
        (ds.previewCheckOut.getTime() - ds.previewCheckIn.getTime()) / 86400000
      );
      if (nights >= 1) {
        this.reservationCreate.emit({
          roomId:     room.id,
          roomTypeId: room.roomTypeId,
          checkIn:    ds.previewCheckIn,
          checkOut:   ds.previewCheckOut,
          nights,
        });
      }
    } else if (ds.collides) {
      this.triggerCollisionFlash();
    }
  }

  confirmMove(): void {
    const pm = this.pendingMove();
    if (!pm) return;
    this.reservationMove.emit({
      reservation: pm.reservation,
      newRoomId:   pm.newRoomId,
      newCheckIn:  pm.newCheckIn,
    });
    this.pendingMove.set(null);
  }

  cancelMove(): void {
    this.pendingMove.set(null);
  }

  // ── Touch handlers ──────────────────────────────
  /** Convert a Touch to the same coordinate space as MouseEvent handlers */
  private touchCoords(touch: Touch): { x: number; y: number } | null {
    const el = this.scrollBodyRef?.nativeElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left + el.scrollLeft - ROOM_COL_W,
      y: touch.clientY - rect.top  + el.scrollTop,
    };
  }

  onCellTouchStart(e: TouchEvent, roomIndex: number, dayIndex: number): void {
    e.preventDefault();
    const touch = e.touches[0];
    const coords = this.touchCoords(touch);
    if (!coords) return;
    this.dragState.set({
      type: 'create',
      startX: coords.x,
      startY: coords.y,
      startRoomIndex: roomIndex,
      startDayOffset: dayIndex,
      currentRoomIndex: roomIndex,
      currentDayOffset: dayIndex,
    });
  }

  onBarTouchStart(e: TouchEvent, res: Reservation): void {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const coords = this.touchCoords(touch);
    if (!coords) return;
    const ri = this.rooms().findIndex(r => r.id === res.roomId);
    const startDay = this.xToDay(coords.x);
    this.dragState.set({
      type: 'move',
      reservation: res,
      startX: coords.x,
      startY: coords.y,
      startRoomIndex: ri,
      startDayOffset: startDay,
      currentRoomIndex: ri,
      currentDayOffset: startDay,
    });
  }

  /** Drag from unassigned row — treated as a move to a real room */
  onUnassignedBarMouseDown(e: MouseEvent, res: Reservation): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const coords = this.getEventCoords(e);
    if (!coords) return;
    const startDay = this.xToDay(coords.x);
    // Use -1 as the "from" room index to indicate unassigned origin
    this.dragState.set({
      type: 'move',
      reservation: res,
      startX: coords.x,
      startY: coords.y,
      startRoomIndex: -1,
      startDayOffset: startDay,
      currentRoomIndex: 0,
      currentDayOffset: startDay,
    });
  }

  onUnassignedBarTouchStart(e: TouchEvent, res: Reservation): void {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const coords = this.touchCoords(touch);
    if (!coords) return;
    const startDay = this.xToDay(coords.x);
    this.dragState.set({
      type: 'move',
      reservation: res,
      startX: coords.x,
      startY: coords.y,
      startRoomIndex: -1,
      startDayOffset: startDay,
      currentRoomIndex: 0,
      currentDayOffset: startDay,
    });
  }

  onTouchMove(e: TouchEvent): void {
    const ds = this.dragState();
    if (!ds) return;
    e.preventDefault();
    const touch = e.touches[0];
    // Reuse mouse move logic by synthesising the same coordinate
    const coords = this.touchCoords(touch);
    if (!coords) return;
    // Build a fake MouseEvent-compatible object and delegate
    this.processMoveCoords(coords.x, coords.y);
  }

  onTouchEnd(e: TouchEvent): void {
    const ds = this.dragState();
    if (!ds) return;
    // Determine final position from changedTouches
    const touch = e.changedTouches[0];
    const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY } as MouseEvent;
    this.onMouseUp(fakeEvent);
  }

  /** Shared move logic used by both onMouseMove and onTouchMove */
  private processMoveCoords(x: number, y: number): void {
    const ds = this.dragState();
    if (!ds) return;

    const dayOffset = this.xToDay(x);
    // +1 offset when unassigned row is visible (it sits at index 0)
    const unassignedOffset = this.unassignedReservations().length > 0 ? 1 : 0;
    const rawRowIndex = Math.floor(y / ROW_HEIGHT);
    const roomIndex = Math.max(0, Math.min(
      this.rooms().length - 1,
      rawRowIndex - unassignedOffset,
    ));

    if (ds.type === 'move') {
      const deltaDays = dayOffset - ds.startDayOffset;
      const origCheckIn = ds.reservation!.checkIn;
      const newCheckIn = new Date(origCheckIn.getTime() + deltaDays * 86400000);
      newCheckIn.setHours(0,0,0,0);
      const nights = ds.reservation!.nights;
      const newCheckOut = new Date(newCheckIn.getTime() + nights * 86400000);
      const newRoom = this.rooms()[roomIndex];
      const collides = this.checkCollision(newRoom.id, newCheckIn, newCheckOut, ds.reservation!.id);
      this.dragState.update(d => d ? ({
        ...d,
        currentRoomIndex: roomIndex,
        currentDayOffset: dayOffset,
        previewCheckIn:  newCheckIn,
        previewCheckOut: newCheckOut,
        previewRoomId:   newRoom.id,
        collides,
      }) : null);
    } else if (ds.type === 'resize') {
      const res = ds.reservation!;
      const checkInDay = Math.round((res.checkIn.getTime() - this.startDate().getTime()) / 86400000);
      const newNights  = Math.max(1, dayOffset - checkInDay + 1);
      const newCheckOut = new Date(res.checkIn.getTime() + newNights * 86400000);
      const collides = this.checkCollision(res.roomId!, res.checkIn, newCheckOut, res.id);
      this.dragState.update(d => d ? ({
        ...d,
        currentDayOffset: dayOffset,
        previewCheckOut: newCheckOut,
        collides,
      }) : null);
    } else if (ds.type === 'create') {
      const room = this.rooms()[ds.startRoomIndex];
      const startDay = Math.min(ds.startDayOffset, dayOffset);
      const endDay   = Math.max(ds.startDayOffset, dayOffset) + 1;
      const ci = this.dayToDate(startDay);
      const co = this.dayToDate(endDay);
      const collides = this.checkCollision(room.id, ci, co);
      this.dragState.update(d => d ? ({
        ...d,
        currentDayOffset: dayOffset,
        previewCheckIn:  ci,
        previewCheckOut: co,
        collides,
      }) : null);
    }
  }

  private triggerCollisionFlash(): void {
    this.collisionFlash.set(true);
    setTimeout(() => this.collisionFlash.set(false), 600);
  }

  // ── Preview geometry ─────────────────────────────
  dragPreviewLeft(): number {
    const ds = this.dragState();
    if (!ds?.previewCheckIn) return 0;
    const start = this.startDate().getTime();
    return Math.max(0, (ds.previewCheckIn.getTime() - start) / 86400000) * COL_WIDTH + ROOM_COL_W;
  }

  dragPreviewWidth(): number {
    const ds = this.dragState();
    if (!ds?.previewCheckIn || !ds.previewCheckOut) return 0;
    const nights = Math.round(
      (ds.previewCheckOut.getTime() - ds.previewCheckIn.getTime()) / 86400000
    );
    return Math.max(COL_WIDTH * 0.5, nights * COL_WIDTH - 2);
  }
}
