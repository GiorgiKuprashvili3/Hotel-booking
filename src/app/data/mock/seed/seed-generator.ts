import { faker } from '@faker-js/faker';
import {
  Property, Room, RoomType, Guest, Reservation, Staff,
  HousekeepingTask, MaintenanceRequest, ConciergeRequest,
  RoomStatus, HousekeepingStatus, ReservationStatus, BookingSource,
  Role, LoyaltyTier, ConciergeRequestType, ConciergeStatus,
  MaintenancePriority, MaintenanceStatus,
} from '../../../domain';

faker.seed(42); // deterministic data — same on every load

/* ---------- Helpers ---------- */
function pickOne<T>(arr: T[]): T { return arr[faker.number.int({ min: 0, max: arr.length - 1 })]; }
function maybe(p = 0.5): boolean { return faker.number.float({ min: 0, max: 1 }) < p; }
function daysAgo(n: number): Date { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number): Date { const d = new Date(); d.setDate(d.getDate() + n); return d; }

/* ---------- Properties ---------- */
export function generateProperties(): Property[] {
  return [
    {
      id: 'prop-1',
      name: 'The Aurora Tbilisi',
      brand: 'LuxStay Collection',
      city: 'Tbilisi', country: 'Georgia',
      address: '14 Rustaveli Avenue, Tbilisi',
      starRating: 5,
      timezone: 'Asia/Tbilisi',
      currency: 'GEL',
      taxRate: 0.18,
      checkInTime: '14:00', checkOutTime: '12:00',
      totalRooms: 80,
      createdAt: daysAgo(800),
    },
    {
      id: 'prop-2',
      name: 'Villa Riviera',
      brand: 'LuxStay Collection',
      city: 'Batumi', country: 'Georgia',
      address: '22 Seaside Boulevard, Batumi',
      starRating: 5,
      timezone: 'Asia/Tbilisi',
      currency: 'GEL',
      taxRate: 0.18,
      checkInTime: '15:00', checkOutTime: '11:00',
      totalRooms: 60,
      createdAt: daysAgo(600),
    },
    {
      id: 'prop-3',
      name: 'Kazbegi Mountain Lodge',
      brand: 'LuxStay Collection',
      city: 'Stepantsminda', country: 'Georgia',
      address: 'Mountain Pass Road, Kazbegi',
      starRating: 4,
      timezone: 'Asia/Tbilisi',
      currency: 'GEL',
      taxRate: 0.18,
      checkInTime: '15:00', checkOutTime: '11:00',
      totalRooms: 40,
      createdAt: daysAgo(400),
    },
  ];
}

/* ---------- Room Types ---------- */
export function generateRoomTypes(properties: Property[]): RoomType[] {
  const types: RoomType[] = [];
  const defs = [
    { code: 'STD', name: 'Standard',     basePrice: 220, max: 2, size: 24, bed: '1 Queen', desc: 'Tastefully appointed standard room' },
    { code: 'DLX', name: 'Deluxe',       basePrice: 320, max: 2, size: 32, bed: '1 King',  desc: 'Spacious deluxe with premium finishings' },
    { code: 'EXC', name: 'Executive',    basePrice: 450, max: 3, size: 42, bed: '1 King + Sofa', desc: 'Executive suite with lounge access' },
    { code: 'STE', name: 'Suite',        basePrice: 680, max: 4, size: 58, bed: '1 King + 2 Twin', desc: 'Lavish suite with separate living area' },
    { code: 'PRES', name: 'Presidential', basePrice: 1200, max: 4, size: 92, bed: '1 King + 2 Twin', desc: 'Top-floor presidential suite' },
  ];

  properties.forEach(p => {
    defs.forEach((d, idx) => {
      types.push({
        id: `${p.id}-rt-${d.code.toLowerCase()}`,
        propertyId: p.id,
        code: d.code,
        name: d.name,
        description: d.desc,
        basePrice: d.basePrice,
        maxOccupancy: d.max,
        bedConfiguration: d.bed,
        sizeSqm: d.size,
        amenities: ['WiFi', 'Smart TV', 'Minibar', 'Safe', 'Bathrobe', ...(idx >= 2 ? ['Sea View', 'Espresso Machine'] : [])],
      });
    });
  });
  return types;
}

