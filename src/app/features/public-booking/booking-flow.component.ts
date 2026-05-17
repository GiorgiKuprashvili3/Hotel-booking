import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ToastService } from '../../core/ui/toast.service';
import { BookingBroadcastService } from '../../core/realtime/booking-broadcast.service';
import {
  GUEST_SERVICE, PROPERTY_SERVICE, RESERVATION_SERVICE, ROOM_SERVICE,
} from '../../data/services/service-tokens';
import { Property, RoomType, BookingSource } from '../../domain';

const FEATURED_PROPERTY_ID = 'prop-1';

const ROOM_IMAGES: Record<string, string> = {
  STD:  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=80',
  DLX:  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&q=80',
  STE:  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=900&q=80',
  EXC:  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900&q=80',
  PRES: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&q=80',
};
const ROOM_FALLBACK = 'https://images.unsplash.com/photo-1590490359683-658d3d23f972?w=900&q=80';

type Step = 'dates' | 'room' | 'guest' | 'payment' | 'confirmation';

const STEP_ORDER: Step[] = ['dates', 'room', 'guest', 'payment', 'confirmation'];
const STEP_LABELS: Record<Step, { num: number; label: string }> = {
  dates:        { num: 1, label: 'Dates & guests' },
  room:         { num: 2, label: 'Choose room' },
  guest:        { num: 3, label: 'Your details' },
  payment:      { num: 4, label: 'Payment' },
  confirmation: { num: 5, label: 'Confirmation' },
};

interface ConfirmationView {
  confirmationNumber: string;
  roomTypeName: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guestName: string;
  email: string;
  totalAmount: number;
}

