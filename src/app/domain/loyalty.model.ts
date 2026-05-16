import { LoyaltyTier } from './enums';

export interface LoyaltyTierConfig {
  id: string;
  name: string;
  minStays: number;
  minPoints: number;
  pointsPerGel: number;        // earn rate
  benefits: string[];
  color?: string;              // UI: badge color token
}

export interface LoyaltyProgram {
  id: string;
  name: string;
  currency: string;            // display name, e.g. "LuxPoints"
  tiers: LoyaltyTierConfig[];
  redemptionRate: number;      // points per 1 GEL of value
}

export interface LoyaltyPromotion {
  id: string;
  name: string;
  description: string;
  multiplier: number;          // e.g. 2 = double points
  targetTiers: LoyaltyTier[];  // empty = all tiers
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  createdBy: string;           // staff id
}

export interface LoyaltyPointsLedgerEntry {
  id: string;
  guestId: string;
  reservationId?: string;
  type: 'earn' | 'redeem' | 'adjustment' | 'bonus' | 'expire';
  points: number;              // positive = earned, negative = redeemed/expired
  balanceAfter: number;
  description: string;
  createdAt: Date;
  staffId?: string;            // for manual adjustments
}
