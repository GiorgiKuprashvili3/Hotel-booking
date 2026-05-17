import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import {
  SETTINGS_SERVICE, RATE_PLAN_SERVICE, ROOM_SERVICE, PROPERTY_SERVICE,
} from '../../data/services/service-tokens';
import { PropertyContextService } from '../../core/config/property-context.service';
import { Property, RatePlan, RoomType, PropertySettings } from '../../domain';

type Tab = 'property' | 'tax' | 'roomtypes' | 'rateplans';

@Component({
  selector: 'lux-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './settings.page.html',
})
export class SettingsPageComponent implements OnInit {
  private settingsSvc  = inject(SETTINGS_SERVICE);
  private ratePlanSvc  = inject(RATE_PLAN_SERVICE);
  private roomSvc      = inject(ROOM_SERVICE);
  private propertySvc  = inject(PROPERTY_SERVICE);
  readonly propertyCtx = inject(PropertyContextService);
  private destroyRef   = inject(DestroyRef);

  tab     = signal<Tab>('property');
  loading = signal(true);
  saving  = signal(false);
  savedMsg = signal('');

  settings  = signal<PropertySettings | null>(null);
  property  = signal<Property | null>(null);
  roomTypes = signal<RoomType[]>([]);
  ratePlans = signal<RatePlan[]>([]);

  activePlans = computed(() => this.ratePlans().filter(p => p.isActive));

  planDialogOpen = signal(false);
  editingPlan    = signal<RatePlan | null>(null);
  planSaving     = signal(false);
  planError      = signal('');

  planForm = {
    name: '', code: '', description: '', cancellationHours: 24, depositPct: 0,
    isRefundable: true, isActive: true,
  };

  readonly taxRules = [
    { label: 'Room Revenue',   desc: 'All room and accommodation charges',     pct: '18%', type: 'standard' },
    { label: 'F&B Revenue',    desc: 'Food and beverage services',             pct: '18%', type: 'standard' },
    { label: 'Spa Services',   desc: 'Spa, wellness, and beauty services',     pct: '18%', type: 'standard' },
    { label: 'Parking',        desc: 'Valet and self-parking charges',         pct: '10%', type: 'reduced'  },
    { label: 'City Tax',       desc: 'Municipal tourism levy (per person/night)', pct: '₾5 flat', type: 'standard' },
    { label: 'Tour Packages',  desc: 'Excursion and guided tour packages',     pct: '0%',  type: 'exempt'   },
  ];

  ngOnInit() {
    const pid = this.propertyCtx.active()?.id ?? '';
    forkJoin({
      settings:  this.settingsSvc.get(),
      property:  this.propertySvc.getById(pid),
      roomTypes: this.roomSvc.listTypes(pid),
      ratePlans: this.ratePlanSvc.list(),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ settings, property, roomTypes, ratePlans }) => {
        this.settings.set(settings);
        this.property.set(property ?? null);
        this.roomTypes.set(roomTypes);
        this.ratePlans.set(ratePlans);
        this.loading.set(false);
      });
  }

  patchProp(key: string, value: unknown) {
    this.property.update(p => p ? { ...p, [key]: value } : p);
  }

  toggleNotif(key: keyof PropertySettings['notifications']) {
    this.settings.update(s => s ? {
      ...s,
      notifications: { ...s.notifications, [key]: !s.notifications[key] },
    } : s);
  }

  updateThreshold(val: number) {
    this.settings.update(s => s ? {
      ...s, notifications: { ...s.notifications, lowOccupancyThreshold: val },
    } : s);
  }

  saveSettings() {
    const s = this.settings();
    if (!s) return;
    this.saving.set(true);
    this.settingsSvc.update(s)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.settings.set(updated);
          this.saving.set(false);
          this.savedMsg.set('✓ Saved successfully');
          setTimeout(() => this.savedMsg.set(''), 3000);
        },
        error: () => { this.saving.set(false); },
      });
  }

  /* ── Rate plans ──────────────────────────────────────── */
  openPlanDialog(plan: RatePlan | null) {
    this.editingPlan.set(plan);
    if (plan) {
      this.planForm = {
        name: plan.name, code: plan.code, description: plan.description ?? '',
        cancellationHours: plan.cancellationHours, depositPct: plan.depositPct,
        isRefundable: plan.isRefundable, isActive: plan.isActive,
      };
    } else {
      this.planForm = { name:'', code:'', description:'', cancellationHours:24, depositPct:0, isRefundable:true, isActive:true };
    }
    this.planError.set('');
    this.planDialogOpen.set(true);
  }

  closePlanDialog() { if (!this.planSaving()) this.planDialogOpen.set(false); }

  submitPlan() {
    if (!this.planForm.name.trim() || !this.planForm.code.trim()) {
      this.planError.set('Name and code are required.');
      return;
    }
    this.planSaving.set(true);
    const editing = this.editingPlan();
    const payload = { ...this.planForm, code: this.planForm.code.toUpperCase() };

    const op$ = editing
      ? this.ratePlanSvc.update(editing.id, payload)
      : this.ratePlanSvc.create(payload);

    op$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: plan => {
        if (editing) {
          this.ratePlans.update(list => list.map(p => p.id === plan.id ? plan : p));
        } else {
          this.ratePlans.update(list => [...list, plan]);
        }
        this.planSaving.set(false);
        this.planDialogOpen.set(false);
      },
      error: () => { this.planSaving.set(false); this.planError.set('Failed to save rate plan.'); },
    });
  }

  deactivatePlan(plan: RatePlan) {
    this.ratePlanSvc.deactivate(plan.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => {
        this.ratePlans.update(list => list.map(p => p.id === updated.id ? updated : p));
      });
  }
}
