import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuestEntity } from './guest.entity';
import {
  CreateGuestDto, UpdateGuestDto, BlacklistGuestDto,
  AdjustLoyaltyPointsDto, GuestQueryDto,
} from './guest.dto';

@Injectable()
export class GuestsService {
  constructor(
    @InjectRepository(GuestEntity)
    private readonly repo: Repository<GuestEntity>,
  ) {}

  async list(query: GuestQueryDto): Promise<{ data: GuestEntity[]; total: number }> {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.repo.createQueryBuilder('guest');

    if (query.search) {
      qb.where(
        `(guest.firstName ILIKE :s
          OR guest.lastName  ILIKE :s
          OR guest.email     ILIKE :s
          OR guest.phone     ILIKE :s
          OR guest.idNumber  ILIKE :s)`,
        { s: `%${query.search}%` },
      );
    }

    if (query.loyaltyTier) {
      qb.andWhere('guest.loyaltyTier = :tier', { tier: query.loyaltyTier });
    }

    if (query.nationality) {
      qb.andWhere('guest.nationality = :nationality', { nationality: query.nationality });
    }

    if (query.isVip !== undefined) {
      qb.andWhere('guest.isVip = :isVip', { isVip: query.isVip });
    }

    if (query.isBlacklisted !== undefined) {
      qb.andWhere('guest.isBlacklisted = :bl', { bl: query.isBlacklisted });
    }

    qb
      .orderBy('guest.lastName', 'ASC')
      .addOrderBy('guest.firstName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getById(id: string): Promise<GuestEntity> {
    const guest = await this.repo.findOne({ where: { id } });
    if (!guest) throw new NotFoundException(`Guest ${id} not found`);
    return guest;
  }

  async getByEmail(email: string): Promise<GuestEntity | null> {
    return this.repo.findOne({ where: { email } });
  }

  async create(dto: CreateGuestDto): Promise<GuestEntity> {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`Guest with email "${dto.email}" already exists`);
    }
    const guest = this.repo.create(dto);
    return this.repo.save(guest);
  }

  async update(id: string, dto: UpdateGuestDto): Promise<GuestEntity> {
    const guest = await this.getById(id);

    if (dto.email && dto.email !== guest.email) {
      const clash = await this.repo.findOne({ where: { email: dto.email } });
      if (clash) {
        throw new ConflictException(`Email "${dto.email}" is already used by another guest`);
      }
    }

    Object.assign(guest, dto);
    return this.repo.save(guest);
  }

  async blacklist(id: string, dto: BlacklistGuestDto): Promise<GuestEntity> {
    const guest = await this.getById(id);
    if (guest.isBlacklisted) {
      throw new BadRequestException('Guest is already blacklisted');
    }
    guest.isBlacklisted = true;
    guest.blacklistReason = dto.reason;
    return this.repo.save(guest);
  }

  async unblacklist(id: string): Promise<GuestEntity> {
    const guest = await this.getById(id);
    guest.isBlacklisted = false;
    guest.blacklistReason = null;
    return this.repo.save(guest);
  }

  async adjustLoyaltyPoints(id: string, dto: AdjustLoyaltyPointsDto): Promise<GuestEntity> {
    const guest = await this.getById(id);

    const newPoints = guest.loyaltyPoints + dto.points;
    if (newPoints < 0) {
      throw new BadRequestException(
        `Cannot deduct ${Math.abs(dto.points)} points — guest only has ${guest.loyaltyPoints}`,
      );
    }

    guest.loyaltyPoints = newPoints;
    if (dto.newTier) guest.loyaltyTier = dto.newTier;

    return this.repo.save(guest);
  }
}
