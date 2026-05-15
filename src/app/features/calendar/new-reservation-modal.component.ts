import {
  Component, input, output, inject, signal, computed, OnInit, DestroyRef,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { animate, style, transition, trigger } from '@angular/animations';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';

import { GUEST_SERVICE, RESERVATION_SERVICE } from '../../data/services/service-tokens';
import { Guest, Room, RoomType, RatePlan } from '../../domain';
import { ReservationStatus, BookingSource } from '../../domain/enums';

export interface NewReservationPayload {
  roomId: string;
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guestId: string;
  adults: number;
  children: number;
  ratePlanId: string;
  totalRoomCharge: number;
  totalTax: number;
  totalAmount: number;
  totalPaid: number;
  totalExtras: number;
  balance: number;
  status: ReservationStatus;
  source: BookingSource;
  specialRequests?: string;
}

/** Lightweight email check — good enough for client-side new-guest creation. */
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

@Component({
  selector: 'app-new-reservation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  animations: [
    trigger('fadeScale', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.96) translateY(8px)' }),
        animate('200ms cubic-bezier(0.34,1.56,0.64,1)',
          style({ opacity: 1, transform: 'scale(1) translateY(0)' })),
      ]),
      transition(':leave', [
        animate('150ms ease-in',
          style({ opacity: 0, transform: 'scale(0.96) translateY(4px)' })),
      ]),
    ]),
  ],
  template: `
<!-- Backdrop -->
<div class="modal-backdrop" (click)="cancel.emit()"></div>

<!-- Modal -->
<div class="modal-wrap" role="dialog" aria-modal="true" aria-label="New reservation" [@fadeScale]>

  <!-- Header -->
  <div class="modal-header">
    <div class="modal-header__left">
      <div class="modal-icon">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="3" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/>
          <path d="M6 1v4M12 1v4M2 8h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M6 12h6M9 10v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div>
        <h2 class="modal-title">New Reservation</h2>
        <p class="modal-sub">{{ room()?.number }} · {{ roomType()?.name }}</p>
      </div>
    </div>
    <button class="btn-close" (click)="cancel.emit()" aria-label="Close">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <!-- Dates strip (read-only, from drag) -->
  <div class="dates-strip">
    <div class="date-block">
      <span class="date-lbl">Check-in</span>
      <span class="date-val">{{ checkIn() | date:'EEE, MMM d, y' }}</span>
    </div>
    <div class="date-sep">
      <svg width="20" height="8" viewBox="0 0 20 8" fill="none">
        <path d="M0 4h18M14 1l3 3-3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="nights-pill">{{ nights() }}n</span>
    </div>
    <div class="date-block date-block--right">
      <span class="date-lbl">Check-out</span>
      <span class="date-val">{{ checkOut() | date:'EEE, MMM d, y' }}</span>
    </div>
  </div>

  <!-- Body -->
  <div class="modal-body">

    <!-- Step 1: Guest search -->
    <section class="form-section">
      <h3 class="form-section__title">
        <span class="step-num">1</span>Guest
      </h3>

      @if (!selectedGuest()) {
        @if (!showCreateForm()) {
          <div class="search-wrap">
            <div class="search-input-wrap">
              <svg class="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.4"/>
                <path d="M9.5 9.5l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              <input
                class="search-input"
                type="text"
                placeholder="Search by name, email or phone…"
                [ngModel]="searchQuery()"
                (ngModelChange)="onSearchChange($event)"
                (focus)="showResults.set(true)"
                autocomplete="off" />
              @if (searchLoading()) {
                <div class="search-spinner"></div>
              }
              <button
                type="button"
                class="btn-new-guest"
                (click)="openCreateForm()"
                title="Add a new guest">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
                <span>New</span>
              </button>
            </div>

            @if (showResults() && searchResults().length > 0) {
              <div class="search-results">
                @for (g of searchResults(); track g.id) {
                  <button class="search-result" (click)="selectGuest(g)">
                    <div class="result-avatar">{{ initials(g) }}</div>
                    <div class="result-info">
                      <span class="result-name">{{ g.firstName }} {{ g.lastName }}</span>
                      <span class="result-meta">{{ g.email }} · {{ g.phone }}</span>
                    </div>
                    @if (g.loyaltyTier) {
                      <span class="result-tier result-tier--{{ g.loyaltyTier }}">
                        {{ g.loyaltyTier | titlecase }}
                      </span>
                    }
                  </button>
                }
              </div>
            }

            @if (showResults() && searchQuery().length > 1 && !searchLoading() && searchResults().length === 0) {
              <div class="search-empty-wrap">
                <p class="search-empty-text">No guests found for "{{ searchQuery() }}"</p>
                <button class="btn-create-from-empty" (click)="openCreateForm()">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  </svg>
                  Add "{{ searchQuery() }}" as new guest
                </button>
              </div>
            }
          </div>
        } @else {
          <!-- Inline create-guest form -->
          <div class="create-guest">
            <div class="create-guest__header">
              <span class="create-guest__title">New guest details</span>
              <button class="btn-back" type="button" (click)="cancelCreateForm()">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M7.5 2.5L3 6l4.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Back to search
              </button>
            </div>
            <div class="create-grid">
              <label class="field">
                <span class="field-lbl">First name <span class="req">*</span></span>
                <input
                  class="field-input"
                  type="text"
                  [ngModel]="newFirstName()"
                  (ngModelChange)="newFirstName.set($event)"
                  placeholder="Jane"
                  autocomplete="off" />
              </label>
              <label class="field">
                <span class="field-lbl">Last name <span class="req">*</span></span>
                <input
                  class="field-input"
                  type="text"
                  [ngModel]="newLastName()"
                  (ngModelChange)="newLastName.set($event)"
                  placeholder="Doe"
                  autocomplete="off" />
              </label>
              <label class="field field--full">
                <span class="field-lbl">Email <span class="req">*</span></span>
                <input
                  class="field-input"
                  type="email"
                  [ngModel]="newEmail()"
                  (ngModelChange)="newEmail.set($event)"
                  placeholder="jane@example.com"
                  autocomplete="off" />
              </label>
              <label class="field field--full">
                <span class="field-lbl">Phone <span class="req">*</span></span>
                <input
                  class="field-input"
                  type="tel"
                  [ngModel]="newPhone()"
                  (ngModelChange)="newPhone.set($event)"
                  placeholder="+1 555 0100"
                  autocomplete="off" />
              </label>
            </div>
            @if (createError()) {
              <div class="create-error">{{ createError() }}</div>
            }
            <div class="create-actions">
              <button class="btn-create-cancel" type="button" (click)="cancelCreateForm()">Cancel</button>
              <button
                class="btn-create-save"
                type="button"
                [disabled]="!canCreateGuest() || creating()"
                (click)="submitNewGuest()">
                @if (creating()) {
                  <span class="search-spinner search-spinner--on-primary"></span>
                  Saving…
                } @else {
                  Save & select
                }
              </button>
            </div>
          </div>
        }
      } @else {
        <div class="guest-selected">
          <div class="guest-avatar">{{ initials(selectedGuest()!) }}</div>
          <div class="guest-info">
            <span class="guest-name">{{ selectedGuest()!.firstName }} {{ selectedGuest()!.lastName }}</span>
            <span class="guest-meta">{{ selectedGuest()!.email }} · {{ selectedGuest()!.phone }}</span>
          </div>
          @if (selectedGuest()!.loyaltyTier) {
            <span class="result-tier result-tier--{{ selectedGuest()!.loyaltyTier }}">
              {{ selectedGuest()!.loyaltyTier | titlecase }}
            </span>
          }
          <button class="btn-change" (click)="clearGuest()">Change</button>
        </div>
      }
    </section>

    <!-- Step 2: Occupancy -->
    <section class="form-section">
      <h3 class="form-section__title">
        <span class="step-num">2</span>Occupancy
      </h3>
      <div class="occ-row">
        <div class="counter-group">
          <span class="counter-label">Adults</span>
          <div class="counter">
            <button class="counter-btn" (click)="adults.set(Math.max(1, adults() - 1))">−</button>
            <span class="counter-val">{{ adults() }}</span>
            <button class="counter-btn" (click)="adults.set(Math.min(maxOcc(), adults() + 1))">+</button>
          </div>
        </div>
        <div class="counter-group">
          <span class="counter-label">Children</span>
          <div class="counter">
            <button class="counter-btn" (click)="children.set(Math.max(0, children() - 1))">−</button>
            <span class="counter-val">{{ children() }}</span>
            <button class="counter-btn" (click)="children.set(Math.min(maxOcc() - adults(), children() + 1))">+</button>
          </div>
        </div>
        <span class="occ-cap">Max {{ maxOcc() }} guests</span>
      </div>
    </section>

    <!-- Step 3: Rate plan -->
    <section class="form-section">
      <h3 class="form-section__title">
        <span class="step-num">3</span>Rate Plan
      </h3>
      <div class="rate-plans">
        @for (rp of ratePlans(); track rp.id) {
          <button
            class="rate-card"
            [class.active]="selectedRatePlanId() === rp.id"
            (click)="selectedRatePlanId.set(rp.id)">
            <div class="rate-card__top">
              <span class="rate-name">{{ rp.name }}</span>
              <span class="rate-price">{{ nightlyRate(rp) | currency }}<span class="rate-per">/night</span></span>
            </div>
            <div class="rate-card__tags">
              @if (rp.refundable) {
                <span class="rate-tag rate-tag--green">Refundable</span>
              } @else {
                <span class="rate-tag rate-tag--red">Non-refundable</span>
              }
              @if (rp.includesBreakfast) {
                <span class="rate-tag rate-tag--blue">Breakfast incl.</span>
              }
            </div>
          </button>
        }
      </div>
    </section>

    <!-- Step 4: Special requests -->
    <section class="form-section form-section--last">
      <h3 class="form-section__title">
        <span class="step-num">4</span>Special Requests
        <span class="optional">optional</span>
      </h3>
      <textarea
        class="textarea"
        rows="2"
        placeholder="Early check-in, allergy info, bed preference…"
        [ngModel]="specialRequests()"
        (ngModelChange)="specialRequests.set($event)">
      </textarea>
    </section>

  </div><!-- /modal-body -->

  <!-- Footer -->
  <div class="modal-footer">
    <div class="price-summary">
      @if (selectedPlan()) {
        <div class="price-breakdown">
          <span class="price-label">{{ nights() }}n × {{ nightlyRate(selectedPlan()!) | currency }}</span>
          <span class="price-tax">+ tax (12%)</span>
        </div>
        <span class="price-total">{{ totalAmount() | currency }}</span>
      }
    </div>
    <div class="footer-actions">
      <button class="btn-cancel" (click)="cancel.emit()">Cancel</button>
      <button
        class="btn-confirm"
        [disabled]="!canConfirm()"
        (click)="onConfirm()">
        Create Reservation
      </button>
    </div>
  </div>

</div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(11,31,58,0.35);
      backdrop-filter: blur(3px);
      z-index: 300;
    }

    .modal-wrap {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 301;
      width: min(560px, calc(100vw - 32px));
      max-height: calc(100vh - 64px);
      background: var(--surface);
      border-radius: var(--radius-xl, 16px);
      box-shadow: 0 24px 64px rgba(0,0,0,0.22);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Header */
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-5) var(--space-6) var(--space-4);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .modal-header__left { display: flex; align-items: center; gap: var(--space-3); }
    .modal-icon {
      width: 40px; height: 40px;
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      color: var(--primary);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .modal-title {
      font-size: var(--text-lg); font-weight: 700;
      color: var(--text); margin: 0; line-height: 1.2;
    }
    .modal-sub {
      font-size: var(--text-xs); color: var(--text-muted); margin: 2px 0 0;
    }
    .btn-close {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border: none; background: var(--surface-2);
      border-radius: var(--radius-full);
      cursor: pointer; color: var(--text-muted);
      transition: all var(--t-fast);
      flex-shrink: 0;
      &:hover { background: var(--danger-bg); color: var(--danger); }
    }

    /* Dates strip */
    .dates-strip {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-3) var(--space-6);
      background: color-mix(in srgb, var(--primary) 5%, var(--surface-2));
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .date-block { display: flex; flex-direction: column; gap: 2px; }
    .date-block--right { text-align: right; }
    .date-lbl {
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--text-subtle);
    }
    .date-val { font-size: var(--text-sm); font-weight: 600; color: var(--text); }
    .date-sep {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      color: var(--text-subtle);
    }
    .nights-pill {
      font-size: 11px; font-weight: 700;
      background: var(--primary); color: var(--on-primary);
      padding: 2px 8px; border-radius: var(--radius-full);
    }

    /* Body */
    .modal-body {
      flex: 1; overflow-y: auto;
      padding: var(--space-2) var(--space-6);
    }

    /* Form sections */
    .form-section {
      padding: var(--space-4) 0;
      border-bottom: 1px solid var(--border);
    }
    .form-section--last { border-bottom: none; }
    .form-section__title {
      display: flex; align-items: center; gap: var(--space-2);
      font-size: var(--text-xs); font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--text-subtle); margin: 0 0 var(--space-3);
    }
    .step-num {
      width: 18px; height: 18px;
      border-radius: 50%;
      background: var(--primary); color: var(--on-primary);
      font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .optional {
      font-size: 10px; font-weight: 400;
      color: var(--text-subtle); text-transform: none;
      letter-spacing: 0; margin-left: auto;
    }

    /* Guest search */
    .search-wrap { position: relative; }
    .search-input-wrap {
      display: flex; align-items: center; gap: var(--space-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0 var(--space-3);
      background: var(--surface);
      transition: border-color var(--t-fast);
      &:focus-within { border-color: var(--primary); }
    }
    .search-icon { color: var(--text-subtle); flex-shrink: 0; }
    .search-input {
      flex: 1; height: 40px;
      border: none; background: transparent; outline: none;
      font-size: var(--text-sm); color: var(--text);
      &::placeholder { color: var(--text-subtle); }
    }
    .search-spinner {
      width: 14px; height: 14px; flex-shrink: 0;
      border: 2px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .search-results {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-3);
      z-index: 10;
      overflow: hidden;
      max-height: 220px; overflow-y: auto;
    }
    .search-result {
      width: 100%;
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: none; background: transparent; cursor: pointer; text-align: left;
      transition: background var(--t-fast);
      &:hover { background: var(--surface-2); }
    }
    .result-avatar {
      width: 34px; height: 34px; border-radius: var(--radius-full);
      background: var(--primary); color: var(--on-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; flex-shrink: 0;
    }
    .result-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .result-name { font-size: var(--text-sm); font-weight: 600; color: var(--text); }
    .result-meta { font-size: var(--text-xs); color: var(--text-muted); }
    .result-tier {
      font-size: 10px; font-weight: 700; padding: 2px 6px;
      border-radius: var(--radius-sm); text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .result-tier--gold     { background: #fef3c7; color: #92400e; }
    .result-tier--silver   { background: #f1f5f9; color: #475569; }
    .result-tier--platinum { background: #1e293b; color: #fbbf24; }
    .result-tier--bronze   { background: #fdf0e8; color: #7c4a1e; }
    .search-empty-wrap {
      display: flex; flex-direction: column; gap: var(--space-2);
      padding: var(--space-3) 0 0;
    }
    .search-empty-text {
      font-size: var(--text-sm); color: var(--text-muted);
      margin: 0; text-align: center;
    }
    .btn-create-from-empty {
      display: flex; align-items: center; justify-content: center; gap: var(--space-2);
      width: 100%; height: 38px;
      border: 1px dashed color-mix(in srgb, var(--primary) 45%, var(--border));
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--primary) 6%, var(--surface));
      color: var(--primary);
      font-size: var(--text-sm); font-weight: 600;
      cursor: pointer;
      transition: all var(--t-fast);
      &:hover {
        border-style: solid;
        background: color-mix(in srgb, var(--primary) 10%, var(--surface));
      }
    }

    /* Inline "+ New" button inside the search input */
    .btn-new-guest {
      display: flex; align-items: center; gap: 4px;
      height: 28px; padding: 0 10px;
      margin-left: var(--space-2);
      border: 1px solid var(--border);
      background: var(--surface-2);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      font-size: var(--text-xs); font-weight: 600;
      cursor: pointer; flex-shrink: 0;
      transition: all var(--t-fast);
      &:hover {
        color: var(--primary);
        border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
        background: color-mix(in srgb, var(--primary) 8%, var(--surface));
      }
    }

    /* Create-guest inline form */
    .create-guest {
      border: 1px solid color-mix(in srgb, var(--primary) 20%, var(--border));
      background: color-mix(in srgb, var(--primary) 4%, var(--surface-2));
      border-radius: var(--radius-md);
      padding: var(--space-4);
      display: flex; flex-direction: column; gap: var(--space-3);
    }
    .create-guest__header {
      display: flex; align-items: center; justify-content: space-between;
    }
    .create-guest__title {
      font-size: var(--text-sm); font-weight: 600; color: var(--text);
    }
    .btn-back {
      display: flex; align-items: center; gap: 4px;
      font-size: var(--text-xs); color: var(--text-muted);
      background: none; border: none; cursor: pointer; padding: 4px 6px;
      border-radius: var(--radius-sm);
      transition: all var(--t-fast);
      &:hover { color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, transparent); }
    }
    .create-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field--full { grid-column: 1 / -1; }
    .field-lbl {
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .req { color: var(--danger); }
    .field-input {
      width: 100%; box-sizing: border-box;
      height: 36px; padding: 0 var(--space-3);
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface); color: var(--text);
      font-size: var(--text-sm); font-family: inherit;
      outline: none; transition: border-color var(--t-fast);
      &:focus { border-color: var(--primary); }
      &::placeholder { color: var(--text-subtle); }
    }
    .create-error {
      font-size: var(--text-xs); color: var(--danger);
      background: var(--danger-bg);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
    }
    .create-actions {
      display: flex; justify-content: flex-end; gap: var(--space-2);
    }
    .btn-create-cancel {
      height: 36px; padding: 0 var(--space-4);
      border: 1px solid var(--border); background: transparent;
      border-radius: var(--radius-md);
      font-size: var(--text-sm); color: var(--text-muted);
      cursor: pointer;
      transition: all var(--t-fast);
      &:hover { border-color: var(--border-strong); color: var(--text); }
    }
    .btn-create-save {
      display: inline-flex; align-items: center; gap: var(--space-2);
      height: 36px; padding: 0 var(--space-4);
      border: none; background: var(--primary); color: var(--on-primary);
      border-radius: var(--radius-md);
      font-size: var(--text-sm); font-weight: 600; cursor: pointer;
      transition: filter var(--t-fast);
      &:hover:not(:disabled) { filter: brightness(1.08); }
      &:disabled { opacity: 0.45; cursor: not-allowed; }
    }
    .search-spinner--on-primary {
      border-color: color-mix(in srgb, var(--on-primary) 35%, transparent);
      border-top-color: var(--on-primary);
    }

    /* Selected guest */
    .guest-selected {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: color-mix(in srgb, var(--primary) 6%, var(--surface-2));
      border: 1px solid color-mix(in srgb, var(--primary) 20%, var(--border));
      border-radius: var(--radius-md);
    }
    .guest-avatar {
      width: 36px; height: 36px; border-radius: var(--radius-full);
      background: var(--primary); color: var(--on-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }
    .guest-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .guest-name { font-size: var(--text-sm); font-weight: 600; color: var(--text); }
    .guest-meta { font-size: var(--text-xs); color: var(--text-muted); }
    .btn-change {
      font-size: var(--text-xs); color: var(--primary);
      background: none; border: none; cursor: pointer;
      text-decoration: underline; padding: 0;
      &:hover { color: var(--primary-hover); }
    }

    /* Occupancy counters */
    .occ-row {
      display: flex; align-items: center; gap: var(--space-5);
    }
    .counter-group { display: flex; flex-direction: column; gap: var(--space-1); }
    .counter-label { font-size: var(--text-xs); color: var(--text-muted); font-weight: 500; }
    .counter {
      display: flex; align-items: center;
      border: 1px solid var(--border); border-radius: var(--radius-md);
      overflow: hidden;
    }
    .counter-btn {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border: none; background: var(--surface-2); cursor: pointer;
      font-size: var(--text-md); color: var(--text); line-height: 1;
      transition: background var(--t-fast);
      &:hover { background: var(--surface-3); }
    }
    .counter-val {
      width: 36px; text-align: center;
      font-size: var(--text-sm); font-weight: 600; color: var(--text);
    }
    .occ-cap {
      font-size: var(--text-xs); color: var(--text-subtle);
      margin-top: 18px;
    }

    /* Rate plans */
    .rate-plans { display: flex; flex-direction: column; gap: var(--space-2); }
    .rate-card {
      width: 100%; text-align: left;
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface); cursor: pointer;
      transition: all var(--t-fast);
      &:hover { border-color: var(--border-strong); }
      &.active {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 5%, var(--surface));
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
      }
    }
    .rate-card__top {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: var(--space-2);
    }
    .rate-name { font-size: var(--text-sm); font-weight: 600; color: var(--text); }
    .rate-price { font-size: var(--text-md); font-weight: 700; color: var(--primary); }
    .rate-per { font-size: var(--text-xs); font-weight: 400; color: var(--text-muted); }
    .rate-card__tags { display: flex; gap: var(--space-2); }
    .rate-tag {
      font-size: 10px; font-weight: 600; padding: 2px 7px;
      border-radius: var(--radius-full); text-transform: uppercase; letter-spacing: 0.04em;
    }
    .rate-tag--green { background: var(--success-bg); color: var(--success); }
    .rate-tag--red   { background: var(--danger-bg);  color: var(--danger); }
    .rate-tag--blue  { background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); }

    /* Textarea */
    .textarea {
      width: 100%; box-sizing: border-box;
      padding: var(--space-3); resize: vertical;
      border: 1px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface); color: var(--text);
      font-size: var(--text-sm); font-family: inherit; line-height: 1.5;
      outline: none; transition: border-color var(--t-fast);
      &:focus { border-color: var(--primary); }
      &::placeholder { color: var(--text-subtle); }
    }

    /* Footer */
    .modal-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid var(--border);
      background: var(--surface); flex-shrink: 0;
    }
    .price-summary { display: flex; flex-direction: column; gap: 2px; }
    .price-breakdown { display: flex; gap: var(--space-2); align-items: center; }
    .price-label { font-size: var(--text-xs); color: var(--text-muted); }
    .price-tax   { font-size: var(--text-xs); color: var(--text-subtle); }
    .price-total { font-size: var(--text-xl); font-weight: 700; color: var(--text); }
    .footer-actions { display: flex; gap: var(--space-2); }
    .btn-cancel {
      height: 40px; padding: 0 var(--space-5);
      border: 1px solid var(--border); background: transparent;
      border-radius: var(--radius-md); font-size: var(--text-sm);
      color: var(--text-muted); cursor: pointer;
      transition: all var(--t-fast);
      &:hover { border-color: var(--border-strong); color: var(--text); }
    }
    .btn-confirm {
      height: 40px; padding: 0 var(--space-6);
      border: none; background: var(--primary); color: var(--on-primary);
      border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 600;
      cursor: pointer; transition: filter var(--t-fast);
      &:hover:not(:disabled) { filter: brightness(1.08); }
      &:disabled { opacity: 0.45; cursor: not-allowed; }
    }
  `],
})
export class NewReservationModalComponent implements OnInit {
  private guestSvc  = inject(GUEST_SERVICE);
  private destroyRef = inject(DestroyRef);