/* ---------- Rooms ---------- */
export function generateRooms(properties: Property[], types: RoomType[]): Room[] {
  const rooms: Room[] = [];
  properties.forEach(p => {
    const propTypes = types.filter(t => t.propertyId === p.id);
    const floors = Math.ceil(p.totalRooms / 10);
    let counter = 0;
    for (let floor = 1; floor <= floors && counter < p.totalRooms; floor++) {
      const roomsThisFloor = Math.min(10, p.totalRooms - counter);
      for (let i = 1; i <= roomsThisFloor; i++) {
        // Higher floors → fancier room type bias
        const typeIdx = Math.min(
          propTypes.length - 1,
          Math.floor((floor / floors) * propTypes.length + faker.number.float({ min: 0, max: 2 })),
        );
        const number = `${floor}${String(i).padStart(2, '0')}`;
        const statusRoll = faker.number.float({ min: 0, max: 1 });
        const status =
          statusRoll < 0.45 ? RoomStatus.Available :
          statusRoll < 0.75 ? RoomStatus.Occupied :
          statusRoll < 0.85 ? RoomStatus.Cleaning :
          statusRoll < 0.92 ? RoomStatus.Reserved :
          statusRoll < 0.97 ? RoomStatus.Maintenance :
                              RoomStatus.Blocked;

        rooms.push({
          id: `${p.id}-r-${number}`,
          propertyId: p.id,
          roomTypeId: propTypes[typeIdx].id,
          number,
          floor,
          status,
          housekeepingStatus:
            status === RoomStatus.Cleaning ? HousekeepingStatus.InProgress :
            status === RoomStatus.Available ? HousekeepingStatus.Clean :
            status === RoomStatus.Occupied ? HousekeepingStatus.Dirty :
            HousekeepingStatus.Clean,
          isSmoking: maybe(0.15),
          lastCleanedAt: daysAgo(Math.floor(Math.random() * 3)),
        });
        counter++;
      }
    }
  });
  return rooms;
}

/* ---------- Guests ---------- */
export function generateGuests(count = 200): Guest[] {
  const guests: Guest[] = [];
  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName  = faker.person.lastName();
    const isVip = maybe(0.08);
    const stays = faker.number.int({ min: 1, max: 24 });
    guests.push({
      id: `guest-${i + 1}`,
      firstName, lastName,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      phone: faker.phone.number(),
      nationality: faker.location.country(),
      idType: pickOne(['passport', 'national_id', 'driver_license']),
      idNumber: faker.string.alphanumeric(9).toUpperCase(),
      dateOfBirth: faker.date.birthdate({ min: 22, max: 75, mode: 'age' }),
      address: faker.location.streetAddress({ useFullAddress: true }),
      isVip,
      loyaltyTier: stays > 15 ? LoyaltyTier.Platinum
                : stays > 8  ? LoyaltyTier.Gold
                : stays > 3  ? LoyaltyTier.Silver
                              : LoyaltyTier.Bronze,
      loyaltyPoints: stays * faker.number.int({ min: 200, max: 800 }),
      preferences: {
        preferredFloor: pickOne(['low', 'mid', 'high']),
        preferredBed: pickOne(['king', 'queen', 'twin']),
        smokingPreference: maybe(0.1),
        dietary: maybe(0.3) ? [pickOne(['Vegetarian', 'Vegan', 'Gluten-free', 'Halal'])] : [],
        wakeUpCall: maybe(0.2) ? '07:00' : undefined,
      },
      tags: isVip ? ['VIP', pickOne(['Repeat guest', 'Corporate', 'Celebrity'])] : [],
      totalStays: stays,
      totalSpent: stays * faker.number.int({ min: 400, max: 3500 }),
      lastStayDate: daysAgo(faker.number.int({ min: 5, max: 365 })),
      createdAt: daysAgo(faker.number.int({ min: 30, max: 1500 })),
    });
  }
  return guests;
}

