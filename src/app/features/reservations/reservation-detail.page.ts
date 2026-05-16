import {
  Component, OnInit, inject, signal, computed, DestroyRef,
} from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';

import {
  RESERVATION_SERVICE, ROOM_SERVICE, GUEST_SERVICE,
} from '../../data/services/service-tokens';
import {
  Reservation, Room, RoomType, Guest, Folio, FolioItem,
} from '../../domain';
import {
  ReservationStatus, PaymentMethod, BookingSource,
} from '../../domain/enums';

import { CheckInWizardComponent }  from './check-in-wizard.component';
import { CheckOutWizardComponent } from './check-out-wizard.component';

type Tab = 'overview' | 'folio' | 'notes' | 'documents';

interface AttachedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;     // base64 preview (no real storage)
  uploadedAt: Date;
}

const STATUS_META: Record<ReservationStatus, { label: string; color: string; bg: string }> = {
  [ReservationStatus.Pending]:    { label: 'Pending',     color: 'var(--warning)', bg: 'var(--warning-bg)' },
  [ReservationStatus.Confirmed]:  { label: 'Confirmed',   color: 'var(--info)',    bg: 'var(--info-bg)' },
  [ReservationStatus.CheckedIn]:  { label: 'Checked-in',  color: 'var(--success)', bg: 'var(--success-bg)' },
  [ReservationStatus.CheckedOut]: { label: 'Checked-out', color: 'var(--text-muted)', bg: 'var(--surface-2)' },
  [ReservationStatus.Cancelled]:  { label: 'Cancelled',   color: 'var(--danger)',  bg: 'var(--danger-bg)' },
  [ReservationStatus.NoShow]:     { label: 'No-show',     color: 'var(--danger)',  bg: 'var(--danger-bg)' },
};

const SOURCE_LABELS: Record<string, string> = {
  [BookingSource.Direct]:          'Direct',
  [BookingSource.BookingCom]:      'Booking.com',
  [BookingSource.Airbnb]:          'Airbnb',
  [BookingSource.Expedia]:         'Expedia',
  [BookingSource.Walk_in]:         'Walk-in',
  [BookingSource.Phone]:           'Phone',
  [BookingSource.CorporateClient]: 'Corporate',
};

