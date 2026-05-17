import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HousekeepingTaskEntity, HousekeepingTaskType } from './housekeeping-task.entity';
import { RoomEntity } from '../rooms/room.entity';
import {
  CreateHousekeepingTaskDto,
  UpdateHousekeepingTaskDto,
  UpdateHousekeepingStatusDto,
  AssignHousekeepingTaskDto,
  InspectRoomDto,
  HousekeepingQueryDto,
} from './housekeeping.dto';
import { HousekeepingStatus, RoomStatus } from '../../common/enums';

@Injectable()
export class HousekeepingService {
  constructor(
    @InjectRepository(HousekeepingTaskEntity)
    private readonly taskRepo: Repository<HousekeepingTaskEntity>,

    @InjectRepository(RoomEntity)
    private readonly roomRepo: Repository<RoomEntity>,
  ) {}

  async list(query: HousekeepingQueryDto): Promise<HousekeepingTaskEntity[]> {
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.room', 'room')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .leftJoinAndSelect('t.assignedTo', 'assignedTo');

    if (query.propertyId)  qb.andWhere('t.propertyId = :propertyId', { propertyId: query.propertyId });
    if (query.roomId)      qb.andWhere('t.roomId = :roomId', { roomId: query.roomId });
    if (query.assignedToId) qb.andWhere('t.assignedToId = :assignedToId', { assignedToId: query.assignedToId });
    if (query.status)      qb.andWhere('t.status = :status', { status: query.status });
    if (query.taskType)    qb.andWhere('t.taskType = :taskType', { taskType: query.taskType });
    if (query.scheduledDate) qb.andWhere('t.scheduledDate = :scheduledDate', { scheduledDate: query.scheduledDate });

    return qb
      .orderBy('t.priority', 'DESC')
      .addOrderBy('t.scheduledDate', 'ASC')
      .getMany();
  }

  async getById(id: string): Promise<HousekeepingTaskEntity> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['room', 'room.roomType', 'assignedTo', 'inspectedBy'],
    });
    if (!task) throw new NotFoundException(`Housekeeping task ${id} not found`);
    return task;
  }

  async create(dto: CreateHousekeepingTaskDto): Promise<HousekeepingTaskEntity> {
    const room = await this.roomRepo.findOne({ where: { id: dto.roomId } });
    if (!room) throw new NotFoundException(`Room ${dto.roomId} not found`);

    const task = this.taskRepo.create({
      ...dto,
      status: HousekeepingStatus.Dirty,
    });
    return this.taskRepo.save(task);
  }

  async update(id: string, dto: UpdateHousekeepingTaskDto): Promise<HousekeepingTaskEntity> {
    const task = await this.getById(id);
    Object.assign(task, dto);
    return this.taskRepo.save(task);
  }

  async assign(id: string, dto: AssignHousekeepingTaskDto): Promise<HousekeepingTaskEntity> {
    const task = await this.getById(id);
    task.assignedToId = dto.assignedToId;
    return this.taskRepo.save(task);
  }

  async updateStatus(
    id: string,
    dto: UpdateHousekeepingStatusDto,
    staffId?: string,
  ): Promise<HousekeepingTaskEntity> {
    const task = await this.getById(id);
    const prev = task.status;
    task.status = dto.status;
    if (dto.notes) task.notes = dto.notes;

    if (dto.status === HousekeepingStatus.InProgress && prev === HousekeepingStatus.Dirty) {
      task.startedAt = new Date();
      task.assignedToId = staffId ?? task.assignedToId;
    }

    if (dto.status === HousekeepingStatus.Clean && !task.completedAt) {
      task.completedAt = new Date();
    }

    if (dto.status === HousekeepingStatus.Inspected) {
      task.inspectedById = staffId ?? null;
      task.inspectedAt = new Date();
    }

    // Keep room housekeeping status in sync
    const room = await this.roomRepo.findOne({ where: { id: task.roomId } });
    if (room) {
      room.housekeepingStatus = dto.status;
      if (dto.status === HousekeepingStatus.Clean || dto.status === HousekeepingStatus.Inspected) {
        if (room.status === RoomStatus.Cleaning) room.status = RoomStatus.Available;
      }
      await this.roomRepo.save(room);
    }

    return this.taskRepo.save(task);
  }

  async inspect(id: string, dto: InspectRoomDto, inspectorId?: string): Promise<HousekeepingTaskEntity> {
    const task = await this.getById(id);
    task.status = dto.status;
    task.inspectedById = inspectorId ?? null;
    task.inspectedAt = new Date();
    if (dto.notes) task.notes = dto.notes;
    return this.taskRepo.save(task);
  }

  async delete(id: string): Promise<void> {
    const task = await this.getById(id);
    await this.taskRepo.remove(task);
  }

  /** Auto-generate checkout tasks for today's checkouts */
  async generateDailyTasks(propertyId: string, date: string): Promise<HousekeepingTaskEntity[]> {
    const rooms = await this.roomRepo.find({
      where: { propertyId, housekeepingStatus: HousekeepingStatus.Dirty, isActive: true },
    });

    const tasks: HousekeepingTaskEntity[] = [];
    for (const room of rooms) {
      const existing = await this.taskRepo.findOne({
        where: { roomId: room.id, scheduledDate: date },
      });
      if (!existing) {
        const task = await this.taskRepo.save(
          this.taskRepo.create({
            propertyId,
            roomId: room.id,
            taskType: HousekeepingTaskType.Stayover,
            scheduledDate: date,
            status: HousekeepingStatus.Dirty,
            priority: 0,
          }),
        );
        tasks.push(task);
      }
    }
    return tasks;
  }
}
