export enum Role {
  Admin        = 'admin',
  Manager      = 'manager',
  Receptionist = 'receptionist',
  Housekeeper  = 'housekeeper',
  Accountant   = 'accountant',
}

export enum RoomStatus {
  Available   = 'available',
  Occupied    = 'occupied',
  Cleaning    = 'cleaning',
  Maintenance = 'maintenance',
  Reserved    = 'reserved',
  Blocked     = 'blocked',
}

export enum ReservationStatus {
  Pending      = 'pending',
  Confirmed    = 'confirmed',
  CheckedIn    = 'checked_in',
  CheckedOut   = 'checked_out',
  Cancelled    = 'cancelled',
  NoShow       = 'no_show',
}

export enum HousekeepingStatus {
  Dirty       = 'dirty',
  InProgress  = 'in_progress',
  Clean       = 'clean',
  Inspected   = 'inspected',
  OutOfOrder  = 'out_of_order',
}

export enum MaintenancePriority {
  Low      = 'low',
  Medium   = 'medium',
  High     = 'high',
  Urgent   = 'urgent',
}

export enum MaintenanceStatus {
  Open       = 'open',
  Assigned   = 'assigned',
  InProgress = 'in_progress',
  Resolved   = 'resolved',
  Closed     = 'closed',
}

export enum ConciergeRequestType {
  ExtraTowels  = 'extra_towels',
  RoomService  = 'room_service',
  Taxi         = 'taxi',
  WakeUpCall   = 'wake_up_call',
  SpaBooking   = 'spa_booking',
  Other        = 'other',
}

export enum ConciergeStatus {
  New        = 'new',
  InProgress = 'in_progress',
  Completed  = 'completed',
  Cancelled  = 'cancelled',
}

export enum PaymentMethod {
  Cash         = 'cash',
  Card         = 'card',
  BankTransfer = 'bank_transfer',
  Voucher      = 'voucher',
}

export enum BookingSource {
  Direct        = 'direct',
  BookingCom    = 'booking_com',
  Airbnb        = 'airbnb',
  Expedia       = 'expedia',
  Walk_in       = 'walk_in',
  Phone         = 'phone',
  CorporateClient = 'corporate',
}

export enum LoyaltyTier {
  Bronze   = 'bronze',
  Silver   = 'silver',
  Gold     = 'gold',
  Platinum = 'platinum',
}
