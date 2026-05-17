import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Slim, public-facing chrome wrapping the marketing landing page and the
 * booking flow. No sidebar, no app shell — this is what a recruiter / a
 * guest would land on first.
 */
@Component({
  selector: 'lux-public-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, MatIconModule, MatButtonModule],
  template: `
    <a class="skip-link" href="#public-main">Skip to main content</a>

    <header class="public-header" role="banner">
      <a routerLink="/book" class="brand" aria-label="The Aurora — home">
        <span class="brand-mark" aria-hidden="true">L</span>
        <span class="brand-text">
          <span class="brand-name">The Aurora</span>
          <span class="brand-sub">LUXSTAY COLLECTION</span>
        </span>
      </a>

      <nav class="public-nav" aria-label="Primary">
        <a routerLink="/book" fragment="rooms">Rooms</a>
        <a routerLink="/book" fragment="amenities">Amenities</a>
        <a routerLink="/book" fragment="gallery">Gallery</a>
        <a routerLink="/book" fragment="contact">Contact</a>
      </nav>

      <div class="public-actions">
        @if (auth.isAuthenticated()) {
          <button mat-stroked-button (click)="goToAdmin()">
            <mat-icon>dashboard</mat-icon>
            Admin
          </button>
        } @else {
          <a class="staff-link" routerLink="/auth/login">Staff sign-in</a>
        }
        <a mat-flat-button color="primary" routerLink="/book/reserve">Book a stay</a>
      </div>
    </header>

    <main id="public-main" class="public-main">
      <router-outlet />
    </main>

    <footer class="public-footer" role="contentinfo">
      <div class="footer-grid">
        <div>
          <div class="brand small">
            <span class="brand-mark" aria-hidden="true">L</span>
            <span class="brand-name">The Aurora</span>
          </div>
          <p class="footer-tag">
            A five-star sanctuary on Rustaveli Avenue, where Caucasus warmth
            meets contemporary craft.
          </p>
        </div>
        <div>
          <h4>Visit</h4>
          <p>14 Rustaveli Avenue<br>Tbilisi 0108, Georgia</p>
          <p>+995 32 200 1000</p>
        </div>
        <div>
          <h4>Hours</h4>
          <p>Check-in 2:00 PM<br>Check-out 12:00 PM<br>Reception 24/7</p>
        </div>
        <div>
          <h4>Follow</h4>
          <p>Instagram · Facebook · LinkedIn</p>
        </div>
      </div>
      <div class="footer-base">
        <span>© 2026 LuxStay Collection</span>
        <span>Privacy · Terms · Accessibility</span>
      </div>
    </footer>
  `,
  styles: [`
    :host { display: block; background: var(--bg); }

    .skip-link {
      position: absolute; top: -40px; left: var(--space-4);
      background: var(--primary); color: var(--on-primary);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      font-size: var(--text-sm); font-weight: 600;
      z-index: var(--z-toast);
      transition: top var(--t-fast);
    }
    .skip-link:focus { top: var(--space-2); }

    .public-header {
      position: sticky; top: 0; z-index: var(--z-sticky);
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-6);
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: saturate(180%) blur(12px);
      border-bottom: 1px solid var(--border);
    }

    .brand {
      display: flex; align-items: center; gap: var(--space-2);
      text-decoration: none;
    }
    .brand-mark {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      background: var(--navy-900); color: var(--gold-300);
      border-radius: var(--radius-sm);
      font-family: var(--font-display);
      font-size: 18px; font-weight: 700;
    }
    .brand-text { display: flex; flex-direction: column; line-height: 1.1; }
    .brand-name {
      font-family: var(--font-display);
      font-size: var(--text-lg); font-weight: 700;
      color: var(--text);
      letter-spacing: -0.01em;
    }
    .brand-sub {
      font-size: 9px; letter-spacing: 0.18em; font-weight: 600;
      color: var(--text-subtle); margin-top: 2px;
    }

    .public-nav {
      display: flex; gap: var(--space-6);
      align-items: center;
    }
    .public-nav a {
      font-size: var(--text-sm); font-weight: 500;
      color: var(--text-muted);
      padding: var(--space-1) 0;
      border-bottom: 2px solid transparent;
      transition: color var(--t-fast), border-color var(--t-fast);
    }
    .public-nav a:hover { color: var(--text); border-color: var(--accent); }

    .public-actions {
      display: flex; align-items: center; gap: var(--space-3);
    }
    .staff-link {
      font-size: var(--text-sm); color: var(--text-muted);
      font-weight: 500;
    }
    .staff-link:hover { color: var(--text); }

    .public-main {
      min-height: calc(75vh - 64px);
    }

    .public-footer {
      background: var(--navy-900);
      color: rgba(255,255,255,0.85);
      padding: var(--space-12) var(--space-6) var(--space-6);
      margin-top: var(--space-16);
    }
    .footer-grid {
      max-width: var(--content-max);
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.4fr repeat(3, 1fr);
      gap: var(--space-8);
    }
    .public-footer .brand-name { color: white; }
    .public-footer h4 {
      font-family: var(--font-display);
      font-size: var(--text-md); font-weight: 700;
      color: white;
      margin-bottom: var(--space-3);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .public-footer p {
      font-size: var(--text-sm);
      color: rgba(255,255,255,0.7);
      line-height: 1.6;
    }
    .footer-tag { max-width: 32ch; }
    .footer-base {
      max-width: var(--content-max);
      margin: var(--space-10) auto 0;
      padding-top: var(--space-4);
      border-top: 1px solid rgba(255,255,255,0.12);
      display: flex; justify-content: space-between;
      font-size: var(--text-xs);
      color: rgba(255,255,255,0.55);
    }

    /* ── Responsive ─────────────────────────────────────────────── */
    @media (max-width: 1024px) {
      .public-nav { display: none; }
    }
    @media (max-width: 768px) {
      .public-header { padding: var(--space-3) var(--space-4); gap: var(--space-2); }
      .brand-sub { display: none; }
      .public-actions { gap: var(--space-2); }
      .staff-link { display: none; }
      .footer-grid { grid-template-columns: 1fr 1fr; }
      .public-footer { padding: var(--space-8) var(--space-4) var(--space-4); margin-top: var(--space-10); }
      .footer-base { flex-direction: column; gap: var(--space-2); }
    }
    @media (max-width: 480px) {
      .footer-grid { grid-template-columns: 1fr; gap: var(--space-6); }
    }
  `],
})
export class PublicShellComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  goToAdmin() { this.router.navigateByUrl('/app/dashboard'); }
}
