import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GUEST_SERVICE } from '../data/services/service-tokens';
import { Guest } from '../domain';
import { LoyaltyTier } from '../domain/enums';

const TIER_META: Record<LoyaltyTier, { label: string; color: string; bg: string }> = {
  [LoyaltyTier.Bronze]:   { label: 'Bronze',   color: '#8B5A2B', bg: 'rgba(139, 90, 43, 0.12)' },
  [LoyaltyTier.Silver]:   { label: 'Silver',   color: '#7C7C7C', bg: 'rgba(124, 124, 124, 0.14)' },
  [LoyaltyTier.Gold]:     { label: 'Gold',     color: 'var(--accent)', bg: 'color-mix(in srgb, var(--accent) 18%, transparent)' },
  [LoyaltyTier.Platinum]: { label: 'Platinum', color: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 14%, transparent)' },
  [LoyaltyTier.Diamond]:  { label: 'Diamond',  color: '#00BCD4', bg: 'rgba(0, 188, 212, 0.12)' },
};

@Component({
  selector: 'lux-guests-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CurrencyPipe],
  templateUrl: './guests.page.html',
  styleUrl: './guests.page.scss',
})
export class GuestsPageComponent implements OnInit {
  private guestSvc   = inject(GUEST_SERVICE);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly allTiers: LoyaltyTier[] = [
    LoyaltyTier.Bronze, LoyaltyTier.Silver, LoyaltyTier.Gold, LoyaltyTier.Platinum,
  ];

  loading    = signal(true);
  guests     = signal<Guest[]>([]);
  search     = signal('');
  vipFilter  = signal(false);
  tierFilter = signal<LoyaltyTier | null>(null);

  filtered = computed<Guest[]>(() => {
    const q = this.search().trim().toLowerCase();
    const vip = this.vipFilter();
    const tier = this.tierFilter();
    return this.guests().filter(g => {
      if (vip && !g.isVip) return false;
      if (tier && g.loyaltyTier !== tier) return false;
      if (q) {
        const hit = g.firstName.toLowerCase().includes(q) ||
                    g.lastName.toLowerCase().includes(q)  ||
                    g.email.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  });

  vipCount = computed(() => this.guests().filter(g => g.isVip).length);
  hasActiveFilters = computed(() => !!this.search().trim() || this.vipFilter() || !!this.tierFilter());

  ngOnInit(): void {
    this.loading.set(true);
    this.guestSvc.list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => {
        // Sort by total spent desc as a sensible default
        this.guests.set([...list].sort((a, b) => b.totalSpent - a.totalSpent));
        this.loading.set(false);
      });
  }

  initials(g: Guest): string {
    return `${g.firstName[0] ?? ''}${g.lastName[0] ?? ''}`.toUpperCase();
  }
  tierMeta(t: LoyaltyTier) { return TIER_META[t]; }

  toggleVip(): void {
    this.vipFilter.update(v => !v);
    if (this.vipFilter()) this.tierFilter.set(null);
  }
  toggleTier(t: LoyaltyTier): void {
    this.tierFilter.update(curr => curr === t ? null : t);
  }
  clearFilters(): void {
    this.vipFilter.set(false);
    this.tierFilter.set(null);
  }

  open(id: string): void {
    this.router.navigate(['/app/guests', id]);
  }
}
