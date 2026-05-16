export enum Role {
  Admin        = 'admin',
  Manager      = 'manager',
  Receptionist = 'receptionist',
  Housekeeper  = 'housekeeper',
  Accountant   = 'accountant',
}

export enum Permission {
  ViewReservations   = 'view_reservations',
  ManageReservations = 'manage_reservations',
  ViewGuests         = 'view_guests',
  ManageGuests       = 'manage_guests',
  ViewHousekeeping   = 'view_housekeeping',
  ManageHousekeeping = 'manage_housekeeping',
  ViewMaintenance    = 'view_maintenance',
  ManageMaintenance  = 'manage_maintenance',
  ViewFinance        = 'view_finance',
  ManageFinance      = 'manage_finance',
  ViewStaff          = 'view_staff',
  ManageStaff        = 'manage_staff',
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
  Pending    = 'pending',
  Confirmed  = 'confirmed',
  CheckedIn  = 'checked_in',
  CheckedOut = 'checked_out',
  Cancelled  = 'cancelled',
  NoShow     = 'no_show',
}

export enum HousekeepingStatus {
  Dirty      = 'dirty',
  InProgress = 'in_progress',
  Clean      = 'clean',
  Inspected  = 'inspected',
  OutOfOrder = 'out_of_order',
}

export enum MaintenancePriority {
  Low    = 'low',
  Medium = 'medium',
  High   = 'high',
  Urgent = 'urgent',
}

export enum MaintenanceStatus {
  Open       = 'open',
  Assigned   = 'assigned',
  InProgress = 'in_progress',
  Resolved   = 'resolved',
  Closed     = 'closed',
}

export enum ConciergeRequestType {
  ExtraTowels     = 'extra_towels',
  RoomService     = 'room_service',
  Taxi            = 'taxi',
  WakeUpCall      = 'wake_up_call',
  SpaBooking      = 'spa_booking',
  Restaurant      = 'restaurant',
  Laundry         = 'laundry',
  AirportTransfer = 'airport_transfer',
  Tour            = 'tour',
  ExtraAmenity    = 'extra_amenity',
  Transportation  = 'transportation',
  Spa             = 'spa',
  Other           = 'other',
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
  Direct          = 'direct',
  BookingCom      = 'booking_com',
  Airbnb          = 'airbnb',
  Expedia         = 'expedia',
  Walk_in         = 'walk_in',
  Phone           = 'phone',
  CorporateClient = 'corporate',
}

export enum LoyaltyTier {
  Bronze   = 'bronze',
  Silver   = 'silver',
  Gold     = 'gold',
  Platinum = 'platinum',
  Diamond  = 'diamond',
}

export enum AuditAction {
  Created        = 'created',
  Updated        = 'updated',
  Deleted        = 'deleted',
  CheckedIn      = 'checked_in',
  CheckedOut     = 'checked_out',
  Cancelled      = 'cancelled',
  StatusChanged  = 'status_changed',
  Login          = 'login',
  Logout         = 'logout',
  InviteSent     = 'invite_sent',
  PointsAdjusted = 'points_adjusted',
}

export enum AuditEntityType {
  Reservation  = 'reservation',
  Guest        = 'guest',
  Room         = 'room',
  Staff        = 'staff',
  Maintenance  = 'maintenance',
  Concierge    = 'concierge',
  Housekeeping = 'housekeeping',
  Payment      = 'payment',
  Setting      = 'setting',
  Loyalty      = 'loyalty',
}