@Component({
  selector: 'lux-booking-flow',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatIconModule, MatButtonModule,
    SkeletonComponent, EmptyStateComponent,
  ],
  template: `
    <div class="booking-page">
      <!-- ── STEP INDICATOR ── -->
      <nav class="stepper" aria-label="Booking progress">
        <ol>
          @for (s of stepsList; track s) {
            <li [class.is-active]="s === step()"
                [class.is-done]="isDone(s)"
                [attr.aria-current]="s === step() ? 'step' : null">
              <span class="step-circle">
                @if (isDone(s)) {
                  <mat-icon aria-hidden="true">check</mat-icon>
                } @else {
                  {{ stepLabels[s].num }}
                }
              </span>
              <span class="step-label">{{ stepLabels[s].label }}</span>
            </li>
          }
        </ol>
      </nav>

      <div class="booking-layout" [class.full-width]="step() === 'confirmation'">
        <!-- ── MAIN PANE ── -->
        <section class="booking-main" aria-live="polite">

          <!-- STEP 1: DATES & GUESTS -->
          @if (step() === 'dates') {
            <header class="step-header">
              <h2>When are you visiting?</h2>
              <p>Tell us your dates so we can show you what's available.</p>
            </header>

            <form class="step-form" (ngSubmit)="goNext()" novalidate>
              <div class="form-row two">
                <div class="form-field">
                  <label for="checkIn">Check in</label>
                  <input id="checkIn"
                         type="date"
                         [min]="todayIso"
                         [(ngModel)]="checkIn"
                         name="checkIn"
                         required
                         [attr.aria-invalid]="dateError() ? 'true' : null" />
                </div>
                <div class="form-field">
                  <label for="checkOut">Check out</label>
                  <input id="checkOut"
                         type="date"
                         [min]="minCheckoutIso()"
                         [(ngModel)]="checkOut"
                         name="checkOut"
                         required
                         [attr.aria-invalid]="dateError() ? 'true' : null" />
                </div>
              </div>

              <div class="form-row two">
                <div class="form-field">
                  <label for="adults">Adults</label>
                  <select id="adults" [(ngModel)]="adults" name="adults">
                    @for (n of [1,2,3,4]; track n) {
                      <option [ngValue]="n">{{ n }} adult{{ n > 1 ? 's' : '' }}</option>
                    }
                  </select>
                </div>
                <div class="form-field">
                  <label for="children">Children</label>
                  <select id="children" [(ngModel)]="children" name="children">
                    @for (n of [0,1,2,3]; track n) {
                      <option [ngValue]="n">{{ n }} {{ n === 1 ? 'child' : 'children' }}</option>
                    }
                  </select>
                </div>
              </div>

              @if (dateError()) {
                <div class="field-error" role="alert">
                  <mat-icon>error_outline</mat-icon>
                  {{ dateError() }}
                </div>
              }

              @if (!dateError() && nights() > 0) {
                <div class="step-stay-summary">
                  <mat-icon>info</mat-icon>
                  <span>{{ nights() }} night{{ nights() > 1 ? 's' : '' }} ·
                    {{ totalGuests() }} guest{{ totalGuests() > 1 ? 's' : '' }}</span>
                </div>
              }

              <div class="step-actions">
                <a routerLink="/book" class="back-btn">
                  <mat-icon>arrow_back</mat-icon> Back to hotel
                </a>
                <button mat-flat-button color="primary" type="submit"
                        [disabled]="!!dateError()">
                  Continue
                  <mat-icon>arrow_forward</mat-icon>
                </button>
              </div>
            </form>
          }

          <!-- STEP 2: ROOM SELECTION -->
          @if (step() === 'room') {
            <header class="step-header">
              <h2>Choose your room</h2>
              <p>All rates include taxes. Free cancellation up to 24 hours before arrival.</p>
            </header>

            @if (loadingRooms()) {
              <div class="room-list">
                @for (i of [1,2,3]; track i) {
                  <div class="room-option is-loading">
                    <lux-skeleton width="200px" height="140px" radius="var(--radius-md)" />
                    <div class="room-info">
                      <lux-skeleton width="50%" height="20px" />
                      <lux-skeleton width="80%" height="14px" />
                      <lux-skeleton width="60%" height="14px" />
                    </div>
                  </div>
                }
              </div>
            } @else if (availableRooms().length === 0) {
              <lux-empty-state
                icon="hotel"
                title="No rooms available for these dates"
                message="Try different dates, or call our reservations team for assistance.">
                <button mat-stroked-button (click)="goBack()">Change dates</button>
              </lux-empty-state>
            } @else {
              <fieldset class="room-list" [attr.aria-label]="'Choose from ' + availableRooms().length + ' room types'">
                <legend class="sr-only">Available room types</legend>
                @for (rt of availableRooms(); track rt.id) {
                  <label class="room-option"
                         [class.is-selected]="selectedRoomTypeId() === rt.id">
                    <input type="radio"
                           name="roomType"
                           [value]="rt.id"
                           [checked]="selectedRoomTypeId() === rt.id"
                           (change)="selectedRoomTypeId.set(rt.id)" />
                    <img [src]="imageFor(rt)" [alt]="rt.name + ' room photograph'" loading="lazy" />
                    <div class="room-info">
                      <div class="room-info-top">
                        <h3>{{ rt.name }}</h3>
                        <div class="room-price">
                          <span class="price">₾{{ rt.basePrice }}</span>
                          <span class="price-meta">/ night</span>
                        </div>
                      </div>
                      <div class="room-meta">
                        <span><mat-icon aria-hidden="true">bed</mat-icon> {{ rt.bedConfiguration }}</span>
                        <span><mat-icon aria-hidden="true">straighten</mat-icon> {{ rt.sizeSqm }} m²</span>
                        <span><mat-icon aria-hidden="true">people</mat-icon> Sleeps {{ rt.maxOccupancy }}</span>
                      </div>
                      <p class="room-desc">{{ rt.description }}</p>
                      @if (nights() > 0) {
                        <div class="room-total">
                          ₾{{ rt.basePrice * nights() | number:'1.0-0' }} for {{ nights() }} nights, incl. tax
                        </div>
                      }
                    </div>
                    <div class="room-check" aria-hidden="true">
                      <mat-icon>check_circle</mat-icon>
                    </div>
                  </label>
                }
              </fieldset>
            }

            <div class="step-actions">
              <button mat-stroked-button (click)="goBack()">
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-flat-button color="primary"
                      (click)="goNext()"
                      [disabled]="!selectedRoomTypeId()">
                Continue
                <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          }

          <!-- STEP 3: GUEST DETAILS -->
          @if (step() === 'guest') {
            <header class="step-header">
              <h2>Your details</h2>
              <p>We'll send your confirmation to this email.</p>
            </header>

            <form class="step-form" (ngSubmit)="goNext()" novalidate>
              <div class="form-row two">
                <div class="form-field">
                  <label for="firstName">First name <span class="req">*</span></label>
                  <input id="firstName" type="text" autocomplete="given-name"
                         [(ngModel)]="firstName" name="firstName" required
                         [attr.aria-invalid]="touched() && !firstName ? 'true' : null" />
                </div>
                <div class="form-field">
                  <label for="lastName">Last name <span class="req">*</span></label>
                  <input id="lastName" type="text" autocomplete="family-name"
                         [(ngModel)]="lastName" name="lastName" required
                         [attr.aria-invalid]="touched() && !lastName ? 'true' : null" />
                </div>
              </div>

              <div class="form-field">
                <label for="email">Email <span class="req">*</span></label>
                <input id="email" type="email" autocomplete="email"
                       [(ngModel)]="email" name="email" required
                       [attr.aria-invalid]="touched() && !validEmail() ? 'true' : null" />
              </div>

              <div class="form-row two">
                <div class="form-field">
                  <label for="phone">Phone</label>
                  <input id="phone" type="tel" autocomplete="tel"
                         [(ngModel)]="phone" name="phone" placeholder="+995 …" />
                </div>
                <div class="form-field">
                  <label for="country">Country</label>
                  <input id="country" type="text" autocomplete="country-name"
                         [(ngModel)]="country" name="country" placeholder="Georgia" />
                </div>
              </div>

              <div class="form-field">
                <label for="requests">Special requests</label>
                <textarea id="requests" rows="3"
                          [(ngModel)]="specialRequests" name="requests"
                          placeholder="Early check-in, dietary needs, accessibility — let us know."></textarea>
              </div>

              @if (touched() && !canContinueGuestStep()) {
                <div class="field-error" role="alert">
                  <mat-icon>error_outline</mat-icon>
                  Please complete the required fields with a valid email.
                </div>
              }

              <div class="step-actions">
                <button mat-stroked-button type="button" (click)="goBack()">
                  <mat-icon>arrow_back</mat-icon> Back
                </button>
                <button mat-flat-button color="primary" type="submit">
                  Continue to payment
                  <mat-icon>arrow_forward</mat-icon>
                </button>
              </div>
            </form>
          }

          <!-- STEP 4: PAYMENT (FAKE) -->
          @if (step() === 'payment') {
            <header class="step-header">
              <h2>Payment</h2>
              <p>Your card won't be charged today — a small deposit will be authorised at check-in.</p>
            </header>

            <div class="demo-banner" role="note">
              <mat-icon>verified_user</mat-icon>
              <div>
                <strong>Demo mode</strong>
                <p>This is a portfolio project — no real payment is processed.
                  Enter any details to continue.</p>
              </div>
            </div>

            <form class="step-form payment-form" (ngSubmit)="submitBooking()" novalidate>
              <div class="form-field">
                <label for="cardName">Cardholder name</label>
                <input id="cardName" type="text" autocomplete="cc-name"
                       [(ngModel)]="cardName" name="cardName"
                       placeholder="As shown on card"
                       [attr.aria-invalid]="paymentTouched() && !cardName.trim() ? 'true' : null" />
              </div>

              <div class="form-field">
                <label for="cardNumber">Card number</label>
                <div class="input-with-icon">
                  <input id="cardNumber" type="text" inputmode="numeric"
                         autocomplete="cc-number"
                         [ngModel]="cardNumber()"
                         (ngModelChange)="onCardChange($event)"
                         name="cardNumber"
                         placeholder="•••• •••• •••• ••••"
                         maxlength="19"
                         [attr.aria-invalid]="paymentTouched() && !validCardNumber() ? 'true' : null" />
                  <mat-icon class="card-icon" aria-hidden="true">credit_card</mat-icon>
                </div>
              </div>

              <div class="form-row two">
                <div class="form-field">
                  <label for="cardExpiry">Expiry</label>
                  <input id="cardExpiry" type="text" inputmode="numeric"
                         autocomplete="cc-exp"
                         [ngModel]="cardExpiry()"
                         (ngModelChange)="onExpiryChange($event)"
                         name="cardExpiry"
                         placeholder="MM/YY" maxlength="5"
                         [attr.aria-invalid]="paymentTouched() && !validExpiry() ? 'true' : null" />
                </div>
                <div class="form-field">
                  <label for="cardCvc">CVC</label>
                  <input id="cardCvc" type="text" inputmode="numeric"
                         autocomplete="cc-csc"
                         [(ngModel)]="cardCvc" name="cardCvc"
                         placeholder="•••" maxlength="4"
                         [attr.aria-invalid]="paymentTouched() && !validCvc() ? 'true' : null" />
                </div>
              </div>

              <label class="checkbox">
                <input type="checkbox" [(ngModel)]="termsAccepted" name="terms" />
                <span>I agree to the <a href="#" (click)="$event.preventDefault()">booking terms</a>
                  and free cancellation up to 24 hours before arrival.</span>
              </label>

              @if (paymentTouched() && !canSubmitPayment()) {
                <div class="field-error" role="alert">
                  <mat-icon>error_outline</mat-icon>
                  Please fill in all card details and accept the terms to continue.
                </div>
              }
              @if (submitError()) {
                <div class="field-error" role="alert">
                  <mat-icon>error_outline</mat-icon>
                  {{ submitError() }}
                </div>
              }

              <div class="step-actions">
                <button mat-stroked-button type="button" (click)="goBack()" [disabled]="submitting()">
                  <mat-icon>arrow_back</mat-icon> Back
                </button>
                <button mat-flat-button color="primary" type="submit"
                        [disabled]="submitting() || !canSubmitPayment()">
                  @if (submitting()) {
                    <span class="spinner" aria-hidden="true"></span>
                    Confirming reservation…
                  } @else {
                    <ng-container>
                      Confirm booking · ₾{{ total() | number:'1.0-0' }}
                      <mat-icon>lock</mat-icon>
                    </ng-container>
                  }
                </button>
              </div>
            </form>
          }

          <!-- STEP 5: CONFIRMATION -->
          @if (step() === 'confirmation' && confirmation()) {
            <div class="confirmation">
              <div class="confirmation-icon" aria-hidden="true">
                <mat-icon>check_circle</mat-icon>
              </div>
              <h2>You're booked!</h2>
              <p class="confirmation-sub">
                We've sent a confirmation to <strong>{{ confirmation()!.email }}</strong>.
                We look forward to welcoming you to The Aurora.
              </p>

              <div class="confirmation-card">
                <div class="confirmation-card-header">
                  <span class="confirmation-eyebrow">Confirmation number</span>
                  <span class="confirmation-num">{{ confirmation()!.confirmationNumber }}</span>
                </div>

                <dl class="confirmation-grid">
                  <div>
                    <dt>Guest</dt>
                    <dd>{{ confirmation()!.guestName }}</dd>
                  </div>
                  <div>
                    <dt>Room</dt>
                    <dd>{{ confirmation()!.roomTypeName }}</dd>
                  </div>
                  <div>
                    <dt>Check in</dt>
                    <dd>{{ confirmation()!.checkIn | date:'EEE, MMM d, y' }}</dd>
                  </div>
                  <div>
                    <dt>Check out</dt>
                    <dd>{{ confirmation()!.checkOut | date:'EEE, MMM d, y' }}</dd>
                  </div>
                  <div>
                    <dt>Nights</dt>
                    <dd>{{ confirmation()!.nights }}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>₾{{ confirmation()!.totalAmount | number:'1.0-0' }}</dd>
                  </div>
                </dl>
              </div>

              <div class="confirmation-actions">
                <a mat-stroked-button routerLink="/book">Back to hotel</a>
                <button mat-flat-button color="primary" (click)="startNew()">Make another booking</button>
              </div>

              <p class="demo-note">
                <mat-icon>science</mat-icon>
                Open the admin dashboard in another tab — your booking will appear in real-time.
              </p>
            </div>
          }
        </section>

        <!-- ── SUMMARY (sticky) ── -->
        @if (step() !== 'confirmation') {
          <aside class="booking-summary" aria-label="Booking summary">
            <div class="summary-card">
              @if (property(); as p) {
                <img class="summary-img"
                     [src]="'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=600&q=80'"
                     [alt]="p.name + ' exterior'" />
                <div class="summary-property">
                  <h3>{{ p.name }}</h3>
                  <span class="summary-loc">{{ p.address }}</span>
                  <span class="summary-stars">
                    @for (_ of [1,2,3,4,5]; track $index) {
                      <mat-icon>star</mat-icon>
                    }
                  </span>
                </div>
              }

              <div class="summary-section">
                <div class="summary-row">
                  <span>Check in</span>
                  <strong>{{ checkInDate() | date:'MMM d, y' }}</strong>
                </div>
                <div class="summary-row">
                  <span>Check out</span>
                  <strong>{{ checkOutDate() | date:'MMM d, y' }}</strong>
                </div>
                <div class="summary-row">
                  <span>Nights</span>
                  <strong>{{ nights() }}</strong>
                </div>
                <div class="summary-row">
                  <span>Guests</span>
                  <strong>{{ totalGuests() }}</strong>
                </div>
              </div>

              @if (selectedRoomType()) {
                <div class="summary-section">
                  <div class="summary-row">
                    <span>{{ selectedRoomType()!.name }}</span>
                    <strong>₾{{ selectedRoomType()!.basePrice }} × {{ nights() }}</strong>
                  </div>
                  <div class="summary-row">
                    <span>Subtotal</span>
                    <strong>₾{{ subtotal() | number:'1.0-0' }}</strong>
                  </div>
                  <div class="summary-row">
                    <span>Tax (18%)</span>
                    <strong>₾{{ tax() | number:'1.0-0' }}</strong>
                  </div>
                </div>

                <div class="summary-total">
                  <span>Total</span>
                  <strong>₾{{ total() | number:'1.0-0' }}</strong>
                </div>
              } @else {
                <div class="summary-empty">Select a room to see pricing</div>
              }
            </div>
          </aside>
        }
      </div>
    </div>
  `,
  styles: [`
    .booking-page {
      max-width: var(--content-max);
      margin: 0 auto;
      padding: var(--space-6);
    }

    /* ── Stepper ────────────────────────────────────────────── */
    .stepper {
      margin-bottom: var(--space-8);
      overflow-x: auto;
    }
    .stepper ol {
      display: flex;
      justify-content: space-between;
      list-style: none; padding: 0; margin: 0;
      gap: var(--space-2);
      min-width: 0;
    }
    .stepper li {
      display: flex; align-items: center; gap: var(--space-2);
      flex: 1;
      position: relative;
      font-size: var(--text-sm);
      color: var(--text-muted);
      min-width: 0;
    }
    .stepper li:not(:last-child)::after {
      content: '';
      flex: 1; height: 1px;
      background: var(--border-strong);
      margin-left: var(--space-2);
    }
    .stepper li.is-done:not(:last-child)::after { background: var(--success); }
    .step-circle {
      width: 28px; height: 28px; min-width: 28px;
      border-radius: 50%;
      background: var(--surface);
      border: 1.5px solid var(--border-strong);
      display: flex; align-items: center; justify-content: center;
      font-size: var(--text-xs); font-weight: 700;
      color: var(--text-muted);
      transition: all var(--t-fast);
    }
    .step-label {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .is-active .step-circle {
      background: var(--primary);
      color: var(--on-primary);
      border-color: var(--primary);
    }
    .is-active .step-label { color: var(--text); font-weight: 600; }
    .is-done .step-circle {
      background: var(--success);
      color: white;
      border-color: var(--success);
    }
    .is-done .step-circle mat-icon {
      font-size: 16px !important; width: 16px !important; height: 16px !important;
    }
    .is-done .step-label { color: var(--text); }

    /* ── Layout ─────────────────────────────────────────────── */
    .booking-layout {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: var(--space-6);
      align-items: flex-start;
    }
    .booking-layout.full-width { grid-template-columns: 1fr; max-width: 720px; margin: 0 auto; }
    .booking-main {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: var(--space-8);
    }
    .step-header { margin-bottom: var(--space-6); }
    .step-header h2 {
      font-family: var(--font-display);
      font-size: var(--text-3xl);
      font-weight: 700;
      margin-bottom: var(--space-2);
    }
    .step-header p {
      color: var(--text-muted);
      margin: 0;
    }

    /* ── Forms ──────────────────────────────────────────────── */
    .step-form { display: flex; flex-direction: column; gap: var(--space-5); }
    .form-row { display: grid; gap: var(--space-4); }
    .form-row.two { grid-template-columns: 1fr 1fr; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field label {
      font-size: var(--text-xs); font-weight: 600;
      color: var(--text-muted);
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    .req { color: var(--danger); margin-left: 2px; }
    .form-field input,
    .form-field select,
    .form-field textarea {
      padding: var(--space-3);
      background: var(--surface);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      font-family: inherit;
      font-size: var(--text-md);
      color: var(--text);
      transition: border-color var(--t-fast), box-shadow var(--t-fast);
    }
    .form-field input:focus,
    .form-field select:focus,
    .form-field textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(45, 90, 135, 0.12);
    }
    .form-field input[aria-invalid="true"],
    .form-field select[aria-invalid="true"] {
      border-color: var(--danger);
    }
    .input-with-icon { position: relative; }
    .input-with-icon input { padding-right: 44px; width: 100%; }
    .card-icon {
      position: absolute; right: var(--space-3);
      top: 50%; transform: translateY(-50%);
      color: var(--text-subtle);
    }

    .checkbox {
      display: flex; align-items: flex-start; gap: var(--space-2);
      font-size: var(--text-sm); color: var(--text-muted);
      cursor: pointer;
    }
    .checkbox input { margin-top: 2px; }

    .field-error {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-3);
      background: var(--danger-bg);
      color: var(--danger);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
    }
    .field-error mat-icon {
      font-size: 18px !important; width: 18px !important; height: 18px !important;
    }

    .step-stay-summary {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-3);
      background: var(--info-bg);
      color: var(--info);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
    }
    .step-stay-summary mat-icon {
      font-size: 18px !important; width: 18px !important; height: 18px !important;
    }

    .demo-banner {
      display: flex; align-items: flex-start; gap: var(--space-3);
      padding: var(--space-4);
      background: var(--gold-100);
      border: 1px solid var(--gold-300);
      border-radius: var(--radius-md);
      margin-bottom: var(--space-6);
    }
    .demo-banner mat-icon { color: var(--gold-700); flex-shrink: 0; }
    .demo-banner strong { display: block; color: var(--navy-900); }
    .demo-banner p {
      font-size: var(--text-sm); color: var(--ink-700);
      margin: 4px 0 0;
    }

    /* ── Step actions ───────────────────────────────────────── */
    .step-actions {
      display: flex; justify-content: space-between;
      align-items: center;
      gap: var(--space-3);
      margin-top: var(--space-4);
      padding-top: var(--space-5);
      border-top: 1px solid var(--border);
    }
    .back-btn {
      display: inline-flex; align-items: center; gap: var(--space-1);
      color: var(--text-muted);
      font-size: var(--text-sm); font-weight: 500;
      text-decoration: none;
    }
    .back-btn:hover { color: var(--text); }
    .back-btn mat-icon {
      font-size: 16px !important; width: 16px !important; height: 16px !important;
    }

    .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      margin-right: var(--space-2);
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .spinner { animation-duration: 2s; }
    }

    /* ── Room selection ─────────────────────────────────────── */
    .room-list {
      display: flex; flex-direction: column; gap: var(--space-3);
      border: none; padding: 0; margin: 0 0 var(--space-4);
    }
    .room-option {
      display: grid;
      grid-template-columns: 200px 1fr auto;
      gap: var(--space-4);
      padding: var(--space-3);
      background: var(--surface);
      border: 2px solid var(--border);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: border-color var(--t-fast), background var(--t-fast);
      position: relative;
    }
    .room-option:hover { border-color: var(--accent); }
    .room-option.is-selected {
      border-color: var(--primary);
      background: linear-gradient(180deg, var(--surface), rgba(45,90,135,0.03));
    }
    .room-option.is-loading { pointer-events: none; cursor: default; }
    .room-option input[type="radio"] {
      position: absolute; opacity: 0; pointer-events: none;
    }
    .room-option:has(input:focus-visible) {
      outline: 2px solid var(--accent); outline-offset: 2px;
    }
    .room-option img {
      width: 100%; height: 140px; object-fit: cover;
      border-radius: var(--radius-md);
    }
    .room-info { display: flex; flex-direction: column; gap: var(--space-2); }
    .room-info-top {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: var(--space-3);
    }
    .room-info h3 {
      font-family: var(--font-display);
      font-size: var(--text-xl); font-weight: 700;
      margin: 0;
    }
    .room-price { text-align: right; }
    .price {
      font-size: var(--text-xl); font-weight: 700;
      color: var(--text);
    }
    .price-meta { font-size: var(--text-xs); color: var(--text-muted); }
    .room-meta {
      display: flex; flex-wrap: wrap; gap: var(--space-3);
      font-size: var(--text-xs); color: var(--text-muted);
    }
    .room-meta span { display: inline-flex; align-items: center; gap: 4px; }
    .room-meta mat-icon {
      font-size: 14px !important; width: 14px !important; height: 14px !important;
    }
    .room-desc {
      font-size: var(--text-sm); color: var(--text-muted);
      margin: 0; line-height: 1.5;
    }
    .room-total {
      font-size: var(--text-xs); color: var(--success);
      font-weight: 600;
    }
    .room-check {
      display: flex; align-items: center; justify-content: center;
      width: 32px;
      color: var(--border-strong);
      transition: color var(--t-fast);
    }
    .room-option.is-selected .room-check { color: var(--primary); }

    /* ── Summary sidebar ────────────────────────────────────── */
    .booking-summary {
      position: sticky; top: 88px;
    }
    .summary-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .summary-img {
      width: 100%; height: 140px; object-fit: cover;
      display: block;
    }
    .summary-property {
      padding: var(--space-4);
      border-bottom: 1px solid var(--border);
    }
    .summary-property h3 {
      font-family: var(--font-display);
      font-size: var(--text-lg); font-weight: 700;
      margin-bottom: 2px;
    }
    .summary-loc { display: block; font-size: var(--text-xs); color: var(--text-muted); }
    .summary-stars { display: inline-flex; margin-top: var(--space-1); color: var(--accent); }
    .summary-stars mat-icon {
      font-size: 14px !important; width: 14px !important; height: 14px !important;
    }

    .summary-section {
      padding: var(--space-4);
      border-bottom: 1px solid var(--border);
    }
    .summary-row {
      display: flex; justify-content: space-between;
      font-size: var(--text-sm);
      padding: 4px 0;
    }
    .summary-row span { color: var(--text-muted); }
    .summary-row strong { color: var(--text); font-weight: 600; }
    .summary-total {
      display: flex; justify-content: space-between;
      align-items: baseline;
      padding: var(--space-4);
      background: var(--cream-100);
    }
    .summary-total span {
      font-size: var(--text-sm); color: var(--text-muted);
      font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .summary-total strong {
      font-family: var(--font-display);
      font-size: var(--text-2xl); font-weight: 700;
    }
    .summary-empty {
      padding: var(--space-4);
      text-align: center;
      font-size: var(--text-sm);
      color: var(--text-subtle);
    }

    /* ── Confirmation ───────────────────────────────────────── */
    .confirmation { text-align: center; padding: var(--space-6) 0; }
    .confirmation-icon {
      width: 72px; height: 72px;
      margin: 0 auto var(--space-5);
      background: var(--success-bg);
      color: var(--success);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      animation: pop 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .confirmation-icon mat-icon {
      font-size: 40px !important; width: 40px !important; height: 40px !important;
    }
    @keyframes pop { from { transform: scale(0); } to { transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) {
      .confirmation-icon { animation: none; }
    }
    .confirmation h2 {
      font-family: var(--font-display);
      font-size: var(--text-3xl); font-weight: 700;
      margin-bottom: var(--space-3);
    }
    .confirmation-sub {
      color: var(--text-muted);
      max-width: 50ch;
      margin: 0 auto var(--space-6);
    }
    .confirmation-card {
      max-width: 520px; margin: 0 auto;
      background: var(--cream-50);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .confirmation-card-header {
      padding: var(--space-4);
      background: var(--navy-900); color: white;
      text-align: center;
    }
    .confirmation-eyebrow {
      display: block;
      font-size: var(--text-xs);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--gold-300);
      margin-bottom: 4px;
    }
    .confirmation-num {
      font-family: var(--font-mono);
      font-size: var(--text-xl); font-weight: 700;
      color: white;
      letter-spacing: 0.04em;
    }
    .confirmation-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
      padding: var(--space-5);
      margin: 0;
      text-align: left;
    }
    .confirmation-grid dt {
      font-size: var(--text-xs);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
    }
    .confirmation-grid dd {
      margin: 2px 0 0;
      font-size: var(--text-sm); font-weight: 600;
      color: var(--text);
    }
    .confirmation-actions {
      display: flex; gap: var(--space-3);
      justify-content: center;
      margin-top: var(--space-6);
      flex-wrap: wrap;
    }
    .demo-note {
      margin-top: var(--space-6);
      padding: var(--space-3);
      background: var(--info-bg);
      color: var(--info);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      display: inline-flex; align-items: center; gap: var(--space-2);
    }
    .demo-note mat-icon {
      font-size: 18px !important; width: 18px !important; height: 18px !important;
    }

    .sr-only {
      position: absolute; width: 1px; height: 1px;
      padding: 0; margin: -1px; overflow: hidden;
      clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }

    /* ── Responsive ─────────────────────────────────────────── */
    @media (max-width: 1024px) {
      .booking-layout { grid-template-columns: 1fr; }
      .booking-summary { position: static; }
    }
    @media (max-width: 768px) {
      .booking-page { padding: var(--space-4); }
      .booking-main { padding: var(--space-5); }
      .form-row.two { grid-template-columns: 1fr; }
      .room-option {
        grid-template-columns: 1fr;
        gap: var(--space-3);
      }
      .room-option img { height: 180px; }
      .room-check { display: none; }
      .stepper { font-size: var(--text-xs); }
      .step-label { display: none; }
      .stepper li.is-active .step-label { display: inline; }
      .confirmation-grid { grid-template-columns: 1fr; }
      .step-actions { flex-direction: column-reverse; align-items: stretch; }
      .step-actions > * { width: 100%; justify-content: center; }
      .step-actions .back-btn { padding: var(--space-3); justify-content: center; }
    }
  `],
})
export class BookingFlowComponent {
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private propSvc     = inject(PROPERTY_SERVICE);
  private roomSvc     = inject(ROOM_SERVICE);
  private resSvc      = inject(RESERVATION_SERVICE);
  private guestSvc    = inject(GUEST_SERVICE);
  private toast       = inject(ToastService);
  private broadcast   = inject(BookingBroadcastService);

