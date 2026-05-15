/**
 * Seed loader — reads from luxstay-seed-data.json instead of faker.
 * All data shapes, IDs, names, prices and dates match the canonical
 * seed file so the mock layer is a faithful API imitation.
 * When the real NestJS backend is ready, swap the service tokens in
 * mock-data.providers.ts to point at HTTP impls — nothing else changes.
 */
import RAW from './luxstay-seed-data.json';
import {
  Property, Room, RoomType, Guest, Reservation, Staff,
  HousekeepingTask, MaintenanceRequest, ConciergeRequest,
  RoomStatus, HousekeepingStatus, ReservationStatus, BookingSource,
  Role, LoyaltyTier, ConciergeRequestType, ConciergeStatus,
  MaintenancePriority, MaintenanceStatus,
} from '../../../domain';

/* ── helpers ──────────────────────────────────────────────────── */

/** Parse an ISO date string (or null) into a Date. */
function d(iso: string | null | undefined): Date {
  return iso ? new Date(iso) : new Date();
}
function dOpt(iso: string | null | undefined): Date | undefined {
  return iso ? new Date(iso) : undefined;
}

/* ── Properties ──────────────────────────────────────────────── */

export function generateProperties(): Property[] {
  return (RAW.properties as any[]).map(p => ({
    id:           p.id,
    name:         p.name,
    brand:        p.brand,
    city:         p.city,
    country:      p.country,
    address:      p.address,
    starRating:   p.starRating as 3 | 4 | 5,
    timezone:     p.timezone,
    currency:     p.currency,
    taxRate:      p.taxRate,
    checkInTime:  p.checkInTime,
    checkOutTime: p.checkOutTime,
    photoUrl:     p.images?.[0],
    totalRooms:   p.totalRooms,
    createdAt:    d(p.createdAt),
  }));
}

/* ── Room Types ──────────────────────────────────────────────── */

export function generateRoomTypes(_properties: Property[]): RoomType[] {
  return (RAW.roomTypes as any[]).map(rt => ({
    id:               rt.id,
    propertyId:       rt.propertyId,
    code:             rt.code,
    name:             rt.name,
    description:      rt.description,
    basePrice:        rt.basePrice,
    maxOccupancy:     rt.maxOccupancy,
    bedConfiguration: rt.bedConfiguration,
    sizeSqm:          rt.sizeSqm,
    amenities:        rt.amenities ?? [],
    photoUrl:         rt.images?.[0],
  }));
}

/* ── Rooms ───────────────────────────────────────────────────── */

export function generateRooms(_properties: Property[], _types: RoomType[]): Room[] {
  return (RAW.rooms as any[]).map(r => ({
    id:                 r.id,
    propertyId:         r.propertyId,
    roomTypeId:         r.roomTypeId,
    number:             r.number,
    floor:              r.floor,
    status:             r.status as RoomStatus,
    housekeepingStatus: r.housekeepingStatus as HousekeepingStatus,
    isSmoking:          r.isSmoking ?? false,
    notes:              r.notes ?? undefined,
    lastCleanedAt:      dOpt(r.lastCleanedAt),
    lastInspectedAt:    dOpt(r.lastInspectedAt),
  }));
}

/* ── Guests ──────────────────────────────────────────────────── */

export function generateGuests(_count?: number): Guest[] {
  return (RAW.guests as any[]).map(g => ({
    id:           g.id,
    firstName:    g.firstName,
    lastName:     g.lastName,
    email:        g.email,
    phone:        g.phone,
    nationality:  g.nationality,
    idType:       g.idType as 'passport' | 'national_id' | 'driver_license',
    idNumber:     g.idNumber,
    dateOfBirth:  dOpt(g.dateOfBirth),
    address:      g.address
      ? (typeof g.address === 'string'
          ? g.address
          : [g.address.street, g.address.city, g.address.country].filter(Boolean).join(', '))
      : undefined,
    isVip:         g.isVip ?? false,
    loyaltyTier:   g.loyaltyTier as LoyaltyTier | undefined,
    loyaltyPoints: g.loyaltyPoints ?? 0,
    preferences: {
      preferredFloor:    g.preferences?.preferredFloor,
      preferredBed:      g.preferences?.preferredBed,
      smokingPreference: g.preferences?.smokingPreference ?? false,
      dietary:           g.preferences?.dietary ?? [],
      newspaper:         g.preferences?.newspaper ?? undefined,
      wakeUpCall:        g.preferences?.wakeUpCall ?? undefined,
    },
    tags:        g.tags ?? [],
    notes:       g.notes ?? undefined,
    totalStays:  g.totalStays ?? 0,
    totalSpent:  g.totalSpent ?? 0,
    lastStayDate: dOpt(g.lastStayDate),
    createdAt:    d(g.createdAt),
  }));
}

/* ── Staff ───────────────────────────────────────────────────── */

export function generateStaff(_properties: Property[]): Staff[] {
  return (RAW.staff as any[]).map(s => ({
    id:          s.id,
    firstName:   s.firstName,
    lastName:    s.lastName,
    email:       s.email,
    phone:       s.phone ?? undefined,
    role:        s.role as Role,
    propertyIds: s.propertyIds ?? [],
    avatarUrl:   s.avatarUrl ?? undefined,
    isActive:    s.isActive ?? true,
    hiredAt:     d(s.hiredAt),
  }));
}

/* ── Reservations ────────────────────────────────────────────── */

