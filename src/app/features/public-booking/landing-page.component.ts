import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { ROOM_SERVICE, PROPERTY_SERVICE } from '../../data/services/service-tokens';
import { RoomType, Property } from '../../domain';

/** The featured property — single fictional hotel that fronts the public site. */
const FEATURED_PROPERTY_ID = 'prop-1';

interface AmenityCard {
  icon: string;
  title: string;
  body: string;
}

const AMENITIES: AmenityCard[] = [
  { icon: 'restaurant',       title: 'Two restaurants',  body: 'Modern Georgian by chef Tamuna Sulava, plus a rooftop wine bar.' },
  { icon: 'spa',              title: 'Aurora Spa',       body: 'Six treatment rooms, hammam, indoor lap pool — open to guests and members.' },
  { icon: 'pool',             title: 'Rooftop pool',     body: 'Heated year-round with skyline views over Old Town and Mtatsminda.' },
  { icon: 'fitness_center',   title: '24-hour fitness',  body: 'Technogym studio with a resident trainer Monday through Saturday.' },
  { icon: 'meeting_room',     title: 'Meetings & events',body: 'Six adaptable salons, the largest hosting 180 for a seated dinner.' },
  { icon: 'concierge',        title: 'Concierge',        body: 'Private guides, sommelier-led wine country trips, last-minute reservations.' },
];

const GALLERY = [
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80',
  'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80',
  'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=80',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80',
];

/**
 * Curated photo per room-type code. Falls back to a generic suite shot if a code
 * isn't in the map. We deliberately don't trust seed `photoUrl` — the seed file
 * has some broken placeholder URLs we want to override on the public surface.
 */
const ROOM_IMAGES: Record<string, string> = {
  STD: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=80',
  DLX: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&q=80',
  STE: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80',
  EXE: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200&q=80',
  PRE: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80',
};
const ROOM_FALLBACK = 'https://images.unsplash.com/photo-1590490359683-658d3d23f972?w=1200&q=80';

