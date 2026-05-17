import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenanceRequestEntity } from './maintenance-request.entity';
import { RoomEntity } from '../rooms/room.entity';
import {
  CreateMaintenanceRequestDto,
  UpdateMaintenanceRequestDto,
  AssignMaintenanceDto,
  ResolveMaintenanceDto,
  UpdateMaintenanceStatusDto,
  MaintenanceQueryDto,
} from './maintenance.dto';
import { MaintenanceStatus, RoomStatus } from '../../common/enums';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceRequestEntity)
    private readonly requestRepo: Repository<MaintenanceRequestEntity>,

    @InjectRepository(RoomEntity)
    private readonly roomRepo: Repository<RoomEntity>,
  ) {}

  async list(query: MaintenanceQueryDto): Promise<MaintenanceRequestEntity[]> {
    const qb = this.requestRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.room', 'room')
      .leftJoinAndSelect('m.reportedBy', 'reportedBy')
      .leftJoinAndSelect('m.assignedTo', 'assignedTo');

    if (query.propertyId)  qb.andWhere('m.propertyId = :propertyId', { propertyId: query.propertyId });
    if (query.roomId)      qb.andWhere('m.roomId = :roomId', { roomId: query.roomId });
    if (query.assignedToId) qb.andWhere('m.assignedToId = :assignedToId', { assignedToId: query.assignedToId });
    if (query.status)      qb.andWhere('m.status = :status', { status: query.status });
    if (query.priority)    qb.andWhere('m.priority = :priority', { priority: query.priority });
    if (query.category)    qb.andWhere('m.category = :category', { category: query.category });

    return qb.orderBy('m.priority', 'DESC').addOrderBy('m.createdAt', 'DESC').getMany();
  }

  async getById(id: string): Promise<MaintenanceRequestEntity> {
    const req = await this.requestRepo.findOne({
      where: { id },
      relations: ['room', 'reportedBy', 'assignedTo'],
    });
    if (!req) throw new NotFoundException(`Maintenance request ${id} not found`);
    return req;
  }

  async create(
    dto: CreateMaintenanceRequestDto,
    staffId?: string,
  ): Promise<MaintenanceRequestEntity> {
    if (dto.roomId) {
      const room = await this.roomRepo.findOne({ where: { id: dto.roomId } });
      if (!room) throw new NotFoundException(`Room ${dto.roomId} not found`);

      if (dto.requiresRoomBlocked) {
        room.status = RoomStatus.Maintenance;
        await this.roomRepo.save(room);
      }
    }

    const request = this.requestRepo.create({ ...dto, reportedById: staffId });
    return this.requestRepo.save(request);
  }

  async update(id: string, dto: UpdateMaintenanceRequestDto): Promise<MaintenanceRequestEntity> {
    const request = await this.getById(id);
    if (request.status === MaintenanceStatus.Closed) {
      throw new BadRequestException('Cannot update a closed maintenance request');
    }
    Object.assign(request, dto);
    return this.requestRepo.save(request);
  }

  async assign(id: string, dto: AssignMaintenanceDto): Promise<MaintenanceRequestEntity> {
    const request = await this.getById(id);
    request.assignedToId = dto.assignedToId;
    request.status = MaintenanceStatus.Assigned;
    if (dto.scheduledAt) request.scheduledAt = new Date(dto.scheduledAt);
    return this.requestRepo.save(request);
  }

  async updateStatus(id: string, dto: UpdateMaintenanceStatusDto): Promise<MaintenanceRequestEntity> {
    const request = await this.getById(id);
    request.status = dto.status;
    if (dto.notes) request.notes = dto.notes;

    if (dto.status === MaintenanceStatus.InProgress && !request.startedAt) {
      request.startedAt = new Date();
    }

    return this.requestRepo.save(request);
  }

  async resolve(id: string, dto: ResolveMaintenanceDto): Promise<MaintenanceRequestEntity> {
    const request = await this.getById(id);

    if (request.status === MaintenanceStatus.Closed || request.status === MaintenanceStatus.Resolved) {
      throw new BadRequestException('Request is already resolved or closed');
    }

    request.status = MaintenanceStatus.Resolved;
    request.resolutionNotes = dto.resolutionNotes;
    request.resolvedAt = new Date();
    if (dto.actualCost !== undefined) request.actualCost = dto.actualCost;

    // If room was blocked, restore to available
    if (request.roomId && request.requiresRoomBlocked) {
      const room = await this.roomRepo.findOne({ where: { id: request.roomId } });
      if (room && room.status === RoomStatus.Maintenance) {
        room.status = RoomStatus.Available;
        await this.roomRepo.save(room);
      }
    }

    return this.requestRepo.save(request);
  }

  async close(id: string): Promise<MaintenanceRequestEntity> {
    const request = await this.getById(id);
    request.status = MaintenanceStatus.Closed;
    return this.requestRepo.save(request);
  }

  async delete(id: string): Promise<void> {
    const request = await this.getById(id);
    if (request.status !== MaintenanceStatus.Open) {
      throw new BadRequestException('Can only delete open requests');
    }
    await this.requestRepo.remove(request);
  }
}