  stepLabels = STEP_LABELS;
  stepsList  = STEP_ORDER;

  step             = signal<Step>('dates');
  property         = signal<Property | undefined>(undefined);
  availableRooms   = signal<RoomType[]>([]);
  loadingRooms     = signal(false);
  submitting       = signal(false);
  submitError      = signal<string | null>(null);
  touched          = signal(false);
  paymentTouched   = signal(false);
  confirmation     = signal<ConfirmationView | null>(null);

  /* Step 1 inputs */
  todayIso = new Date().toISOString().slice(0, 10);
  checkIn  = this.todayIso;
  checkOut = this.tomorrow(this.todayIso);
  adults   = 2;
  children = 0;

  /* Step 2 */
  selectedRoomTypeId = signal<string | null>(null);

  /* Step 3 */
  firstName       = '';
  lastName        = '';
  email           = '';
  phone           = '';
  country         = '';
  specialRequests = '';

  /* Step 4 — local-only display state, never sent anywhere */
  cardName    = '';
  cardNumber  = signal('');
  cardExpiry  = signal('');
  cardCvc     = '';
  termsAccepted = false;

  /* ─────── derived ─────── */
  checkInDate  = computed(() => new Date(this.checkIn));
  checkOutDate = computed(() => new Date(this.checkOut));
  minCheckoutIso = computed(() => this.tomorrow(this.checkIn));
  nights = computed(() => {
    const ms = this.checkOutDate().getTime() - this.checkInDate().getTime();
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  });
  totalGuests = computed(() => this.adults + this.children);
  dateError = computed(() => {
    if (this.nights() <= 0) return 'Check-out must be after check-in.';
    if (this.checkInDate() < new Date(this.todayIso)) return 'Check-in cannot be in the past.';
    return null;
  });
  selectedRoomType = computed(() =>
    this.availableRooms().find(r => r.id === this.selectedRoomTypeId()) ?? null);
  subtotal = computed(() => {
    const rt = this.selectedRoomType();
    return rt ? rt.basePrice * this.nights() : 0;
  });
  tax    = computed(() => Math.round(this.subtotal() * 0.18));
  total  = computed(() => this.subtotal() + this.tax());

