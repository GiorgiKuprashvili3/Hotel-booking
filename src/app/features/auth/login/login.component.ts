import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../core/auth/auth.service';
import { Role } from '../../../domain/enums';
import { DEMO_USERS } from '../../../core/auth/models/demo-users';

interface DemoCard {
  role: Role;
  title: string;
  description: string;
  icon: string;
  accent: string;
}

/** Icon and accent colour per role — purely presentational config, not business data. */
const ROLE_DISPLAY: Record<Role, { icon: string; accent: string }> = {
  [Role.Admin]:        { icon: 'shield_person',      accent: '#C9A961' },
  [Role.Manager]:      { icon: 'workspace_premium',  accent: '#1A3A5C' },
  [Role.Receptionist]: { icon: 'concierge',          accent: '#4A6B8A' },
  [Role.Housekeeper]:  { icon: 'cleaning_services',  accent: '#4A7C59' },
  [Role.Accountant]:   { icon: 'calculate',          accent: '#7C4A6B' },
};

@Component({
  selector: 'lux-login',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
  ],
  template: `
    <div class="page">
      <!-- Brand panel -->
      <aside class="brand">
        <div class="brand-content">
          <div class="logo">
            <div class="logo-mark">L</div>
            <span class="logo-name">LuxStay</span>
          </div>
          <h1 class="brand-title">Hospitality, refined.</h1>
          <p class="brand-tag">
            The property management system trusted by boutique hotels and
            five-star resorts to orchestrate every guest experience.
          </p>
          <ul class="brand-features">
            <li><mat-icon>check_circle</mat-icon> Real-time room availability</li>
            <li><mat-icon>check_circle</mat-icon> Smart housekeeping workflows</li>
            <li><mat-icon>check_circle</mat-icon> Revenue analytics that matter</li>
            <li><mat-icon>check_circle</mat-icon> Multi-property orchestration</li>
          </ul>
        </div>
        <div class="brand-deco"></div>
      </aside>

      <!-- Login panel -->
      <section class="login">
        <div class="login-inner">
          <h2 class="login-title">Welcome back</h2>
          <p class="login-sub">Sign in to your hotel dashboard.</p>

          <!-- Real-looking login form (decorative, doesn't auth) -->
          <form class="form" (submit)="$event.preventDefault()">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Email address</mat-label>
              <input matInput type="email" [(ngModel)]="email" name="email" autocomplete="email" />
              <mat-icon matSuffix>mail_outline</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="password" name="password" autocomplete="current-password" />
              <mat-icon matSuffix>lock_outline</mat-icon>
            </mat-form-field>

            <button mat-flat-button color="primary" class="signin-btn" type="submit" disabled>
              Sign in
            </button>
          </form>

          <div class="divider"><span>Or try the demo as</span></div>

          <div class="demo-cards">
            @for (c of demoCards; track c.role) {
              <button class="demo-card" (click)="loginAs(c.role)" [style.--card-accent]="c.accent">
                <div class="demo-icon">
                  <mat-icon>{{ c.icon }}</mat-icon>
                </div>
                <div class="demo-text">
                  <div class="demo-title">{{ c.title }}</div>
                  <div class="demo-desc">{{ c.description }}</div>
                </div>
                <mat-icon class="demo-arrow">arrow_forward</mat-icon>
              </button>
            }
          </div>

          <p class="footer-note">
            This is a portfolio demo. No real data, no real bookings, no payments processed.
          </p>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .page {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      background: var(--bg);
    }

    /* ---------- Brand panel ---------- */
    .brand {
      position: relative;
      background: linear-gradient(160deg, var(--navy-900) 0%, var(--navy-700) 100%);
      color: #FFFFFF;
      padding: var(--space-12) var(--space-16);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    .brand-content { position: relative; z-index: 2; }
    .brand-deco {
      position: absolute;
      inset: -20%;
      background:
        radial-gradient(circle at 80% 20%, rgba(201, 169, 97, 0.18), transparent 50%),
        radial-gradient(circle at 20% 80%, rgba(201, 169, 97, 0.10), transparent 40%);
      z-index: 1;
    }

    .logo {
      display: flex; align-items: center; gap: var(--space-3);
      margin-bottom: var(--space-16);
    }
    .logo-mark {
      width: 44px; height: 44px;
      background: linear-gradient(135deg, var(--gold-500), var(--gold-300));
      border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      color: var(--navy-900);
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 24px;
      box-shadow: var(--shadow-gold);
    }
    .logo-name {
      font-family: var(--font-display);
      font-size: var(--text-2xl);
      font-weight: 700;
    }

    .brand-title {
      font-family: var(--font-display);
      font-size: var(--text-5xl);
      font-weight: 700;
      line-height: 1.05;
      letter-spacing: -0.02em;
      margin-bottom: var(--space-4);
      max-width: 520px;
    }
    .brand-tag {
      font-size: var(--text-lg);
      line-height: 1.6;
      color: rgba(255,255,255,0.75);
      max-width: 480px;
      margin-bottom: var(--space-8);
    }
    .brand-features {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: var(--space-3);
    }
    .brand-features li {
      display: flex; align-items: center; gap: var(--space-3);
      color: rgba(255,255,255,0.85);
      font-size: var(--text-base);
    }
    .brand-features mat-icon { color: var(--gold-300); }

    /* ---------- Login panel ---------- */
    .login {
      display: flex; align-items: center; justify-content: center;
      padding: var(--space-12) var(--space-8);
    }
    .login-inner { width: 100%; max-width: 440px; }
    .login-title {
      font-family: var(--font-display);
      font-size: var(--text-3xl);
      margin-bottom: var(--space-1);
    }
    .login-sub {
      color: var(--text-muted);
      margin-bottom: var(--space-6);
      font-size: var(--text-sm);
    }

    .form { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-4); }
    .signin-btn { height: 44px !important; }

    .divider {
      display: flex; align-items: center; gap: var(--space-3);
      margin: var(--space-6) 0 var(--space-4);
      color: var(--text-subtle);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .divider::before, .divider::after {
      content: ''; flex: 1; height: 1px; background: var(--border);
    }

    /* ---------- Demo cards ---------- */
    .demo-cards { display: flex; flex-direction: column; gap: var(--space-2); }
    .demo-card {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--t-fast);
      text-align: left;
      width: 100%;
      font-family: inherit;
    }
    .demo-card:hover {
      border-color: var(--card-accent, var(--accent));
      box-shadow: 0 4px 12px rgba(11, 31, 58, 0.06);
      transform: translateY(-1px);
    }
    .demo-card:hover .demo-arrow {
      transform: translateX(3px);
      color: var(--card-accent, var(--accent));
    }
    .demo-icon {
      width: 40px; height: 40px;
      background: color-mix(in srgb, var(--card-accent) 12%, transparent);
      color: var(--card-accent);
      border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .demo-text { flex: 1; }
    .demo-title { font-size: var(--text-sm); font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .demo-desc  { font-size: var(--text-xs); color: var(--text-muted); }
    .demo-arrow {
      color: var(--text-subtle);
      transition: all var(--t-fast);
      font-size: 18px !important; width: 18px !important; height: 18px !important;
    }

    .footer-note {
      margin-top: var(--space-6);
      font-size: var(--text-xs);
      color: var(--text-subtle);
      text-align: center;
    }

    @media (max-width: 1024px) {
      .page { grid-template-columns: 1fr; }
      .brand { padding: var(--space-8); min-height: 280px; }
      .brand-title { font-size: var(--text-3xl); }
      .brand-features { display: none; }
    }
  `],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  /** Pre-fill with the Manager demo user's email so it looks realistic. */
  email    = DEMO_USERS[Role.Manager].email;
  password = '••••••••';

  /**
   * Build demo cards entirely from DEMO_USERS — no hardcoded strings.
   * Description is derived from the user's name, role, and property count.
   */
  demoCards: DemoCard[] = (Object.values(Role) as Role[])
    .filter(role => role in DEMO_USERS && role in ROLE_DISPLAY)
    .map(role => {
      const user    = DEMO_USERS[role];
      const display = ROLE_DISPLAY[role];
      const propCount = user.propertyIds.length;
      const propLabel = propCount === 1
        ? '1 property'
        : `${propCount} properties`;

      const roleDescriptions: Record<Role, string> = {
        [Role.Admin]:        `Full system access · ${propLabel}`,
        [Role.Manager]:      `Operations & analytics · ${propLabel}`,
        [Role.Receptionist]: `Front desk & reservations · ${propLabel}`,
        [Role.Housekeeper]:  `Cleaning tasks & maintenance · ${propLabel}`,
        [Role.Accountant]:   `Financials & reporting · ${propLabel}`,
      };

      return {
        role,
        title: user.firstName + ' ' + user.lastName,
        description: roleDescriptions[role],
        icon:   display.icon,
        accent: display.accent,
      };
    });

  loginAs(role: Role) {
    this.auth.loginAsDemo(role);
    this.router.navigateByUrl('/app/dashboard');
  }
}
