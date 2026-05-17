import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';
import { AuditAction, AuditEntityType } from '../../common/enums';

export interface LogAuditDto {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  performedById?: string;
  propertyId?: string;
  ipAddress?: string;
  notes?: string;
}

export class AuditQueryDto {
  entityType?: AuditEntityType;
  entityId?: string;
  performedById?: string;
  action?: AuditAction;
  propertyId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
  ) {}

  /** Fire-and-forget audit log — never throws, never blocks the caller */
  async log(dto: LogAuditDto): Promise<void> {
    try {
      await this.auditRepo.save(this.auditRepo.create(dto));
    } catch {
      // Audit must never crash the main flow
    }
  }

  async query(query: AuditQueryDto): Promise<{ data: AuditLogEntity[]; total: number }> {
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.performedBy', 'performedBy');

    if (query.entityType)    qb.andWhere('a.entityType = :entityType', { entityType: query.entityType });
    if (query.entityId)      qb.andWhere('a.entityId = :entityId', { entityId: query.entityId });
    if (query.performedById) qb.andWhere('a.performedById = :performedById', { performedById: query.performedById });
    if (query.action)        qb.andWhere('a.action = :action', { action: query.action });
    if (query.propertyId)    qb.andWhere('a.propertyId = :propertyId', { propertyId: query.propertyId });
    if (query.fromDate)      qb.andWhere('a.createdAt >= :fromDate', { fromDate: query.fromDate });
    if (query.toDate)        qb.andWhere('a.createdAt <= :toDate', { toDate: query.toDate });

    const total = await qb.getCount();

    qb.orderBy('a.createdAt', 'DESC')
      .limit(query.limit ?? 50)
      .offset(query.offset ?? 0);

    const data = await qb.getMany();
    return { data, total };
  }

  async getById(id: string): Promise<AuditLogEntity> {
    return this.auditRepo.findOne({ where: { id }, relations: ['performedBy'] });
  }

  async getEntityHistory(entityType: AuditEntityType, entityId: string): Promise<AuditLogEntity[]> {
    return this.auditRepo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
      relations: ['performedBy'],
    });
  }
}
