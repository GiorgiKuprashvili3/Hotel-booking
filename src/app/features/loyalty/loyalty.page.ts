import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, switchMap } from 'rxjs';

import {
  LOYALTY_SERVICE, GUEST_SERVICE,
} from '../../data/services/service-tokens';
import { Guest, LoyaltyProgram, LoyaltyPromotion, LoyaltyPointsLedgerEntry } from '../../domain';
import { LoyaltyTier } from '../../domain/enums';

/* ── Tier meta ──────────────────────────────────────────── */
const TIER_META: Record<LoyaltyTier, { label: string; color: string; bg: string; icon: string; glow: string }> = {
  [LoyaltyTier.Bronze]:   { label: 'Bronze',   color: '#92400E', bg: '#FEF3C7', icon: '🥉', glow: '#FDE68A' },
  [LoyaltyTier.Silver]:   { label: 'Silver',   color: '#374151', bg: '#F3F4F6', icon: '🥈', glow: '#E5E7EB' },
  [LoyaltyTier.Gold]:     { label: 'Gold',     color: '#92400E', bg: '#FEF9C3', icon: '🥇', glow: '#FEF08A' },
  [LoyaltyTier.Platinum]: { label: 'Platinum', color: '#1E40AF', bg: '#DBEAFE', icon: '💎', glow: '#BFDBFE' },
  [LoyaltyTier.Diamond]:  { label: 'Diamond',  color: '#6D28D9', bg: '#EDE9FE', icon: '💠', glow: '#DDD6FE' },
};
const ALL_TIERS = Object.values(LoyaltyTier);

type Tab = 'members' | 'tiers' | 'promotions';

@Component({
  selector: 'lux-loyalty-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './loyalty.page.html',
})
export class LoyaltyPageComponent implements OnInit {
  private loyaltySvc = inject(LOYALTY_SERVICE);
  private destroyRef = inject(DestroyRef);

  readonly TIER_META = TIER_META;
  readonly allTiers  = ALL_TIERS;
  readonly LoyaltyTier = LoyaltyTier;

  /* ── State ──────────────────────────────────────────── */
  tab         = signal<Tab>('members');
  loading     = signal(true);
  program     = signal<LoyaltyProgram | null>(null);
  members     = signal<Guest[]>([]);
  promotions  = signal<LoyaltyPromotion[]>([]);

  search      = signal('');
  filterTier  = signal('');

  historyGuest   = signal<Guest | null>(null);
  historyLoading = signal(false);
  pointsHistory  = signal<LoyaltyPointsLedgerEntry[]>([]);

  promoDialogOpen = signal(false);
  promoSaving     = signal(false);
  promoError      = signal('');

  promoForm = {
    name: '', description: '', multiplier: 2, isActive: true,
    startsAt: '', endsAt: '', targetTiers: [] as LoyaltyTier[],
  };

  /* ── Computed ────────────────────────────────────────── */
  filteredMembers = computed(() => {
    let list = this.members();
    const q    = this.search().toLowerCase();
    const tier = this.filterTier();
    if (q)    list = list.filter(g => `${g.firstName} ${g.lastName} ${g.email} ${g.loyaltyNumber ?? ''}`.toLowerCase().includes(q));
    if (tier) list = list.filter(g => g.loyaltyTier === tier);
    return list.sort((a, b) => b.loyaltyPoints - a.loyaltyPoints);
  });

  countByTier = (t: LoyaltyTier | string) => this.members().filter(g => g.loyaltyTier === t).length;

  tierColor = (id: string) => (TIER_META as any)[id]?.color ?? '#374151';
  tierBg    = (id: string) => (TIER_META as any)[id]?.bg    ?? '#F3F4F6';
  tierIcon  = (id: string) => (TIER_META as any)[id]?.icon  ?? '🏅';

  /* ── Lifecycle ───────────────────────────────────────── */
  ngOnInit() {
    forkJoin({
      program:    this.loyaltySvc.getProgram(),
      members:    this.loyaltySvc.listMembers(),
      promotions: this.loyaltySvc.listPromotions(),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ program, members, promotions }) => {
        this.program.set(program);
        this.members.set(members);
        this.promotions.set(promotions);
        this.loading.set(false);
      });
  }

  /* ── History drawer ─────────────────────────────────── */
  openHistory(g: Guest) {
    this.historyGuest.set(g);
    this.historyLoading.set(true);
    this.pointsHistory.set([]);
    this.loyaltySvc.getPointsHistory(g.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(entries => {
        this.pointsHistory.set(entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
        this.historyLoading.set(false);
      });
  }
  closeHistory() { this.historyGuest.set(null); }

  /* ── Promotions ─────────────────────────────────────── */
  openPromoDialog() {
    this.promoForm = { name:'', description:'', multiplier:2, isActive:true, startsAt:'', endsAt:'', targetTiers:[] };
    this.promoError.set('');
    this.promoDialogOpen.set(true);
  }
  closePromoDialog() { if (!this.promoSaving()) this.promoDialogOpen.set(false); }

  togglePromoTier(t: LoyaltyTier) {
    const idx = this.promoForm.targetTiers.indexOf(t);
    if (idx >= 0) this.promoForm.targetTiers.splice(idx, 1);
    else          this.promoForm.targetTiers.push(t);
  }

  submitPromo() {
    if (!this.promoForm.name.trim() || !this.promoForm.startsAt || !this.promoForm.endsAt) {
      this.promoError.set('Name, start date and end date are required.');
      return;
    }
    this.promoSaving.set(true);
    this.loyaltySvc.createPromotion({
      name:        this.promoForm.name,
      description: this.promoForm.description,
      multiplier:  this.promoForm.multiplier,
      targetTiers: this.promoForm.targetTiers,
      startsAt:    new Date(this.promoForm.startsAt),
      endsAt:      new Date(this.promoForm.endsAt),
      isActive:    this.promoForm.isActive,
      createdBy:   'current-user',
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => {
        this.promotions.update(list => [p, ...list]);
        this.promoSaving.set(false);
        this.promoDialogOpen.set(false);
      },
      error: () => { this.promoSaving.set(false); this.promoError.set('Failed to create promotion.'); },
    });
  }

  togglePromo(p: LoyaltyPromotion) {
    this.loyaltySvc.updatePromotion(p.id, { isActive: !p.isActive })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => {
        this.promotions.update(list => list.map(x => x.id === updated.id ? updated : x));
      });
  }
}
