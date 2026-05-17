import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LoyaltyLedgerEntity,
  LoyaltyTransactionType,
  TIER_EARN_RATE,
  TIER_THRESHOLDS,
} from './loyalty-ledger.entity';
import { GuestEntity } from '../guests/guest.entity';
import { LoyaltyTier } from '../../common/enums';

export class AdjustPointsDto {
  guestId: string;
  points: number; // positive = earn, negative = deduct
  type: LoyaltyTransactionType;
  description?: string;
  reservationId?: string;
  createdById?: string;
}

export class EarnFromStayDto {
  guestId: string;
  reservationId: string;
  amountSpent: number; // currency amount to convert to points
  createdById?: string;
}

export class RedeemPointsDto {
  guestId: string;
  points: number;
  reservationId?: string;
  description?: string;
  createdById?: string;
}

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyLedgerEntity)
    private readonly ledgerRepo: Repository<LoyaltyLedgerEntity>,

    @InjectRepository(GuestEntity)
    private readonly guestRepo: Repository<GuestEntity>,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private computeTier(points: number): LoyaltyTier {
    const sorted = (Object.entries(TIER_THRESHOLDS) as [LoyaltyTier, number][])
      .sort(([, a], [, b]) => b - a);
    for (const [tier, threshold] of sorted) {
      if (points >= threshold) return tier;
    }
    return LoyaltyTier.Bronze;
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  async getLedger(guestId: string): Promise<LoyaltyLedgerEntity[]> {
    const guest = await this.guestRepo.findOne({ where: { id: guestId } });
    if (!guest) throw new NotFoundException(`Guest ${guestId} not found`);
    return this.ledgerRepo.find({
      where: { guestId },
      order: { createdAt: 'DESC' },
    });
  }

  async getBalance(guestId: string): Promise<{
    points: number;
    tier: LoyaltyTier;
    nextTier: LoyaltyTier | null;
    pointsToNextTier: number | null;
  }> {
    const guest = await this.guestRepo.findOne({ where: { id: guestId } });
    if (!guest) throw new NotFoundException(`Guest ${guestId} not found`);

    const tierOrder = [
      LoyaltyTier.Bronze,
      LoyaltyTier.Silver,
      LoyaltyTier.Gold,
      LoyaltyTier.Platinum,
      LoyaltyTier.Diamond,
    ];
    const currentIdx = tierOrder.indexOf(guest.loyaltyTier ?? LoyaltyTier.Bronze);
    const nextTier = currentIdx < tierOrder.length - 1 ? tierOrder[currentIdx + 1] : null;
    const pointsToNextTier = nextTier
      ? TIER_THRESHOLDS[nextTier] - (guest.loyaltyPoints ?? 0)
      : null;

    return {
      points: guest.loyaltyPoints ?? 0,
      tier: guest.loyaltyTier ?? LoyaltyTier.Bronze,
      nextTier,
      pointsToNextTier,
    };
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  async adjustPoints(dto: AdjustPointsDto): Promise<LoyaltyLedgerEntity> {
    const guest = await this.guestRepo.findOne({ where: { id: dto.guestId } });
    if (!guest) throw new NotFoundException(`Guest ${dto.guestId} not found`);

    const currentPoints = guest.loyaltyPoints ?? 0;
    const newBalance = currentPoints + dto.points;

    if (newBalance < 0) {
      throw new BadRequestException(
        `Insufficient points. Balance: ${currentPoints}, requested deduction: ${Math.abs(dto.points)}`,
      );
    }

    guest.loyaltyPoints = newBalance;
    guest.loyaltyTier = this.computeTier(newBalance);
    if (!guest.loyaltyCardNumber) {
      guest.loyaltyCardNumber = `LX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    await this.guestRepo.save(guest);

    return this.ledgerRepo.save(
      this.ledgerRepo.create({
        guestId: dto.guestId,
        reservationId: dto.reservationId ?? null,
        type: dto.type,
        points: dto.points,
        balanceAfter: newBalance,
        description: dto.description ?? null,
        createdById: dto.createdById ?? null,
      }),
    );
  }

  async earnFromStay(dto: EarnFromStayDto): Promise<LoyaltyLedgerEntity> {
    const guest = await this.guestRepo.findOne({ where: { id: dto.guestId } });
    if (!guest) throw new NotFoundException(`Guest ${dto.guestId} not found`);

    const tier = guest.loyaltyTier ?? LoyaltyTier.Bronze;
    const rate = TIER_EARN_RATE[tier];
    const pointsEarned = Math.floor(dto.amountSpent * rate);

    return this.adjustPoints({
      guestId: dto.guestId,
      reservationId: dto.reservationId,
      points: pointsEarned,
      type: LoyaltyTransactionType.Earn,
      description: `Earned from stay: ${dto.amountSpent} @ ${rate}pts/unit`,
      createdById: dto.createdById,
    });
  }

  async redeemPoints(dto: RedeemPointsDto): Promise<LoyaltyLedgerEntity> {
    return this.adjustPoints({
      guestId: dto.guestId,
      reservationId: dto.reservationId,
      points: -dto.points,
      type: LoyaltyTransactionType.Redeem,
      description: dto.description ?? 'Points redeemed',
      createdById: dto.createdById,
    });
  }
}