/* ---------- Staff ---------- */
export function generateStaff(properties: Property[]): Staff[] {
  const seed: Array<Partial<Staff>> = [
    { firstName: 'Elena',  lastName: 'Morozova',   role: Role.Admin },
    { firstName: 'Henri',  lastName: 'Beaumont',   role: Role.Manager },
    { firstName: 'Sofia',  lastName: 'Chen',       role: Role.Receptionist },
    { firstName: 'Mateo',  lastName: 'Diaz',       role: Role.Housekeeper },
    { firstName: 'Aiko',   lastName: 'Tanaka',     role: Role.Accountant },
    { firstName: 'Lukas',  lastName: 'Schmidt',    role: Role.Receptionist },
    { firstName: 'Priya',  lastName: 'Khan',       role: Role.Housekeeper },
    { firstName: 'Marco',  lastName: 'Rossi',      role: Role.Housekeeper },
    { firstName: 'Yuki',   lastName: 'Sato',       role: Role.Receptionist },
    { firstName: 'Olivia', lastName: 'Bernard',    role: Role.Manager },
    { firstName: 'Diego',  lastName: 'Hernandez',  role: Role.Housekeeper },
    { firstName: 'Anna',   lastName: 'Kowalski',   role: Role.Housekeeper },
  ];
  return seed.map((s, i) => ({
    id: `staff-${i + 1}`,
    firstName: s.firstName!,
    lastName:  s.lastName!,
    email: `${s.firstName!.toLowerCase()}.${s.lastName!.toLowerCase()}@luxstay.demo`,
    role: s.role!,
    propertyIds: s.role === Role.Admin || s.role === Role.Manager
      ? properties.map(p => p.id)
      : [properties[i % properties.length].id],
    isActive: true,
    hiredAt: daysAgo(faker.number.int({ min: 60, max: 1200 })),
  }));
}