  /* Plain methods rather than computed() — these depend on non-signal
     ngModel-bound string fields (firstName, lastName, email), and a
     computed() wouldn't track them. The template re-evaluates these
     each change-detection cycle, which is what we want. */
  validEmail(): boolean {
    return /\S+@\S+\.\S+/.test(this.email);
  }
  canContinueGuestStep(): boolean {
    return !!this.firstName.trim() &&
           !!this.lastName.trim() &&
           this.validEmail();
  }

  validCardNumber(): boolean {
    return this.cardNumber().replace(/\s/g, '').length === 16;
  }
  validExpiry(): boolean {
    return /^(0[1-9]|1[0-2])\/\d{2}$/.test(this.cardExpiry());
  }
  validCvc(): boolean {
    return /^\d{3,4}$/.test(this.cardCvc.trim());
  }
  canSubmitPayment(): boolean {
    return !!this.cardName.trim() &&
           this.validCardNumber() &&
           this.validExpiry() &&
           this.validCvc() &&
           this.termsAccepted;
  }

  constructor() {
    this.propSvc.getById(FEATURED_PROPERTY_ID).subscribe(p => this.property.set(p));

    // Seed inputs from query params (deep link from hero)
    this.route.queryParams.subscribe(q => {
      if (q['checkIn'])   this.checkIn  = q['checkIn'];
      if (q['checkOut'])  this.checkOut = q['checkOut'];
      if (q['guests'])    this.adults   = Number(q['guests']);
      if (q['roomType']) {
        // pre-select the room type; we'll resolve it once rooms load
        this.preselectRoomTypeId = q['roomType'];
        this.step.set('room');
        this.loadAvailableRooms();
      }
    });

    // Clamp checkout to be > checkIn whenever checkIn moves
    effect(() => {
      const min = this.minCheckoutIso();
      if (this.checkOut < min) this.checkOut = min;
    });
  }

