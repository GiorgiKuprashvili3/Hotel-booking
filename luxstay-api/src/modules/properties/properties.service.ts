import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyEntity } from './property.entity';
import {
  CreatePropertyDto, UpdatePropertyDto, PropertyQueryDto,
} from './property.dto';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(PropertyEntity)
    private readonly repo: Repository<PropertyEntity>,
  ) {}

  async list(query: PropertyQueryDto): Promise<PropertyEntity[]> {
    const qb = this.repo.createQueryBuilder('property');

    if (!query.includeInactive) {
      qb.where('property.isActive = true');
    }

    if (query.country) {
      qb.andWhere('property.country = :country', { country: query.country });
    }

    if (query.search) {
      qb.andWhere(
        '(property.name ILIKE :s OR property.city ILIKE :s OR property.code ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    return qb.orderBy('property.name', 'ASC').getMany();
  }

  async getById(id: string): Promise<PropertyEntity> {
    const property = await this.repo.findOne({ where: { id } });
    if (!property) throw new NotFoundException(`Property ${id} not found`);
    return property;
  }

  async getByCode(code: string): Promise<PropertyEntity> {
    const property = await this.repo.findOne({ where: { code } });
    if (!property) throw new NotFoundException(`Property code "${code}" not found`);
    return property;
  }

  async create(dto: CreatePropertyDto): Promise<PropertyEntity> {
    const existing = await this.repo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Property code "${dto.code}" already in use`);
    }
    const property = this.repo.create(dto);
    return this.repo.save(property);
  }

  async update(id: string, dto: UpdatePropertyDto): Promise<PropertyEntity> {
    const property = await this.getById(id);

    if (dto.code && dto.code !== property.code) {
      const clash = await this.repo.findOne({ where: { code: dto.code } });
      if (clash) {
        throw new ConflictException(`Property code "${dto.code}" already in use`);
      }
    }

    Object.assign(property, dto);
    return this.repo.save(property);
  }

  async deactivate(id: string): Promise<PropertyEntity> {
    const property = await this.getById(id);
    property.isActive = false;
    return this.repo.save(property);
  }

  async reactivate(id: string): Promise<PropertyEntity> {
    const property = await this.getById(id);
    property.isActive = true;
    return this.repo.save(property);
  }
}