  // Inputs
  roomId     = input.required<string>();
  roomTypeId = input.required<string>();
  checkIn    = input.required<Date>();
  checkOut   = input.required<Date>();
  nights     = input.required<number>();
  room       = input<Room | null>(null);
  roomType   = input<RoomType | null>(null);
  ratePlans  = input<RatePlan[]>([]);

  // Outputs
  confirm = output<NewReservationPayload>();
  cancel  = output<void>();

  // State
  searchQuery      = signal('');
  searchResults    = signal<Guest[]>([]);
  searchLoading    = signal(false);
  showResults      = signal(false);
  selectedGuest    = signal<Guest | null>(null);
  adults           = signal(1);
  children         = signal(0);
  selectedRatePlanId = signal('');
  specialRequests  = signal('');

  // New-guest creation state
  showCreateForm = signal(false);
  newFirstName   = signal('');
  newLastName    = signal('');
  newEmail       = signal('');
  newPhone       = signal('');
  creating       = signal(false);
  createError    = signal<string | null>(null);

  // Expose Math for template
  readonly Math = Math;

  maxOcc = computed(() => this.roomType()?.maxOccupancy ?? 4);

  selectedPlan = computed(() =>
    this.ratePlans().find(rp => rp.id === this.selectedRatePlanId()) ?? null
  );

