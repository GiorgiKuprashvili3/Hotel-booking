import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RatePlanEntity } from './rate-plan.entity';
import {
  CreateRatePlanDto, UpdateRatePlanDto, RatePlanQueryDto,
} from './rate-plan.dto';

@Injectable()
export class RatePlansService {
  constructor(
    @InjectRepository(RatePlanEntity)
    private readonly repo: Repository<RatePlanEntity>,
  ) {}

  async list(query: RatePlanQueryDto): Promise<RatePlanEntity[]> {
    const qb = this.repo
      .createQueryBuilder('rp')
      .leftJoinAndSelect('rp.roomType', 'roomType');

    if (!query.includeInactive) {
      qb.where('rp.isActive = true');
    }

    if (query.propertyId) {
      qb.andWhere('rp.propertyId = :propertyId', { propertyId: query.propertyId });
    }

    if (query.roomTypeId) {
      qb.andWhere(
        '(rp.roomTypeId = :roomTypeId OR rp.roomTypeId IS NULL)',
        { roomTypeId: query.roomTypeId },
      );
    }

    if (query.mealPlan) {
      qb.andWhere('rp.mealPlan = :mealPlan', { mealPlan: query.mealPlan });
    }

    if (query.isPublic !== undefined) {
      qb.andWhere('rp.isPublic = :isPublic', { isPublic: query.isPublic });
    }

    // Filter by validity date: plan must be valid on the requested date
    if (query.validOn) {
      qb.andWhere(
        '(rp.validFrom IS NULL OR rp.validFrom <= :d)',
        { d: query.validOn },
      );
      qb.andWhere(
        '(rp.validTo IS NULL OR rp.validTo >= :d)',
        { d: query.validOn },
      );
    }

    return qb.orderBy('rp.baseRate', 'ASC').getMany();
  }

  async getById(id: string): Promise<RatePlanEntity> {
    const plan = await this.repo.findOne({
      where: { id },
      relations: ['roomType'],
    });
    if (!plan) throw new NotFoundException(`Rate plan ${id} not found`);
    return plan;
  }

  async create(dto: CreateRatePlanDto): Promise<RatePlanEntity> {
    const clash = await this.repo.findOne({
      where: { propertyId: dto.propertyId, code: dto.code },
    });
    if (clash) {
      throw new ConflictException(
        `Rate plan code "${dto.code}" already exists for this property`,
      );
    }
    const plan = this.repo.create(dto);
    return this.repo.save(plan);
  }

  async update(id: string, dto: UpdateRatePlanDto): Promise<RatePlanEntity> {
    const plan = await this.getById(id);

    if (dto.code && dto.code !== plan.code) {
      const clash = await this.repo.findOne({
        where: { propertyId: plan.propertyId, code: dto.code },
      });
      if (clash) {
        throw new ConflictException(
          `Rate plan code "${dto.code}" already exists for this property`,
        );
      }
    }

    Object.assign(plan, dto);
    return this.repo.save(plan);
  }

  async deactivate(id: string): Promise<RatePlanEntity> {
    const plan = await this.getById(id);
    plan.isActive = false;
    return this.repo.save(plan);
  }

  async reactivate(id: string): Promise<RatePlanEntity> {
    const plan = await this.getById(id);
    plan.isActive = true;
    return this.repo.save(plan);
  }
}
