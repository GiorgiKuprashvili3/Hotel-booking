import {
  Component, OnInit, OnDestroy, AfterViewInit,
  inject, signal, computed, effect, DestroyRef, ElementRef, ViewChild, NgZone,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { ANALYTICS_SERVICE, RESERVATION_SERVICE, ROOM_SERVICE, AnalyticsSnapshot } from '../data/services/service-tokens';
import { PropertyContextService } from '../core/config/property-context.service';

/* ── types ─────────────────────────────────────────────────── */
type Preset = 'today' | '7d' | 'mtd' | 'ytd' | 'custom';
interface DateRange { from: Date; to: Date; }
interface RoomTypePerf { name: string; revenue: number; reservations: number; adr: number; occupancy: number; }

/* ── helpers ────────────────────────────────────────────────── */
function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfYear(d: Date): Date { return new Date(d.getFullYear(), 0, 1); }

const SOURCE_LABELS: Record<string, string> = {
  booking_com:'Booking.com', expedia:'Expedia', agoda:'Agoda', airbnb:'Airbnb',
  direct:'Direct', phone:'Phone', corporate:'Corporate', gds:'GDS', walk_in:'Walk-in',
};
const SOURCE_COLORS = ['#1A3A5C','#C9A961','#4A7C59','#4A6B8A','#C8862E','#9E3B3B','#5B7FA8','#7A6A4A','#6B8A7A'];

declare const ApexCharts: any;

@Component({
  selector: 'lux-analytics-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe, PercentPipe],
  template: `
<div class="an-page">
  <!-- ── HEADER ─────────────────────────────────────────────── -->
  <header class="an-header">
    <div class="an-title-block">
      <div class="an-icon">📊</div>
      <div>
        <h1 class="an-title">Analytics</h1>
        <p class="an-sub">{{ propertyCtx.active()?.name }} · Revenue intelligence</p>
      </div>
    </div>
    <div class="an-toolbar">
      <div class="preset-group">
        @for (p of presets; track p.id) {
          <button class="preset-btn" [class.active]="activePreset() === p.id" (click)="applyPreset(p.id)">{{ p.label }}</button>
        }
      </div>
      @if (activePreset() === 'custom') {
        <div class="custom-range">
          <input type="date" class="date-input" [ngModel]="customFrom()" (ngModelChange)="customFrom.set($event); applyCustom()" />
          <span class="date-sep">→</span>
          <input type="date" class="date-input" [ngModel]="customTo()" (ngModelChange)="customTo.set($event); applyCustom()" />
        </div>
      }
      <div class="export-group">
        <button class="btn-export" (click)="exportCsv()">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          CSV
        </button>
        <button class="btn-export btn-pdf" (click)="exportPdf()">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="9" height="11" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M5 4h5M5 7h5M5 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M11 6l3 3-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          PDF
        </button>
      </div>
    </div>
  </header>

  <!-- ── DATE RANGE LABEL ─────────────────────────────────────── -->
  <div class="range-banner">
    <span class="range-label">{{ range().from | date:'MMM d, y' }} – {{ range().to | date:'MMM d, y' }}</span>
    <span class="range-days">{{ dayCount() }} day{{ dayCount() === 1 ? '' : 's' }}</span>
  </div>

  @if (loading()) {
    <div class="skeleton-wrap">
      <div class="skel-kpi-row">@for (_ of [1,2,3,4]; track $index) { <div class="skel skel-kpi"></div> }</div>
      <div class="skel-chart-row"><div class="skel skel-chart-lg"></div><div class="skel skel-chart-sm"></div></div>
      <div class="skel-chart-row"><div class="skel skel-chart-sm"></div><div class="skel skel-chart-lg"></div></div>
    </div>
  } @else {

  <!-- ── KPI CARDS ──────────────────────────────────────────── -->
  <div class="kpi-grid">
    <div class="kpi-card kpi-primary">
      <div class="kpi-top">
        <span class="kpi-icon">🏨</span>
        <span class="kpi-delta" [class.positive]="kpis().occDelta >= 0" [class.negative]="kpis().occDelta < 0">
          {{ kpis().occDelta >= 0 ? '↑' : '↓' }} {{ (kpis().occDelta < 0 ? -kpis().occDelta : kpis().occDelta) | number:'1.1-1' }}pp
        </span>
      </div>
      <div class="kpi-value">{{ kpis().occupancy | percent:'1.1-1' }}</div>
      <div class="kpi-label">Occupancy Rate</div>
      <div class="kpi-sub">{{ kpis().occupiedRoomNights | number }} occ. room-nights</div>
    </div>
    <div class="kpi-card kpi-gold">
      <div class="kpi-top">
        <span class="kpi-icon">💰</span>
        <span class="kpi-delta kpi-delta-dark" [class.positive]="kpis().adrDelta >= 0" [class.negative]="kpis().adrDelta < 0">
          {{ kpis().adrDelta >= 0 ? '↑' : '↓' }} {{ (kpis().adrDelta < 0 ? -kpis().adrDelta : kpis().adrDelta) | number:'1.0-0' }}
        </span>
      </div>
      <div class="kpi-value">{{ propertyCtx.active()?.currency ?? '$' }} {{ kpis().adr | number:'1.0-0' }}</div>
      <div class="kpi-label">ADR</div>
      <div class="kpi-sub">Average daily rate per room</div>
    </div>
    <div class="kpi-card kpi-teal">
      <div class="kpi-top">
        <span class="kpi-icon">📈</span>
        <span class="kpi-delta" [class.positive]="kpis().revparDelta >= 0" [class.negative]="kpis().revparDelta < 0">
          {{ kpis().revparDelta >= 0 ? '↑' : '↓' }} {{ (kpis().revparDelta < 0 ? -kpis().revparDelta : kpis().revparDelta) | number:'1.0-0' }}
        </span>
      </div>
      <div class="kpi-value">{{ propertyCtx.active()?.currency ?? '$' }} {{ kpis().revpar | number:'1.0-0' }}</div>
      <div class="kpi-label">RevPAR</div>
      <div class="kpi-sub">Revenue per available room</div>
    </div>
    <div class="kpi-card kpi-dark">
      <div class="kpi-top">
        <span class="kpi-icon">🏦</span>
        <span class="kpi-delta" [class.positive]="kpis().revDelta >= 0" [class.negative]="kpis().revDelta < 0">
          {{ kpis().revDelta >= 0 ? '↑' : '↓' }} {{ (kpis().revDelta < 0 ? -kpis().revDelta : kpis().revDelta) | number:'1.0-0' }}
        </span>
      </div>
      <div class="kpi-value">{{ propertyCtx.active()?.currency ?? '$' }} {{ kpis().totalRevenue | number:'1.0-0' }}</div>
      <div class="kpi-label">Total Revenue</div>
      <div class="kpi-sub">Rooms + F&amp;B + Spa</div>
    </div>
  </div>

  <!-- ── REVENUE BREAKDOWN STRIP ───────────────────────────── -->
  <div class="rev-strip">
    <div class="rev-segment">
      <span class="rev-dot" style="background:#1A3A5C"></span>
      <span class="rev-label">Room</span>
      <span class="rev-val">{{ propertyCtx.active()?.currency ?? '$' }} {{ kpis().roomRevenue | number:'1.0-0' }}</span>
      <span class="rev-pct">{{ kpis().roomRevenue / kpis().totalRevenue | percent:'1.0-0' }}</span>
    </div>
    <div class="rev-seg-divider"></div>
    <div class="rev-segment">
      <span class="rev-dot" style="background:#C9A961"></span>
      <span class="rev-label">F&amp;B</span>
      <span class="rev-val">{{ propertyCtx.active()?.currency ?? '$' }} {{ kpis().fnbRevenue | number:'1.0-0' }}</span>
      <span class="rev-pct">{{ kpis().fnbRevenue / kpis().totalRevenue | percent:'1.0-0' }}</span>
    </div>
    <div class="rev-seg-divider"></div>
    <div class="rev-segment">
      <span class="rev-dot" style="background:#4A7C59"></span>
      <span class="rev-label">Spa</span>
      <span class="rev-val">{{ propertyCtx.active()?.currency ?? '$' }} {{ kpis().spaRevenue | number:'1.0-0' }}</span>
      <span class="rev-pct">{{ kpis().spaRevenue / kpis().totalRevenue | percent:'1.0-0' }}</span>
    </div>
    <div class="rev-seg-divider"></div>
    <div class="rev-segment">
      <span class="rev-label">Arrivals</span>
      <span class="rev-val rev-count">{{ kpis().totalArrivals }}</span>
    </div>
    <div class="rev-seg-divider"></div>
    <div class="rev-segment">
      <span class="rev-label">No-shows</span>
      <span class="rev-val rev-count rev-danger">{{ kpis().totalNoShows }}</span>
    </div>
    <div class="rev-seg-divider"></div>
    <div class="rev-segment">
      <span class="rev-label">Cancellations</span>
      <span class="rev-val rev-count rev-danger">{{ kpis().totalCancellations }}</span>
    </div>
  </div>

  <!-- ── CHARTS GRID ────────────────────────────────────────── -->
  <div class="charts-grid">

    <!-- Revenue Trend line chart -->
    <div class="chart-card chart-wide">
      <div class="chart-head">
        <div>
          <div class="chart-title">Revenue Trend</div>
          <div class="chart-sub">Daily room, F&amp;B and spa revenue</div>
        </div>
      </div>
      <div #revTrendEl class="chart-body"></div>
    </div>

    <!-- Booking Source donut -->
    <div class="chart-card">
      <div class="chart-head">
        <div>
          <div class="chart-title">Booking Source Mix</div>
          <div class="chart-sub">Reservations by channel</div>
        </div>
      </div>
      <div #sourceEl class="chart-body chart-body-sm"></div>
    </div>

    <!-- Occupancy heatmap calendar -->
    <div class="chart-card chart-wide">
      <div class="chart-head">
        <div>
          <div class="chart-title">Occupancy Heatmap</div>
          <div class="chart-sub">Colour-coded by nightly occupancy %</div>
        </div>
        <div class="heatmap-legend">
          <span class="legend-item"><span class="legend-swatch" style="background:#EEF2F7"></span>0–40%</span>
          <span class="legend-item"><span class="legend-swatch" style="background:#A8C4E0"></span>40–60%</span>
          <span class="legend-item"><span class="legend-swatch" style="background:#5B7FA8"></span>60–80%</span>
          <span class="legend-item"><span class="legend-swatch" style="background:#1A3A5C"></span>80–100%</span>
        </div>
      </div>
      <div class="heatmap-days">
        @for (d of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; track d) { <span>{{ d }}</span> }
      </div>
      <div class="heatmap-grid">
        @for (week of heatmapWeeks(); track $index) {
          <div class="heatmap-week">
            @for (cell of week; track cell.date) {
              <div class="heatmap-cell" [style.background]="cell.inRange ? occColor(cell.occ) : '#F5F5F5'"
                   [style.opacity]="cell.inRange ? 1 : 0.35"
                   [title]="cell.date + ': ' + (cell.occ * 100 | number:'1.0-0') + '% occ · $' + (cell.adr | number:'1.0-0') + ' ADR'">
                <span class="cell-day" [style.color]="cell.occ >= 0.6 ? 'white' : '#374151'">{{ cell.dayNum }}</span>
                @if (cell.inRange && cell.occ > 0) {
                  <span class="cell-pct" [style.color]="cell.occ >= 0.6 ? 'rgba(255,255,255,.8)' : '#6B7280'">
                    {{ cell.occ * 100 | number:'1.0-0' }}%
                  </span>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>

    <!-- Room-type bar chart -->
    <div class="chart-card">
      <div class="chart-head">
        <div>
          <div class="chart-title">Room-Type Performance</div>
          <div class="chart-sub">Revenue &amp; ADR by category</div>
        </div>
      </div>
      <div #roomTypeEl class="chart-body chart-body-sm"></div>
    </div>

  </div>

  <!-- ── ROOM TYPE TABLE ─────────────────────────────────────── -->
  <div class="perf-table-card">
    <div class="chart-title" style="margin-bottom:var(--space-4)">Room-Type Detail</div>
    <table class="perf-table">
      <thead>
        <tr>
          <th>Room Type</th>
          <th class="ta-r">Reservations</th>
          <th class="ta-r">Revenue</th>
          <th class="ta-r">ADR</th>
          <th class="ta-r">Occ %</th>
          <th>Rev Share</th>
        </tr>
      </thead>
      <tbody>
        @for (rt of roomTypePerf(); track rt.name) {
          <tr>
            <td class="rt-name">{{ rt.name }}</td>
            <td class="ta-r">{{ rt.reservations }}</td>
            <td class="ta-r mono">{{ propertyCtx.active()?.currency ?? '$' }} {{ rt.revenue | number:'1.0-0' }}</td>
            <td class="ta-r mono">{{ propertyCtx.active()?.currency ?? '$' }} {{ rt.adr | number:'1.0-0' }}</td>
            <td class="ta-r">
              <span class="occ-badge" [style.background]="occColor(rt.occupancy / 100)" [style.color]="rt.occupancy >= 60 ? 'white' : '#1A3A5C'">
                {{ rt.occupancy | number:'1.0-0' }}%
              </span>
            </td>
            <td>
              <div class="rev-bar-wrap">
                <div class="rev-bar-fill" [style.width.%]="rt.revenue / kpis().totalRevenue * 100"></div>
                <span class="rev-bar-pct">{{ rt.revenue / kpis().totalRevenue | percent:'1.0-0' }}</span>
              </div>
            </td>
          </tr>
        }
      </tbody>
    </table>
  </div>

  } <!-- /if !loading -->
</div>
  `,
  styles: [`
    .an-page { height:100%; display:flex; flex-direction:column; overflow-y:auto; background:var(--bg); }

    /* header */
    .an-header {
      display:flex; align-items:center; justify-content:space-between; gap:var(--space-4);
      padding:var(--space-4) var(--space-6); background:var(--surface);
      border-bottom:1px solid var(--border); flex-shrink:0; flex-wrap:wrap;
      position:sticky; top:0; z-index:10;
    }
    .an-title-block { display:flex; align-items:center; gap:var(--space-3); }
    .an-icon {
      width:40px; height:40px; border-radius:var(--radius-lg); background:#EEF0F5;
      display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;
    }
    .an-title { font-size:var(--text-xl); font-weight:700; margin:0; }
    .an-sub   { font-size:var(--text-sm); color:var(--text-muted); margin:0; }
    .an-toolbar { display:flex; align-items:center; gap:var(--space-3); flex-wrap:wrap; }

    .preset-group { display:flex; gap:3px; background:var(--surface-2); border-radius:var(--radius-lg); padding:3px; }
    .preset-btn {
      padding:5px 12px; border-radius:var(--radius-md); border:none;
      background:transparent; font-size:var(--text-sm); font-weight:500;
      color:var(--text-muted); cursor:pointer; transition:all var(--t-fast); white-space:nowrap;
    }
    .preset-btn.active { background:var(--surface); color:var(--text); font-weight:700; box-shadow:0 1px 4px rgba(0,0,0,.1); }
    .preset-btn:hover:not(.active) { color:var(--text); }

    .custom-range { display:flex; align-items:center; gap:var(--space-2); }
    .date-input { border:1px solid var(--border); border-radius:var(--radius-md); padding:5px 8px; font-size:var(--text-sm); background:var(--surface); color:var(--text); outline:none; }
    .date-sep { color:var(--text-muted); font-size:var(--text-sm); }

    .export-group { display:flex; gap:var(--space-2); }
    .btn-export {
      display:flex; align-items:center; gap:6px; padding:6px 14px;
      border-radius:var(--radius-md); border:1.5px solid var(--border);
      background:var(--surface); font-size:var(--text-sm); font-weight:600;
      color:var(--text); cursor:pointer; transition:all var(--t-fast);
    }
    .btn-export:hover { border-color:#1A3A5C; color:#1A3A5C; }
    .btn-pdf { border-color:#1A3A5C; background:#1A3A5C; color:white; }
    .btn-pdf:hover { opacity:.9; }

    /* range banner */
    .range-banner {
      display:flex; align-items:center; gap:var(--space-3);
      padding:var(--space-2) var(--space-6);
      background:color-mix(in srgb,#1A3A5C 6%,transparent);
      border-bottom:1px solid var(--border); flex-shrink:0;
    }
    .range-label { font-size:var(--text-sm); font-weight:600; color:#1A3A5C; }
    .range-days  { font-size:var(--text-xs); color:var(--text-muted); }

    /* skeleton */
    .skeleton-wrap { padding:var(--space-6); display:flex; flex-direction:column; gap:var(--space-4); }
    .skel-kpi-row  { display:grid; grid-template-columns:repeat(4,1fr); gap:var(--space-4); }
    .skel-chart-row{ display:grid; grid-template-columns:2fr 1fr; gap:var(--space-4); }
    .skel { background:var(--border); border-radius:var(--radius-xl); animation:shim 1.4s ease-in-out infinite; }
    .skel-kpi { height:120px; } .skel-chart-lg { height:280px; } .skel-chart-sm { height:280px; }
    @keyframes shim { 0%,100%{opacity:.7} 50%{opacity:.35} }

    /* KPI cards */
    .kpi-grid {
      display:grid; grid-template-columns:repeat(4,1fr);
      gap:var(--space-4); padding:var(--space-5) var(--space-6) 0;
    }
    .kpi-card {
      border-radius:var(--radius-xl); padding:var(--space-5);
      display:flex; flex-direction:column; gap:3px;
      box-shadow:0 4px 16px rgba(0,0,0,.08); overflow:hidden; position:relative;
    }
    .kpi-card::after {
      content:''; position:absolute; right:-24px; top:-24px;
      width:80px; height:80px; border-radius:50%; background:rgba(255,255,255,.1);
    }
    .kpi-primary { background:#1A3A5C; color:white; }
    .kpi-gold    { background:#C9A961; color:#1A1200; }
    .kpi-teal    { background:#4A7C59; color:white; }
    .kpi-dark    { background:#2D2D2D; color:white; }

    .kpi-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-2); }
    .kpi-icon { font-size:20px; }
    .kpi-delta {
      font-size:11px; font-weight:700; padding:2px 8px;
      border-radius:var(--radius-full); background:rgba(255,255,255,.18);
    }
    .kpi-delta-dark { background:rgba(0,0,0,.12); }
    .kpi-delta.negative { background:rgba(239,68,68,.25); }

    .kpi-value  { font-size:26px; font-weight:800; letter-spacing:-0.02em; line-height:1; }
    .kpi-label  { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; opacity:.72; margin-top:4px; }
    .kpi-sub    { font-size:11px; opacity:.55; }

    /* revenue strip */
    .rev-strip {
      display:flex; align-items:center; margin:var(--space-4) var(--space-6);
      background:var(--surface); border:1px solid var(--border);
      border-radius:var(--radius-xl); padding:var(--space-3) var(--space-2);
      box-shadow:0 1px 4px rgba(0,0,0,.04); overflow-x:auto; flex-shrink:0;
    }
    .rev-segment { display:flex; align-items:center; gap:var(--space-2); padding:0 var(--space-4); white-space:nowrap; }
    .rev-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
    .rev-label { font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
    .rev-val   { font-size:var(--text-base); font-weight:700; color:var(--text); }
    .rev-count { font-size:var(--text-xl); }
    .rev-danger{ color:var(--danger); }
    .rev-pct   { font-size:11px; color:var(--text-muted); }
    .rev-seg-divider { width:1px; height:32px; background:var(--border); flex-shrink:0; }

    /* charts grid */
    .charts-grid {
      display:grid; grid-template-columns:2fr 1fr;
      gap:var(--space-4); padding:0 var(--space-6);
    }
    .chart-card {
      background:var(--surface); border:1px solid var(--border);
      border-radius:var(--radius-xl); padding:var(--space-5);
      box-shadow:0 1px 4px rgba(0,0,0,.04); overflow:hidden;
    }
    .chart-wide { grid-column:1; }
    .chart-head { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:var(--space-4); gap:var(--space-3); flex-wrap:wrap; }
    .chart-title { font-size:var(--text-base); font-weight:700; color:var(--text); }
    .chart-sub   { font-size:var(--text-xs); color:var(--text-muted); margin-top:2px; }
    .chart-body    { min-height:260px; }
    .chart-body-sm { min-height:220px; }

    /* heatmap */
    .heatmap-legend { display:flex; gap:var(--space-3); flex-wrap:wrap; align-items:center; }
    .legend-item { display:flex; align-items:center; gap:5px; font-size:10px; color:var(--text-muted); white-space:nowrap; }
    .legend-swatch { width:12px; height:12px; border-radius:3px; border:1px solid rgba(0,0,0,.08); }
    .heatmap-days {
      display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-bottom:4px;
      font-size:10px; color:var(--text-muted); text-align:center;
      font-weight:700; text-transform:uppercase; letter-spacing:.04em;
    }
    .heatmap-grid { display:flex; flex-direction:column; gap:4px; }
    .heatmap-week { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
    .heatmap-cell {
      aspect-ratio:1.3; border-radius:6px; min-height:40px;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      cursor:default; transition:transform var(--t-fast),box-shadow var(--t-fast);
      gap:1px;
    }
    .heatmap-cell:hover { transform:scale(1.06); box-shadow:0 3px 10px rgba(0,0,0,.15); z-index:1; position:relative; }
    .cell-day { font-size:10px; font-weight:700; }
    .cell-pct { font-size:9px; font-weight:600; }

    /* room type table */
    .perf-table-card {
      margin:var(--space-4) var(--space-6) var(--space-6);
      background:var(--surface); border:1px solid var(--border);
      border-radius:var(--radius-xl); padding:var(--space-5);
      box-shadow:0 1px 4px rgba(0,0,0,.04); overflow:hidden;
    }
    .perf-table { width:100%; border-collapse:collapse; }
    .perf-table th {
      font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
      color:var(--text-muted); padding:var(--space-2) var(--space-3);
      border-bottom:2px solid var(--border); background:var(--surface-2); text-align:left;
    }
    .perf-table td { padding:var(--space-3); border-bottom:1px solid var(--border); font-size:var(--text-sm); color:var(--text); }
    .perf-table tr:last-child td { border-bottom:none; }
    .perf-table tr:hover td { background:var(--surface-2); }
    .ta-r { text-align:right; }
    .rt-name { font-weight:600; }
    .mono { font-family:var(--font-mono,monospace); }
    .occ-badge { display:inline-block; padding:2px 8px; border-radius:var(--radius-full); font-size:11px; font-weight:700; }
    .rev-bar-wrap { display:flex; align-items:center; gap:var(--space-2); min-width:120px; }
    .rev-bar-fill { height:6px; border-radius:3px; background:#1A3A5C; min-width:4px; transition:width .4s ease; }
    .rev-bar-pct  { font-size:11px; color:var(--text-muted); white-space:nowrap; }

    /* responsive */
    @media (max-width:1100px) {
      .kpi-grid { grid-template-columns:repeat(2,1fr); }
      .charts-grid { grid-template-columns:1fr; }
      .chart-wide { grid-column:auto; }
    }
    @media (max-width:640px) {
      .kpi-grid { grid-template-columns:1fr 1fr; padding-inline:var(--space-4); }
      .charts-grid { padding-inline:var(--space-4); }
      .rev-strip, .perf-table-card { margin-inline:var(--space-4); }
    }
    @media print {
      .an-page { overflow:visible; height:auto; }
      .an-header { position:static; }
      .an-toolbar, .export-group { display:none; }
      .charts-grid { grid-template-columns:1fr 1fr; }
    }
  `],
})
export class AnalyticsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private analyticsSvc  = inject(ANALYTICS_SERVICE);
  private reservationSvc = inject(RESERVATION_SERVICE);
  private roomSvc       = inject(ROOM_SERVICE);
  readonly propertyCtx  = inject(PropertyContextService);
  private zone          = inject(NgZone);
  private destroyRef    = inject(DestroyRef);

  @ViewChild('revTrendEl', { static: false }) revTrendEl!: ElementRef;
  @ViewChild('sourceEl',   { static: false }) sourceEl!: ElementRef;
  @ViewChild('roomTypeEl', { static: false }) roomTypeEl!: ElementRef;



  loading      = signal(true);
  activePreset = signal<Preset>('mtd');
  snapshots    = signal<AnalyticsSnapshot[]>([]);
  allRes       = signal<any[]>([]);
  roomTypes    = signal<any[]>([]);

  // FIX: customFrom/customTo must be signals so range() reacts when the user
  // changes the date inputs. Plain string properties are invisible to computed().
  customFrom = signal(isoDate(startOfMonth(new Date())));
  customTo   = signal(isoDate(new Date()));

  private charts: any[] = [];

  constructor() {
    // FIX: Use effect() so charts re-render whenever range() changes.
    // effect() runs after the full signal graph has settled, so filteredSnaps(),
    // sourceBreakdown(), and roomTypePerf() already hold the new values.
    // Read the computed data BEFORE going outside the zone.
    effect(() => {
      if (this.loading()) return; // wait for data
      // Reading these inside the effect tracks them as dependencies AND
      // captures their current values while still inside Angular's zone.
      const snaps  = this.filteredSnaps();
      const source = this.sourceBreakdown();
      const perf   = this.roomTypePerf();
      setTimeout(() => this.reinitChartsWithData(snaps, source, perf), 0);
    });
  }

  readonly presets = [
    { id: 'today' as Preset, label: 'Today'  },
    { id: '7d'    as Preset, label: 'Last 7d' },
    { id: 'mtd'   as Preset, label: 'MTD'    },
    { id: 'ytd'   as Preset, label: 'YTD'    },
    { id: 'custom' as Preset, label: 'Custom' },
  ];

  // FIX: range() now reads customFrom() and customTo() as signals,
  // so computed() properly invalidates when custom dates change.
  range = computed<DateRange>(() => {
    const today = startOfDay(new Date());
    switch (this.activePreset()) {
      case 'today':  return { from: today, to: today };
      case '7d':     return { from: addDays(today, -6), to: today };
      case 'mtd':    return { from: startOfMonth(today), to: today };
      case 'ytd':    return { from: startOfYear(today), to: today };
      default: {
        const f = this.customFrom() ? startOfDay(new Date(this.customFrom())) : startOfMonth(today);
        const t = this.customTo()   ? startOfDay(new Date(this.customTo()))   : today;
        return { from: f, to: t };
      }
    }
  });

  dayCount = computed(() => {
    const r = this.range();
    return Math.max(1, Math.round((r.to.getTime() - r.from.getTime()) / 86400000) + 1);
  });

  private filteredSnaps = computed(() => {
    const { from, to } = this.range();
    const f = isoDate(from), t = isoDate(to);
    return this.snapshots().filter(s => s.date >= f && s.date <= t);
  });

  private prevSnaps = computed(() => {
    const { from, to } = this.range();
    const days = this.dayCount();
    const pf = isoDate(addDays(from, -days)), pt = isoDate(addDays(to, -days));
    return this.snapshots().filter(s => s.date >= pf && s.date <= pt);
  });

  private avg = (arr: AnalyticsSnapshot[], k: keyof AnalyticsSnapshot) =>
    arr.length ? arr.reduce((s, x) => s + (x[k] as number), 0) / arr.length : 0;
  private sum = (arr: AnalyticsSnapshot[], k: keyof AnalyticsSnapshot) =>
    arr.reduce((s, x) => s + (x[k] as number), 0);

  kpis = computed(() => {
    const c = this.filteredSnaps(), p = this.prevSnaps();
    const occupancy    = this.avg(c, 'occupancyRate');
    const adr          = this.avg(c, 'adr');
    const revpar       = this.avg(c, 'revpar');
    const totalRevenue = this.sum(c, 'totalRevenue');
    return {
      occupancy, adr, revpar, totalRevenue,
      roomRevenue:      this.sum(c, 'roomRevenue'),
      fnbRevenue:       this.sum(c, 'fnbRevenue'),
      spaRevenue:       this.sum(c, 'spaRevenue'),
      totalArrivals:    this.sum(c, 'arrivals'),
      totalNoShows:     this.sum(c, 'noShows'),
      totalCancellations: this.sum(c, 'cancellations'),
      occupiedRoomNights: this.sum(c, 'occupiedRooms'),
      occDelta:    (occupancy - this.avg(p, 'occupancyRate')) * 100,
      adrDelta:    adr    - this.avg(p, 'adr'),
      revparDelta: revpar - this.avg(p, 'revpar'),
      revDelta:    totalRevenue - this.sum(p, 'totalRevenue'),
    };
  });

  heatmapWeeks = computed(() => {
    const { from, to } = this.range();
    const snapMap = new Map(this.snapshots().map(s => [s.date, s]));
    const startMon = new Date(from);
    const dow = startMon.getDay();
    startMon.setDate(startMon.getDate() - (dow === 0 ? 6 : dow - 1));

    const weeks: { date:string; dayNum:number; occ:number; adr:number; inRange:boolean }[][] = [];
    let cur = new Date(startMon);
    while (cur <= addDays(to, 7) && weeks.length < 18) {
      const week: typeof weeks[0] = [];
      for (let d = 0; d < 7; d++) {
        const ds = isoDate(cur), snap = snapMap.get(ds);
        week.push({ date: ds, dayNum: cur.getDate(), occ: snap?.occupancyRate ?? 0, adr: snap?.adr ?? 0, inRange: cur >= from && cur <= to });
        cur = addDays(cur, 1);
      }
      weeks.push(week);
    }
    return weeks;
  });

  roomTypePerf = computed<RoomTypePerf[]>(() => {
    const { from, to } = this.range();
    const rts = this.roomTypes();
    const res = this.allRes().filter(r => { const ci = new Date(r.checkIn); return ci >= from && ci <= to; });
    const days = this.dayCount();
    return rts.map(rt => {
      const rtRes = res.filter((r: any) => r.roomTypeId === rt.id);
      const revenue = rtRes.reduce((s: number, r: any) => s + (r.totalRoomCharge ?? 0), 0);
      const totalNights = rtRes.reduce((s: number, r: any) => s + (r.nights ?? 1), 0);
      const approxRooms = Math.max(1, Math.round((this.filteredSnaps()[0]?.totalRooms ?? 80) / Math.max(rts.length, 1)));
      return {
        name: rt.name, revenue, reservations: rtRes.length,
        adr: rtRes.length ? revenue / rtRes.length : 0,
        occupancy: Math.min(100, days * approxRooms > 0 ? (totalNights / (days * approxRooms)) * 100 : 0),
      };
    }).filter(r => r.reservations > 0).sort((a, b) => b.revenue - a.revenue);
  });

  private sourceBreakdown = computed(() => {
    const { from, to } = this.range();
    const res = this.allRes().filter(r => { const ci = new Date(r.checkIn); return ci >= from && ci <= to; });
    const counts: Record<string, number> = {};
    res.forEach((r: any) => { const s = r.source ?? 'direct'; counts[s] = (counts[s] ?? 0) + 1; });
    return Object.entries(counts)
      .map(([source, count]) => ({ source, count, label: SOURCE_LABELS[source] ?? source }))
      .sort((a, b) => b.count - a.count);
  });

  ngOnInit(): void {
    const propId = this.propertyCtx.activeId();
    if (!propId) return;
    forkJoin([
      this.analyticsSvc.listSnapshots(propId),
      this.reservationSvc.list(propId),
      this.roomSvc.listTypes(propId),
    ]).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([snaps, res, rts]) => {
        this.snapshots.set(snaps as AnalyticsSnapshot[]);
        this.allRes.set(res as any[]);
        this.roomTypes.set(rts as any[]);
        // FIX: setting loading to false triggers the effect() which handles
        // the initial chart render — no need for a separate setTimeout here.
        this.loading.set(false);
      });
  }

  ngAfterViewInit(): void { /* charts init after data */ }
  ngOnDestroy(): void { this.destroyCharts(); }

  applyPreset(p: Preset): void {
    this.activePreset.set(p);
    // Chart re-render is handled reactively by the effect() in the constructor.
  }
  applyCustom(): void {
    this.activePreset.set('custom');
    // Chart re-render is handled reactively by the effect() in the constructor.
  }

  occColor(occ: number): string {
    if (occ <= 0)  return '#EEF2F7';
    if (occ < 0.4) return '#D0DFF0';
    if (occ < 0.6) return '#A8C4E0';
    if (occ < 0.8) return '#5B7FA8';
    return '#1A3A5C';
  }

  exportCsv(): void {
    const snaps = this.filteredSnaps();
    if (!snaps.length) return;
    const header = ['date','occupancyRate','adr','revpar','totalRevenue','roomRevenue','fnbRevenue','spaRevenue','arrivals','departures','noShows','cancellations'];
    const csv = [header.join(','), ...snaps.map(s => header.map(k => (s as any)[k]).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `analytics-${isoDate(this.range().from)}-${isoDate(this.range().to)}.csv`;
    a.click();
  }

  exportPdf(): void { window.print(); }

  private destroyCharts(): void {
    this.charts.forEach(c => { try { c.destroy(); } catch { /**/ } });
    this.charts = [];
  }
  private reinitChartsWithData(snaps: AnalyticsSnapshot[], source: ReturnType<typeof this.sourceBreakdown>, perf: RoomTypePerf[]): void {
    this.destroyCharts();
    if (typeof ApexCharts === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      this.initRevTrend(snaps);
      this.initSourcePie(source);
      this.initRoomTypeBar(perf);
    });
  }

  // Keep for any legacy callers but route through the data-passing version
  private reinitCharts(): void {
    const snaps  = this.filteredSnaps();
    const source = this.sourceBreakdown();
    const perf   = this.roomTypePerf();
    this.reinitChartsWithData(snaps, source, perf);
  }

  /** @deprecated use reinitChartsWithData */
  private initCharts(): void { this.reinitCharts(); }

  private initRevTrend(snaps: AnalyticsSnapshot[]): void {
    const el = this.revTrendEl?.nativeElement;
    if (!el) return;
    const chart = new ApexCharts(el, {
      chart: { type:'area', height:260, toolbar:{show:false}, fontFamily:'Inter,system-ui,sans-serif', background:'transparent', animations:{enabled:true,speed:500}, zoom:{enabled:false} },
      series: [
        { name:'Room Revenue', data: snaps.map(s => s.roomRevenue) },
        { name:'F&B Revenue',  data: snaps.map(s => s.fnbRevenue)  },
        { name:'Spa Revenue',  data: snaps.map(s => s.spaRevenue)  },
      ],
      xaxis: {
        categories: snaps.map(s => s.date),
        tickAmount: Math.min(snaps.length, 14),
        labels: { rotate:-30, style:{fontSize:'10px',colors:'#6B7280'}, formatter:(v:string) => v?.slice(5) ?? '' },
        axisBorder:{show:false}, axisTicks:{show:false},
      },
      yaxis: { labels:{style:{fontSize:'10px',colors:'#6B7280'}, formatter:(v:number) => `$${(v/1000).toFixed(0)}k`} },
      colors: ['#1A3A5C','#C9A961','#4A7C59'],
      fill: { type:'gradient', gradient:{shadeIntensity:1,opacityFrom:.35,opacityTo:.02,stops:[0,90]} },
      stroke: { curve:'smooth', width:2.5 },
      dataLabels: { enabled:false },
      tooltip: { theme:'light', y:{formatter:(v:number) => `$${v.toLocaleString()}`} },
      legend: { position:'top', fontSize:'12px', fontWeight:600, labels:{colors:'#374151'} },
      grid: { borderColor:'#E5E7EB', strokeDashArray:4, padding:{left:8,right:8} },
    });
    chart.render();
    this.charts.push(chart);
  }

  private initSourcePie(data: ReturnType<typeof this.sourceBreakdown>): void {
    const el = this.sourceEl?.nativeElement;
    if (!el) return;
    if (!data.length) return;
    const chart = new ApexCharts(el, {
      chart: { type:'donut', height:220, fontFamily:'Inter,system-ui,sans-serif', background:'transparent', animations:{enabled:true,speed:500} },
      series: data.map(d => d.count),
      labels:  data.map(d => d.label),
      colors:  SOURCE_COLORS.slice(0, data.length),
      legend: {
        position:'bottom', fontSize:'11px', fontWeight:600, labels:{colors:'#374151'},
        itemMargin:{horizontal:6,vertical:3},
        formatter:(name:string, opts:any) => `${name} (${opts.w.globals.series[opts.seriesIndex]})`,
      },
      dataLabels: { enabled:false },
      plotOptions: { pie:{ donut:{ size:'62%', labels:{ show:true, total:{ show:true, label:'Total Reservations', style:{fontSize:'11px'} } } } } },
      tooltip: { y:{formatter:(v:number) => `${v} reservations`} },
      stroke: { width:2, colors:['#fff'] },
    });
    chart.render();
    this.charts.push(chart);
  }

  private initRoomTypeBar(perf: RoomTypePerf[]): void {
    const el = this.roomTypeEl?.nativeElement;
    if (!el) return;
    if (!perf.length) return;
    const chart = new ApexCharts(el, {
      chart: { type:'bar', height:220, toolbar:{show:false}, fontFamily:'Inter,system-ui,sans-serif', background:'transparent', animations:{enabled:true,speed:500} },
      series: [
        { name:'Revenue',     data: perf.map(p => p.revenue)              },
        { name:'ADR (×10)',   data: perf.map(p => Math.round(p.adr * 10)) },
      ],
      xaxis: {
        categories: perf.map(p => p.name),
        labels:{style:{fontSize:'11px',colors:'#6B7280'}},
        axisBorder:{show:false}, axisTicks:{show:false},
      },
      yaxis: { labels:{style:{fontSize:'10px',colors:'#6B7280'}, formatter:(v:number) => `$${(v/1000).toFixed(0)}k`} },
      colors: ['#1A3A5C','#C9A961'],
      plotOptions: { bar:{ borderRadius:5, columnWidth:'55%' } },
      dataLabels: { enabled:false },
      tooltip: { theme:'light', y:{ formatter:(v:number,{seriesIndex}:any) => seriesIndex===0 ? `$${v.toLocaleString()}` : `$${(v/10).toFixed(0)} ADR` } },
      legend: { position:'top', fontSize:'11px', fontWeight:600, labels:{colors:'#374151'} },
      grid: { borderColor:'#E5E7EB', strokeDashArray:4, padding:{left:4,right:4} },
    });
    chart.render();
    this.charts.push(chart);
  }
}
