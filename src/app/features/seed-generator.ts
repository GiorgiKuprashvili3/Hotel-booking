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
  MaintenancePriority, MaintenanceStatus, AuditLog, AuditAction, AuditEntityType,
  LoyaltyProgram, LoyaltyPromotion, LoyaltyTierConfig, PropertySettings, RatePlan,
} from '../../../domain';

/* ── helpers ──────────────────────────────────────────────────── */

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
    loyaltyNumber: g.loyaltyNumber ?? undefined,
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
    id:           s.id,
    firstName:    s.firstName,
    lastName:     s.lastName,
    email:        s.email,
    phone:        s.phone ?? undefined,
    role:         s.role as Role,
    propertyIds:  s.propertyIds ?? [],
    avatarUrl:    s.avatarUrl ?? s.avatar ?? undefined,
    isActive:     s.isActive ?? true,
    hiredAt:      d(s.hiredAt),
    shift:        s.shift as 'day' | 'evening' | 'night' | undefined,
    languages:    s.languages ?? [],
    notes:        s.notes ?? undefined,
    inviteStatus: 'accepted' as const,
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
    estimatedCost: c.estimatedCost ?? undefined,
    actualCost:    c.actualCost ?? undefined,
    guestRating:   c.guestRating ?? undefined,
    notes:         c.notes ?? undefined,
  }));
}

/* ── Audit Log ───────────────────────────────────────────────── */