export function generateReservations(
  _properties: Property[],
  _rooms: Room[],
  _types: RoomType[],
  _guests: Guest[],
): Reservation[] {
  return (RAW.reservations as any[]).map(r => ({
    id:                 r.id,
    confirmationNumber: r.confirmationNumber,
    propertyId:         r.propertyId,
    guestId:            r.guestId,
    roomId:             r.roomId ?? undefined,
    roomTypeId:         r.roomTypeId,
    ratePlanId:         r.ratePlanId ?? 'bar',
    checkIn:            d(r.checkIn),
    checkOut:           d(r.checkOut),
    nights:             r.nights,
    adults:             r.adults,
    children:           r.children ?? 0,
    status:             r.status as ReservationStatus,
    source:             (r.source ?? 'direct') as BookingSource,
    totalRoomCharge:    r.totalRoomCharge ?? 0,
    totalTax:           r.totalTax ?? 0,
    totalExtras:        r.totalExtras ?? 0,
    totalPaid:          r.totalPaid ?? 0,
    totalAmount:        r.totalAmount ?? 0,
    balance:            r.balance ?? 0,
    specialRequests:    r.specialRequests ?? r.notes ?? undefined,
    internalNotes:      r.internalNotes ?? undefined,
    createdAt:          d(r.createdAt),
    cancelledAt:        dOpt(r.cancelledAt),
    cancellationReason: r.cancellationReason ?? undefined,
  }));
}

/* ── Housekeeping tasks ──────────────────────────────────────── */

export function generateHousekeepingTasks(_rooms: Room[], _staff: Staff[]): HousekeepingTask[] {
  return (RAW.housekeepingTasks as any[]).map(t => ({
    id:              t.id,
    propertyId:      t.propertyId,
    roomId:          t.roomId,
    assignedTo:      t.assignedTo ?? undefined,
    status:          t.status as HousekeepingStatus,
    priority:        (t.priority ?? 'normal') as 'low' | 'normal' | 'high',
    scheduledFor:    d(t.scheduledFor),
    startedAt:       dOpt(t.startedAt),
    completedAt:     dOpt(t.completedAt),
    durationMinutes: t.durationMinutes ?? undefined,
    notes:           t.notes ?? undefined,
  }));
}

/* ── Maintenance ─────────────────────────────────────────────── */

export function generateMaintenance(
  _properties: Property[],
  _rooms: Room[],
  _staff: Staff[],
): MaintenanceRequest[] {
  return (RAW.maintenance as any[]).map(m => ({
    id:              m.id,
    propertyId:      m.propertyId,
    roomId:          m.roomId ?? undefined,
    location:        m.location ?? undefined,
    reportedBy:      m.reportedBy,
    assignedTo:      m.assignedTo ?? undefined,
    category:        (m.category ?? 'other') as MaintenanceRequest['category'],
    priority:        m.priority as MaintenancePriority,
    status:          m.status as MaintenanceStatus,
    title:           m.title,
    description:     m.description ?? '',
    reportedAt:      d(m.reportedAt),
    resolvedAt:      dOpt(m.resolvedAt),
    resolutionNotes: m.resolutionNotes ?? undefined,
  }));
}

/* ── Concierge ───────────────────────────────────────────────── */

export function generateConcierge(_reservations: Reservation[]): ConciergeRequest[] {
  return (RAW.concierge as any[]).map(c => ({
    id:            c.id,
    propertyId:    c.propertyId,
    reservationId: c.reservationId,
    guestId:       c.guestId,
    roomId:        c.roomId ?? undefined,
    type:          (c.type ?? 'other') as ConciergeRequestType,
    status:        c.status as ConciergeStatus,
    details:       c.details ?? c.notes ?? '',
    scheduledFor:  dOpt(c.scheduledFor),
    requestedAt:   d(c.requestedAt ?? c.createdAt),
    completedAt:   dOpt(c.completedAt),
    assignedTo:    c.assignedTo ?? undefined,
  }));
}

/* ── Master dataset ──────────────────────────────────────────── */

export interface AnalyticsSnapshotRaw {
  date:           string;
  propertyId:     string;
  occupancyRate:  number;
  totalRooms:     number;
  occupiedRooms:  number;
  adr:            number;
  revpar:         number;
  totalRevenue:   number;
  roomRevenue:    number;
  fnbRevenue:     number;
  spaRevenue:     number;
  arrivals:       number;
  departures:     number;
  noShows:        number;
  cancellations:  number;
}

export interface SeedDataset {
  properties:          Property[];
  roomTypes:           RoomType[];
  rooms:               Room[];
  guests:              Guest[];
  staff:               Staff[];
  reservations:        Reservation[];
  housekeepingTasks:   HousekeepingTask[];
  maintenance:         MaintenanceRequest[];
  concierge:           ConciergeRequest[];
  analyticsSnapshots:  AnalyticsSnapshotRaw[];
}

let cached: SeedDataset | null = null;

export function getSeedDataset(): SeedDataset {
  if (cached) return cached;
  const properties       = generateProperties();
  const roomTypes        = generateRoomTypes(properties);
  const rooms            = generateRooms(properties, roomTypes);
  const guests           = generateGuests();
  const staff            = generateStaff(properties);
  const reservations     = generateReservations(properties, rooms, roomTypes, guests);
  const housekeepingTasks = generateHousekeepingTasks(rooms, staff);
  const maintenance      = generateMaintenance(properties, rooms, staff);
  const concierge        = generateConcierge(reservations);
  const analyticsSnapshots = (RAW.analyticsSnapshots ?? []) as AnalyticsSnapshotRaw[];
  cached = { properties, roomTypes, rooms, guests, staff, reservations, housekeepingTasks, maintenance, concierge, analyticsSnapshots };
  return cached;
}
