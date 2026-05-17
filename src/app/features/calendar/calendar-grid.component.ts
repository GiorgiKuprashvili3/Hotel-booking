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
  templateUrl: './calendar-grid.component.html',
  styleUrl: './calendar-grid.component.scss',
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