  private preselectRoomTypeId: string | null = null;

  /* ─────── navigation ─────── */
  isDone(s: Step): boolean {
    return STEP_ORDER.indexOf(s) < STEP_ORDER.indexOf(this.step());
  }

  goNext(): void {
    const current = this.step();
    if (current === 'dates') {
      if (this.dateError()) return;
      this.step.set('room');
      this.loadAvailableRooms();
      this.scrollToTop();
      return;
    }
    if (current === 'room') {
      if (!this.selectedRoomTypeId()) return;
      this.step.set('guest');
      this.scrollToTop();
      return;
    }
    if (current === 'guest') {
      this.touched.set(true);
      if (!this.canContinueGuestStep()) return;
      this.step.set('payment');
      this.scrollToTop();
      return;
    }
  }

  goBack(): void {
    const order = STEP_ORDER;
    const idx = order.indexOf(this.step());
    if (idx > 0) {
      this.step.set(order[idx - 1]);
      this.scrollToTop();
    }
  }

  loadAvailableRooms(): void {
    this.loadingRooms.set(true);
    this.roomSvc.listTypes(FEATURED_PROPERTY_ID).subscribe({
      next: types => {
        // Filter by occupancy capability
        const filtered = types.filter(t => t.maxOccupancy >= this.totalGuests());
        this.availableRooms.set(filtered);
        if (this.preselectRoomTypeId &&
            filtered.some(t => t.id === this.preselectRoomTypeId)) {
          this.selectedRoomTypeId.set(this.preselectRoomTypeId);
          this.preselectRoomTypeId = null;
        }
        this.loadingRooms.set(false);
      },
      error: () => {
        this.toast.error('Could not load rooms', 'Please retry in a moment.');
        this.loadingRooms.set(false);
      },
    });
  }