/* ---------- Reservations ---------- */
export function generateReservations(
  properties: Property[],
  rooms: Room[],
  types: RoomType[],
  guests: Guest[],
): Reservation[] {
  const reservations: Reservation[] = [];
  let counter = 1;

  properties.forEach(p => {
    const propRooms = rooms.filter(r => r.propertyId === p.id);
    const propTypes = types.filter(t => t.propertyId === p.id);

    // Past reservations (checked out)
    for (let i = 0; i < 80; i++) {
      const checkIn = daysAgo(faker.number.int({ min: 30, max: 365 }));
      const nights = faker.number.int({ min: 1, max: 7 });
      const checkOut = new Date(checkIn); checkOut.setDate(checkOut.getDate() + nights);
      const type = pickOne(propTypes);
      const adults = faker.number.int({ min: 1, max: type.maxOccupancy });
      const roomCharge = type.basePrice * nights;
      const tax = roomCharge * p.taxRate;
      const extras = maybe(0.6) ? faker.number.int({ min: 20, max: 400 }) : 0;
      const total = roomCharge + tax + extras;

      reservations.push({
        id: `res-${counter}`,
        confirmationNumber: `LUX-${2025}-${String(counter).padStart(5, '0')}`,
        propertyId: p.id,
        guestId: pickOne(guests).id,
        roomId: pickOne(propRooms).id,
        roomTypeId: type.id,
        ratePlanId: 'bar',
        checkIn, checkOut, nights,
        adults, children: maybe(0.2) ? faker.number.int({ min: 1, max: 2 }) : 0,
        status: maybe(0.05) ? ReservationStatus.Cancelled : ReservationStatus.CheckedOut,
        source: pickOne(Object.values(BookingSource)) as BookingSource,
        totalRoomCharge: roomCharge,
        totalTax: tax,
        totalExtras: extras,
        totalPaid: total,
        totalAmount: total,
        balance: 0,
        createdAt: new Date(checkIn.getTime() - faker.number.int({ min: 1, max: 60 }) * 86400000),
      });
      counter++;
    }

    // Current stays (checked in)
    for (let i = 0; i < 18; i++) {
      const checkIn = daysAgo(faker.number.int({ min: 0, max: 4 }));
      const nights = faker.number.int({ min: 2, max: 8 });
      const checkOut = new Date(checkIn); checkOut.setDate(checkOut.getDate() + nights);
      const type = pickOne(propTypes);
      const occupiedRooms = propRooms.filter(r => r.status === RoomStatus.Occupied);
      const room = occupiedRooms.length ? pickOne(occupiedRooms) : pickOne(propRooms);
      const roomCharge = type.basePrice * nights;
      const tax = roomCharge * p.taxRate;

      reservations.push({
        id: `res-${counter}`,
        confirmationNumber: `LUX-${2026}-${String(counter).padStart(5, '0')}`,
        propertyId: p.id,
        guestId: pickOne(guests).id,
        roomId: room.id,
        roomTypeId: type.id,
        ratePlanId: 'bar',
        checkIn, checkOut, nights,
        adults: faker.number.int({ min: 1, max: type.maxOccupancy }),
        children: maybe(0.2) ? 1 : 0,
        status: ReservationStatus.CheckedIn,
        source: pickOne(Object.values(BookingSource)) as BookingSource,
        totalRoomCharge: roomCharge,
        totalTax: tax,
        totalExtras: 0,
        totalPaid: roomCharge + tax,
        totalAmount: roomCharge + tax,
        balance: 0,
        createdAt: new Date(checkIn.getTime() - faker.number.int({ min: 5, max: 90 }) * 86400000),
      });
      counter++;
    }

    // Future reservations
    for (let i = 0; i < 50; i++) {
      const checkIn = daysFromNow(faker.number.int({ min: 1, max: 90 }));
      const nights = faker.number.int({ min: 1, max: 7 });
      const checkOut = new Date(checkIn); checkOut.setDate(checkOut.getDate() + nights);
      const type = pickOne(propTypes);
      const roomCharge = type.basePrice * nights;
      const tax = roomCharge * p.taxRate;

      reservations.push({
        id: `res-${counter}`,
        confirmationNumber: `LUX-${2026}-${String(counter).padStart(5, '0')}`,
        propertyId: p.id,
        guestId: pickOne(guests).id,
        roomId: maybe(0.6) ? pickOne(propRooms).id : undefined,
        roomTypeId: type.id,
        ratePlanId: 'bar',
        checkIn, checkOut, nights,
        adults: faker.number.int({ min: 1, max: type.maxOccupancy }),
        children: maybe(0.15) ? 1 : 0,
        status: ReservationStatus.Confirmed,
        source: pickOne(Object.values(BookingSource)) as BookingSource,
        totalRoomCharge: roomCharge,
        totalTax: tax,
        totalExtras: 0,
        totalPaid: maybe(0.5) ? roomCharge * 0.3 : 0,
        totalAmount: roomCharge + tax,
        balance: roomCharge + tax,
        createdAt: daysAgo(faker.number.int({ min: 1, max: 30 })),
      });
      counter++;
    }

    // Guaranteed today arrivals (so arrivalsToday KPI always has data)
    for (let i = 0; i < 5; i++) {
      const checkIn = daysFromNow(0); // today
      const nights = faker.number.int({ min: 1, max: 5 });
      const checkOut = new Date(checkIn); checkOut.setDate(checkOut.getDate() + nights);
      const type = pickOne(propTypes);
      const roomCharge = type.basePrice * nights;
      const tax = roomCharge * p.taxRate;
      reservations.push({
        id: `res-${counter}`,
        confirmationNumber: `LUX-${2026}-${String(counter).padStart(5, '0')}`,
        propertyId: p.id,
        guestId: pickOne(guests).id,
        roomId: maybe(0.7) ? pickOne(propRooms).id : undefined,
        roomTypeId: type.id,
        ratePlanId: 'bar',
        checkIn, checkOut, nights,
        adults: faker.number.int({ min: 1, max: type.maxOccupancy }),
        children: maybe(0.2) ? 1 : 0,
        status: ReservationStatus.Confirmed,
        source: pickOne(Object.values(BookingSource)) as BookingSource,
        totalRoomCharge: roomCharge,
        totalTax: tax,
        totalExtras: 0,
        totalPaid: 0,
        totalAmount: roomCharge + tax,
        balance: roomCharge + tax,
        createdAt: daysAgo(faker.number.int({ min: 1, max: 14 })),
      });
      counter++;
    }

    // Guaranteed today departures (CheckedIn guests checking out today)
    for (let i = 0; i < 3; i++) {
      const checkOut = daysFromNow(0); // today
      const nights = faker.number.int({ min: 1, max: 4 });
      const checkIn = new Date(checkOut); checkIn.setDate(checkIn.getDate() - nights);
      const type = pickOne(propTypes);
      const roomCharge = type.basePrice * nights;
      const tax = roomCharge * p.taxRate;
      const occupiedRooms = propRooms.filter(r => r.status === RoomStatus.Occupied);
      reservations.push({
        id: `res-${counter}`,
        confirmationNumber: `LUX-${2026}-${String(counter).padStart(5, '0')}`,
        propertyId: p.id,
        guestId: pickOne(guests).id,
        roomId: pickOne(occupiedRooms.length ? occupiedRooms : propRooms).id,
        roomTypeId: type.id,
        ratePlanId: 'bar',
        checkIn, checkOut, nights,
        adults: faker.number.int({ min: 1, max: type.maxOccupancy }),
        children: 0,
        status: ReservationStatus.CheckedIn,
        source: pickOne(Object.values(BookingSource)) as BookingSource,
        totalRoomCharge: roomCharge,
        totalTax: tax,
        totalExtras: 0,
        totalPaid: roomCharge + tax,
        totalAmount: roomCharge + tax,
        balance: 0,
        createdAt: new Date(checkIn.getTime() - faker.number.int({ min: 1, max: 10 }) * 86400000),
      });
      counter++;
    }
  }); // end properties.forEach

  return reservations;
}

