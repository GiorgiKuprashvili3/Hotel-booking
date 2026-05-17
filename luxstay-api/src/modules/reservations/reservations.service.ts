import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { ReservationEntity } from './reservation.entity';
import { BookingGroupEntity } from './booking-group.entity';
import { RoomEntity } from '../rooms/room.entity';
import { GuestEntity } from '../guests/guest.entity';
import {
  CreateReservationDto,
  UpdateReservationDto,
  CheckInDto,
  CheckOutDto,
  CancelReservationDto,
  ReservationQueryDto,
  AvailabilityQueryDto,
  CreateBookingGroupDto,
  UpdateBookingGroupDto,
  BookingGroupQueryDto,
} from './reservation.dto';
import {
  ReservationStatus,
  RoomStatus,
  HousekeepingStatus,
} from '../../common/enums';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(ReservationEntity)
    private readonly reservationRepo: Repository<ReservationEntity>,

    @InjectRepository(BookingGroupEntity)
    private readonly groupRepo: Repository<BookingGroupEntity>,

    @InjectRepository(RoomEntity)
    private readonly roomRepo: Repository<RoomEntity>,

    @InjectRepository(GuestEntity)
    private readonly guestRepo: Repository<GuestEntity>,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private generateConfirmationNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = String(Math.floor(Math.random() * 9000) + 1000);
    return `RES-${dateStr}-${rand}`;
  }

  private generateGroupCode(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = String(Math.floor(Math.random() * 900) + 100);
    return `GRP-${dateStr}-${rand}`;
  }

  /**
   * Returns true if the given room has a confirmed/checked-in reservation
   * that overlaps with [checkIn, checkOut), excluding `excludeId`.
   */
  private async hasConflict(
    roomId: string,
    checkInDate: string,
    checkOutDate: string,
    excludeId?: string,
  ): Promise<boolean> {
    const qb = this.reservationRepo
      .createQueryBuilder('r')
      .where('r.roomId = :roomId', { roomId })
      .andWhere('r.status NOT IN (:...inactive)', {
        inactive: [ReservationStatus.Cancelled, ReservationStatus.NoShow],
      })
      // overlap: existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn
      .andWhere('r.checkInDate < :checkOut', { checkOut: checkOutDate })
      .andWhere('r.checkOutDate > :checkIn', { checkIn: checkInDate });

    if (excludeId) {
      qb.andWhere('r.id != :excludeId', { excludeId });
    }

    return (await qb.getCount()) > 0;
  }

  // ── Booking Groups ────────────────────────────────────────────────────────────

  async listGroups(query: BookingGroupQueryDto): Promise<BookingGroupEntity[]> {
    const qb = this.groupRepo.createQueryBuilder('g');

    if (!query.includeInactive) qb.where('g.isActive = true');
    if (query.propertyId) qb.andWhere('g.propertyId = :propertyId', { propertyId: query.propertyId });
    if (query.search) {
      qb.andWhere('(g.name ILIKE :s OR g.code ILIKE :s)', { s: `%${query.search}%` });
    }

    return qb.orderBy('g.createdAt', 'DESC').getMany();
  }

  async getGroupById(id: string): Promise<BookingGroupEntity> {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException(`Booking group ${id} not found`);
    return group;
  }

  async createGroup(dto: CreateBookingGroupDto): Promise<BookingGroupEntity> {
    let code: string;
    let tries = 0;
    do {
      code = this.generateGroupCode();
      tries++;
    } while (tries < 10 && await this.groupRepo.findOne({ where: { code } }));

    const group = this.groupRepo.create({ ...dto, code });
    return this.groupRepo.save(group);
  }

  async updateGroup(id: string, dto: UpdateBookingGroupDto): Promise<BookingGroupEntity> {
    const group = await this.getGroupById(id);
    Object.assign(group, dto);
    return this.groupRepo.save(group);
  }

  async deactivateGroup(id: string): Promise<BookingGroupEntity> {
    const group = await this.getGroupById(id);
    group.isActive = false;
    return this.groupRepo.save(group);
  }

  // ── Reservations ─────────────────────────────────────────────────────────────

  async list(query: ReservationQueryDto): Promise<ReservationEntity[]> {
    const qb = this.reservationRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.room', 'room')
      .leftJoinAndSelect('r.guest', 'guest')
      .leftJoinAndSelect('r.ratePlan', 'ratePlan')
      .leftJoinAndSelect('r.bookingGroup', 'bookingGroup');

    if (query.propertyId) {
      qb.andWhere('r.propertyId = :propertyId', { propertyId: query.propertyId });
    }
    if (query.roomId) {
      qb.andWhere('r.roomId = :roomId', { roomId: query.roomId });
    }
    if (query.guestId) {
      qb.andWhere('r.guestId = :guestId', { guestId: query.guestId });
    }
    if (query.bookingGroupId) {
      qb.andWhere('r.bookingGroupId = :bookingGroupId', { bookingGroupId: query.bookingGroupId });
    }
    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }
    if (query.source) {
      qb.andWhere('r.source = :source', { source: query.source });
    }
    if (query.fromDate) {
      qb.andWhere('r.checkOutDate >= :fromDate', { fromDate: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere('r.checkInDate <= :toDate', { toDate: query.toDate });
    }
    if (query.search) {
      qb.andWhere(
        '(r.confirmationNumber ILIKE :s OR guest.firstName ILIKE :s OR guest.lastName ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    return qb.orderBy('r.checkInDate', 'ASC').getMany();
  }

  async getById(id: string): Promise<ReservationEntity> {
    const res = await this.reservationRepo.findOne({
      where: { id },
      relations: ['room', 'room.roomType', 'guest', 'ratePlan', 'bookingGroup'],
    });
    if (!res) throw new NotFoundException(`Reservation ${id} not found`);
    return res;
  }

  async getByConfirmationNumber(confirmationNumber: string): Promise<ReservationEntity> {
    const res = await this.reservationRepo.findOne({
      where: { confirmationNumber },
      relations: ['room', 'room.roomType', 'guest', 'ratePlan'],
    });
    if (!res) throw new NotFoundException(`Reservation ${confirmationNumber} not found`);
    return res;
  }

  async create(dto: CreateReservationDto, staffId?: string): Promise<ReservationEntity> {
    // Validate dates
    if (dto.checkInDate >= dto.checkOutDate) {
      throw new BadRequestException('checkOutDate must be after checkInDate');
    }

    // Verify room exists and belongs to property
    const room = await this.roomRepo.findOne({ where: { id: dto.roomId } });
    if (!room) throw new NotFoundException(`Room ${dto.roomId} not found`);
    if (room.propertyId !== dto.propertyId) {
      throw new BadRequestException('Room does not belong to the specified property');
    }
    if (!room.isActive) {
      throw new BadRequestException('Room is not active');
    }

    // Verify guest exists
    const guest = await this.guestRepo.findOne({ where: { id: dto.guestId } });
    if (!guest) throw new NotFoundException(`Guest ${dto.guestId} not found`);
    if (guest.isBlacklisted) {
      throw new BadRequestException('Guest is blacklisted and cannot be booked');
    }

    // Check for date conflicts
    const conflict = await this.hasConflict(dto.roomId, dto.checkInDate, dto.checkOutDate);
    if (conflict) {
      throw new ConflictException(
        `Room ${room.number} is not available for the requested dates`,
      );
    }

    // Generate unique confirmation number
    let confirmationNumber: string;
    let tries = 0;
    do {
      confirmationNumber = this.generateConfirmationNumber();
      tries++;
    } while (
      tries < 10 &&
      (await this.reservationRepo.findOne({ where: { confirmationNumber } }))
    );

    const reservation = this.reservationRepo.create({
      ...dto,
      confirmationNumber,
      status: ReservationStatus.Confirmed,
      createdBy: staffId,
    });

    // Mark room as Reserved
    room.status = RoomStatus.Reserved;
    await this.roomRepo.save(room);

    return this.reservationRepo.save(reservation);
  }

  async update(id: string, dto: UpdateReservationDto): Promise<ReservationEntity> {
    const reservation = await this.getById(id);

    if (
      reservation.status === ReservationStatus.CheckedIn ||
      reservation.status === ReservationStatus.CheckedOut ||
      reservation.status === ReservationStatus.Cancelled
    ) {
      throw new BadRequestException(
        `Cannot update a reservation with status "${reservation.status}"`,
      );
    }

    // If dates or room change, re-validate availability
    const newCheckIn = dto.checkInDate ?? reservation.checkInDate;
    const newCheckOut = dto.checkOutDate ?? reservation.checkOutDate;
    const newRoomId = dto.roomId ?? reservation.roomId;

    if (newCheckIn >= newCheckOut) {
      throw new BadRequestException('checkOutDate must be after checkInDate');
    }

    if (
      dto.roomId ||
      dto.checkInDate ||
      dto.checkOutDate
    ) {
      const conflict = await this.hasConflict(newRoomId, newCheckIn, newCheckOut, id);
      if (conflict) {
        throw new ConflictException('Room is not available for the requested dates');
      }
    }

    Object.assign(reservation, dto);
    return this.reservationRepo.save(reservation);
  }

  async checkIn(id: string, dto: CheckInDto): Promise<ReservationEntity> {
    const reservation = await this.getById(id);

    if (reservation.status !== ReservationStatus.Confirmed && reservation.status !== ReservationStatus.Pending) {
      throw new BadRequestException(
        `Cannot check in a reservation with status "${reservation.status}"`,
      );
    }

    reservation.status = ReservationStatus.CheckedIn;
    reservation.actualCheckInAt = dto.actualCheckInAt
      ? new Date(dto.actualCheckInAt)
      : new Date();
    reservation.checkedInBy = dto.staffId ?? null;

    // Update room to occupied
    const room = await this.roomRepo.findOne({ where: { id: reservation.roomId } });
    if (room) {
      room.status = RoomStatus.Occupied;
      await this.roomRepo.save(room);
    }

    // Update guest stats
    const guest = await this.guestRepo.findOne({ where: { id: reservation.guestId } });
    if (guest) {
      guest.totalStays += 1;
      guest.lastStayAt = reservation.actualCheckInAt;
      await this.guestRepo.save(guest);
    }

    return this.reservationRepo.save(reservation);
  }

  async checkOut(id: string, dto: CheckOutDto): Promise<ReservationEntity> {
    const reservation = await this.getById(id);

    if (reservation.status !== ReservationStatus.CheckedIn) {
      throw new BadRequestException(
        `Cannot check out a reservation with status "${reservation.status}"`,
      );
    }

    reservation.status = ReservationStatus.CheckedOut;
    reservation.actualCheckOutAt = dto.actualCheckOutAt
      ? new Date(dto.actualCheckOutAt)
      : new Date();
    reservation.checkedOutBy = dto.staffId ?? null;

    // Update room to needs cleaning
    const room = await this.roomRepo.findOne({ where: { id: reservation.roomId } });
    if (room) {
      room.status = RoomStatus.Cleaning;
      room.housekeepingStatus = HousekeepingStatus.Dirty;
      await this.roomRepo.save(room);
    }

    return this.reservationRepo.save(reservation);
  }

  async cancel(id: string, dto: CancelReservationDto): Promise<ReservationEntity> {
    const reservation = await this.getById(id);

    if (
      reservation.status === ReservationStatus.CheckedOut ||
      reservation.status === ReservationStatus.Cancelled
    ) {
      throw new BadRequestException(
        `Cannot cancel a reservation with status "${reservation.status}"`,
      );
    }

    const wasCheckedIn = reservation.status === ReservationStatus.CheckedIn;

    reservation.status = ReservationStatus.Cancelled;
    reservation.cancellationReason = dto.cancellationReason ?? null;
    reservation.cancelledAt = new Date();

    // Free the room if it was reserved or occupied
    const room = await this.roomRepo.findOne({ where: { id: reservation.roomId } });
    if (room) {
      room.status = wasCheckedIn ? RoomStatus.Cleaning : RoomStatus.Available;
      if (wasCheckedIn) room.housekeepingStatus = HousekeepingStatus.Dirty;
      await this.roomRepo.save(room);
    }

    return this.reservationRepo.save(reservation);
  }

  async markNoShow(id: string): Promise<ReservationEntity> {
    const reservation = await this.getById(id);

    if (
      reservation.status !== ReservationStatus.Confirmed &&
      reservation.status !== ReservationStatus.Pending
    ) {
      throw new BadRequestException(
        `Cannot mark a reservation as no-show with status "${reservation.status}"`,
      );
    }

    reservation.status = ReservationStatus.NoShow;

    const room = await this.roomRepo.findOne({ where: { id: reservation.roomId } });
    if (room) {
      room.status = RoomStatus.Available;
      await this.roomRepo.save(room);
    }

    return this.reservationRepo.save(reservation);
  }

  // ── Availability ─────────────────────────────────────────────────────────────

  async checkAvailability(query: AvailabilityQueryDto): Promise<RoomEntity[]> {
    if (query.checkInDate >= query.checkOutDate) {
      throw new BadRequestException('checkOutDate must be after checkInDate');
    }

    // Find room IDs that have a conflicting reservation
    const conflicting = await this.reservationRepo
      .createQueryBuilder('r')
      .select('r.roomId')
      .where('r.propertyId = :propertyId', { propertyId: query.propertyId })
      .andWhere('r.status NOT IN (:...inactive)', {
        inactive: [ReservationStatus.Cancelled, ReservationStatus.NoShow],
      })
      .andWhere('r.checkInDate < :checkOut', { checkOut: query.checkOutDate })
      .andWhere('r.checkOutDate > :checkIn', { checkIn: query.checkInDate })
      .getRawMany();

    const blockedRoomIds = conflicting.map((r) => r.r_roomId);

    const qb = this.roomRepo
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .where('room.propertyId = :propertyId', { propertyId: query.propertyId })
      .andWhere('room.isActive = true')
      .andWhere('room.status != :maintenance', { maintenance: RoomStatus.Maintenance })
      .andWhere('room.status != :blocked', { blocked: RoomStatus.Blocked });

    if (blockedRoomIds.length > 0) {
      qb.andWhere('room.id NOT IN (:...blockedRoomIds)', { blockedRoomIds });
    }

    if (query.roomTypeId) {
      qb.andWhere('room.roomTypeId = :roomTypeId', { roomTypeId: query.roomTypeId });
    }

    return qb.orderBy('roomType.name', 'ASC').addOrderBy('room.number', 'ASC').getMany();
  }
}
