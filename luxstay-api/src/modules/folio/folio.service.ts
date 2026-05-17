import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FolioEntity, FolioStatus } from './folio.entity';
import { FolioItemEntity, FolioItemType, FolioItemCategory } from './folio-item.entity';
import {
  CreateFolioDto,
  AddFolioItemDto,
  AddRoomChargesDto,
  RecordPaymentDto,
  VoidFolioItemDto,
  FolioQueryDto,
} from './folio.dto';
import { ReservationEntity } from '../reservations/reservation.entity';
import { PaymentMethod } from '../../common/enums';

@Injectable()
export class FolioService {
  constructor(
    @InjectRepository(FolioEntity)
    private readonly folioRepo: Repository<FolioEntity>,

    @InjectRepository(FolioItemEntity)
    private readonly itemRepo: Repository<FolioItemEntity>,

    @InjectRepository(ReservationEntity)
    private readonly reservationRepo: Repository<ReservationEntity>,

    private readonly dataSource: DataSource,
  ) {}

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Recompute and persist the folio totals from its non-voided items.
   */
  private async recalculate(folio: FolioEntity): Promise<FolioEntity> {
    const items = await this.itemRepo.find({
      where: { folioId: folio.id, isVoided: false },
    });

    let charges = 0;
    let payments = 0;

    for (const item of items) {
      const amt = Number(item.amount);
      if (amt >= 0) {
        charges += amt;
      } else {
        payments += Math.abs(amt);
      }
    }

    folio.totalCharges = charges;
    folio.totalPayments = payments;
    folio.balance = charges - payments;

    return this.folioRepo.save(folio);
  }

  // ── Folio CRUD ────────────────────────────────────────────────────────────────

  async list(query: FolioQueryDto): Promise<FolioEntity[]> {
    const qb = this.folioRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.reservation', 'reservation');

    if (query.reservationId) {
      qb.andWhere('f.reservationId = :reservationId', { reservationId: query.reservationId });
    }
    if (query.propertyId) {
      qb.andWhere('f.propertyId = :propertyId', { propertyId: query.propertyId });
    }
    if (query.status) {
      qb.andWhere('f.status = :status', { status: query.status });
    }

    return qb.orderBy('f.createdAt', 'DESC').getMany();
  }

  async getById(id: string): Promise<FolioEntity> {
    const folio = await this.folioRepo.findOne({
      where: { id },
      relations: ['reservation', 'items'],
    });
    if (!folio) throw new NotFoundException(`Folio ${id} not found`);
    return folio;
  }

  async getByReservation(reservationId: string): Promise<FolioEntity> {
    const folio = await this.folioRepo.findOne({
      where: { reservationId },
      relations: ['items'],
    });
    if (!folio) throw new NotFoundException(`Folio for reservation ${reservationId} not found`);
    return folio;
  }

  async create(dto: CreateFolioDto): Promise<FolioEntity> {
    // Verify reservation exists
    const reservation = await this.reservationRepo.findOne({
      where: { id: dto.reservationId },
    });
    if (!reservation) {
      throw new NotFoundException(`Reservation ${dto.reservationId} not found`);
    }

    // Only one folio per reservation
    const existing = await this.folioRepo.findOne({
      where: { reservationId: dto.reservationId },
    });
    if (existing) {
      throw new ConflictException(
        `A folio already exists for reservation ${dto.reservationId}`,
      );
    }

    const folio = this.folioRepo.create({
      ...dto,
      currency: dto.currency ?? 'USD',
      status: FolioStatus.Open,
    });

    return this.folioRepo.save(folio);
  }

  // ── Items ─────────────────────────────────────────────────────────────────────

  async addItem(
    folioId: string,
    dto: AddFolioItemDto,
    staffId?: string,
  ): Promise<FolioEntity> {
    const folio = await this.getById(folioId);

    if (folio.status !== FolioStatus.Open) {
      throw new BadRequestException(`Folio is ${folio.status} — cannot post items`);
    }

    const item = this.itemRepo.create({
      ...dto,
      folioId,
      postedBy: staffId,
    });
    await this.itemRepo.save(item);

    return this.recalculate(folio);
  }