  nightlyRate(rp: RatePlan): number {
    return (this.roomType()?.basePrice ?? 0) * rp.multiplier;
  }

  totalRoomCharge = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) return 0;
    return this.nightlyRate(plan) * this.nights();
  });

  totalAmount = computed(() => {
    const charge = this.totalRoomCharge();
    return charge + charge * 0.12; // 12% tax
  });

  canConfirm = computed(() =>
    !!this.selectedGuest() && !!this.selectedPlan()
  );

  canCreateGuest = computed(() =>
    this.newFirstName().trim().length > 0 &&
    this.newLastName().trim().length > 0 &&
    isValidEmail(this.newEmail()) &&
    this.newPhone().trim().length >= 4
  );

  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    // Auto-select first rate plan
    if (this.ratePlans().length) {
      this.selectedRatePlanId.set(this.ratePlans()[0].id);
    }

    // Debounced search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q.length > 1
        ? this.guestSvc.search(q)
        : of([])
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => {
      this.searchResults.set(results);
      this.searchLoading.set(false);
    });
  }

  onSearchChange(q: string): void {
    this.searchQuery.set(q);
    if (q.length > 1) {
      this.searchLoading.set(true);
      this.searchSubject.next(q);
    } else {
      this.searchResults.set([]);
      this.searchLoading.set(false);
    }
  }

  selectGuest(g: Guest): void {
    this.selectedGuest.set(g);
    this.showResults.set(false);
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  clearGuest(): void {
    this.selectedGuest.set(null);
  }

  openCreateForm(): void {
    // Smart-prefill from current search query
    const q = this.searchQuery().trim();
    if (q) {
      if (q.includes('@')) {
        this.newEmail.set(q);
      } else if (/^[\+\d][\d\s\-()]{3,}$/.test(q)) {
        this.newPhone.set(q);
      } else {
        const parts = q.split(/\s+/);
        this.newFirstName.set(parts[0] ?? '');
        if (parts.length > 1) {
          this.newLastName.set(parts.slice(1).join(' '));
        }
      }
    }
    this.createError.set(null);
    this.showResults.set(false);
    this.showCreateForm.set(true);
  }

  cancelCreateForm(): void {
    this.showCreateForm.set(false);
    this.newFirstName.set('');
    this.newLastName.set('');
    this.newEmail.set('');
    this.newPhone.set('');
    this.createError.set(null);
    this.creating.set(false);
  }

  submitNewGuest(): void {
    if (!this.canCreateGuest() || this.creating()) return;
    this.creating.set(true);
    this.createError.set(null);

    this.guestSvc.create({
      firstName: this.newFirstName().trim(),
      lastName:  this.newLastName().trim(),
      email:     this.newEmail().trim(),
      phone:     this.newPhone().trim(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (g) => {
          this.creating.set(false);
          this.showCreateForm.set(false);
          // Reset fields after a successful save
          this.newFirstName.set('');
          this.newLastName.set('');
          this.newEmail.set('');
          this.newPhone.set('');
          this.selectGuest(g);
        },
        error: () => {
          this.creating.set(false);
          this.createError.set('Could not save guest. Please try again.');
        },
      });
  }

  initials(g: Guest): string {
    return `${g.firstName[0] ?? ''}${g.lastName[0] ?? ''}`.toUpperCase();
  }

  onConfirm(): void {
    const guest = this.selectedGuest();
    const plan  = this.selectedPlan();
    if (!guest || !plan) return;

    const charge = this.totalRoomCharge();
    const tax    = charge * 0.12;

    this.confirm.emit({
      roomId:           this.roomId(),
      roomTypeId:       this.roomTypeId(),
      checkIn:          this.checkIn(),
      checkOut:         this.checkOut(),
      nights:           this.nights(),
      guestId:          guest.id,
      adults:           this.adults(),
      children:         this.children(),
      ratePlanId:       plan.id,
      totalRoomCharge:  charge,
      totalTax:         tax,
      totalAmount:      charge + tax,
      totalPaid:        0,
      totalExtras:      0,
      balance:          charge + tax,
      status:           ReservationStatus.Confirmed,
      source:           BookingSource.Direct,
      specialRequests:  this.specialRequests() || undefined,
    });
  }
}
