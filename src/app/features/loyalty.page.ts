import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, switchMap } from 'rxjs';

import {
  LOYALTY_SERVICE, GUEST_SERVICE,
} from '../data/services/service-tokens';
import { Guest, LoyaltyProgram, LoyaltyPromotion, LoyaltyPointsLedgerEntry } from '../domain';
import { LoyaltyTier } from '../domain/enums';

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
  template: `
<div class="loy-page">

  <!-- ── HEADER ─────────────────────────────────────────── -->
  <header class="loy-header">
    <div class="loy-title-block">
      <div class="loy-icon">💎</div>
      <div>
        <h1 class="loy-title">{{ program()?.name ?? 'Loyalty Program' }}</h1>
        <p class="loy-sub">{{ members().length }} enrolled members · {{ program()?.currency ?? 'Points' }}</p>
      </div>
    </div>
    <div class="loy-toolbar">
      <div class="tab-pills">
        <button class="tab-pill" [class.active]="tab() === 'members'" (click)="tab.set('members')">
          👤 Members
        </button>
        <button class="tab-pill" [class.active]="tab() === 'tiers'" (click)="tab.set('tiers')">
          🏅 Tiers & Benefits
        </button>
        <button class="tab-pill" [class.active]="tab() === 'promotions'" (click)="tab.set('promotions')">
          🎯 Promotions
        </button>
      </div>
      @if (tab() === 'members') {
        <div class="search-box">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <input class="search-input" type="text" placeholder="Search members…"
                 [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </div>
        <select class="filter-select" [ngModel]="filterTier()" (ngModelChange)="filterTier.set($event)">
          <option value="">All Tiers</option>
          @for (t of allTiers; track t) {
            <option [value]="t">{{ TIER_META[t].icon }} {{ TIER_META[t].label }}</option>
          }
        </select>
      }
      @if (tab() === 'promotions') {
        <button class="btn-promo" (click)="openPromoDialog()">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          New Promotion
        </button>
      }
    </div>
  </header>

  @if (loading()) {
    <div class="loy-loading">
      <div class="spinner"></div>
      <span>Loading loyalty data…</span>
    </div>
  } @else {

    <!-- ── MEMBERS TAB ─────────────────────────────────── -->
    @if (tab() === 'members') {

      <!-- KPI strip -->
      <div class="kpi-strip">
        @for (t of allTiers; track t) {
          <button class="kpi-tile" [class.active]="filterTier() === t"
                  (click)="filterTier.set(filterTier() === t ? '' : t)"
                  [style.--col]="TIER_META[t].color"
                  [style.--bg]="TIER_META[t].bg">
            <span class="kpi-icon">{{ TIER_META[t].icon }}</span>
            <span class="kpi-num">{{ countByTier(t) }}</span>
            <span class="kpi-lbl">{{ TIER_META[t].label }}</span>
          </button>
        }
      </div>

      <!-- Member table -->
      <div class="table-wrap">
        <div class="members-table">
          <div class="thead">
            <div class="th">Member</div>
            <div class="th">Tier</div>
            <div class="th th-r">Points Balance</div>
            <div class="th th-r">Total Stays</div>
            <div class="th th-r">Total Spent</div>
            <div class="th">Last Stay</div>
            <div class="th th-c">History</div>
          </div>

          @if (filteredMembers().length === 0) {
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <div class="empty-msg">No members match your search.</div>
            </div>
          }

          @for (g of filteredMembers(); track g.id) {
            <div class="tbody-row">
              <div class="td td-member">
                <div class="member-avatar" [style.background]="TIER_META[g.loyaltyTier!]?.bg ?? '#F3F4F6'"
                     [style.color]="TIER_META[g.loyaltyTier!]?.color ?? '#374151'">
                  {{ g.firstName[0] }}{{ g.lastName[0] }}
                </div>
                <div>
                  <div class="member-name">{{ g.firstName }} {{ g.lastName }}</div>
                  <div class="member-number">{{ g.loyaltyNumber ?? '—' }}</div>
                </div>
              </div>
              <div class="td">
                @if (g.loyaltyTier) {
                  <span class="tier-badge"
                        [style.background]="TIER_META[g.loyaltyTier].bg"
                        [style.color]="TIER_META[g.loyaltyTier].color"
                        [style.box-shadow]="'0 0 0 1.5px ' + TIER_META[g.loyaltyTier].glow">
                    {{ TIER_META[g.loyaltyTier].icon }} {{ TIER_META[g.loyaltyTier].label }}
                  </span>
                }
              </div>
              <div class="td td-r points-cell">
                <span class="points-val">{{ g.loyaltyPoints | number }}</span>
                <span class="points-lbl">pts</span>
              </div>
              <div class="td td-r">{{ g.totalStays }}</div>
              <div class="td td-r spend-val">₾{{ g.totalSpent | number:'1.0-0' }}</div>
              <div class="td">{{ g.lastStayDate ? (g.lastStayDate | date:'MMM d, y') : '—' }}</div>
              <div class="td td-c">
                <button class="hist-btn" (click)="openHistory(g)" title="View points history">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/>
                    <path d="M8 5v3.5l2 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    }

    <!-- ── TIERS TAB ───────────────────────────────────── -->
    @if (tab() === 'tiers') {
      <div class="tiers-wrap">
        @if (program()) {
          <div class="tiers-intro">
            <div class="tiers-intro-icon">💎</div>
            <div>
              <div class="tiers-intro-name">{{ program()!.name }}</div>
              <div class="tiers-intro-sub">
                Currency: <strong>{{ program()!.currency }}</strong> ·
                Redemption rate: <strong>{{ program()!.redemptionRate }} pts / ₾1</strong>
              </div>
            </div>
          </div>

          <div class="tiers-grid">
            @for (tier of program()!.tiers; track tier.id) {
              <div class="tier-card" [style.--tier-color]="tierColor(tier.id)"
                   [style.--tier-bg]="tierBg(tier.id)">
                <div class="tier-card-header">
                  <div class="tier-card-icon">{{ tierIcon(tier.id) }}</div>
                  <div class="tier-card-name">{{ tier.name }}</div>
                  <div class="tier-card-count">{{ countByTier(tier.id) }} members</div>
                </div>
                <div class="tier-card-stats">
                  <div class="tier-stat">
                    <span class="tier-stat-val">{{ tier.minStays }}</span>
                    <span class="tier-stat-lbl">Min stays</span>
                  </div>
                  <div class="tier-stat">
                    <span class="tier-stat-val">{{ tier.minPoints | number }}</span>
                    <span class="tier-stat-lbl">Min points</span>
                  </div>
                  <div class="tier-stat">
                    <span class="tier-stat-val">{{ tier.pointsPerGel }}×</span>
                    <span class="tier-stat-lbl">pts/₾</span>
                  </div>
                </div>
                <div class="tier-benefits">
                  <div class="tier-benefits-label">Benefits</div>
                  @for (b of tier.benefits; track b) {
                    <div class="tier-benefit-item">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="2"
                              stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      {{ b }}
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    }

    <!-- ── PROMOTIONS TAB ─────────────────────────────── -->
    @if (tab() === 'promotions') {
      <div class="promos-wrap">
        @if (promotions().length === 0) {
          <div class="promos-empty">
            <div class="promos-empty-icon">🎯</div>
            <div class="promos-empty-msg">No promotions yet. Create one to boost member engagement.</div>
            <button class="btn-promo" (click)="openPromoDialog()">Create First Promotion</button>
          </div>
        } @else {
          <div class="promos-grid">
            @for (p of promotions(); track p.id) {
              <div class="promo-card" [class.promo-inactive]="!p.isActive">
                <div class="promo-card-top">
                  <div class="promo-multiplier">{{ p.multiplier }}×</div>
                  <div class="promo-status-toggle">
                    <span class="promo-status" [class.active]="p.isActive">
                      {{ p.isActive ? '🟢 Active' : '⚪ Inactive' }}
                    </span>
                    <button class="toggle-btn" (click)="togglePromo(p)">
                      {{ p.isActive ? 'Pause' : 'Activate' }}
                    </button>
                  </div>
                </div>
                <div class="promo-name">{{ p.name }}</div>
                <div class="promo-desc">{{ p.description }}</div>
                <div class="promo-meta">
                  <span class="promo-meta-item">
                    📅 {{ p.startsAt | date:'MMM d' }} – {{ p.endsAt | date:'MMM d, y' }}
                  </span>
                  @if (p.targetTiers.length > 0) {
                    <span class="promo-meta-item">
                      @for (t of p.targetTiers; track t) {
                        <span class="tier-mini" [style.color]="TIER_META[t]?.color">
                          {{ TIER_META[t]?.icon }}
                        </span>
                      }
                      {{ p.targetTiers.length }} tier(s)
                    </span>
                  } @else {
                    <span class="promo-meta-item">🌐 All tiers</span>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    }
  }
</div>

<!-- ── POINTS HISTORY DRAWER ──────────────────────────── -->
@if (historyGuest()) {
  <div class="drawer-backdrop" (click)="closeHistory()">
    <div class="drawer-panel" (click)="$event.stopPropagation()">
      <div class="drawer-header">
        <div>
          <div class="drawer-title">Points History</div>
          <div class="drawer-sub">{{ historyGuest()!.firstName }} {{ historyGuest()!.lastName }}</div>
        </div>
        <button class="drawer-close" (click)="closeHistory()">✕</button>
      </div>
      <div class="drawer-kpi-row">
        <div class="drawer-kpi">
          <span class="drawer-kpi-val">{{ historyGuest()!.loyaltyPoints | number }}</span>
          <span class="drawer-kpi-lbl">Current Balance</span>
        </div>
        @if (historyGuest()!.loyaltyTier) {
          <div class="drawer-kpi">
            <span class="drawer-kpi-val">
              {{ TIER_META[historyGuest()!.loyaltyTier!]?.icon }}
              {{ TIER_META[historyGuest()!.loyaltyTier!]?.label }}
            </span>
            <span class="drawer-kpi-lbl">Tier</span>
          </div>
        }
        <div class="drawer-kpi">
          <span class="drawer-kpi-val">{{ historyGuest()!.totalStays }}</span>
          <span class="drawer-kpi-lbl">Total Stays</span>
        </div>
      </div>
      <div class="ledger-scroll">
        @if (historyLoading()) {
          <div class="ledger-loading">
            <div class="spinner"></div>
            <span>Loading history…</span>
          </div>
        } @else if (pointsHistory().length === 0) {
          <div class="ledger-empty">No transactions yet.</div>
        } @else {
          @for (entry of pointsHistory(); track entry.id) {
            <div class="ledger-row">
              <div class="ledger-icon"
                   [class.earn]="entry.points > 0"
                   [class.redeem]="entry.points < 0">
                {{ entry.points > 0 ? '⬆️' : '⬇️' }}
              </div>
              <div class="ledger-main">
                <div class="ledger-desc">{{ entry.description }}</div>
                <div class="ledger-date">{{ entry.createdAt | date:'MMM d, y HH:mm' }}</div>
              </div>
              <div class="ledger-pts" [class.positive]="entry.points > 0" [class.negative]="entry.points < 0">
                {{ entry.points > 0 ? '+' : '' }}{{ entry.points | number }}
              </div>
              <div class="ledger-bal">{{ entry.balanceAfter | number }}</div>
            </div>
          }
        }
      </div>
    </div>
  </div>
}

<!-- ── NEW PROMOTION DIALOG ──────────────────────────── -->
@if (promoDialogOpen()) {
  <div class="dialog-backdrop" (click)="closePromoDialog()">
    <div class="dialog-panel" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="dialog-title">New Promotion</h2>
        <button class="dialog-close" (click)="closePromoDialog()">✕</button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input class="form-input" [(ngModel)]="promoForm.name" placeholder="Double Points Weekend" />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" [(ngModel)]="promoForm.description" rows="2"
                    placeholder="Earn double LuxPoints on all stays…"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Points Multiplier *</label>
            <input class="form-input" type="number" [(ngModel)]="promoForm.multiplier" min="1.1" step="0.5" />
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" [(ngModel)]="promoForm.isActive">
              <option [ngValue]="true">Active</option>
              <option [ngValue]="false">Draft (Inactive)</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Start Date *</label>
            <input class="form-input" type="date" [(ngModel)]="promoForm.startsAt" />
          </div>
          <div class="form-group">
            <label class="form-label">End Date *</label>
            <input class="form-input" type="date" [(ngModel)]="promoForm.endsAt" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Target Tiers (leave empty for all)</label>
          <div class="tier-checks">
            @for (t of allTiers; track t) {
              <label class="tier-check-item">
                <input type="checkbox" [checked]="promoForm.targetTiers.includes(t)"
                       (change)="togglePromoTier(t)" />
                <span [style.color]="TIER_META[t].color">{{ TIER_META[t].icon }} {{ TIER_META[t].label }}</span>
              </label>
            }
          </div>
        </div>
        @if (promoError()) {
          <div class="form-error">{{ promoError() }}</div>
        }
      </div>
      <div class="dialog-footer">
        <button class="btn-cancel" (click)="closePromoDialog()">Cancel</button>
        <button class="btn-submit" [disabled]="promoSaving()" (click)="submitPromo()">
          {{ promoSaving() ? 'Creating…' : 'Create Promotion' }}
        </button>
      </div>
    </div>
  </div>
}

<style>
/* ── Layout ──────────────────────────────────────────── */
.loy-page { display:flex; flex-direction:column; height:100%; background:var(--surface-ground,#F8F7F4); }

/* Header */
.loy-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap;
  gap:12px; padding:20px 24px 16px; background:#fff; border-bottom:1px solid #E5E7EB; }
.loy-title-block { display:flex; align-items:center; gap:12px; }
.loy-icon { width:40px; height:40px; background:linear-gradient(135deg,#EDE9FE,#DBEAFE);
  border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; }
.loy-title { font-size:1.25rem; font-weight:700; color:#111827; margin:0; }
.loy-sub { font-size:.8rem; color:#6B7280; margin:0; }
.loy-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.tab-pills { display:flex; background:#F3F4F6; border-radius:8px; padding:3px; gap:2px; }
.tab-pill { padding:6px 14px; border:none; background:transparent; border-radius:6px;
  font-size:.8rem; font-weight:500; color:#6B7280; cursor:pointer; transition:.15s; }
.tab-pill.active { background:#fff; color:#111827; box-shadow:0 1px 3px rgba(0,0,0,.1); }
.search-box { display:flex; align-items:center; gap:6px; background:#F9FAFB;
  border:1px solid #E5E7EB; border-radius:7px; padding:0 10px; }
.search-input { border:none; background:transparent; outline:none; font-size:.82rem;
  color:#374151; width:160px; height:34px; }
.filter-select { padding:0 10px; height:34px; border:1px solid #E5E7EB; border-radius:7px;
  background:#F9FAFB; font-size:.82rem; color:#374151; cursor:pointer; }
.btn-promo { display:flex; align-items:center; gap:6px; padding:0 14px; height:34px;
  background:#7C3AED; color:#fff; border:none; border-radius:7px; font-size:.82rem;
  font-weight:600; cursor:pointer; transition:.15s; }
.btn-promo:hover { background:#6D28D9; }

/* Loading */
.loy-loading { display:flex; align-items:center; justify-content:center; gap:10px;
  padding:80px 0; color:#6B7280; }
.spinner { width:20px; height:20px; border:2px solid #E5E7EB; border-top-color:#7C3AED;
  border-radius:50%; animation:spin .7s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

/* KPI strip */
.kpi-strip { display:flex; gap:10px; padding:14px 24px; overflow-x:auto;
  background:#fff; border-bottom:1px solid #E5E7EB; }
.kpi-tile { display:flex; flex-direction:column; align-items:center; gap:2px;
  min-width:90px; padding:10px 14px; border:1.5px solid #E5E7EB; border-radius:10px;
  background:#fff; cursor:pointer; transition:.15s; }
.kpi-tile:hover, .kpi-tile.active { border-color:var(--col,#6B7280);
  background:var(--bg, #F3F4F6); }
.kpi-icon { font-size:.95rem; }
.kpi-num { font-size:1.25rem; font-weight:700; color:#111827; }
.kpi-lbl { font-size:.72rem; color:#6B7280; }

/* Member table */
.table-wrap { flex:1; overflow:auto; padding:16px 24px 24px; }
.members-table { background:#fff; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; }
.thead { display:grid; grid-template-columns:1fr 120px 130px 90px 110px 120px 60px;
  padding:0 16px; background:#F9FAFB; border-bottom:1px solid #E5E7EB; }
.th { padding:10px 8px; font-size:.72rem; font-weight:600; color:#6B7280; text-transform:uppercase; letter-spacing:.04em; }
.th-r { text-align:right; }
.th-c { text-align:center; }
.tbody-row { display:grid; grid-template-columns:1fr 120px 130px 90px 110px 120px 60px;
  padding:0 16px; border-bottom:1px solid #F3F4F6; align-items:center; }
.tbody-row:last-child { border-bottom:none; }
.tbody-row:hover { background:#FAFAFA; }
.td { padding:10px 8px; font-size:.82rem; color:#374151; }
.td-r { text-align:right; }
.td-c { text-align:center; }
.td-member { display:flex; align-items:center; gap:10px; }
.member-avatar { width:34px; height:34px; border-radius:50%; flex-shrink:0;
  display:flex; align-items:center; justify-content:center; font-size:.72rem; font-weight:700; }
.member-name { font-weight:600; color:#111827; font-size:.85rem; }
.member-number { font-size:.72rem; color:#9CA3AF; }
.tier-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 8px;
  border-radius:6px; font-size:.75rem; font-weight:600; }
.points-cell { display:flex; align-items:baseline; gap:4px; justify-content:flex-end; }
.points-val { font-weight:700; color:#7C3AED; font-size:.92rem; }
.points-lbl { font-size:.68rem; color:#9CA3AF; }
.spend-val { font-weight:600; color:#16A34A; }
.hist-btn { width:28px; height:28px; border:1px solid #E5E7EB; border-radius:6px;
  background:#fff; display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:#6B7280; transition:.15s; }
.hist-btn:hover { border-color:#7C3AED; color:#7C3AED; }
.empty-state { display:flex; flex-direction:column; align-items:center; gap:8px;
  padding:60px 0; color:#9CA3AF; }
.empty-icon { font-size:2rem; }
.empty-msg { font-size:.85rem; }

/* ── Tiers tab ────────────────────────────────────────── */
.tiers-wrap { flex:1; overflow:auto; padding:20px 24px; }
.tiers-intro { display:flex; align-items:center; gap:12px; background:#fff;
  border:1px solid #E5E7EB; border-radius:10px; padding:14px 18px; margin-bottom:16px; }
.tiers-intro-icon { font-size:1.4rem; }
.tiers-intro-name { font-size:.95rem; font-weight:700; color:#111827; }
.tiers-intro-sub { font-size:.78rem; color:#6B7280; margin-top:2px; }
.tiers-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:14px; }
.tier-card { background:#fff; border:2px solid var(--tier-bg,#F3F4F6); border-radius:14px;
  overflow:hidden; transition:.2s; }
.tier-card:hover { border-color:var(--tier-color,#374151); box-shadow:0 4px 20px rgba(0,0,0,.08); }
.tier-card-header { display:flex; flex-direction:column; align-items:center; gap:4px;
  padding:18px 16px 12px; background:var(--tier-bg,#F3F4F6); }
.tier-card-icon { font-size:1.8rem; }
.tier-card-name { font-size:.95rem; font-weight:700; color:var(--tier-color,#374151); }
.tier-card-count { font-size:.72rem; color:#6B7280; background:#fff; padding:2px 8px;
  border-radius:10px; border:1px solid rgba(0,0,0,.08); }
.tier-card-stats { display:grid; grid-template-columns:repeat(3,1fr); padding:12px 10px;
  border-bottom:1px solid #F3F4F6; }
.tier-stat { display:flex; flex-direction:column; align-items:center; gap:2px; }
.tier-stat-val { font-size:.95rem; font-weight:700; color:var(--tier-color,#374151); }
.tier-stat-lbl { font-size:.65rem; color:#9CA3AF; text-align:center; }
.tier-benefits { padding:12px 14px; display:flex; flex-direction:column; gap:6px; }
.tier-benefits-label { font-size:.7rem; font-weight:700; text-transform:uppercase;
  letter-spacing:.06em; color:#9CA3AF; margin-bottom:2px; }
.tier-benefit-item { display:flex; align-items:flex-start; gap:6px; font-size:.78rem;
  color:#374151; line-height:1.4; }
.tier-benefit-item svg { flex-shrink:0; margin-top:2px; color:var(--tier-color,#374151); }

/* ── Promotions tab ───────────────────────────────────── */
.promos-wrap { flex:1; overflow:auto; padding:20px 24px; }
.promos-empty { display:flex; flex-direction:column; align-items:center; gap:12px;
  padding:80px 0; color:#9CA3AF; }
.promos-empty-icon { font-size:2.5rem; }
.promos-empty-msg { font-size:.88rem; max-width:300px; text-align:center; }
.promos-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:14px; }
.promo-card { background:#fff; border:1.5px solid #E5E7EB; border-radius:14px;
  padding:18px; transition:.2s; }
.promo-card:hover { box-shadow:0 4px 16px rgba(0,0,0,.08); }
.promo-inactive { opacity:.65; }
.promo-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.promo-multiplier { font-size:1.6rem; font-weight:800; color:#7C3AED;
  background:#EDE9FE; padding:4px 12px; border-radius:10px; }
.promo-status-toggle { display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
.promo-status { font-size:.72rem; font-weight:600; }
.promo-status.active { color:#16A34A; }
.toggle-btn { padding:3px 10px; border:1px solid #E5E7EB; border-radius:6px;
  background:#F9FAFB; font-size:.72rem; cursor:pointer; transition:.15s; }
.toggle-btn:hover { background:#EDE9FE; border-color:#7C3AED; color:#7C3AED; }
.promo-name { font-size:.95rem; font-weight:700; color:#111827; margin-bottom:4px; }
.promo-desc { font-size:.8rem; color:#6B7280; line-height:1.4; margin-bottom:10px; }
.promo-meta { display:flex; flex-direction:column; gap:4px; }
.promo-meta-item { display:flex; align-items:center; gap:4px; font-size:.75rem; color:#6B7280; }
.tier-mini { font-size:.8rem; }

/* ── History Drawer ──────────────────────────────────── */
.drawer-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:1000;
  display:flex; justify-content:flex-end; }
.drawer-panel { background:#fff; width:440px; max-width:100%; height:100%;
  display:flex; flex-direction:column; box-shadow:-6px 0 32px rgba(0,0,0,.15); }
.drawer-header { display:flex; align-items:flex-start; justify-content:space-between;
  padding:20px; border-bottom:1px solid #F3F4F6; }
.drawer-title { font-size:1rem; font-weight:700; color:#111827; }
.drawer-sub { font-size:.8rem; color:#6B7280; margin-top:2px; }
.drawer-close { width:32px; height:32px; border:1px solid #E5E7EB; border-radius:7px;
  background:#F9FAFB; cursor:pointer; font-size:.85rem; color:#6B7280; }
.drawer-kpi-row { display:flex; gap:0; border-bottom:1px solid #F3F4F6; }
.drawer-kpi { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;
  padding:14px 8px; border-right:1px solid #F3F4F6; }
.drawer-kpi:last-child { border-right:none; }
.drawer-kpi-val { font-size:1.05rem; font-weight:700; color:#7C3AED; }
.drawer-kpi-lbl { font-size:.7rem; color:#9CA3AF; }
.ledger-scroll { flex:1; overflow-y:auto; padding:8px 0; }
.ledger-loading, .ledger-empty { display:flex; align-items:center; justify-content:center;
  gap:8px; padding:40px 0; color:#9CA3AF; font-size:.85rem; }
.ledger-row { display:flex; align-items:center; gap:10px; padding:10px 20px;
  border-bottom:1px solid #F9FAFB; transition:.1s; }
.ledger-row:hover { background:#FAFAFA; }
.ledger-icon { width:28px; height:28px; border-radius:50%; display:flex;
  align-items:center; justify-content:center; font-size:.75rem; flex-shrink:0; }
.ledger-icon.earn   { background:#DCFCE7; }
.ledger-icon.redeem { background:#FEE2E2; }
.ledger-main { flex:1; }
.ledger-desc { font-size:.83rem; color:#374151; font-weight:500; }
.ledger-date { font-size:.72rem; color:#9CA3AF; margin-top:1px; }
.ledger-pts { font-size:.88rem; font-weight:700; min-width:60px; text-align:right; }
.ledger-pts.positive { color:#16A34A; }
.ledger-pts.negative { color:#DC2626; }
.ledger-bal { font-size:.75rem; color:#9CA3AF; min-width:50px; text-align:right; }

/* ── Dialog (promotions) ─────────────────────────────── */
.dialog-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex;
  align-items:center; justify-content:center; z-index:1001; padding:16px; }
.dialog-panel { background:#fff; border-radius:14px; width:100%; max-width:500px;
  box-shadow:0 20px 60px rgba(0,0,0,.2); overflow:hidden; }
.dialog-header { display:flex; align-items:center; justify-content:space-between;
  padding:18px 20px 14px; border-bottom:1px solid #F3F4F6; }
.dialog-title { font-size:1rem; font-weight:700; color:#111827; margin:0; }
.dialog-close { width:30px; height:30px; border:none; background:#F9FAFB; border-radius:6px;
  cursor:pointer; font-size:.85rem; color:#6B7280; }
.dialog-body { padding:20px; display:flex; flex-direction:column; gap:14px;
  max-height:60vh; overflow-y:auto; }
.dialog-footer { display:flex; justify-content:flex-end; gap:8px;
  padding:14px 20px; border-top:1px solid #F3F4F6; background:#FAFAFA; }
.form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.form-group { display:flex; flex-direction:column; gap:5px; }
.form-label { font-size:.78rem; font-weight:600; color:#374151; }
.form-input, .form-select, .form-textarea { padding:8px 10px; border:1px solid #E5E7EB;
  border-radius:7px; font-size:.85rem; color:#111827; background:#fff; outline:none; transition:.15s; }
.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color:#7C3AED; box-shadow:0 0 0 3px #EDE9FE; }
.form-textarea { resize:vertical; font-family:inherit; }
.tier-checks { display:flex; flex-wrap:wrap; gap:8px; }
.tier-check-item { display:flex; align-items:center; gap:6px; font-size:.82rem; cursor:pointer; }
.tier-check-item input { accent-color:#7C3AED; }
.form-error { background:#FEE2E2; color:#DC2626; border-radius:7px; padding:8px 10px; font-size:.8rem; }
.btn-cancel { padding:0 16px; height:36px; border:1px solid #E5E7EB; border-radius:7px;
  background:#fff; color:#374151; font-size:.85rem; cursor:pointer; }
.btn-submit { padding:0 20px; height:36px; background:#7C3AED; color:#fff; border:none;
  border-radius:7px; font-size:.85rem; font-weight:600; cursor:pointer; }
.btn-submit:disabled { opacity:.6; cursor:not-allowed; }
</style>
  `,
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
