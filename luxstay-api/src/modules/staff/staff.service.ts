import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { StaffEntity } from './staff.entity';
import { InviteStaffDto, UpdateStaffDto, StaffQueryDto } from './staff.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffEntity)
    private readonly repo: Repository<StaffEntity>,
  ) {}

  async list(query: StaffQueryDto): Promise<StaffEntity[]> {
    const qb = this.repo.createQueryBuilder('staff')
      .where('staff.isActive = true');

    if (query.propertyId) {
      qb.andWhere(':propertyId = ANY(staff.propertyIds)', {
        propertyId: query.propertyId,
      });
    }

    if (query.role) {
      qb.andWhere('staff.role = :role', { role: query.role });
    }

    if (query.search) {
      qb.andWhere(
        '(staff.firstName ILIKE :s OR staff.lastName ILIKE :s OR staff.email ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    return qb.orderBy('staff.firstName', 'ASC').getMany();
  }

  async getById(id: string): Promise<StaffEntity> {
    const staff = await this.repo.findOne({ where: { id } });
    if (!staff) throw new NotFoundException(`Staff ${id} not found`);
    return staff;
  }

  async getByEmail(email: string): Promise<StaffEntity | null> {
    return this.repo
      .createQueryBuilder('staff')
      .addSelect('staff.password')
      .addSelect('staff.refreshToken')
      .where('staff.email = :email', { email })
      .getOne();
  }

  async invite(dto: InviteStaffDto, invitedBy: string): Promise<StaffEntity> {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const staff = this.repo.create({
      ...dto,
      // Temporary password — in production send a reset link via email
      password: uuid(),
      hiredAt: new Date(),
      inviteStatus: 'pending',
      invitedAt: new Date(),
      invitedBy,
    });

    const saved = await this.repo.save(staff);

    // TODO: send invite email here via a MailService
    console.log(`📧  Invite sent to ${dto.email}`);

    return saved;
  }

  async update(id: string, dto: UpdateStaffDto): Promise<StaffEntity> {
    const staff = await this.getById(id);
    Object.assign(staff, dto);
    return this.repo.save(staff);
  }

  async deactivate(id: string): Promise<StaffEntity> {
    const staff = await this.getById(id);
    staff.isActive = false;
    return this.repo.save(staff);
  }

  async saveRefreshToken(id: string, token: string): Promise<void> {
    await this.repo.update(id, { refreshToken: token });
  }

  async clearRefreshToken(id: string): Promise<void> {
    await this.repo.update(id, { refreshToken: null });
  }
}
