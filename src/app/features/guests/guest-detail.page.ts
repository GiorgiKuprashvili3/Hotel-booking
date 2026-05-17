import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';

import {
  GUEST_SERVICE, RESERVATION_SERVICE, ROOM_SERVICE,
} from '../../data/services/service-tokens';
import { Guest, GuestPreferences, Reservation, RoomType } from '../../domain';
import { LoyaltyTier, ReservationStatus } from '../../domain/enums';

type Tab = 'overview' | 'stays' | 'preferences' | 'documents';

const TIER_META: Record<LoyaltyTier, { label: string; color: string; bg: string }> = {
  [LoyaltyTier.Bronze]:   { label: 'Bronze',   color: '#8B5A2B', bg: 'rgba(139, 90, 43, 0.12)' },
  [LoyaltyTier.Silver]:   { label: 'Silver',   color: '#7C7C7C', bg: 'rgba(124, 124, 124, 0.14)' },
  [LoyaltyTier.Gold]:     { label: 'Gold',     color: 'var(--accent)', bg: 'color-mix(in srgb, var(--accent) 18%, transparent)' },
  [LoyaltyTier.Platinum]: { label: 'Platinum', color: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 14%, transparent)' },
  [LoyaltyTier.Diamond]:  { label: 'Diamond',  color: '#00BCD4', bg: 'rgba(0, 188, 212, 0.12)' },
};

const STATUS_META: Record<ReservationStatus, { label: string; color: string; bg: string }> = {
  [ReservationStatus.Pending]:    { label: 'Pending',     color: 'var(--warning)', bg: 'var(--warning-bg)' },
  [ReservationStatus.Confirmed]:  { label: 'Confirmed',   color: 'var(--info)',    bg: 'var(--info-bg)' },
  [ReservationStatus.CheckedIn]:  { label: 'Checked-in',  color: 'var(--success)', bg: 'var(--success-bg)' },
  [ReservationStatus.CheckedOut]: { label: 'Checked-out', color: 'var(--text-muted)', bg: 'var(--surface-2)' },
  [ReservationStatus.Cancelled]:  { label: 'Cancelled',   color: 'var(--danger)',  bg: 'var(--danger-bg)' },
  [ReservationStatus.NoShow]:     { label: 'No-show',     color: 'var(--danger)',  bg: 'var(--danger-bg)' },
};