@Component({
  selector: 'lux-reservation-detail-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe, CurrencyPipe, RouterLink,
    CheckInWizardComponent, CheckOutWizardComponent,
  ],
  template: `
<div class="detail-page">

  @if (loading()) {
    <div class="loading">Loading reservation…</div>
  } @else if (!reservation()) {
    <div class="loading">Reservation not found. <a routerLink="/app/reservations">Back to list</a></div>
  } @else {

    <!-- Breadcrumb -->
    <nav class="crumbs">
      <a routerLink="/app/reservations" class="crumb">Reservations</a>
      <span class="crumb-sep">/</span>
      <span class="crumb crumb--current">{{ reservation()!.confirmationNumber }}</span>
    </nav>

    <!-- Header -->
    <header class="dp-header">
      <div class="dp-header__main">
        <div class="dp-title-row">
          <h1 class="dp-title">{{ reservation()!.confirmationNumber }}</h1>
          <span class="status-pill"
                [style.color]="meta(reservation()!.status).color"
                [style.background]="meta(reservation()!.status).bg">
            {{ meta(reservation()!.status).label }}
          </span>
          @if (guest()?.isVip) {
            <span class="vip-tag">VIP</span>
          }
        </div>
        <p class="dp-subtitle">
          <a class="link" [routerLink]="['/app/guests', reservation()!.guestId]">
            {{ guest()?.firstName }} {{ guest()?.lastName }}
          </a>
          <span class="dot">·</span>
          {{ reservation()!.checkIn | date:'MMM d' }}
          <span class="arrow">→</span>
          {{ reservation()!.checkOut | date:'MMM d, y' }}
          ({{ reservation()!.nights }} {{ reservation()!.nights === 1 ? 'night' : 'nights' }})
        </p>
      </div>
      <div class="dp-header__actions">
        @if (canCheckIn()) {
          <button class="btn-primary" (click)="openCheckIn()">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7h8M7 4l3 3-3 3M10 2h2v10h-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
            Check in
          </button>
        }
        @if (canCheckOut()) {
          <button class="btn-primary btn-primary--warn" (click)="openCheckOut()">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M12 7H4M7 4l-3 3 3 3M4 2H2v10h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
            Check out
          </button>
        }
        @if (canCancel()) {
          <button class="btn-danger" (click)="cancelReservation()">Cancel</button>
        }
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
          @if (t.id === 'documents' && documents().length > 0) {
            <span class="tab-badge">{{ documents().length }}</span>
          }
        </button>
      }
    </div>

    <!-- Tab content -->
    <div class="tab-content">

      @if (activeTab() === 'overview') {
        <div class="grid-2">
          <!-- Stay info card -->
          <section class="card">
            <h3 class="card-title">Stay details</h3>
            <dl class="stay-list">
              <div class="stay-row">
                <dt>Check-in</dt>
                <dd>{{ reservation()!.checkIn | date:'EEE, MMM d, y' }} · 3:00 PM</dd>
              </div>
              <div class="stay-row">
                <dt>Check-out</dt>
                <dd>{{ reservation()!.checkOut | date:'EEE, MMM d, y' }} · 11:00 AM</dd>
              </div>
              <div class="stay-row">
                <dt>Nights</dt>
                <dd>{{ reservation()!.nights }}</dd>
              </div>
              <div class="stay-row">
                <dt>Guests</dt>
                <dd>{{ reservation()!.adults }} {{ reservation()!.adults === 1 ? 'adult' : 'adults' }}@if (reservation()!.children > 0) {, {{ reservation()!.children }} {{ reservation()!.children === 1 ? 'child' : 'children' }}}</dd>
              </div>
              <div class="stay-row">
                <dt>Room type</dt>
                <dd>{{ typeName() }}</dd>
              </div>
              <div class="stay-row">
                <dt>Room</dt>
                <dd>
                  @if (room()) {
                    Room {{ room()!.number }} · Floor {{ room()!.floor }}
                  } @else {
                    <span class="muted">Not assigned</span>
                  }
                </dd>
              </div>
              <div class="stay-row">
                <dt>Source</dt>
                <dd>{{ srcLabel(reservation()!.source) }}</dd>
              </div>
              <div class="stay-row">
                <dt>Booked</dt>
                <dd>{{ reservation()!.createdAt | date:'MMM d, y' }}</dd>
              </div>
            </dl>
          </section>

          <!-- Guest summary card -->
          <section class="card">
            <h3 class="card-title">Guest</h3>
            @if (guest(); as g) {
              <div class="guest-summary">
                <div class="guest-avatar">{{ initials() }}</div>
                <div class="guest-summary__body">
                  <div class="guest-summary__name">
                    {{ g.firstName }} {{ g.lastName }}
                    @if (g.isVip) { <span class="vip-tag vip-tag--sm">VIP</span> }
                  </div>
                  <div class="guest-summary__meta">{{ g.nationality }}</div>
                </div>
              </div>
              <dl class="stay-list">
                <div class="stay-row">
                  <dt>Email</dt>
                  <dd>{{ g.email }}</dd>
                </div>
                <div class="stay-row">
                  <dt>Phone</dt>
                  <dd>{{ g.phone }}</dd>
                </div>
                <div class="stay-row">
                  <dt>{{ g.idType | titlecase }}</dt>
                  <dd class="mono">{{ g.idNumber || '—' }}</dd>
                </div>
                <div class="stay-row">
                  <dt>Total stays</dt>
                  <dd>{{ g.totalStays }}</dd>
                </div>
                @if (g.loyaltyTier) {
                  <div class="stay-row">
                    <dt>Loyalty</dt>
                    <dd class="loyalty">{{ g.loyaltyTier | titlecase }} · {{ g.loyaltyPoints }} pts</dd>
                  </div>
                }
              </dl>
              <a class="btn-link-block" [routerLink]="['/app/guests', g.id]">View full profile →</a>
            }
          </section>

          <!-- Pricing card -->
          <section class="card card--span">
            <h3 class="card-title">Pricing</h3>
            <div class="pricing-grid">
              <div class="price-tile">
                <span class="price-lbl">Room charge</span>
                <span class="price-val">{{ reservation()!.totalRoomCharge | currency:'GEL':'symbol-narrow':'1.2-2' }}</span>
              </div>
              <div class="price-tile">
                <span class="price-lbl">Tax</span>
                <span class="price-val">{{ reservation()!.totalTax | currency:'GEL':'symbol-narrow':'1.2-2' }}</span>
              </div>
              <div class="price-tile">
                <span class="price-lbl">Extras</span>
                <span class="price-val">{{ reservation()!.totalExtras | currency:'GEL':'symbol-narrow':'1.2-2' }}</span>
              </div>
              <div class="price-tile price-tile--accent">
                <span class="price-lbl">Total</span>
                <span class="price-val">{{ reservation()!.totalAmount | currency:'GEL':'symbol-narrow':'1.2-2' }}</span>
              </div>
              <div class="price-tile">
                <span class="price-lbl">Paid</span>
                <span class="price-val price-val--paid">−{{ reservation()!.totalPaid | currency:'GEL':'symbol-narrow':'1.2-2' }}</span>
              </div>
              <div class="price-tile" [class.price-tile--danger]="reservation()!.balance > 0">
                <span class="price-lbl">Balance</span>
                <span class="price-val">{{ reservation()!.balance | currency:'GEL':'symbol-narrow':'1.2-2' }}</span>
              </div>
            </div>
          </section>
        </div>
      }

      @if (activeTab() === 'folio') {
        @if (folio(); as f) {
          <section class="card">
            <div class="folio-toolbar">
              <h3 class="card-title" style="margin: 0;">Charges</h3>
              <button class="btn-secondary" (click)="showChargeForm.set(!showChargeForm())">
                @if (showChargeForm()) { Cancel } @else { + Post charge }
              </button>
            </div>

            @if (showChargeForm()) {
              <div class="post-form">
                <select class="field-input" [ngModel]="newCharge.category" (ngModelChange)="newCharge.category = $event">
                  <option value="food">Food</option>
                  <option value="minibar">Minibar</option>
                  <option value="service">Service</option>
                  <option value="misc">Misc</option>
                </select>
                <input class="field-input" type="text" placeholder="Description"
                       [ngModel]="newCharge.description" (ngModelChange)="newCharge.description = $event" />
                <input class="field-input field-input--num" type="number" placeholder="Qty" min="1"
                       [ngModel]="newCharge.quantity" (ngModelChange)="newCharge.quantity = $event" />
                <input class="field-input field-input--num" type="number" placeholder="Unit price" min="0" step="0.01"
                       [ngModel]="newCharge.unitPrice" (ngModelChange)="newCharge.unitPrice = $event" />
                <button class="btn-primary"
                        [disabled]="!canPostCharge()"
                        (click)="postCharge()">Post</button>
              </div>
            }

            <div class="folio-table">
              @if (f.items.length === 0) {
                <div class="empty-row">No charges yet.</div>
              }
              @for (item of f.items; track item.id) {
                <div class="folio-row">
                  <div class="folio-row__left">
                    <div class="folio-desc">{{ item.description }}</div>
                    <div class="folio-meta">
                      <span class="folio-cat" [attr.data-cat]="item.category">{{ item.category }}</span>
                      <span>{{ item.date | date:'MMM d' }}</span>
                      @if (item.quantity > 1) { <span>× {{ item.quantity }}</span> }
                    </div>
                  </div>
                  <div class="folio-amt">{{ item.amount | currency:'GEL':'symbol-narrow':'1.2-2' }}</div>
                </div>
              }
            </div>
          </section>

          <section class="card">
            <div class="folio-toolbar">
              <h3 class="card-title" style="margin: 0;">Payments</h3>
              <button class="btn-secondary" (click)="showPaymentForm.set(!showPaymentForm())">
                @if (showPaymentForm()) { Cancel } @else { + Record payment }
              </button>
            </div>

            @if (showPaymentForm()) {
              <div class="post-form">
                <input class="field-input field-input--num" type="number" placeholder="Amount" min="0" step="0.01"
                       [ngModel]="newPayment.amount" (ngModelChange)="newPayment.amount = $event" />
                <select class="field-input" [ngModel]="newPayment.method" (ngModelChange)="newPayment.method = $event">
                  <option [value]="PaymentMethod.Card">Card</option>
                  <option [value]="PaymentMethod.Cash">Cash</option>
                  <option [value]="PaymentMethod.BankTransfer">Bank transfer</option>
                  <option [value]="PaymentMethod.Voucher">Voucher</option>
                </select>
                <input class="field-input" type="text" placeholder="Reference (optional)"
                       [ngModel]="newPayment.reference" (ngModelChange)="newPayment.reference = $event" />
                <button class="btn-primary"
                        [disabled]="!canRecordPayment()"
                        (click)="recordPayment()">Record</button>
              </div>
            }

            <div class="folio-table">
              @if (f.payments.length === 0) {
                <div class="empty-row">No payments recorded yet.</div>
              }
              @for (p of f.payments; track p.id) {
                <div class="folio-row folio-row--payment">
                  <div class="folio-row__left">
                    <div class="folio-desc">{{ payMethodLabel(p.method) }}</div>
                    <div class="folio-meta">
                      <span>{{ p.date | date:'MMM d, HH:mm' }}</span>
                      @if (p.reference) { <span class="folio-ref">{{ p.reference }}</span> }
                    </div>
                  </div>
                  <div class="folio-amt folio-amt--pay">−{{ p.amount | currency:'GEL':'symbol-narrow':'1.2-2' }}</div>
                </div>
              }
            </div>
          </section>

          <div class="totals-card">
            <div class="totals-row">
              <span>Total</span>
              <span>{{ reservation()!.totalAmount | currency:'GEL':'symbol-narrow':'1.2-2' }}</span>
            </div>
            <div class="totals-row">
              <span>Paid</span>
              <span>−{{ reservation()!.totalPaid | currency:'GEL':'symbol-narrow':'1.2-2' }}</span>
            </div>
            <div class="totals-row totals-row--balance">
              <span>Balance</span>
              <span [class.balance-owed]="reservation()!.balance > 0"
                    [class.balance-ok]="reservation()!.balance <= 0">
                {{ reservation()!.balance | currency:'GEL':'symbol-narrow':'1.2-2' }}
              </span>
            </div>
          </div>
        } @else {
          <div class="loading">Loading folio…</div>
        }
      }

      @if (activeTab() === 'notes') {
        <section class="card">
          <h3 class="card-title">Special requests</h3>
          <p class="card-help">Visible to all staff. Forwarded from the booking source.</p>
          <textarea
            class="notes-textarea"
            rows="4"
            placeholder="e.g. 'Late check-in, anniversary trip, please prepare champagne'"
            [ngModel]="specialRequestsDraft()"
            (ngModelChange)="specialRequestsDraft.set($event)"></textarea>
        </section>

        <section class="card">
          <h3 class="card-title">Internal notes</h3>
          <p class="card-help">Staff-only. Use for billing notes, follow-ups, complaints.</p>
          <textarea
            class="notes-textarea notes-textarea--internal"
            rows="6"
            placeholder="e.g. 'Guest requested room change to higher floor — comp upgrade approved 2026-05-10 by JS.'"
            [ngModel]="internalNotesDraft()"
            (ngModelChange)="internalNotesDraft.set($event)"></textarea>
        </section>

        <div class="notes-actions">
          <button class="btn-secondary" (click)="resetNotes()" [disabled]="!notesDirty() || savingNotes()">
            Discard
          </button>
          <button class="btn-primary" (click)="saveNotes()" [disabled]="!notesDirty() || savingNotes()">
            @if (savingNotes()) { Saving… } @else { Save notes }
          </button>
        </div>
      }

      @if (activeTab() === 'documents') {
        <section class="card">
          <h3 class="card-title">Attached documents</h3>
          <p class="card-help">
            Drag-and-drop or click below to upload. Previews only — files are not stored on the server.
          </p>

          <label class="upload-zone">
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              hidden
              (change)="onFiles($event)" />
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 22V8m0 0l-5 5m5-5l5 5M6 22v3a1 1 0 001 1h18a1 1 0 001-1v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="upload-text">Click to upload, or drag files here</span>
            <span class="upload-hint">Images or PDFs · No actual storage in demo</span>
          </label>

          @if (documents().length > 0) {
            <div class="docs-grid">
              @for (d of documents(); track d.id) {
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
                    <div class="doc-meta">{{ formatBytes(d.size) }} · {{ d.uploadedAt | date:'MMM d, HH:mm' }}</div>
                  </div>
                  <button class="doc-del" (click)="removeDoc(d.id)" aria-label="Remove">
                    <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                  </button>
                </div>
              }
            </div>
          }
        </section>
      }

    </div>

    <!-- Wizards -->
    @if (showCheckInWizard()) {
      <lux-check-in-wizard
        [reservation]="reservation()!"
        [guest]="guest()"
        [rooms]="rooms()"
        (completed)="onCheckedIn($event)"
        (cancel)="showCheckInWizard.set(false)" />
    }
    @if (showCheckOutWizard()) {
      <lux-check-out-wizard
        [reservation]="reservation()!"
        [guest]="guest()"
        [folio]="folio()"
        [roomNumber]="room()?.number ?? null"
        (completed)="onCheckedOut($event)"
        (cancel)="showCheckOutWizard.set(false)" />
    }
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
    .crumb--current { color: var(--text); font-weight: 600; font-family: var(--font-mono); }

    .dp-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--space-4); flex-wrap: wrap;
    }
    .dp-title-row {
      display: flex; align-items: center; gap: var(--space-3);
      flex-wrap: wrap;
    }
    .dp-title {
      font-size: var(--text-2xl); font-weight: 700;
      margin: 0; color: var(--text); font-family: var(--font-mono);
      letter-spacing: -0.01em;
    }
    .dp-subtitle {
      font-size: var(--text-sm); color: var(--text-muted);
      margin: 6px 0 0; display: flex; align-items: center;
      flex-wrap: wrap; gap: 6px;
    }
    .dp-subtitle .link { color: var(--primary); text-decoration: none; font-weight: 600; }
    .dp-subtitle .link:hover { text-decoration: underline; }
    .dp-subtitle .dot { color: var(--text-subtle); }
    .dp-subtitle .arrow { color: var(--text-subtle); }
    .status-pill {
      display: inline-block; padding: 3px 10px;
      border-radius: var(--radius-full);
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .vip-tag {
      display: inline-block; padding: 2px 8px;
      background: var(--accent); color: var(--on-accent);
      border-radius: var(--radius-full);
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
    }
    .vip-tag--sm { font-size: 9px; padding: 1px 6px; margin-left: 4px; }

    .dp-header__actions { display: flex; gap: var(--space-2); }
    .btn-primary, .btn-secondary, .btn-danger {
      display: inline-flex; align-items: center; gap: 6px;
      height: 36px; padding: 0 var(--space-4);
      border-radius: var(--radius-md); cursor: pointer;
      font-size: var(--text-sm); font-weight: 600;
      transition: all var(--t-fast); border: 1px solid transparent;
    }
    .btn-primary { background: var(--primary); color: var(--on-primary); border: none; }
    .btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary--warn { background: var(--warning); }
    .btn-secondary {
      background: transparent; color: var(--text-muted); border-color: var(--border);
    }
    .btn-secondary:hover { color: var(--text); border-color: var(--border-strong); }
    .btn-danger {
      background: transparent; color: var(--danger); border-color: var(--danger);
    }
    .btn-danger:hover { background: var(--danger); color: #fff; }

    /* Tabs */
    .tabs {
      display: flex; gap: 4px; border-bottom: 1px solid var(--border);
      margin-bottom: var(--space-4);
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

    .stay-list { display: flex; flex-direction: column; gap: var(--space-2); margin: 0; }
    .stay-row {
      display: grid; grid-template-columns: 120px 1fr;
      gap: var(--space-3);
      padding: 6px 0; border-bottom: 1px solid var(--border);
      font-size: var(--text-sm);
    }
    .stay-row:last-child { border-bottom: none; }
    .stay-row dt { color: var(--text-muted); margin: 0; }
    .stay-row dd { margin: 0; color: var(--text); }
    .stay-row dd.muted { color: var(--text-subtle); font-style: italic; }
    .stay-row dd.mono { font-family: var(--font-mono); }
    .loyalty { text-transform: capitalize; }

    .guest-summary {
      display: flex; gap: var(--space-3); align-items: center;
      padding-bottom: var(--space-3); margin-bottom: var(--space-3);
      border-bottom: 1px solid var(--border);
    }
    .guest-avatar {
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--primary); color: var(--on-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: var(--text-md); font-weight: 700;
    }
    .guest-summary__name {
      font-size: var(--text-md); font-weight: 600; color: var(--text);
      display: flex; align-items: center;
    }
    .guest-summary__meta { font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }
    .btn-link-block {
      display: block; margin-top: var(--space-3);
      padding: 10px; text-align: center;
      color: var(--primary); text-decoration: none;
      font-size: var(--text-sm); font-weight: 600;
      border: 1px solid var(--border); border-radius: var(--radius-md);
      transition: all var(--t-fast);
    }
    .btn-link-block:hover {
      background: var(--surface-2); border-color: var(--primary);
    }

    .pricing-grid {
      display: grid; gap: var(--space-3);
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }
    .price-tile {
      display: flex; flex-direction: column; gap: 4px;
      padding: var(--space-3);
      background: var(--surface-2); border-radius: var(--radius-md);
    }
    .price-tile--accent { background: color-mix(in srgb, var(--primary) 8%, transparent); border: 1px solid var(--primary); }
    .price-tile--danger { background: var(--danger-bg); }
    .price-tile--danger .price-val { color: var(--danger); }
    .price-lbl {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-subtle);
    }
    .price-val {
      font-size: var(--text-md); font-weight: 700; color: var(--text);
      font-variant-numeric: tabular-nums;
    }
    .price-val--paid { color: var(--success); }

    /* Folio tab */
    .folio-toolbar {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: var(--space-3);
    }
    .post-form {
      display: grid; gap: var(--space-2);
      grid-template-columns: 120px 1fr 80px 100px auto;
      padding: var(--space-3); background: var(--surface-2);
      border-radius: var(--radius-md); margin-bottom: var(--space-3);
    }
    .field-input {
      height: 36px; padding: 0 var(--space-3);
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface); color: var(--text);
      font-size: var(--text-sm); font-family: inherit; outline: none;
      box-sizing: border-box;
    }
    .field-input--num { text-align: right; }
    .field-input:focus { border-color: var(--primary); }

    .folio-table {
      border: 1px solid var(--border); border-radius: var(--radius-md);
      overflow: hidden;
    }
    .folio-row {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: var(--space-3); gap: var(--space-3);
    }
    .folio-row:not(:last-child) { border-bottom: 1px solid var(--border); }
    .empty-row {
      padding: var(--space-6); text-align: center;
      color: var(--text-muted); font-size: var(--text-sm);
    }
    .folio-desc { font-size: var(--text-sm); color: var(--text); font-weight: 500; }
    .folio-meta {
      display: flex; gap: 8px; align-items: center; margin-top: 2px;
      font-size: 11px; color: var(--text-muted);
    }
    .folio-cat {
      padding: 1px 6px; border-radius: var(--radius-sm);
      background: var(--surface-2); text-transform: capitalize;
      font-weight: 600;
    }
    .folio-cat[data-cat="room"]    { color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); }
    .folio-cat[data-cat="tax"]     { color: var(--text-muted); }
    .folio-cat[data-cat="food"]    { color: var(--success); background: var(--success-bg); }
    .folio-cat[data-cat="minibar"] { color: var(--warning); background: var(--warning-bg); }
    .folio-cat[data-cat="service"] { color: var(--info); background: var(--info-bg); }
    .folio-ref { font-family: var(--font-mono); }
    .folio-amt {
      font-size: var(--text-sm); font-weight: 600; color: var(--text);
      font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    .folio-amt--pay { color: var(--success); }

    .totals-card {
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: var(--space-4);
      display: flex; flex-direction: column; gap: 6px;
    }
    .totals-row {
      display: flex; justify-content: space-between;
      font-size: var(--text-sm); color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
    .totals-row--balance {
      padding-top: 8px; border-top: 1px solid var(--border);
      font-size: var(--text-md); font-weight: 700;
    }
    .balance-owed { color: var(--danger); }
    .balance-ok   { color: var(--success); }

    /* Notes tab */
    .notes-textarea {
      width: 100%; box-sizing: border-box;
      padding: var(--space-3); border: 1px solid var(--border);
      border-radius: var(--radius-md); background: var(--surface);
      color: var(--text); font-size: var(--text-sm); font-family: inherit;
      outline: none; resize: vertical;
    }
    .notes-textarea:focus { border-color: var(--primary); }
    .notes-textarea--internal {
      background: color-mix(in srgb, var(--warning) 5%, var(--surface));
      border-color: var(--warning-bg);
    }
    .notes-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }

    /* Documents tab */
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
export class ReservationDetailPageComponent implements OnInit {
  private resSvc     = inject(RESERVATION_SERVICE);
  private roomSvc    = inject(ROOM_SERVICE);
  private guestSvc   = inject(GUEST_SERVICE);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly PaymentMethod = PaymentMethod;
  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'folio',     label: 'Folio' },
    { id: 'notes',     label: 'Notes' },
    { id: 'documents', label: 'Documents' },
  ];

  loading       = signal(true);
  reservation   = signal<Reservation | null>(null);
  guest         = signal<Guest | null>(null);
  room          = signal<Room | null>(null);
  rooms         = signal<Room[]>([]);
  roomType      = signal<RoomType | null>(null);
  folio         = signal<Folio | null>(null);
  documents     = signal<AttachedDoc[]>([]);

  activeTab     = signal<Tab>('overview');

  // Notes editing
  specialRequestsDraft = signal('');
  internalNotesDraft   = signal('');
  savingNotes          = signal(false);

  // Folio inline forms
  showChargeForm  = signal(false);
  showPaymentForm = signal(false);
  newCharge = { category: 'misc' as 'food' | 'minibar' | 'service' | 'misc' | 'tax' | 'room', description: '', quantity: 1, unitPrice: 0 };
  newPayment = { amount: 0, method: PaymentMethod.Card as string, reference: '' };

  // Wizards
  showCheckInWizard  = signal(false);
  showCheckOutWizard = signal(false);

  notesDirty = computed(() => {
    const r = this.reservation();
    if (!r) return false;
    return (r.specialRequests ?? '') !== this.specialRequestsDraft() ||
           (r.internalNotes  ?? '') !== this.internalNotesDraft();
  });

  initials = computed(() => {
    const g = this.guest();
    return g ? `${g.firstName[0] ?? ''}${g.lastName[0] ?? ''}`.toUpperCase() : '?';
  });

  canCheckIn  = computed(() => this.reservation()?.status === ReservationStatus.Confirmed
                              || this.reservation()?.status === ReservationStatus.Pending);
  canCheckOut = computed(() => this.reservation()?.status === ReservationStatus.CheckedIn);
  canCancel   = computed(() => {
    const s = this.reservation()?.status;
    return s === ReservationStatus.Pending || s === ReservationStatus.Confirmed;
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(params => {
        const id = params.get('id');
        if (!id) return of(null);
        return this.resSvc.getById(id);
      }),
    ).subscribe(r => {
      if (!r) {
        this.reservation.set(null);
        this.loading.set(false);
        return;
      }
      this.reservation.set(r);
      this.specialRequestsDraft.set(r.specialRequests ?? '');
      this.internalNotesDraft.set(r.internalNotes ?? '');
      this.loadRelated(r);
    });
  }

  private loadRelated(r: Reservation): void {
    forkJoin({
      guest:  this.guestSvc.getById(r.guestId),
      room:   r.roomId ? this.roomSvc.getById(r.roomId) : of(null),
      rooms:  this.roomSvc.list(r.propertyId),
      types:  this.roomSvc.listTypes(r.propertyId),
      folio:  this.resSvc.getFolio(r.id),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ guest, room, rooms, types, folio }) => {
      this.guest.set(guest ?? null);
      this.room.set(room ?? null);
      this.rooms.set(rooms);
      this.roomType.set(types.find(t => t.id === r.roomTypeId) ?? null);
      this.folio.set(folio ?? null);
      this.loading.set(false);
    });
  }

  meta(s: ReservationStatus) { return STATUS_META[s]; }
  srcLabel(s: string): string { return SOURCE_LABELS[s] ?? s; }
  typeName(): string { return this.roomType()?.name ?? '—'; }

  payMethodLabel(m: string): string {
    switch (m) {
      case PaymentMethod.Card:         return 'Card';
      case PaymentMethod.Cash:         return 'Cash';
      case PaymentMethod.BankTransfer: return 'Bank transfer';
      case PaymentMethod.Voucher:      return 'Voucher';
      default: return m;
    }
  }

  /* ---------- Wizards ---------- */
  openCheckIn():  void { this.showCheckInWizard.set(true); }
  openCheckOut(): void { this.showCheckOutWizard.set(true); }

  onCheckedIn(updated: Reservation): void {
    this.reservation.set(updated);
    this.showCheckInWizard.set(false);
    // Refresh room reference + folio
    if (updated.roomId) this.roomSvc.getById(updated.roomId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(room => this.room.set(room ?? null));
    this.resSvc.getFolio(updated.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(f => this.folio.set(f ?? null));
  }

  onCheckedOut(updated: Reservation): void {
    this.reservation.set(updated);
    this.showCheckOutWizard.set(false);
    this.resSvc.getFolio(updated.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(f => this.folio.set(f ?? null));
  }

  /* ---------- Cancel ---------- */
  cancelReservation(): void {
    const r = this.reservation();
    if (!r) return;
    const reason = prompt('Cancellation reason:');
    if (!reason) return;
    this.resSvc.cancel(r.id, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => this.reservation.set(updated));
  }

  /* ---------- Notes ---------- */
  saveNotes(): void {
    const r = this.reservation();
    if (!r || this.savingNotes()) return;
    this.savingNotes.set(true);
    this.resSvc.update(r.id, {
      specialRequests: this.specialRequestsDraft().trim() || undefined,
      internalNotes:   this.internalNotesDraft().trim() || undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.reservation.set(updated);
        this.savingNotes.set(false);
      },
      error: () => this.savingNotes.set(false),
    });
  }
  resetNotes(): void {
    const r = this.reservation();
    if (!r) return;
    this.specialRequestsDraft.set(r.specialRequests ?? '');
    this.internalNotesDraft.set(r.internalNotes ?? '');
  }

  /* ---------- Folio inline operations ---------- */
  canPostCharge(): boolean {
    return this.newCharge.description.trim().length > 0 &&
           this.newCharge.unitPrice > 0 &&
           this.newCharge.quantity > 0;
  }
  postCharge(): void {
    const r = this.reservation();
    if (!r || !this.canPostCharge()) return;
    const q = this.newCharge.quantity;
    const u = this.newCharge.unitPrice;
    this.resSvc.postFolioItem(r.id, {
      description: this.newCharge.description.trim(),
      category: this.newCharge.category as FolioItem['category'],
      quantity: q,
      unitPrice: u,
      amount: q * u,
      date: new Date(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(updated => {
      this.folio.set(updated);
      // Refresh reservation totals
      this.resSvc.getById(r.id).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(refreshed => refreshed && this.reservation.set(refreshed));
      this.newCharge = { category: 'misc', description: '', quantity: 1, unitPrice: 0 };
      this.showChargeForm.set(false);
    });
  }

  canRecordPayment(): boolean { return this.newPayment.amount > 0; }
  recordPayment(): void {
    const r = this.reservation();
    if (!r || !this.canRecordPayment()) return;
    this.resSvc.recordPayment(r.id, {
      amount: this.newPayment.amount,
      method: this.newPayment.method as PaymentMethod,
      reference: this.newPayment.reference.trim() || undefined,
      date: new Date(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(updated => {
      this.folio.set(updated);
      this.resSvc.getById(r.id).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(refreshed => refreshed && this.reservation.set(refreshed));
      this.newPayment = { amount: 0, method: PaymentMethod.Card, reference: '' };
      this.showPaymentForm.set(false);
    });
  }

  /* ---------- Documents ---------- */
  onFiles(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    files.forEach(f => this.readFile(f));
    input.value = '';
  }
  private readFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const doc: AttachedDoc = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: reader.result as string,
        uploadedAt: new Date(),
      };
      this.documents.update(list => [doc, ...list]);
    };
    reader.readAsDataURL(file);
  }
  removeDoc(id: string): void {
    this.documents.update(list => list.filter(d => d.id !== id));
  }
  formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }
}
