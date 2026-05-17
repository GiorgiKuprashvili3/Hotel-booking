import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomTypeEntity } from './room-type.entity';
import { RoomEntity } from './room.entity';
import {
  CreateRoomTypeDto, UpdateRoomTypeDto, RoomTypeQueryDto,
  CreateRoomDto, UpdateRoomDto, UpdateRoomStatusDto, RoomQueryDto,
} from './room.dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(RoomTypeEntity)
    private readonly roomTypeRepo: Repository<RoomTypeEntity>,

    @InjectRepository(RoomEntity)
    private readonly roomRepo: Repository<RoomEntity>,
  ) {}

  // ── Room Types ──────────────────────────────────────────────────────────────

  async listRoomTypes(query: RoomTypeQueryDto): Promise<RoomTypeEntity[]> {
    const qb = this.roomTypeRepo.createQueryBuilder('rt');

    if (!query.includeInactive) {
      qb.where('rt.isActive = true');
    }

    if (query.propertyId) {
      qb.andWhere('rt.propertyId = :propertyId', { propertyId: query.propertyId });
    }

    if (query.search) {
      qb.andWhere(
        '(rt.name ILIKE :s OR rt.code ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    return qb.orderBy('rt.name', 'ASC').getMany();
  }

  async getRoomTypeById(id: string): Promise<RoomTypeEntity> {
    const rt = await this.roomTypeRepo.findOne({ where: { id } });
    if (!rt) throw new NotFoundException(`Room type ${id} not found`);
    return rt;
  }

  async createRoomType(dto: CreateRoomTypeDto): Promise<RoomTypeEntity> {
    const clash = await this.roomTypeRepo.findOne({
      where: { propertyId: dto.propertyId, code: dto.code },
    });
    if (clash) {
      throw new ConflictException(
        `Room type code "${dto.code}" already exists for this property`,
      );
    }
    const rt = this.roomTypeRepo.create(dto);
    return this.roomTypeRepo.save(rt);
  }

  async updateRoomType(id: string, dto: UpdateRoomTypeDto): Promise<RoomTypeEntity> {
    const rt = await this.getRoomTypeById(id);

    if (dto.code && dto.code !== rt.code) {
      const clash = await this.roomTypeRepo.findOne({
        where: { propertyId: rt.propertyId, code: dto.code },
      });
      if (clash) {
        throw new ConflictException(
          `Room type code "${dto.code}" already exists for this property`,
        );
      }
    }

    Object.assign(rt, dto);
    return this.roomTypeRepo.save(rt);
  }

  async deactivateRoomType(id: string): Promise<RoomTypeEntity> {
    const rt = await this.getRoomTypeById(id);
    rt.isActive = false;
    return this.roomTypeRepo.save(rt);
  }

  async reactivateRoomType(id: string): Promise<RoomTypeEntity> {
    const rt = await this.getRoomTypeById(id);
    rt.isActive = true;
    return this.roomTypeRepo.save(rt);
  }

  // ── Rooms ───────────────────────────────────────────────────────────────────

  async listRooms(query: RoomQueryDto): Promise<RoomEntity[]> {
    const qb = this.roomRepo
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.roomType', 'roomType');

    if (!query.includeInactive) {
      qb.where('room.isActive = true');
    }

    if (query.propertyId) {
      qb.andWhere('room.propertyId = :propertyId', { propertyId: query.propertyId });
    }

    if (query.roomTypeId) {
      qb.andWhere('room.roomTypeId = :roomTypeId', { roomTypeId: query.roomTypeId });
    }

    if (query.status) {
      qb.andWhere('room.status = :status', { status: query.status });
    }

    if (query.housekeepingStatus) {
      qb.andWhere('room.housekeepingStatus = :hs', { hs: query.housekeepingStatus });
    }

    if (query.floor !== undefined) {
      qb.andWhere('room.floor = :floor', { floor: query.floor });
    }

    return qb.orderBy('room.floor', 'ASC').addOrderBy('room.number', 'ASC').getMany();
  }

  async getRoomById(id: string): Promise<RoomEntity> {
    const room = await this.roomRepo.findOne({
      where: { id },
      relations: ['roomType'],
    });
    if (!room) throw new NotFoundException(`Room ${id} not found`);
    return room;
  }

  async createRoom(dto: CreateRoomDto): Promise<RoomEntity> {
    // Verify room type belongs to the same property
    const roomType = await this.getRoomTypeById(dto.roomTypeId);
    if (roomType.propertyId !== dto.propertyId) {
      throw new ConflictException('Room type does not belong to the specified property');
    }

    const clash = await this.roomRepo.findOne({
      where: { propertyId: dto.propertyId, number: dto.number },
    });
    if (clash) {
      throw new ConflictException(
        `Room number "${dto.number}" already exists for this property`,
      );
    }

    const room = this.roomRepo.create(dto);
    return this.roomRepo.save(room);
  }

  async updateRoom(id: string, dto: UpdateRoomDto): Promise<RoomEntity> {
    const room = await this.getRoomById(id);

    if (dto.number && dto.number !== room.number) {
      const clash = await this.roomRepo.findOne({
        where: { propertyId: room.propertyId, number: dto.number },
      });
      if (clash) {
        throw new ConflictException(
          `Room number "${dto.number}" already exists for this property`,
        );
      }
    }

    Object.assign(room, dto);
    return this.roomRepo.save(room);
  }

  async updateRoomStatus(id: string, dto: UpdateRoomStatusDto): Promise<RoomEntity> {
    const room = await this.getRoomById(id);
    room.status = dto.status;
    if (dto.housekeepingStatus) room.housekeepingStatus = dto.housekeepingStatus;
    return this.roomRepo.save(room);
  }

  async deactivateRoom(id: string): Promise<RoomEntity> {
    const room = await this.getRoomById(id);
    room.isActive = false;
    return this.roomRepo.save(room);
  }

  async reactivateRoom(id: string): Promise<RoomEntity> {
    const room = await this.getRoomById(id);
    room.isActive = true;
    return this.roomRepo.save(room);
  }
}
