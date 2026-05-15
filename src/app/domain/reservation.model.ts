import { BookingSource, PaymentMethod, ReservationStatus } from './enums';

export interface Reservation {
  id: string;
  confirmationNumber: string;  // 'LUX-2026-04821'
  propertyId: string;
  guestId: string;
  roomId?: string;             // null until room assigned
  roomTypeId: string;
  ratePlanId: string;

  checkIn: Date;
  checkOut: Date;
  nights: number;

  adults: number;
  children: number;

  status: ReservationStatus;
  source: BookingSource;

  totalRoomCharge: number;
  totalTax: number;
  totalExtras: number;
  totalPaid: number;
  totalAmount: number;
  balance: number;

  specialRequests?: string;
  internalNotes?: string;

  groupId?: string;            // multi-room booking
  createdAt: Date;
  createdBy?: string;          // staff id, null if online
  cancelledAt?: Date;
  cancellationReason?: string;
}

export interface Folio {
  id: string;
  reservationId: string;
  items: FolioItem[];
  payments: Payment[];
  isOpen: boolean;
  closedAt?: Date;
}

export interface FolioItem {
  id: string;
  date: Date;
  description: string;        // 'Room charge - night 1', 'Minibar', 'Restaurant'
  category: 'room' | 'tax' | 'food' | 'minibar' | 'service' | 'misc';
  quantity: number;
  unitPrice: number;
  amount: number;
  postedBy?: string;
}

export interface Payment {
  id: string;
  reservationId: string;
  date: Date;
  amount: number;
  method: PaymentMethod;
  reference?: string;          // card last 4, transaction id
  receivedBy?: string;         // staff id
  notes?: string;
}

/** A group booking is a parent record tying multiple reservations together. */
export interface BookingGroup {
  id: string;
  propertyId: string;
  name: string;                // 'Smith Wedding Party', 'Acme Corp Q2 Retreat'
  primaryGuestId: string;
  reservationIds: string[];
  notes?: string;
  createdAt: Date;
}