  /* ─────── card input formatters ─────── */
  onCardChange(raw: string): void {
    const digits = (raw ?? '').replace(/\D/g, '').slice(0, 16);
    const grouped = digits.match(/.{1,4}/g)?.join(' ') ?? '';
    this.cardNumber.set(grouped);
  }
  onExpiryChange(raw: string): void {
    const digits = (raw ?? '').replace(/\D/g, '').slice(0, 4);
    const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    this.cardExpiry.set(formatted);
  }

  /* ─────── submission ─────── */
  imageFor(rt: RoomType): string {
    return ROOM_IMAGES[rt.code] ?? rt.photoUrl ?? ROOM_FALLBACK;
  }

  submitBooking(): void {
    this.paymentTouched.set(true);
    if (!this.canSubmitPayment()) return;
    const rt = this.selectedRoomType();
    if (!rt) return;

    this.submitting.set(true);
    this.submitError.set(null);

    // 1. Create the guest record (mock create)
    this.guestSvc.create({
      firstName: this.firstName.trim(),
      lastName:  this.lastName.trim(),
      email:     this.email.trim(),
      phone:     this.phone.trim(),
      nationality: this.country.trim() || 'Unknown',
      isVip: false,
      loyaltyPoints: 0,
      totalStays: 0,
      totalSpent: 0,
      tags: [],
      preferences: { smokingPreference: false, dietary: [] },
    }).subscribe({
      next: guest => {
        // 2. Create the reservation
        this.resSvc.create({
          propertyId: FEATURED_PROPERTY_ID,
          guestId:    guest.id,
          roomTypeId: rt.id,
          ratePlanId: 'bar',
          checkIn:    this.checkInDate(),
          checkOut:   this.checkOutDate(),
          nights:     this.nights(),
          adults:     this.adults,
          children:   this.children,
          source:     BookingSource.Direct,
          totalRoomCharge: this.subtotal(),
          totalTax:   this.tax(),
          specialRequests: this.specialRequests.trim() || undefined,
        }).subscribe({
          next: res => {
            const view: ConfirmationView = {
              confirmationNumber: res.confirmationNumber,
              roomTypeName: rt.name,
              checkIn:   res.checkIn,
              checkOut:  res.checkOut,
              nights:    res.nights,
              guestName: `${guest.firstName} ${guest.lastName}`,
              email:     guest.email,
              totalAmount: res.totalAmount,
            };
            this.confirmation.set(view);

            // Broadcast to admin dashboard — same tab via signal, other tabs via BroadcastChannel.
            this.broadcast.publish({
              type: 'booking.created',
              reservationId: res.id,
              confirmationNumber: res.confirmationNumber,
              propertyId: res.propertyId,
              guestName: view.guestName,
              roomTypeName: rt.name,
              checkIn:  res.checkIn.toISOString(),
              checkOut: res.checkOut.toISOString(),
              totalAmount: res.totalAmount,
              at: new Date().toISOString(),
            });

            this.submitting.set(false);
            this.step.set('confirmation');
            this.scrollToTop();
          },
          error: () => this.failSubmit(),
        });
      },
      error: () => this.failSubmit(),
    });
  }

  private failSubmit(): void {
    this.submitting.set(false);
    this.submitError.set('Something went wrong creating your booking. Please try again.');
  }

  startNew(): void {
    this.step.set('dates');
    this.selectedRoomTypeId.set(null);
    this.confirmation.set(null);
    this.firstName = this.lastName = this.email = this.phone = this.country = '';
    this.specialRequests = '';
    this.cardName = this.cardCvc = '';
    this.cardNumber.set('');
    this.cardExpiry.set('');
    this.termsAccepted = false;
    this.touched.set(false);
    this.scrollToTop();
  }

  private scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private tomorrow(iso: string): string {
    const d = new Date(iso);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
}