@Component({
  selector: 'lux-landing-page',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatIconModule, MatButtonModule, SkeletonComponent,
  ],
  template: `
    <!-- ══════════ HERO ══════════ -->
    <section class="hero">
      <div class="hero-bg"
           [style.backgroundImage]="'url(https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1800&q=80)'">
      </div>
      <div class="hero-overlay"></div>

      <div class="hero-inner">
        <span class="hero-eyebrow">Tbilisi, Georgia · 5★</span>
        <h1 class="hero-title">A grand hotel,<br/>rewritten for now.</h1>
        <p class="hero-sub">
          On Rustaveli Avenue at the foot of Mtatsminda, The Aurora pairs
          century-old craft with the rhythm of a modern city stay.
        </p>

        <!-- Hero booking widget -->
        <form class="hero-search"
              (ngSubmit)="searchAvailability()"
              aria-label="Check availability">
          <div class="field">
            <label for="hero-checkin">Check in</label>
            <input id="hero-checkin"
                   type="date"
                   [min]="todayIso"
                   [(ngModel)]="checkIn"
                   name="checkIn" />
          </div>
          <div class="field">
            <label for="hero-checkout">Check out</label>
            <input id="hero-checkout"
                   type="date"
                   [min]="minCheckoutIso()"
                   [(ngModel)]="checkOut"
                   name="checkOut" />
          </div>
          <div class="field">
            <label for="hero-guests">Guests</label>
            <select id="hero-guests" [(ngModel)]="guests" name="guests">
              <option [ngValue]="1">1 guest</option>
              <option [ngValue]="2">2 guests</option>
              <option [ngValue]="3">3 guests</option>
              <option [ngValue]="4">4 guests</option>
            </select>
          </div>
          <button type="submit" class="hero-cta">
            <mat-icon aria-hidden="true">search</mat-icon>
            Check availability
          </button>
        </form>
      </div>
    </section>

    <!-- ══════════ INTRO ══════════ -->
    <section class="intro section">
      <div class="intro-stat">
        <span class="num">2018</span>
        <span class="lbl">Year built</span>
      </div>
      <div class="intro-stat">
        <span class="num">80</span>
        <span class="lbl">Rooms &amp; suites</span>
      </div>
      <div class="intro-stat">
        <span class="num">9.4</span>
        <span class="lbl">Guest rating</span>
      </div>
      <div class="intro-stat">
        <span class="num">5★</span>
        <span class="lbl">Forbes Travel Guide</span>
      </div>
    </section>

    <!-- ══════════ ROOMS ══════════ -->
    <section id="rooms" class="section">
      <header class="section-header">
        <span class="eyebrow">Accommodations</span>
        <h2>Rooms &amp; suites</h2>
        <p>Five room categories, each finished with linen by Frette,
           a deep soaking bath and a private balcony or terrace.</p>
      </header>

      @if (loading()) {
        <div class="room-grid">
          @for (i of [1,2,3]; track i) {
            <article class="room-card is-loading">
              <lux-skeleton height="220px" radius="var(--radius-lg) var(--radius-lg) 0 0" />
              <div class="room-card-body">
                <lux-skeleton width="60%" height="22px" />
                <lux-skeleton width="40%" height="14px" />
                <lux-skeleton width="100%" height="14px" />
                <lux-skeleton width="80%" height="14px" />
              </div>
            </article>
          }
        </div>
      } @else if (error()) {
        <div class="surface error-surface" role="alert">
          <mat-icon>error_outline</mat-icon>
          <div>
            <strong>We couldn't load rooms.</strong>
            <p>Please try again — or call the front desk on +995 32 200 1000.</p>
          </div>
          <button mat-stroked-button (click)="loadRoomTypes()">Retry</button>
        </div>
      } @else {
        <div class="room-grid">
          @for (rt of roomTypes(); track rt.id) {
            <article class="room-card">
              <div class="room-photo">
                <img [src]="imageFor(rt)"
                     [alt]="rt.name + ' room photograph'"
                     loading="lazy" />
                <span class="room-badge">From ₾{{ rt.basePrice }}/night</span>
              </div>
              <div class="room-card-body">
                <h3>{{ rt.name }}</h3>
                <div class="room-meta">
                  <span><mat-icon aria-hidden="true">bed</mat-icon> {{ rt.bedConfiguration }}</span>
                  <span><mat-icon aria-hidden="true">straighten</mat-icon> {{ rt.sizeSqm }} m²</span>
                  <span><mat-icon aria-hidden="true">people</mat-icon> {{ rt.maxOccupancy }} guests</span>
                </div>
                <p class="room-desc">{{ rt.description }}</p>
                @if (rt.amenities?.length) {
                  <ul class="room-amenities">
                    @for (a of rt.amenities!.slice(0, 4); track a) {
                      <li>{{ a }}</li>
                    }
                  </ul>
                }
                <a mat-flat-button color="primary"
                   [routerLink]="['/book/reserve']"
                   [queryParams]="{ roomType: rt.id }">
                  Reserve {{ rt.name }}
                </a>
              </div>
            </article>
          }
        </div>
      }
    </section>

    <!-- ══════════ AMENITIES ══════════ -->
    <section id="amenities" class="section section-tinted">
      <header class="section-header">
        <span class="eyebrow">The property</span>
        <h2>What's on offer</h2>
        <p>Everything you'd expect of a five-star, and several things you wouldn't.</p>
      </header>

      <div class="amenities-grid">
        @for (a of amenities; track a.title) {
          <div class="amenity-card">
            <div class="amenity-icon" aria-hidden="true">
              <mat-icon>{{ a.icon }}</mat-icon>
            </div>
            <h3>{{ a.title }}</h3>
            <p>{{ a.body }}</p>
          </div>
        }
      </div>
    </section>

    <!-- ══════════ GALLERY ══════════ -->
    <section id="gallery" class="section">
      <header class="section-header">
        <span class="eyebrow">Spaces</span>
        <h2>Gallery</h2>
        <p>The lobby, the rooftop, a corner suite at dusk.</p>
      </header>

      <div class="gallery-grid">
        @for (img of gallery; track img; let i = $index) {
          <button type="button"
                  class="gallery-tile"
                  [class.tall]="i === 0 || i === 3"
                  (click)="openLightbox(i)"
                  [attr.aria-label]="'Open photo ' + (i + 1) + ' of ' + gallery.length">
            <img [src]="img"
                 [alt]="'Aurora Tbilisi — gallery photograph ' + (i + 1)"
                 loading="lazy" />
          </button>
        }
      </div>

      @if (lightboxIndex() !== null) {
        <div class="lightbox"
             role="dialog"
             aria-modal="true"
             aria-label="Photo viewer"
             (click)="closeLightbox()"
             (keydown.escape)="closeLightbox()"
             tabindex="-1">
          <button type="button"
                  class="lightbox-close"
                  (click)="closeLightbox(); $event.stopPropagation()"
                  aria-label="Close photo viewer">
            <mat-icon>close</mat-icon>
          </button>
          <button type="button"
                  class="lightbox-nav prev"
                  (click)="prevPhoto(); $event.stopPropagation()"
                  aria-label="Previous photo">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <img [src]="gallery[lightboxIndex()!]"
               [alt]="'Gallery photo ' + (lightboxIndex()! + 1)"
               (click)="$event.stopPropagation()" />
          <button type="button"
                  class="lightbox-nav next"
                  (click)="nextPhoto(); $event.stopPropagation()"
                  aria-label="Next photo">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <div class="lightbox-counter">{{ lightboxIndex()! + 1 }} / {{ gallery.length }}</div>
        </div>
      }
    </section>

    <!-- ══════════ CTA ══════════ -->
    <section id="contact" class="section cta-section">
      <div class="cta-card">
        <h2>Plan your stay</h2>
        <p>Book directly for our best available rate, room upgrades when available,
           and complimentary breakfast for two.</p>
        <div class="cta-actions">
          <a mat-flat-button color="primary" routerLink="/book/reserve">Book a stay</a>
          <a mat-stroked-button href="tel:+995322001000">Call +995 32 200 1000</a>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ── HERO ───────────────────────────────────────────────── */
    .hero {
      position: relative;
      min-height: clamp(560px, 80vh, 720px);
      display: flex; align-items: flex-end;
      padding: var(--space-12) var(--space-6) var(--space-10);
      color: white;
      overflow: hidden;
    }
    .hero-bg {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
      transform: scale(1.04);
    }
    .hero-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(180deg,
        rgba(11, 31, 58, 0.30) 0%,
        rgba(11, 31, 58, 0.55) 60%,
        rgba(11, 31, 58, 0.80) 100%);
    }
    .hero-inner {
      position: relative; z-index: 1;
      max-width: var(--content-max);
      width: 100%; margin: 0 auto;
    }
    .hero-eyebrow {
      display: inline-block;
      font-size: var(--text-xs); letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--gold-300);
      margin-bottom: var(--space-4);
    }
    .hero-title {
      font-family: var(--font-display);
      font-size: clamp(40px, 6vw, 72px);
      line-height: 1.05; font-weight: 700;
      letter-spacing: -0.02em;
      color: white;
      margin: 0 0 var(--space-4);
      max-width: 18ch;
    }
    .hero-sub {
      font-size: var(--text-lg);
      line-height: 1.5;
      color: rgba(255,255,255,0.85);
      max-width: 56ch;
      margin: 0 0 var(--space-8);
    }

    .hero-search {
      display: grid;
      grid-template-columns: 1.2fr 1.2fr 0.8fr auto;
      gap: var(--space-3);
      padding: var(--space-3);
      background: white;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-3);
      max-width: 820px;
    }
    .hero-search .field {
      display: flex; flex-direction: column; gap: 4px;
      padding: var(--space-2) var(--space-3);
      border-right: 1px solid var(--border);
    }
    .hero-search .field:nth-child(3) { border-right: none; }
    .hero-search label {
      font-size: 10px; letter-spacing: 0.12em;
      text-transform: uppercase; font-weight: 600;
      color: var(--text-muted);
    }
    .hero-search input, .hero-search select {
      border: none; background: transparent;
      color: var(--text);
      font-size: var(--text-md); font-weight: 500;
      padding: 2px 0;
      font-family: inherit;
    }
    .hero-search input:focus, .hero-search select:focus {
      outline: none;
    }
    .hero-search input::-webkit-calendar-picker-indicator {
      cursor: pointer; opacity: 0.6;
    }
    .hero-cta {
      display: flex; align-items: center; justify-content: center;
      gap: var(--space-2);
      background: var(--navy-900); color: var(--gold-300);
      border: none; border-radius: var(--radius-md);
      padding: 0 var(--space-5);
      font-size: var(--text-sm); font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: background var(--t-fast);
      min-height: 52px;
    }
    .hero-cta:hover { background: var(--navy-700); }
    .hero-cta:focus-visible {
      outline: 2px solid var(--gold-300); outline-offset: 2px;
    }
    .hero-cta mat-icon {
      font-size: 18px !important; width: 18px !important; height: 18px !important;
    }

    /* ── INTRO STATS ───────────────────────────────────────── */
    .intro {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-4);
      padding-top: var(--space-12);
      padding-bottom: var(--space-12);
      max-width: var(--content-max);
      margin: 0 auto;
    }
    .intro-stat {
      text-align: center;
      padding: var(--space-4);
    }
    .intro-stat .num {
      display: block;
      font-family: var(--font-display);
      font-size: var(--text-4xl); font-weight: 700;
      color: var(--text);
      letter-spacing: -0.02em;
    }
    .intro-stat .lbl {
      display: block;
      font-size: var(--text-xs); letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-top: var(--space-1);
    }

    /* ── SECTIONS ─────────────────────────────────────────── */
    .section {
      max-width: var(--content-max);
      margin: 0 auto;
      padding: var(--space-12) var(--space-6);
    }
    .section-tinted {
      max-width: none;
      background: var(--cream-100);
      padding-left: var(--space-6); padding-right: var(--space-6);
    }
    .section-tinted > * { max-width: var(--content-max); margin-left: auto; margin-right: auto; }
    .section-header {
      text-align: center;
      max-width: 60ch;
      margin: 0 auto var(--space-10);
    }
    .eyebrow {
      display: inline-block;
      font-size: var(--text-xs); letter-spacing: 0.2em;
      text-transform: uppercase; font-weight: 600;
      color: var(--accent);
      margin-bottom: var(--space-3);
    }
    .section-header h2 {
      font-family: var(--font-display);
      font-size: clamp(32px, 4vw, 44px);
      font-weight: 700;
      margin-bottom: var(--space-3);
    }
    .section-header p {
      font-size: var(--text-md);
      color: var(--text-muted);
      line-height: 1.6;
    }

    /* ── ROOM GRID ────────────────────────────────────────── */
    .room-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--space-6);
    }
    .room-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: transform var(--t-base), box-shadow var(--t-base);
      display: flex; flex-direction: column;
    }
    .room-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-3);
    }
    .room-card.is-loading { pointer-events: none; }

    .room-photo {
      position: relative; aspect-ratio: 4 / 3;
      overflow: hidden; background: var(--surface-2);
    }
    .room-photo img {
      width: 100%; height: 100%; object-fit: cover;
      transition: transform var(--t-slow);
    }
    .room-card:hover .room-photo img { transform: scale(1.04); }
    .room-badge {
      position: absolute; top: var(--space-3); left: var(--space-3);
      background: rgba(255,255,255,0.94);
      color: var(--navy-900);
      font-size: var(--text-xs); font-weight: 600;
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
    }

    .room-card-body {
      padding: var(--space-5);
      display: flex; flex-direction: column; gap: var(--space-3);
      flex: 1;
    }
    .room-card-body h3 {
      font-family: var(--font-display);
      font-size: var(--text-2xl); font-weight: 700;
      margin: 0;
    }
    .room-meta {
      display: flex; flex-wrap: wrap; gap: var(--space-3);
      font-size: var(--text-xs); color: var(--text-muted);
    }
    .room-meta span {
      display: inline-flex; align-items: center; gap: 4px;
    }
    .room-meta mat-icon {
      font-size: 14px !important; width: 14px !important; height: 14px !important;
    }
    .room-desc {
      font-size: var(--text-sm);
      color: var(--text-muted);
      line-height: 1.55;
      margin: 0;
    }
    .room-amenities {
      display: flex; flex-wrap: wrap; gap: var(--space-1);
      list-style: none; padding: 0; margin: 0;
    }
    .room-amenities li {
      font-size: var(--text-xs);
      padding: 2px var(--space-2);
      background: var(--surface-2);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
    }
    .room-card-body > a {
      margin-top: auto;
      align-self: flex-start;
    }

    .error-surface {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-5);
      border-left: 4px solid var(--danger);
    }
    .error-surface mat-icon { color: var(--danger); flex-shrink: 0; }
    .error-surface div { flex: 1; }
    .error-surface p { color: var(--text-muted); font-size: var(--text-sm); margin: 4px 0 0; }

    /* ── AMENITIES ────────────────────────────────────────── */
    .amenities-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: var(--space-5);
    }
    .amenity-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      transition: border-color var(--t-fast), box-shadow var(--t-fast);
    }
    .amenity-card:hover {
      border-color: var(--accent);
      box-shadow: var(--shadow-1);
    }
    .amenity-icon {
      width: 48px; height: 48px;
      display: flex; align-items: center; justify-content: center;
      background: var(--navy-900); color: var(--gold-300);
      border-radius: var(--radius-md);
      margin-bottom: var(--space-3);
    }
    .amenity-icon mat-icon {
      font-size: 24px !important; width: 24px !important; height: 24px !important;
    }
    .amenity-card h3 {
      font-size: var(--text-lg); font-weight: 600;
      margin-bottom: var(--space-2);
    }
    .amenity-card p {
      font-size: var(--text-sm);
      color: var(--text-muted);
      line-height: 1.55;
      margin: 0;
    }

    /* ── GALLERY ──────────────────────────────────────────── */
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-auto-rows: 240px;
      gap: var(--space-3);
    }
    .gallery-tile {
      padding: 0; border: none; background: none; cursor: pointer;
      border-radius: var(--radius-md);
      overflow: hidden;
      position: relative;
    }
    .gallery-tile.tall { grid-row: span 2; }
    .gallery-tile img {
      width: 100%; height: 100%; object-fit: cover;
      transition: transform var(--t-slow);
    }
    .gallery-tile:hover img { transform: scale(1.06); }
    .gallery-tile:focus-visible {
      outline: 3px solid var(--accent); outline-offset: 2px;
    }

    .lightbox {
      position: fixed; inset: 0;
      background: rgba(11, 31, 58, 0.92);
      z-index: var(--z-modal);
      display: flex; align-items: center; justify-content: center;
      padding: var(--space-8);
    }
    .lightbox img {
      max-width: 100%; max-height: 90vh;
      object-fit: contain;
      border-radius: var(--radius-md);
    }
    .lightbox-close, .lightbox-nav {
      position: absolute;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
      width: 48px; height: 48px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: background var(--t-fast);
    }
    .lightbox-close:hover, .lightbox-nav:hover { background: rgba(255,255,255,0.2); }
    .lightbox-close { top: var(--space-4); right: var(--space-4); }
    .lightbox-nav.prev { left: var(--space-4); }
    .lightbox-nav.next { right: var(--space-4); }
    .lightbox-nav.prev { top: 50%; transform: translateY(-50%); }
    .lightbox-nav.next { top: 50%; transform: translateY(-50%); }
    .lightbox-counter {
      position: absolute; bottom: var(--space-5);
      color: rgba(255,255,255,0.85);
      font-size: var(--text-sm);
    }

    /* ── CTA ──────────────────────────────────────────────── */
    .cta-section { padding-bottom: var(--space-16); }
    .cta-card {
      background: var(--navy-900);
      color: white;
      border-radius: var(--radius-xl);
      padding: var(--space-12);
      text-align: center;
      background-image:
        radial-gradient(circle at 80% 20%, rgba(201, 169, 97, 0.18), transparent 50%),
        radial-gradient(circle at 20% 80%, rgba(91, 127, 168, 0.15), transparent 50%);
    }
    .cta-card h2 {
      font-family: var(--font-display);
      font-size: clamp(28px, 4vw, 40px);
      color: white;
      margin-bottom: var(--space-3);
    }
    .cta-card p {
      color: rgba(255,255,255,0.8);
      max-width: 50ch; margin: 0 auto var(--space-6);
      font-size: var(--text-md); line-height: 1.6;
    }
    .cta-actions {
      display: flex; gap: var(--space-3); justify-content: center;
      flex-wrap: wrap;
    }
    .cta-actions [mat-stroked-button] {
      color: white !important;
      border-color: rgba(255,255,255,0.4) !important;
    }

    /* ── RESPONSIVE ───────────────────────────────────────── */
    @media (max-width: 1024px) {
      .gallery-grid { grid-template-columns: repeat(2, 1fr); grid-auto-rows: 200px; }
    }
    @media (max-width: 768px) {
      .hero { padding: var(--space-8) var(--space-4); }
      .hero-search {
        grid-template-columns: 1fr 1fr;
        gap: var(--space-2);
      }
      .hero-search .field:nth-child(odd) { border-right: 1px solid var(--border); }
      .hero-search .field:nth-child(2) { border-right: none; }
      .hero-cta { grid-column: span 2; min-height: 48px; }
      .intro { grid-template-columns: repeat(2, 1fr); }
      .section { padding: var(--space-8) var(--space-4); }
      .section-tinted { padding-left: var(--space-4); padding-right: var(--space-4); }
      .gallery-grid {
        grid-template-columns: 1fr 1fr;
        grid-auto-rows: 160px;
      }
      .cta-card { padding: var(--space-8) var(--space-5); }
    }
    @media (max-width: 480px) {
      .intro { grid-template-columns: 1fr 1fr; }
      .gallery-grid { grid-auto-rows: 140px; }
      .gallery-tile.tall { grid-row: span 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .room-card, .room-photo img, .gallery-tile img { transition: none; }
      .room-card:hover { transform: none; }
    }
  `],
})
export class LandingPageComponent {
  private router    = inject(Router);
  private roomSvc   = inject(ROOM_SERVICE);
  private propSvc   = inject(PROPERTY_SERVICE);

