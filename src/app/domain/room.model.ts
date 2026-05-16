import { HousekeepingStatus, RoomStatus } from './enums';

export interface RoomType {
  id: string;
  propertyId: string;
  code: string;             // 'DLX', 'STE', 'STD'
  name: string;             // 'Deluxe King'
  description: string;
  basePrice: number;        // nightly base
  maxOccupancy: number;
  bedConfiguration: string; // '1 King', '2 Queens'
  sizeSqm: number;
  amenities: string[];      // ['WiFi','Minibar','Sea View']
  photoUrl?: string;
}

export interface Room {
  id: string;
  propertyId: string;
  roomTypeId: string;
  number: string;        // '301'
  floor: number;
  status: RoomStatus;
  housekeepingStatus: HousekeepingStatus;
  isSmoking: boolean;
  notes?: string;
  lastCleanedAt?: Date;
  lastInspectedAt?: Date;
}

export interface RatePlan {
  id: string;
  name: string;
  code: string;              // 'BAR', 'BB', 'NR'
  description?: string;
  // legacy fields kept for backward compat
  propertyId?: string;
  roomTypeId?: string;
  multiplier?: number;
  minStay?: number;
  maxStay?: number;
  refundable?: boolean;
  isRefundable: boolean;
  includesBreakfast?: boolean;
  cancellationHours: number;  // free cancellation up to N hours before arrival
  depositPct: number;         // 0-100
  isActive: boolean;
}

/** A log entry every time a room's status changes — surfaced in the room drawer. */
export interface RoomStatusHistory {
  id: string;
  roomId: string;
  from: RoomStatus;
  to: RoomStatus;
  at: Date;
  staffId?: string;
  note?: string;
}
