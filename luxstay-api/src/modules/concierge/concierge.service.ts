import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConciergeRequestEntity } from './concierge-request.entity';
import {
  CreateConciergeRequestDto,
  UpdateConciergeRequestDto,
  AssignConciergeDto,
  UpdateConciergeStatusDto,
  ConciergeQueryDto,
} from './concierge.dto';
import { ConciergeStatus } from '../../common/enums';

@Injectable()
export class ConciergeService {
  constructor(
    @InjectRepository(ConciergeRequestEntity)
    private readonly requestRepo: Repository<ConciergeRequestEntity>,
  ) {}

  async list(query: ConciergeQueryDto): Promise<ConciergeRequestEntity[]> {
    const qb = this.requestRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.guest', 'guest')
      .leftJoinAndSelect('c.assignedTo', 'assignedTo')
      .leftJoinAndSelect('c.reservation', 'reservation');

    if (query.propertyId)   qb.andWhere('c.propertyId = :propertyId', { propertyId: query.propertyId });
    if (query.reservationId) qb.andWhere('c.reservationId = :reservationId', { reservationId: query.reservationId });
    if (query.guestId)      qb.andWhere('c.guestId = :guestId', { guestId: query.guestId });
    if (query.status)       qb.andWhere('c.status = :status', { status: query.status });
    if (query.requestType)  qb.andWhere('c.requestType = :requestType', { requestType: query.requestType });

    return qb
      .orderBy('c.priority', 'DESC')
      .addOrderBy('c.createdAt', 'DESC')
      .getMany();
  }

  async getById(id: string): Promise<ConciergeRequestEntity> {
    const req = await this.requestRepo.findOne({
      where: { id },
      relations: ['guest', 'assignedTo', 'reservation'],
    });
    if (!req) throw new NotFoundException(`Concierge request ${id} not found`);
    return req;
  }

  async create(dto: CreateConciergeRequestDto): Promise<ConciergeRequestEntity> {
    const request = this.requestRepo.create({
      ...dto,
      requestedAt: dto.requestedAt ? new Date(dto.requestedAt) : new Date(),
    });
    return this.requestRepo.save(request);
  }

  async update(id: string, dto: UpdateConciergeRequestDto): Promise<ConciergeRequestEntity> {
    const request = await this.getById(id);
    if (request.status === ConciergeStatus.Completed || request.status === ConciergeStatus.Cancelled) {
      throw new BadRequestException('Cannot update a completed or cancelled request');
    }
    Object.assign(request, dto);
    return this.requestRepo.save(request);
  }

  async assign(id: string, dto: AssignConciergeDto): Promise<ConciergeRequestEntity> {
    const request = await this.getById(id);
    request.assignedToId = dto.assignedToId;
    if (request.status === ConciergeStatus.New) {
      request.status = ConciergeStatus.InProgress;
    }
    return this.requestRepo.save(request);
  }

  async updateStatus(id: string, dto: UpdateConciergeStatusDto): Promise<ConciergeRequestEntity> {
    const request = await this.getById(id);
    request.status = dto.status;
    if (dto.staffNotes) request.staffNotes = dto.staffNotes;

    if (dto.status === ConciergeStatus.Completed) {
      request.fulfilledAt = new Date();
    }
    return this.requestRepo.save(request);
  }

  async delete(id: string): Promise<void> {
    const request = await this.getById(id);
    await this.requestRepo.remove(request);
  }
}