  amenities = AMENITIES;
  gallery   = GALLERY;

  property    = signal<Property | undefined>(undefined);
  roomTypes   = signal<RoomType[]>([]);
  loading     = signal(true);
  error       = signal(false);

  /* Hero search inputs */
  todayIso = new Date().toISOString().slice(0, 10);
  checkIn  = this.todayIso;
  checkOut = this.tomorrow(this.todayIso);
  guests   = 2;

  minCheckoutIso = computed(() => this.tomorrow(this.checkIn));

  /* Lightbox */
  lightboxIndex = signal<number | null>(null);

  constructor() {
    this.propSvc.getById(FEATURED_PROPERTY_ID).subscribe(p => this.property.set(p));
    this.loadRoomTypes();

    // Keep checkout >= checkIn + 1 day if user shifts checkIn forward
    effect(() => {
      const min = this.minCheckoutIso();
      if (this.checkOut < min) this.checkOut = min;
    });
  }

  loadRoomTypes(): void {
    this.loading.set(true);
    this.error.set(false);
    this.roomSvc.listTypes(FEATURED_PROPERTY_ID).subscribe({
      next: types => {
        this.roomTypes.set(types);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  imageFor(rt: RoomType): string {
    return ROOM_IMAGES[rt.code] ?? rt.photoUrl ?? ROOM_FALLBACK;
  }

  searchAvailability(): void {
    this.router.navigate(['/book/reserve'], {
      queryParams: {
        checkIn:  this.checkIn,
        checkOut: this.checkOut,
        guests:   this.guests,
      },
    });
  }

  /* ── Lightbox controls ─────────────────────────────────── */
  openLightbox(i: number)  { this.lightboxIndex.set(i); }
  closeLightbox()          { this.lightboxIndex.set(null); }
  nextPhoto() {
    const i = this.lightboxIndex();
    if (i === null) return;
    this.lightboxIndex.set((i + 1) % this.gallery.length);
  }
  prevPhoto() {
    const i = this.lightboxIndex();
    if (i === null) return;
    this.lightboxIndex.set((i - 1 + this.gallery.length) % this.gallery.length);
  }

  private tomorrow(iso: string): string {
    const d = new Date(iso);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
}