export function generateAuditLog(): AuditLog[] {
  const raw = (RAW as any).auditLog ?? [];
  if (raw.length > 0) {
    return raw.map((a: any) => ({
      id:         a.id,
      entityType: a.entityType as AuditEntityType,
      entityId:   a.entityId,
      action:     a.action as AuditAction,
      userId:     a.userId,
      details:    a.details ?? undefined,
      ipAddress:  a.ipAddress ?? undefined,
      timestamp:  d(a.timestamp),
    }));
  }

  // Synthesise a rich audit log covering all entity types and actions
  const reservations   = (RAW.reservations   as any[]).slice(0, 40);
  const guests         = (RAW.guests         as any[]).slice(0, 15);
  const staffList      = (RAW.staff          as any[]);
  const rooms          = (RAW.rooms          as any[]).slice(0, 10);
  const maintenance    = (RAW.maintenance    as any[]).slice(0, 10);
  const concierge      = (RAW.concierge      as any[]).slice(0, 10);
  const housekeeping   = (RAW.housekeepingTasks as any[]).slice(0, 10);

  const staffIds  = staffList.map((s: any) => s.id);
  const ipPool    = ['192.168.1.12','192.168.1.34','10.0.0.5','10.0.1.8','172.16.0.2'];
  const entries: AuditLog[] = [];
  let idx = 1;

  function uid(): string { return staffIds[idx % staffIds.length] ?? 'staff-1'; }
  function ip(): string  { return ipPool[idx % ipPool.length]; }
  function ago(ms: number): Date { return new Date(Date.now() - ms); }

  // ── Reservations ──────────────────────────────────────────────
  reservations.forEach(r => {
    entries.push({
      id: `audit-synth-${idx++}`, entityType: AuditEntityType.Reservation,
      entityId: r.id, action: AuditAction.Created, userId: uid(), ipAddress: ip(),
      details: { confirmationNumber: r.confirmationNumber, source: r.source, nights: r.nights },
      timestamp: d(r.createdAt),
    });
    if (r.status === 'checked_in' || r.status === 'checked_out') {
      entries.push({
        id: `audit-synth-${idx++}`, entityType: AuditEntityType.Reservation,
        entityId: r.id, action: AuditAction.CheckedIn, userId: uid(), ipAddress: ip(),
        details: { roomId: r.roomId, keyCardsIssued: 2 },
        timestamp: new Date(d(r.checkIn).getTime() + 3_600_000),
      });
    }
    if (r.status === 'checked_out') {
      entries.push({
        id: `audit-synth-${idx++}`, entityType: AuditEntityType.Reservation,
        entityId: r.id, action: AuditAction.CheckedOut, userId: uid(), ipAddress: ip(),
        details: { totalPaid: r.totalPaid, balance: r.balance },
        timestamp: d(r.checkOut),
      });
      entries.push({
        id: `audit-synth-${idx++}`, entityType: AuditEntityType.Loyalty,
        entityId: r.guestId, action: AuditAction.PointsAdjusted, userId: uid(), ipAddress: ip(),
        details: { points: Math.floor((r.totalAmount ?? 200) * 1.5), reason: `Stay ${r.confirmationNumber}` },
        timestamp: new Date(d(r.checkOut).getTime() + 60_000),
      });
    }
    if (r.status === 'cancelled') {
      entries.push({
        id: `audit-synth-${idx++}`, entityType: AuditEntityType.Reservation,
        entityId: r.id, action: AuditAction.Cancelled, userId: uid(), ipAddress: ip(),
        details: { reason: r.cancellationReason ?? 'Guest request' },
        timestamp: dOpt(r.cancelledAt) ?? ago(86400_000 * 2),
      });
    }
  });

  // ── Guest updates ─────────────────────────────────────────────
  guests.forEach(g => {
    entries.push({
      id: `audit-synth-${idx++}`, entityType: AuditEntityType.Guest,
      entityId: g.id, action: AuditAction.Created, userId: uid(), ipAddress: ip(),
      details: { name: `${g.firstName} ${g.lastName}`, nationality: g.nationality },
      timestamp: d(g.createdAt),
    });
    if (g.isVip) {
      entries.push({
        id: `audit-synth-${idx++}`, entityType: AuditEntityType.Guest,
        entityId: g.id, action: AuditAction.Updated, userId: uid(), ipAddress: ip(),
        details: { field: 'isVip', from: false, to: true },
        timestamp: new Date(d(g.createdAt).getTime() + 86400_000 * 3),
      });
    }
  });

  // ── Room status changes ───────────────────────────────────────
  rooms.forEach(r => {
    entries.push({
      id: `audit-synth-${idx++}`, entityType: AuditEntityType.Room,
      entityId: r.id, action: AuditAction.StatusChanged, userId: uid(), ipAddress: ip(),
      details: { room: r.number, from: 'available', to: r.status },
      timestamp: ago(86400_000 * Math.floor(Math.random() * 7 + 1)),
    });
  });

  // ── Maintenance ───────────────────────────────────────────────
  maintenance.forEach(m => {
    entries.push({
      id: `audit-synth-${idx++}`, entityType: AuditEntityType.Maintenance,
      entityId: m.id, action: AuditAction.Created, userId: uid(), ipAddress: ip(),
      details: { title: m.title, priority: m.priority, category: m.category },
      timestamp: d(m.reportedAt),
    });
    if (m.status !== 'open') {
      entries.push({
        id: `audit-synth-${idx++}`, entityType: AuditEntityType.Maintenance,
        entityId: m.id, action: AuditAction.StatusChanged, userId: uid(), ipAddress: ip(),
        details: { from: 'open', to: m.status },
        timestamp: dOpt(m.resolvedAt) ?? ago(86400_000),
      });
    }
  });

  // ── Concierge ─────────────────────────────────────────────────
  concierge.forEach(c => {
    entries.push({
      id: `audit-synth-${idx++}`, entityType: AuditEntityType.Concierge,
      entityId: c.id, action: AuditAction.Created, userId: uid(), ipAddress: ip(),
      details: { type: c.type, guestId: c.guestId },
      timestamp: d(c.requestedAt ?? c.createdAt),
    });
    if (c.status === 'completed') {
      entries.push({
        id: `audit-synth-${idx++}`, entityType: AuditEntityType.Concierge,
        entityId: c.id, action: AuditAction.StatusChanged, userId: uid(), ipAddress: ip(),
        details: { from: 'in_progress', to: 'completed' },
        timestamp: dOpt(c.completedAt) ?? ago(3_600_000),
      });
    }
  });

  // ── Housekeeping ──────────────────────────────────────────────
  housekeeping.forEach(h => {
    if (h.completedAt) {
      entries.push({
        id: `audit-synth-${idx++}`, entityType: AuditEntityType.Housekeeping,
        entityId: h.id, action: AuditAction.StatusChanged, userId: h.assignedTo ?? uid(),
        ipAddress: ip(),
        details: { roomId: h.roomId, from: 'in_progress', to: 'clean', durationMinutes: h.durationMinutes },
        timestamp: d(h.completedAt),
      });
    }
  });

  // ── Staff logins ──────────────────────────────────────────────
  staffList.forEach((s: any, i: number) => {
    // login today / yesterday
    entries.push({
      id: `audit-synth-${idx++}`, entityType: AuditEntityType.Staff,
      entityId: s.id, action: AuditAction.Login, userId: s.id, ipAddress: ip(),
      details: { browser: 'Chrome 124' },
      timestamp: ago((i % 3) * 3_600_000 + Math.random() * 3_600_000),
    });
    if (i % 4 === 0) {
      entries.push({
        id: `audit-synth-${idx++}`, entityType: AuditEntityType.Staff,
        entityId: s.id, action: AuditAction.Logout, userId: s.id, ipAddress: ip(),
        details: { sessionDurationMin: Math.floor(Math.random() * 480 + 30) },
        timestamp: ago((i % 3) * 3_600_000 - 1_800_000),
      });
    }
  });

  // ── Settings change ───────────────────────────────────────────
  entries.push({
    id: `audit-synth-${idx++}`, entityType: AuditEntityType.Setting,
    entityId: 'prop-1', action: AuditAction.Updated, userId: staffIds[0] ?? 'staff-1',
    ipAddress: ip(),
    details: { field: 'checkInTime', from: '14:00', to: '15:00' },
    timestamp: ago(86400_000 * 5),
  });

  return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/* ── Loyalty Promotions ──────────────────────────────────────── */

export function generateLoyaltyPromotions(): LoyaltyPromotion[] {
  const raw = (RAW as any).loyaltyPromotions ?? [];
  if (raw.length > 0) {
    return raw.map((p: any) => ({
      id:          p.id,
      name:        p.name,
      description: p.description ?? '',
      multiplier:  p.multiplier ?? 2,
      targetTiers: (p.targetTiers ?? []) as LoyaltyTier[],
      startsAt:    d(p.startsAt),
      endsAt:      d(p.endsAt),
      isActive:    p.isActive ?? true,
      createdBy:   p.createdBy ?? 'staff-1',
    }));
  }
  // Fallback: rich built-in promotions so the tab is never empty
  const now = Date.now();
  const day = 86_400_000;
  return [
    {
      id: 'promo-1',
      name: 'Double Points Weekend',
      description: 'Earn 2× LuxPoints on all stays booked Friday–Sunday.',
      multiplier: 2,
      targetTiers: [] as LoyaltyTier[],
      startsAt: new Date(now - day * 2),
      endsAt:   new Date(now + day * 5),
      isActive: true,
      createdBy: 'staff-1',
    },
    {
      id: 'promo-2',
      name: 'Platinum & Diamond Boost',
      description: 'Our top-tier members earn 3× points throughout Q2.',
      multiplier: 3,
      targetTiers: [LoyaltyTier.Platinum, LoyaltyTier.Diamond],
      startsAt: new Date(now - day * 10),
      endsAt:   new Date(now + day * 80),
      isActive: true,
      createdBy: 'staff-1',
    },
    {
      id: 'promo-3',
      name: 'New Member Welcome Bonus',
      description: 'First-time members earn 2× points on their inaugural stay.',
      multiplier: 2,
      targetTiers: [LoyaltyTier.Bronze],
      startsAt: new Date(now - day * 30),
      endsAt:   new Date(now + day * 335),
      isActive: true,
      createdBy: 'staff-2',
    },
    {
      id: 'promo-4',
      name: 'Summer Splash',
      description: '1.5× points on all spa and F&B charges during summer.',
      multiplier: 1.5,
      targetTiers: [] as LoyaltyTier[],
      startsAt: new Date(now + day * 20),
      endsAt:   new Date(now + day * 110),
      isActive: false,
      createdBy: 'staff-1',
    },
  ];
}

export function generateLoyaltyProgram(): LoyaltyProgram {
  const raw = (RAW as any).loyaltyProgram ?? {};
  return {
    id:             raw.id ?? 'lux-rewards',
    name:           raw.name ?? 'LuxStay Rewards',
    currency:       raw.currency ?? 'LuxPoints',
    redemptionRate: raw.redemptionRate ?? 100,
    tiers: ((raw.tiers ?? []) as any[]).map((t: any) => ({
      id:            t.id,
      name:          t.name,
      minStays:      t.minStays ?? 0,
      minPoints:     t.minPoints ?? 0,
      pointsPerGel:  t.pointsPerGel ?? 1,
      benefits:      t.benefits ?? [],
    })) as LoyaltyTierConfig[],
  };
}

/* ── Rate Plans ──────────────────────────────────────────────── */

export function generateRatePlans(): RatePlan[] {
  const raw = (RAW as any).ratePlans ?? [];
  if (raw.length > 0) {
    return raw.map((rp: any) => ({
      id:                rp.id,
      name:              rp.name,
      code:              rp.code,
      description:       rp.description ?? undefined,
      isRefundable:      rp.isRefundable ?? true,
      cancellationHours: rp.cancellationHours ?? 24,
      depositPct:        rp.depositPct ?? 0,
      isActive:          rp.isActive ?? true,
    }));
  }
  // fallback if seed has no ratePlans
  return [
    { id: 'bar', name: 'Best Available Rate', code: 'BAR', isRefundable: true, cancellationHours: 24, depositPct: 0, isActive: true },
    { id: 'bb',  name: 'Bed & Breakfast',     code: 'BB',  isRefundable: true, cancellationHours: 24, depositPct: 0, isActive: true },
    { id: 'nr',  name: 'Non-Refundable',       code: 'NR',  isRefundable: false, cancellationHours: 0, depositPct: 100, isActive: true },
  ];
}

/* ── Settings ────────────────────────────────────────────────── */

export function generateSettings(): PropertySettings {
  const raw = (RAW as any).settings ?? {};
  return {
    theme:             raw.theme ?? 'light',
    defaultPropertyId: raw.defaultPropertyId ?? 'prop-1',
    language:          raw.language ?? 'en',
    dateFormat:        raw.dateFormat ?? 'DD/MM/YYYY',
    timeFormat:        raw.timeFormat ?? '24h',
    currency:          raw.currency ?? 'GEL',
    notifications: {
      newReservation:       raw.notifications?.newReservation ?? true,
      checkInReminder:      raw.notifications?.checkInReminder ?? true,
      maintenanceAlert:     raw.notifications?.maintenanceAlert ?? true,
      housekeepingComplete: raw.notifications?.housekeepingComplete ?? true,
      lowOccupancyAlert:    raw.notifications?.lowOccupancyAlert ?? false,
      lowOccupancyThreshold: raw.notifications?.lowOccupancyThreshold ?? 0.4,
    },
    dashboard: {
      defaultView:            raw.dashboard?.defaultView ?? 'overview',
      kpiCards:               raw.dashboard?.kpiCards ?? ['occupancy','revenue','adr','arrivals','departures','inhouse'],
      refreshIntervalSeconds: raw.dashboard?.refreshIntervalSeconds ?? 60,
    },
  };
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
  auditLog:            AuditLog[];
  loyaltyProgram:      LoyaltyProgram;
  loyaltyPromotions:   LoyaltyPromotion[];
  ratePlans:           RatePlan[];
  settings:            PropertySettings;
}

let cached: SeedDataset | null = null;

export function getSeedDataset(): SeedDataset {
  if (cached) return cached;
  const properties        = generateProperties();
  const roomTypes         = generateRoomTypes(properties);
  const rooms             = generateRooms(properties, roomTypes);
  const guests            = generateGuests();
  const staff             = generateStaff(properties);
  const reservations      = generateReservations(properties, rooms, roomTypes, guests);
  const housekeepingTasks = generateHousekeepingTasks(rooms, staff);
  const maintenance       = generateMaintenance(properties, rooms, staff);
  const concierge         = generateConcierge(reservations);
  const analyticsSnapshots = (RAW.analyticsSnapshots ?? []) as AnalyticsSnapshotRaw[];
  const auditLog          = generateAuditLog();
  const loyaltyProgram    = generateLoyaltyProgram();
  const loyaltyPromotions = generateLoyaltyPromotions();
  const ratePlans         = generateRatePlans();
  const settings          = generateSettings();

  cached = {
    properties, roomTypes, rooms, guests, staff, reservations,
    housekeepingTasks, maintenance, concierge, analyticsSnapshots,
    auditLog,
    loyaltyProgram,
    loyaltyPromotions,
    ratePlans,
    settings,
  };
  return cached;
}