@Component({
  selector: 'lux-guest-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CurrencyPipe, RouterLink],
  templateUrl: './guest-detail.page.html',
  styleUrl: './guest-detail.page.scss',
})
export class GuestDetailPageComponent implements OnInit {
  private guestSvc   = inject(GUEST_SERVICE);
  private resSvc     = inject(RESERVATION_SERVICE);
  private roomSvc    = inject(ROOM_SERVICE);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'overview',    label: 'Overview' },
    { id: 'stays',       label: 'Stays' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'documents',   label: 'Documents' },
  ];

  loading       = signal(true);
  guest         = signal<Guest | null>(null);
  stays         = signal<Reservation[]>([]);
  roomTypes     = signal<RoomType[]>([]);

  activeTab     = signal<Tab>('overview');

  // Notes
  notesDraft    = signal('');
  savingNotes   = signal(false);

  // Tags
  newTag        = signal('');

  // Preferences
  prefDraft     = signal<GuestPreferences>({ smokingPreference: false, dietary: [] });
  savingPrefs   = signal(false);
  newDiet       = signal('');

  // Other documents (UI-only, not persisted)
  otherDocs     = signal<{ id: string; name: string; size: number; type: string; dataUrl: string; uploadedAt: Date }[]>([]);

  notesDirty = computed(() => (this.guest()?.notes ?? '') !== this.notesDraft());

  prefsDirty = computed(() => {
    const g = this.guest();
    if (!g) return false;
    return JSON.stringify(g.preferences) !== JSON.stringify(this.prefDraft());
  });

  initials = computed(() => {
    const g = this.guest();
    return g ? `${g.firstName[0] ?? ''}${g.lastName[0] ?? ''}`.toUpperCase() : '?';
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(params => {
        const id = params.get('id');
        if (!id) return of(null);
        return this.guestSvc.getById(id);
      }),
    ).subscribe(g => {
      if (!g) {
        this.guest.set(null);
        this.loading.set(false);
        return;
      }
      this.setGuest(g);
      this.loadRelated(g);
    });
  }

  private setGuest(g: Guest): void {
    this.guest.set(g);
    this.notesDraft.set(g.notes ?? '');
    this.prefDraft.set({ ...g.preferences, dietary: [...g.preferences.dietary] });
  }

  private loadRelated(g: Guest): void {
    forkJoin({
      stays: this.guestSvc.getStays(g.id),
      // Use stays' propertyId to fetch room types from one property
      // (in practice a guest may stay at multiple properties — we'd want types per-property)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ stays }) => {
      this.stays.set(stays);
      // Fetch room types for any property the guest has stayed at
      const propertyIds = [...new Set(stays.map(s => s.propertyId))];
      if (propertyIds.length === 0) {
        this.loading.set(false);
        return;
      }
      forkJoin(propertyIds.map(pid => this.roomSvc.listTypes(pid)))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(typesPerProp => {
          this.roomTypes.set(typesPerProp.flat());
          this.loading.set(false);
        });
    });
  }

  tierMeta(t: LoyaltyTier) { return TIER_META[t]; }
  statusMeta(s: ReservationStatus) { return STATUS_META[s]; }
  typeName(id: string): string { return this.roomTypes().find(t => t.id === id)?.name ?? '—'; }

  openReservation(id: string): void {
    this.router.navigate(['/app/reservations', id]);
  }

  /* ---------- VIP toggle ---------- */
  toggleVip(): void {
    const g = this.guest();
    if (!g) return;
    this.guestSvc.update(g.id, { isVip: !g.isVip })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => this.setGuest(updated));
  }

  /* ---------- Tags ---------- */
  addTag(): void {
    const tag = this.newTag().trim();
    const g = this.guest();
    if (!tag || !g) return;
    if (g.tags.includes(tag)) { this.newTag.set(''); return; }
    this.guestSvc.update(g.id, { tags: [...g.tags, tag] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => {
        this.setGuest(updated);
        this.newTag.set('');
      });
  }
  removeTag(tag: string): void {
    const g = this.guest();
    if (!g) return;
    this.guestSvc.update(g.id, { tags: g.tags.filter(t => t !== tag) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => this.setGuest(updated));
  }

  /* ---------- Notes ---------- */
  saveNotes(): void {
    const g = this.guest();
    if (!g || this.savingNotes()) return;
    this.savingNotes.set(true);
    this.guestSvc.update(g.id, { notes: this.notesDraft().trim() || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.setGuest(updated);
          this.savingNotes.set(false);
        },
        error: () => this.savingNotes.set(false),
      });
  }
  resetNotes(): void {
    this.notesDraft.set(this.guest()?.notes ?? '');
  }

  /* ---------- Preferences ---------- */
  updatePref<K extends keyof GuestPreferences>(key: K, value: GuestPreferences[K]): void {
    this.prefDraft.update(p => ({ ...p, [key]: value }));
  }
  addDiet(): void {
    const d = this.newDiet().trim();
    if (!d) return;
    this.prefDraft.update(p =>
      p.dietary.includes(d) ? p : { ...p, dietary: [...p.dietary, d] });
    this.newDiet.set('');
  }
  removeDiet(d: string): void {
    this.prefDraft.update(p => ({ ...p, dietary: p.dietary.filter(x => x !== d) }));
  }
  savePrefs(): void {
    const g = this.guest();
    if (!g || this.savingPrefs()) return;
    this.savingPrefs.set(true);
    this.guestSvc.update(g.id, { preferences: this.prefDraft() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.setGuest(updated);
          this.savingPrefs.set(false);
        },
        error: () => this.savingPrefs.set(false),
      });
  }
  resetPrefs(): void {
    const g = this.guest();
    if (!g) return;
    this.prefDraft.set({ ...g.preferences, dietary: [...g.preferences.dietary] });
  }

  /* ---------- ID Photo ---------- */
  onIdFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const g = this.guest();
      if (!g) return;
      this.guestSvc.update(g.id, { idPhotoUrl: reader.result as string })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(updated => this.setGuest(updated));
    };
    reader.readAsDataURL(file);
    input.value = '';
  }
  replaceIdPhoto(): void {
    // Trigger a fresh file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (ev) => this.onIdFile(ev);
    input.click();
  }
  removeIdPhoto(): void {
    const g = this.guest();
    if (!g) return;
    this.guestSvc.update(g.id, { idPhotoUrl: undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => this.setGuest(updated));
  }

  /* ---------- Other documents ---------- */
  onOtherFiles(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = () => {
        this.otherDocs.update(list => [{
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: f.name, size: f.size, type: f.type,
          dataUrl: reader.result as string,
          uploadedAt: new Date(),
        }, ...list]);
      };
      reader.readAsDataURL(f);
    });
    input.value = '';
  }
  removeOtherDoc(id: string): void {
    this.otherDocs.update(list => list.filter(d => d.id !== id));
  }
  formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }
}
