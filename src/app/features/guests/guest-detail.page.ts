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
  template: `
<div class="detail-page">

  @if (loading()) {
    <div class="loading">Loading guest…</div>
  } @else if (!guest()) {
    <div class="loading">Guest not found. <a routerLink="/app/guests">Back to list</a></div>
  } @else {

    <!-- Breadcrumb -->
    <nav class="crumbs">
      <a routerLink="/app/guests" class="crumb">Guests</a>
      <span class="crumb-sep">/</span>
      <span class="crumb crumb--current">{{ guest()!.firstName }} {{ guest()!.lastName }}</span>
    </nav>

    <!-- Profile header -->
    <header class="profile-head">
      <div class="profile-avatar">{{ initials() }}</div>
      <div class="profile-meta">
        <div class="profile-name-row">
          <h1 class="profile-name">{{ guest()!.firstName }} {{ guest()!.lastName }}</h1>
          <button
            class="vip-toggle"
            [class.is-vip]="guest()!.isVip"
            (click)="toggleVip()"
            [title]="guest()!.isVip ? 'Remove VIP status' : 'Mark as VIP'">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 1l1.85 3.75L13 5.4l-3 2.92L10.7 13 7 11l-3.7 2L4 8.32 1 5.4l4.15-.65L7 1z"/>
            </svg>
            {{ guest()!.isVip ? 'VIP' : 'Mark VIP' }}
          </button>
          @if (guest()!.loyaltyTier) {
            <span class="tier-pill"
                  [style.color]="tierMeta(guest()!.loyaltyTier!).color"
                  [style.background]="tierMeta(guest()!.loyaltyTier!).bg">
              {{ tierMeta(guest()!.loyaltyTier!).label }} · {{ guest()!.loyaltyPoints }} pts
            </span>
          }
        </div>
        <div class="profile-contact">
          <span><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 3.5l5 3.5 5-3.5M1.5 3.5h10v6h-10v-6z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg> {{ guest()!.email }}</span>
          <span class="dot">·</span>
          <span><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 1.5h2l1 3-1.5 1a8 8 0 003.5 3.5l1-1.5 3 1V11a1 1 0 01-1 1A9.5 9.5 0 011.5 2.5 1 1 0 012 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg> {{ guest()!.phone }}</span>
          <span class="dot">·</span>
          <span>{{ guest()!.nationality }}</span>
        </div>
        <div class="profile-stats">
          <div class="stat-tile">
            <span class="stat-val">{{ guest()!.totalStays }}</span>
            <span class="stat-lbl">Total stays</span>
          </div>
          <div class="stat-tile">
            <span class="stat-val">{{ guest()!.totalSpent | currency:'GEL':'symbol-narrow':'1.0-0' }}</span>
            <span class="stat-lbl">Total spent</span>
          </div>
          <div class="stat-tile">
            <span class="stat-val">
              {{ guest()!.lastStayDate ? (guest()!.lastStayDate | date:'MMM y') : '—' }}
            </span>
            <span class="stat-lbl">Last stay</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Tabs -->
    <div class="tabs">
      @for (t of tabs; track t.id) {
        <button
          class="tab"
          [class.active]="activeTab() === t.id"
          (click)="activeTab.set(t.id)">
          {{ t.label }}
          @if (t.id === 'stays' && stays().length > 0) {
            <span class="tab-badge">{{ stays().length }}</span>
          }
        </button>
      }
    </div>

    <div class="tab-content">

      @if (activeTab() === 'overview') {
        <div class="grid-2">

          <section class="card">
            <h3 class="card-title">Identity</h3>
            <dl class="info-list">
              <div class="info-row">
                <dt>Document</dt>
                <dd class="capitalize">{{ guest()!.idType | titlecase }}</dd>
              </div>
              <div class="info-row">
                <dt>Number</dt>
                <dd class="mono">{{ guest()!.idNumber || '—' }}</dd>
              </div>
              <div class="info-row">
                <dt>Date of birth</dt>
                <dd>{{ guest()!.dateOfBirth ? (guest()!.dateOfBirth | date:'MMM d, y') : '—' }}</dd>
              </div>
              <div class="info-row">
                <dt>Address</dt>
                <dd>{{ guest()!.address || '—' }}</dd>
              </div>
              <div class="info-row">
                <dt>Guest since</dt>
                <dd>{{ guest()!.createdAt | date:'MMM y' }}</dd>
              </div>
            </dl>
          </section>

          <section class="card">
            <h3 class="card-title">Tags</h3>
            <div class="tag-row">
              @for (tag of guest()!.tags; track tag) {
                <span class="g-tag">
                  {{ tag }}
                  <button class="g-tag__del" (click)="removeTag(tag)" aria-label="Remove tag">
                    <svg width="9" height="9" viewBox="0 0 9 9"><path d="M2 2l5 5M7 2l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                  </button>
                </span>
              }
              @if (!guest()!.tags.length) {
                <span class="muted">No tags yet.</span>
              }
            </div>
            <div class="add-tag-row">
              <input
                class="field-input"
                type="text"
                placeholder="Add a tag (e.g. 'Repeat guest')"
                [ngModel]="newTag()"
                (ngModelChange)="newTag.set($event)"
                (keyup.enter)="addTag()" />
              <button class="btn-primary" (click)="addTag()" [disabled]="!newTag().trim()">Add</button>
            </div>
          </section>

          <section class="card card--span">
            <h3 class="card-title">Notes</h3>
            <p class="card-help">
              Visible to all staff. Use for anything worth remembering across stays.
            </p>
            <textarea
              class="notes-area"
              rows="5"
              placeholder="e.g. 'Allergic to feathers. Always requests room facing the garden. Anniversary on Sept 14 — partner is Maya.'"
              [ngModel]="notesDraft()"
              (ngModelChange)="notesDraft.set($event)"></textarea>
            <div class="notes-actions">
              <button class="btn-secondary" (click)="resetNotes()" [disabled]="!notesDirty() || savingNotes()">
                Discard
              </button>
              <button class="btn-primary" (click)="saveNotes()" [disabled]="!notesDirty() || savingNotes()">
                @if (savingNotes()) { Saving… } @else { Save notes }
              </button>
            </div>
          </section>
        </div>
      }

      @if (activeTab() === 'stays') {
        <section class="card">
          <h3 class="card-title">Stay history</h3>
          @if (!stays().length) {
            <div class="empty-card">
              <p>No stays on record for this guest.</p>
            </div>
          } @else {
            <table class="stays-table">
              <thead>
                <tr>
                  <th>Confirmation</th>
                  <th>Dates</th>
                  <th class="num-col">Nights</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th class="num-col">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (r of stays(); track r.id) {
                  <tr class="row" (click)="openReservation(r.id)">
                    <td class="mono">{{ r.confirmationNumber }}</td>
                    <td class="dates-cell">
                      <span>{{ r.checkIn | date:'MMM d' }}</span>
                      <span class="arrow">→</span>
                      <span>{{ r.checkOut | date:'MMM d, y' }}</span>
                    </td>
                    <td class="num-col">{{ r.nights }}</td>
                    <td>{{ typeName(r.roomTypeId) }}</td>
                    <td>
                      <span class="status-pill"
                            [style.color]="statusMeta(r.status).color"
                            [style.background]="statusMeta(r.status).bg">
                        {{ statusMeta(r.status).label }}
                      </span>
                    </td>
                    <td class="num-col">{{ r.totalAmount | currency:'GEL':'symbol-narrow':'1.0-0' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      }

      @if (activeTab() === 'preferences') {
        <section class="card">
          <h3 class="card-title">Preferences</h3>
          <p class="card-help">
            Used as defaults during booking, room assignment, and turndown service.
          </p>

          <div class="pref-grid">
            <label class="pref-field">
              <span class="pref-lbl">Preferred room type</span>
              <select class="field-input"
                      [ngModel]="prefDraft().preferredRoomType ?? ''"
                      (ngModelChange)="updatePref('preferredRoomType', $event || undefined)">
                <option value="">No preference</option>
                <option value="standard">Standard</option>
                <option value="deluxe">Deluxe</option>
                <option value="suite">Suite</option>
              </select>
            </label>

            <label class="pref-field">
              <span class="pref-lbl">Preferred floor</span>
              <select class="field-input"
                      [ngModel]="prefDraft().preferredFloor ?? ''"
                      (ngModelChange)="updatePref('preferredFloor', $event || undefined)">
                <option value="">No preference</option>
                <option value="low">Low</option>
                <option value="mid">Mid</option>
                <option value="high">High</option>
              </select>
            </label>

            <label class="pref-field">
              <span class="pref-lbl">Preferred bed</span>
              <select class="field-input"
                      [ngModel]="prefDraft().preferredBed ?? ''"
                      (ngModelChange)="updatePref('preferredBed', $event || undefined)">
                <option value="">No preference</option>
                <option value="king">King</option>
                <option value="queen">Queen</option>
                <option value="twin">Twin</option>
              </select>
            </label>

            <label class="pref-field">
              <span class="pref-lbl">Wake-up call</span>
              <input class="field-input"
                     type="time"
                     [ngModel]="prefDraft().wakeUpCall ?? ''"
                     (ngModelChange)="updatePref('wakeUpCall', $event || undefined)" />
            </label>

            <label class="pref-field">
              <span class="pref-lbl">Newspaper</span>
              <input class="field-input"
                     type="text"
                     placeholder="e.g. 'Financial Times'"
                     [ngModel]="prefDraft().newspaper ?? ''"
                     (ngModelChange)="updatePref('newspaper', $event || undefined)" />
            </label>

            <label class="pref-field pref-field--toggle">
              <span class="pref-lbl">Smoking</span>
              <span class="toggle">
                <input type="checkbox"
                       [ngModel]="prefDraft().smokingPreference"
                       (ngModelChange)="updatePref('smokingPreference', $event)" />
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
                <span class="toggle-text">
                  {{ prefDraft().smokingPreference ? 'Smoking room' : 'Non-smoking' }}
                </span>
              </span>
            </label>
          </div>

          <div class="pref-section">
            <span class="pref-lbl">Dietary restrictions</span>
            <div class="diet-row">
              @for (d of prefDraft().dietary; track d) {
                <span class="diet-chip">
                  {{ d }}
                  <button class="diet-del" (click)="removeDiet(d)">
                    <svg width="9" height="9" viewBox="0 0 9 9"><path d="M2 2l5 5M7 2l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                  </button>
                </span>
              }
              <input
                class="diet-input"
                type="text"
                placeholder="+ add (e.g. vegetarian)"
                [ngModel]="newDiet()"
                (ngModelChange)="newDiet.set($event)"
                (keyup.enter)="addDiet()" />
            </div>
          </div>

          <div class="notes-actions">
            <button class="btn-secondary" (click)="resetPrefs()" [disabled]="!prefsDirty() || savingPrefs()">
              Discard
            </button>
            <button class="btn-primary" (click)="savePrefs()" [disabled]="!prefsDirty() || savingPrefs()">
              @if (savingPrefs()) { Saving… } @else { Save preferences }
            </button>
          </div>
        </section>
      }

      @if (activeTab() === 'documents') {
        <section class="card">
          <h3 class="card-title">ID document</h3>
          <p class="card-help">
            Upload a photo or scan of the guest's ID. Files are previewed in-browser only — they aren't actually persisted in this demo.
          </p>

          @if (guest()!.idPhotoUrl) {
            <div class="id-preview">
              <img [src]="guest()!.idPhotoUrl!" alt="ID document" />
              <div class="id-overlay">
                <button class="btn-overlay" (click)="replaceIdPhoto()">Replace</button>
                <button class="btn-overlay btn-overlay--danger" (click)="removeIdPhoto()">Remove</button>
              </div>
            </div>
          } @else {
            <label class="upload-zone">
              <input
                type="file"
                accept="image/*"
                hidden
                #idFile
                (change)="onIdFile($event)" />
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <rect x="4" y="8" width="28" height="20" rx="2" stroke="currentColor" stroke-width="1.8"/>
                <circle cx="13" cy="16" r="3" stroke="currentColor" stroke-width="1.8"/>
                <path d="M21 14h7M21 18h5M21 22h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
              <span class="upload-text">Click to upload ID photo</span>
              <span class="upload-hint">{{ guest()!.idType | titlecase }} · No actual storage</span>
            </label>
          }
        </section>

        <section class="card">
          <h3 class="card-title">Other documents</h3>
          <p class="card-help">Additional files associated with this guest (visa, custom forms, etc).</p>

          <label class="upload-zone">
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              hidden
              (change)="onOtherFiles($event)" />
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 19V7m0 0l-4 4m4-4l4 4M5 19v2a1 1 0 001 1h16a1 1 0 001-1v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="upload-text">Click to upload or drag files</span>
            <span class="upload-hint">Images or PDFs</span>
          </label>

          @if (otherDocs().length > 0) {
            <div class="docs-grid">
              @for (d of otherDocs(); track d.id) {
                <div class="doc-tile">
                  <div class="doc-preview">
                    @if (d.type.startsWith('image/')) {
                      <img [src]="d.dataUrl" [alt]="d.name" />
                    } @else {
                      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                        <path d="M10 4h16l8 8v24a4 4 0 01-4 4H10a4 4 0 01-4-4V8a4 4 0 014-4z" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1.5"/>
                        <path d="M26 4v8h8" stroke="var(--border)" stroke-width="1.5"/>
                        <text x="22" y="28" fill="var(--text-muted)" font-size="9" text-anchor="middle" font-weight="600">PDF</text>
                      </svg>
                    }
                  </div>
                  <div class="doc-body">
                    <div class="doc-name">{{ d.name }}</div>
                    <div class="doc-meta">{{ formatBytes(d.size) }} · {{ d.uploadedAt | date:'MMM d' }}</div>
                  </div>
                  <button class="doc-del" (click)="removeOtherDoc(d.id)">
                    <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                  </button>
                </div>
              }
            </div>
          }
        </section>
      }

    </div>
  }
</div>
  `,
  styles: [`
    .detail-page { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); }
    .loading { padding: var(--space-12); text-align: center; color: var(--text-muted); }
    .loading a { color: var(--primary); text-decoration: underline; }

    .crumbs { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); }
    .crumb { color: var(--text-muted); text-decoration: none; transition: color var(--t-fast); }
    .crumb:hover:not(.crumb--current) { color: var(--primary); }
    .crumb-sep { color: var(--text-subtle); }
    .crumb--current { color: var(--text); font-weight: 600; }

    /* Profile head */
    .profile-head {
      display: flex; gap: var(--space-5);
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: var(--space-5);
    }
    .profile-avatar {
      width: 72px; height: 72px; border-radius: 50%;
      background: var(--primary); color: var(--on-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: var(--text-2xl); font-weight: 700; flex-shrink: 0;
    }
    .profile-meta { flex: 1; display: flex; flex-direction: column; gap: var(--space-3); }
    .profile-name-row {
      display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;
    }
    .profile-name {
      font-size: var(--text-2xl); font-weight: 700; color: var(--text);
      margin: 0; letter-spacing: -0.01em;
    }
    .vip-toggle {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px;
      border: 1px solid var(--border); background: var(--surface);
      border-radius: var(--radius-full); cursor: pointer;
      font-size: var(--text-xs); font-weight: 700; color: var(--text-muted);
      transition: all var(--t-fast);
    }
    .vip-toggle:hover { color: var(--accent); border-color: var(--accent); }
    .vip-toggle.is-vip {
      background: var(--accent); color: var(--on-accent); border-color: var(--accent);
    }

    .tier-pill {
      display: inline-block; padding: 3px 10px;
      border-radius: var(--radius-full);
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .profile-contact {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      font-size: var(--text-sm); color: var(--text-muted);
    }
    .profile-contact span { display: inline-flex; align-items: center; gap: 4px; }
    .profile-contact .dot { color: var(--text-subtle); margin: 0; }
    .profile-stats {
      display: flex; gap: var(--space-3); margin-top: var(--space-1);
    }
    .stat-tile {
      display: flex; flex-direction: column; gap: 2px;
      padding: var(--space-3) var(--space-4);
      background: var(--surface-2); border-radius: var(--radius-md);
      flex: 1; min-width: 110px;
    }
    .stat-val {
      font-size: var(--text-lg); font-weight: 700; color: var(--text);
      font-variant-numeric: tabular-nums;
    }
    .stat-lbl {
      font-size: 11px; font-weight: 600; color: var(--text-subtle);
      text-transform: uppercase; letter-spacing: 0.06em;
    }

    /* Tabs */
    .tabs {
      display: flex; gap: 4px; border-bottom: 1px solid var(--border);
    }
    .tab {
      padding: 12px var(--space-4); background: transparent;
      border: none; border-bottom: 2px solid transparent;
      cursor: pointer; font-size: var(--text-sm); font-weight: 600;
      color: var(--text-muted); margin-bottom: -1px;
      transition: all var(--t-fast);
      display: inline-flex; align-items: center; gap: 6px;
    }
    .tab:hover { color: var(--text); }
    .tab.active { color: var(--primary); border-bottom-color: var(--primary); }
    .tab-badge {
      padding: 1px 7px; background: var(--surface-2);
      border-radius: var(--radius-full);
      font-size: 10px; font-weight: 700;
    }
    .tab.active .tab-badge { background: var(--primary); color: var(--on-primary); }

    .tab-content { display: flex; flex-direction: column; gap: var(--space-4); }

    /* Cards */
    .grid-2 {
      display: grid; gap: var(--space-4);
      grid-template-columns: 1fr 1fr;
    }
    @media (max-width: 880px) { .grid-2 { grid-template-columns: 1fr; } }
    .card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: var(--space-5);
    }
    .card--span { grid-column: 1 / -1; }
    .card-title {
      font-size: var(--text-md); font-weight: 700;
      margin: 0 0 var(--space-3); color: var(--text);
    }
    .card-help {
      font-size: var(--text-xs); color: var(--text-muted);
      margin: -8px 0 var(--space-3);
    }
    .empty-card { padding: var(--space-6); text-align: center; color: var(--text-muted); }
    .empty-card p { margin: 0; font-size: var(--text-sm); }

    .info-list { display: flex; flex-direction: column; gap: 0; margin: 0; }
    .info-row {
      display: grid; grid-template-columns: 120px 1fr;
      gap: var(--space-3);
      padding: 8px 0; border-bottom: 1px solid var(--border);
      font-size: var(--text-sm);
    }
    .info-row:last-child { border-bottom: none; }
    .info-row dt { color: var(--text-muted); margin: 0; }
    .info-row dd { margin: 0; color: var(--text); }
    .info-row dd.mono { font-family: var(--font-mono); }
    .info-row dd.capitalize { text-transform: capitalize; }

    /* Tags */
    .tag-row {
      display: flex; flex-wrap: wrap; gap: 6px;
      margin-bottom: var(--space-3); min-height: 28px;
    }
    .muted { color: var(--text-muted); font-size: var(--text-sm); }
    .g-tag {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 10px;
      background: var(--surface-2); color: var(--text);
      border-radius: var(--radius-full);
      font-size: var(--text-xs); font-weight: 500;
    }
    .g-tag__del {
      width: 14px; height: 14px; padding: 0;
      border: none; background: transparent;
      cursor: pointer; color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
    }
    .g-tag__del:hover { background: var(--danger); color: #fff; }
    .add-tag-row { display: flex; gap: 8px; }
    .field-input {
      height: 36px; padding: 0 var(--space-3);
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface); color: var(--text);
      font-size: var(--text-sm); font-family: inherit; outline: none;
      flex: 1; box-sizing: border-box;
    }
    .field-input:focus { border-color: var(--primary); }
    .btn-primary, .btn-secondary {
      height: 36px; padding: 0 var(--space-4);
      border-radius: var(--radius-md); cursor: pointer;
      font-size: var(--text-sm); font-weight: 600;
      transition: all var(--t-fast);
    }
    .btn-primary {
      background: var(--primary); color: var(--on-primary); border: none;
    }
    .btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      background: transparent; color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover:not(:disabled) { color: var(--text); border-color: var(--border-strong); }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

    .notes-area {
      width: 100%; box-sizing: border-box;
      padding: var(--space-3); border: 1px solid var(--border);
      border-radius: var(--radius-md); background: var(--surface);
      color: var(--text); font-size: var(--text-sm); font-family: inherit;
      outline: none; resize: vertical;
      margin-bottom: var(--space-3);
    }
    .notes-area:focus { border-color: var(--primary); }
    .notes-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }

    /* Stays table */
    .stays-table { width: 100%; border-collapse: collapse; }
    .stays-table th {
      text-align: left; padding: var(--space-3) var(--space-3);
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-subtle);
      background: var(--surface-2); border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .stays-table td {
      padding: var(--space-3); border-bottom: 1px solid var(--border);
      font-size: var(--text-sm); color: var(--text);
    }
    .row { cursor: pointer; transition: background var(--t-fast); }
    .row:hover { background: var(--surface-2); }
    .num-col { text-align: right; font-variant-numeric: tabular-nums; }
    .mono { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-muted); }
    .dates-cell {
      display: flex; align-items: center; gap: 6px;
      color: var(--text-muted); white-space: nowrap;
    }
    .arrow { color: var(--text-subtle); }
    .status-pill {
      display: inline-block; padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
    }

    /* Preferences */
    .pref-grid {
      display: grid; gap: var(--space-3);
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      margin-bottom: var(--space-4);
    }
    .pref-field { display: flex; flex-direction: column; gap: 6px; }
    .pref-field--toggle { gap: 8px; }
    .pref-lbl {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-subtle);
    }
    .pref-section { margin-bottom: var(--space-4); }
    .diet-row {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      padding: var(--space-2); border: 1px solid var(--border);
      border-radius: var(--radius-md); margin-top: 6px;
    }
    .diet-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 10px;
      background: var(--success-bg); color: var(--success);
      border-radius: var(--radius-full);
      font-size: var(--text-xs); font-weight: 600;
    }
    .diet-del {
      width: 14px; height: 14px; padding: 0;
      border: none; background: transparent; cursor: pointer;
      color: var(--success); display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
    }
    .diet-del:hover { background: var(--danger); color: #fff; }
    .diet-input {
      flex: 1; min-width: 140px;
      border: none; background: transparent;
      font-size: var(--text-sm); color: var(--text);
      outline: none; padding: 4px;
    }

    .toggle {
      display: inline-flex; align-items: center; gap: 8px;
      cursor: pointer; position: relative;
    }
    .toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
    .toggle-track {
      width: 36px; height: 20px;
      background: var(--surface-3); border-radius: 10px;
      position: relative; transition: background var(--t-fast);
      flex-shrink: 0;
    }
    .toggle-thumb {
      position: absolute; top: 2px; left: 2px;
      width: 16px; height: 16px;
      background: #fff; border-radius: 50%;
      box-shadow: var(--shadow-1);
      transition: transform var(--t-fast);
    }
    .toggle input:checked + .toggle-track { background: var(--primary); }
    .toggle input:checked + .toggle-track .toggle-thumb { transform: translateX(16px); }
    .toggle-text { font-size: var(--text-sm); color: var(--text); }

    /* Documents */
    .upload-zone {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px; padding: var(--space-8);
      border: 2px dashed var(--border-strong); border-radius: var(--radius-md);
      background: var(--surface-2); cursor: pointer;
      color: var(--text-muted); transition: all var(--t-fast);
    }
    .upload-zone:hover {
      border-color: var(--primary); color: var(--primary);
      background: color-mix(in srgb, var(--primary) 4%, transparent);
    }
    .upload-text { font-size: var(--text-sm); font-weight: 600; }
    .upload-hint { font-size: var(--text-xs); color: var(--text-subtle); }

    .id-preview {
      position: relative; border-radius: var(--radius-md); overflow: hidden;
      background: var(--surface-2); max-width: 480px;
    }
    .id-preview img { display: block; width: 100%; max-height: 320px; object-fit: contain; }
    .id-overlay {
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: var(--space-3);
      background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
      display: flex; gap: var(--space-2); justify-content: flex-end;
      opacity: 0; transition: opacity var(--t-fast);
    }
    .id-preview:hover .id-overlay { opacity: 1; }
    .btn-overlay {
      padding: 6px 12px; border: 1px solid rgba(255,255,255,0.6);
      background: rgba(0,0,0,0.5); color: #fff;
      border-radius: var(--radius-md); cursor: pointer;
      font-size: var(--text-xs); font-weight: 600;
      transition: all var(--t-fast);
    }
    .btn-overlay:hover { background: rgba(255,255,255,0.2); }
    .btn-overlay--danger { border-color: var(--danger); }
    .btn-overlay--danger:hover { background: var(--danger); }

    .docs-grid {
      display: grid; gap: var(--space-3);
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      margin-top: var(--space-4);
    }
    .doc-tile {
      position: relative;
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius-md); overflow: hidden;
      display: flex; flex-direction: column;
    }
    .doc-preview {
      aspect-ratio: 4 / 3; background: var(--surface-3);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .doc-preview img { width: 100%; height: 100%; object-fit: cover; }
    .doc-body { padding: var(--space-2) var(--space-3); }
    .doc-name {
      font-size: var(--text-xs); font-weight: 600; color: var(--text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .doc-meta { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
    .doc-del {
      position: absolute; top: 6px; right: 6px;
      width: 22px; height: 22px;
      border: none; border-radius: 50%;
      background: rgba(0,0,0,0.5); color: #fff;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity var(--t-fast);
    }
    .doc-tile:hover .doc-del { opacity: 1; }
  `],
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
