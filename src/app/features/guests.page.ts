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
  template: `
<div class="guests-page">

  <header class="g-header">
    <div>
      <h1 class="page-title">Guests</h1>
      <p class="page-sub">
        {{ filtered().length }} of {{ guests().length }}
        <span class="dot">·</span>
        {{ vipCount() }} VIP
      </p>
    </div>
  </header>

  <!-- Filters -->
  <div class="filters">
    <input
      class="filter-input filter-input--search"
      type="search"
      placeholder="Search by name or email…"
      [ngModel]="search()"
      (ngModelChange)="search.set($event)" />

    <div class="chip-group">
      <button
        class="filter-chip"
        [class.active]="!vipFilter() && !tierFilter()"
        (click)="clearFilters()">
        All
      </button>
      <button
        class="filter-chip filter-chip--vip"
        [class.active]="vipFilter()"
        (click)="toggleVip()">
        ★ VIP only
      </button>
      <span class="chip-sep"></span>
      @for (tier of allTiers; track tier) {
        <button
          class="filter-chip"
          [class.active]="tierFilter() === tier"
          [style.--c]="tierMeta(tier).color"
          (click)="toggleTier(tier)">
          {{ tierMeta(tier).label }}
        </button>
      }
    </div>
  </div>

  <!-- Table -->
  <div class="table-wrap">
    @if (loading()) {
      <div class="loading">Loading guests…</div>
    } @else if (!filtered().length) {
      <div class="empty">
        <p>No guests match your filters.</p>
        @if (hasActiveFilters()) {
          <button class="btn-link" (click)="clearFilters()">Clear filters</button>
        }
      </div>
    } @else {
      <table class="g-table">
        <thead>
          <tr>
            <th>Guest</th>
            <th>Contact</th>
            <th>Nationality</th>
            <th class="num-col">Stays</th>
            <th class="num-col">Total spent</th>
            <th>Last stay</th>
            <th>Loyalty</th>
          </tr>
        </thead>
        <tbody>
          @for (g of filtered(); track g.id) {
            <tr class="row" (click)="open(g.id)">
              <td>
                <div class="guest-cell">
                  <div class="g-avatar">{{ initials(g) }}</div>
                  <div class="g-name-block">
                    <span class="g-name">
                      {{ g.firstName }} {{ g.lastName }}
                      @if (g.isVip) { <span class="vip-tag">VIP</span> }
                    </span>
                    @if (g.tags.length) {
                      <span class="g-tags-line">
                        @for (t of g.tags.slice(0, 2); track t) {
                          <span class="g-tag">{{ t }}</span>
                        }
                        @if (g.tags.length > 2) {
                          <span class="g-tag g-tag--more">+{{ g.tags.length - 2 }}</span>
                        }
                      </span>
                    }
                  </div>
                </div>
              </td>
              <td class="contact-cell">
                <div class="contact-email">{{ g.email }}</div>
                <div class="contact-phone">{{ g.phone }}</div>
              </td>
              <td>{{ g.nationality }}</td>
              <td class="num-col">{{ g.totalStays }}</td>
              <td class="num-col">{{ g.totalSpent | currency:'GEL':'symbol-narrow':'1.0-0' }}</td>
              <td class="muted">
                {{ g.lastStayDate ? (g.lastStayDate | date:'MMM y') : '—' }}
              </td>
              <td>
                @if (g.loyaltyTier) {
                  <span class="tier-pill"
                        [style.color]="tierMeta(g.loyaltyTier).color"
                        [style.background]="tierMeta(g.loyaltyTier).bg">
                    {{ tierMeta(g.loyaltyTier).label }}
                  </span>
                  <span class="loyalty-pts">{{ g.loyaltyPoints }} pts</span>
                } @else {
                  <span class="muted">—</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    }
  </div>

</div>
  `,
  styles: [`
    .guests-page { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); }
    .g-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--space-4); flex-wrap: wrap;
    }
    .page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--text); margin: 0; }
    .page-sub { font-size: var(--text-sm); color: var(--text-muted); margin: 4px 0 0; }
    .page-sub .dot { margin: 0 4px; color: var(--text-subtle); }

    .filters {
      display: flex; gap: var(--space-3); flex-wrap: wrap; align-items: center;
      padding: var(--space-3) var(--space-4);
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    .filter-input {
      height: 36px; padding: 0 var(--space-3);
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface); color: var(--text);
      font-size: var(--text-sm); font-family: inherit; outline: none;
    }
    .filter-input--search { flex: 1; min-width: 260px; max-width: 360px; }
    .filter-input:focus { border-color: var(--primary); }

    .chip-group { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .chip-sep {
      width: 1px; height: 18px; background: var(--border); margin: 0 4px;
    }
    .filter-chip {
      height: 28px; padding: 0 var(--space-3);
      border: 1px solid var(--border); background: var(--surface);
      border-radius: var(--radius-full); cursor: pointer;
      font-size: var(--text-xs); font-weight: 600; color: var(--text-muted);
      transition: all var(--t-fast);
    }
    .filter-chip:hover { color: var(--text); border-color: var(--border-strong); }
    .filter-chip.active {
      background: var(--c, var(--primary)); color: var(--on-primary); border-color: var(--c, var(--primary));
    }
    .filter-chip--vip { color: var(--accent); }
    .filter-chip--vip.active {
      background: var(--accent); color: var(--on-accent); border-color: var(--accent);
    }

    .table-wrap {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-md); overflow: hidden;
    }
    .loading, .empty {
      padding: var(--space-12); text-align: center; color: var(--text-muted);
    }
    .empty p { margin: 0 0 var(--space-2); }
    .btn-link {
      background: none; border: none; cursor: pointer;
      color: var(--primary); font-size: var(--text-sm); font-weight: 600;
      text-decoration: underline;
    }

    .g-table { width: 100%; border-collapse: collapse; }
    .g-table th {
      text-align: left; padding: var(--space-3) var(--space-4);
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-subtle);
      background: var(--surface-2); border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .g-table td {
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--border);
      font-size: var(--text-sm); color: var(--text); vertical-align: middle;
    }
    .num-col { text-align: right; font-variant-numeric: tabular-nums; }
    .row { cursor: pointer; transition: background var(--t-fast); }
    .row:hover { background: var(--surface-2); }
    .muted { color: var(--text-muted); }

    .guest-cell { display: flex; gap: var(--space-3); align-items: center; }
    .g-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: var(--primary); color: var(--on-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: var(--text-xs); font-weight: 700; flex-shrink: 0;
    }
    .g-name-block { display: flex; flex-direction: column; gap: 2px; }
    .g-name {
      font-weight: 600; color: var(--text);
      display: flex; align-items: center; gap: 6px;
    }
    .vip-tag {
      padding: 2px 7px; background: var(--accent); color: var(--on-accent);
      border-radius: var(--radius-full); font-size: 9px;
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
    }
    .g-tags-line { display: flex; gap: 4px; flex-wrap: wrap; }
    .g-tag {
      padding: 1px 6px; font-size: 10px;
      background: var(--surface-2); color: var(--text-muted);
      border-radius: var(--radius-sm);
    }
    .g-tag--more { color: var(--text-subtle); }

    .contact-cell { display: flex; flex-direction: column; gap: 1px; }
    .contact-email { color: var(--text); }
    .contact-phone { font-size: var(--text-xs); color: var(--text-muted); }

    .tier-pill {
      display: inline-block; padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .loyalty-pts {
      font-size: var(--text-xs); color: var(--text-muted);
      margin-left: 6px; font-variant-numeric: tabular-nums;
    }
  `],
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
