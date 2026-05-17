import {
  Component, OnInit, OnDestroy, AfterViewInit,
  inject, signal, computed, effect, DestroyRef, ElementRef, ViewChild, NgZone,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { ANALYTICS_SERVICE, RESERVATION_SERVICE, ROOM_SERVICE, AnalyticsSnapshot } from '../../data/services/service-tokens';
import { PropertyContextService } from '../../core/config/property-context.service';

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
  templateUrl: './analytics.page.html',
  styleUrl: './analytics.page.scss',
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
