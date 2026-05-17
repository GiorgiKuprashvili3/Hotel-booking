import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Cross-context realtime channel.
 *
 * Public booking flow (anonymous, no auth) publishes a `booking.created`
 * event when a guest completes a reservation. The admin dashboard,
 * running in the SAME tab or a SEPARATE tab, subscribes and surfaces
 * the new reservation in real time.
 *
 * Transport: BroadcastChannel where available (modern browsers, cross-tab),
 * with a same-tab Subject fallback so it always works in test envs too.
 */

export interface BookingCreatedEvent {
  type: 'booking.created';
  reservationId: string;
  confirmationNumber: string;
  propertyId: string;
  guestName: string;
  roomTypeName: string;
  checkIn: string;        // ISO
  checkOut: string;       // ISO
  totalAmount: number;
  at: string;             // ISO timestamp
}

export type RealtimeEvent = BookingCreatedEvent;

const CHANNEL_NAME = 'luxstay.realtime';

@Injectable({ providedIn: 'root' })
export class BookingBroadcastService {
  private channel: BroadcastChannel | null = null;
  private localBus = new Subject<RealtimeEvent>();

  /** Cumulative event log, capped, useful for badges + slide-in toasts. */
  readonly recent = signal<RealtimeEvent[]>([]);

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (e: MessageEvent<RealtimeEvent>) => {
          if (e?.data) this.ingest(e.data, /* echo */ false);
        };
      } catch {
        this.channel = null;
      }
    }
  }

  /** Publish to all subscribers (this tab + other tabs). */
  publish(event: RealtimeEvent): void {
    this.ingest(event, /* echo */ true);
    if (this.channel) {
      try { this.channel.postMessage(event); } catch { /* swallow */ }
    }
  }

  /** Stream of events, in arrival order. */
  events$(): Observable<RealtimeEvent> {
    return this.localBus.asObservable();
  }

  private ingest(event: RealtimeEvent, echo: boolean): void {
    this.localBus.next(event);
    this.recent.update(list => [event, ...list].slice(0, 20));
    // `echo` is reserved for future use if we ever need to suppress local re-broadcast.
    void echo;
  }
}