  /**
   * Post nightly room charges for a date range.
   * Creates one FolioItem per night between fromDate (inclusive) and toDate (exclusive).
   */
  async addRoomCharges(
    folioId: string,
    dto: AddRoomChargesDto,
    staffId?: string,
  ): Promise<FolioEntity> {
    const folio = await this.getById(folioId);

    if (folio.status !== FolioStatus.Open) {
      throw new BadRequestException(`Folio is ${folio.status} — cannot post charges`);
    }

    const start = new Date(dto.fromDate);
    const end = new Date(dto.toDate);

    if (start >= end) {
      throw new BadRequestException('toDate must be after fromDate');
    }

    const items: FolioItemEntity[] = [];
    const cursor = new Date(start);

    while (cursor < end) {
      const nightStr = cursor.toISOString().slice(0, 10);
      const nextDay = new Date(cursor);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextStr = nextDay.toISOString().slice(0, 10);

      const desc = `${dto.descriptionPrefix ?? 'Room charge'} – ${nightStr}`;

      items.push(
        this.itemRepo.create({
          folioId,
          type: FolioItemType.Charge,
          category: FolioItemCategory.RoomRate,
          description: desc,
          amount: dto.ratePerNight,
          date: nightStr,
          postedBy: staffId,
        }),
      );

      cursor.setDate(cursor.getDate() + 1);
    }

    await this.itemRepo.save(items);
    return this.recalculate(folio);
  }

  /**
   * Convenience method: post a payment (negative amount) to the folio.
   */
  async recordPayment(
    folioId: string,
    dto: RecordPaymentDto,
    staffId?: string,
  ): Promise<FolioEntity> {
    const folio = await this.getById(folioId);

    if (folio.status !== FolioStatus.Open) {
      throw new BadRequestException(`Folio is ${folio.status} — cannot record payments`);
    }

    const today = new Date().toISOString().slice(0, 10);

    const item = this.itemRepo.create({
      folioId,
      type: FolioItemType.Payment,
      category: FolioItemCategory.Deposit,
      description: `Payment received (${dto.paymentMethod})`,
      amount: -Math.abs(dto.amount), // payments are negative
      date: today,
      paymentMethod: dto.paymentMethod,
      paymentReference: dto.paymentReference,
      notes: dto.notes,
      postedBy: staffId,
    });

    await this.itemRepo.save(item);
    return this.recalculate(folio);
  }

  async voidItem(
    folioId: string,
    itemId: string,
    dto: VoidFolioItemDto,
    staffId?: string,
  ): Promise<FolioEntity> {
    const folio = await this.getById(folioId);

    if (folio.status !== FolioStatus.Open) {
      throw new BadRequestException(`Folio is ${folio.status} — cannot void items`);
    }

    const item = await this.itemRepo.findOne({
      where: { id: itemId, folioId },
    });
    if (!item) throw new NotFoundException(`Folio item ${itemId} not found`);
    if (item.isVoided) throw new BadRequestException('Item is already voided');

    item.isVoided = true;
    if (dto.reason) item.notes = `VOIDED: ${dto.reason}${item.notes ? ` | ${item.notes}` : ''}`;
    await this.itemRepo.save(item);

    return this.recalculate(folio);
  }

  // ── Folio lifecycle ───────────────────────────────────────────────────────────

  async close(folioId: string): Promise<FolioEntity> {
    const folio = await this.getById(folioId);

    if (folio.status !== FolioStatus.Open) {
      throw new BadRequestException(`Folio is already ${folio.status}`);
    }

    await this.recalculate(folio); // fresh totals

    if (Number(folio.balance) > 0) {
      throw new BadRequestException(
        `Folio has an outstanding balance of ${folio.balance} ${folio.currency} — settle before closing`,
      );
    }

    folio.status = FolioStatus.Closed;
    folio.closedAt = new Date();

    return this.folioRepo.save(folio);
  }

  async void(folioId: string): Promise<FolioEntity> {
    const folio = await this.getById(folioId);

    if (folio.status === FolioStatus.Voided) {
      throw new BadRequestException('Folio is already voided');
    }

    folio.status = FolioStatus.Voided;
    return this.folioRepo.save(folio);
  }
}