/* ---------- Housekeeping tasks ---------- */
export function generateHousekeepingTasks(rooms: Room[], staff: Staff[]): HousekeepingTask[] {
  const housekeepers = staff.filter(s => s.role === Role.Housekeeper);
  return rooms
    .filter(r => r.housekeepingStatus !== HousekeepingStatus.Clean)
    .map((r, i) => ({
      id: `hsk-${i + 1}`,
      propertyId: r.propertyId,
      roomId: r.id,
      assignedTo: maybe(0.7) ? pickOne(housekeepers)?.id : undefined,
      status: r.housekeepingStatus,
      priority: maybe(0.2) ? 'high' : 'normal',
      scheduledFor: new Date(),
      startedAt: r.housekeepingStatus === HousekeepingStatus.InProgress ? new Date(Date.now() - 1800000) : undefined,
      durationMinutes: r.housekeepingStatus === HousekeepingStatus.InProgress ? 30 : undefined,
    }));
}

/* ---------- Maintenance ---------- */
export function generateMaintenance(properties: Property[], rooms: Room[], staff: Staff[]): MaintenanceRequest[] {
  const out: MaintenanceRequest[] = [];
  properties.forEach(p => {
    const propRooms = rooms.filter(r => r.propertyId === p.id);
    for (let i = 0; i < 8; i++) {
      const reported = daysAgo(faker.number.int({ min: 0, max: 30 }));
      out.push({
        id: `mnt-${p.id}-${i + 1}`,
        propertyId: p.id,
        roomId: maybe(0.8) ? pickOne(propRooms).id : undefined,
        location: maybe(0.2) ? pickOne(['Lobby', 'Pool deck', 'Restaurant', 'Spa']) : undefined,
        reportedBy: pickOne(staff).id,
        assignedTo: maybe(0.7) ? pickOne(staff).id : undefined,
        category: pickOne(['plumbing','electrical','hvac','furniture','appliance','other']) as any,
        priority: pickOne(Object.values(MaintenancePriority)),
        status: pickOne(Object.values(MaintenanceStatus)),
        title: pickOne(['Leaking faucet','AC not cooling','Broken lamp','TV remote replacement','Toilet running','Door hinge loose']),
        description: faker.lorem.sentence(),
        reportedAt: reported,
      });
    }
  });
  return out;
}

/* ---------- Concierge ---------- */
export function generateConcierge(reservations: Reservation[]): ConciergeRequest[] {
  const active = reservations.filter(r => r.status === ReservationStatus.CheckedIn);
  return active.flatMap((r, i) => {
    if (!maybe(0.4)) return [];
    return [{
      id: `con-${i + 1}`,
      propertyId: r.propertyId,
      reservationId: r.id,
      guestId: r.guestId,
      roomId: r.roomId,
      type: pickOne(Object.values(ConciergeRequestType)),
      status: pickOne([ConciergeStatus.New, ConciergeStatus.InProgress, ConciergeStatus.Completed]),
      details: faker.lorem.sentence(),
      requestedAt: new Date(Date.now() - faker.number.int({ min: 5, max: 240 }) * 60000),
    }];
  });
}

/* ---------- Master seed ---------- */
export interface SeedDataset {
  properties: Property[];
  roomTypes: RoomType[];
  rooms: Room[];
  guests: Guest[];
  staff: Staff[];
  reservations: Reservation[];
  housekeepingTasks: HousekeepingTask[];
  maintenance: MaintenanceRequest[];
  concierge: ConciergeRequest[];
}

let cached: SeedDataset | null = null;

export function getSeedDataset(): SeedDataset {
  if (cached) return cached;
  const properties = generateProperties();
  const roomTypes  = generateRoomTypes(properties);
  const rooms      = generateRooms(properties, roomTypes);
  const guests     = generateGuests(200);
  const staff      = generateStaff(properties);
  const reservations = generateReservations(properties, rooms, roomTypes, guests);
  const housekeepingTasks = generateHousekeepingTasks(rooms, staff);
  const maintenance = generateMaintenance(properties, rooms, staff);
  const concierge   = generateConcierge(reservations);
  cached = { properties, roomTypes, rooms, guests, staff, reservations, housekeepingTasks, maintenance, concierge };
  return cached;
}
