import {
  Component, computed, HostListener, inject, signal,
} from '@angular/core';
import { CommonModule }           from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule }          from '@angular/material/icon';
import { MatButtonModule }        from '@angular/material/button';
import { MatMenuModule }          from '@angular/material/menu';
import { MatTooltipModule }       from '@angular/material/tooltip';
import { MatDividerModule }       from '@angular/material/divider';
import { FormsModule }            from '@angular/forms';
import { AuthService }            from '../../core/auth/auth.service';
import { PropertyContextService } from '../../core/config/property-context.service';
import { LayoutService }          from '../../core/config/layout.service';
import { Role }                   from '../../domain/enums';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: Role[];
  dividerBefore?: boolean;
}

const NAV: NavItem[] = [
  { label: 'Dashboard',    icon: 'dashboard',            route: '/app/dashboard' },
  { label: 'Calendar',     icon: 'calendar_month',       route: '/app/calendar',     roles: [Role.Admin, Role.Manager, Role.Receptionist] },
  { label: 'Reservations', icon: 'confirmation_number',  route: '/app/reservations', roles: [Role.Admin, Role.Manager, Role.Receptionist] },
  { label: 'Rooms',        icon: 'meeting_room',         route: '/app/rooms',        roles: [Role.Admin, Role.Manager, Role.Receptionist, Role.Housekeeper] },
  { label: 'Guests',       icon: 'people',               route: '/app/guests',       roles: [Role.Admin, Role.Manager, Role.Receptionist] },
  { label: 'Housekeeping', icon: 'cleaning_services',    route: '/app/housekeeping', roles: [Role.Admin, Role.Manager, Role.Housekeeper], dividerBefore: true },
  { label: 'Maintenance',  icon: 'build',                route: '/app/maintenance',  roles: [Role.Admin, Role.Manager, Role.Housekeeper] },
  { label: 'Concierge',    icon: 'room_service',         route: '/app/concierge',    roles: [Role.Admin, Role.Manager, Role.Receptionist] },
  { label: 'Analytics',    icon: 'bar_chart',            route: '/app/analytics',    roles: [Role.Admin, Role.Manager, Role.Accountant], dividerBefore: true },
  { label: 'Loyalty',      icon: 'star',                 route: '/app/loyalty',      roles: [Role.Admin, Role.Manager] },
  { label: 'Staff',        icon: 'badge',                route: '/app/staff',        roles: [Role.Admin, Role.Manager] },
  { label: 'Settings',     icon: 'settings',             route: '/app/settings',     roles: [Role.Admin], dividerBefore: true },
];

@Component({
  selector: 'lux-shell',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule,
    MatDividerModule, FormsModule,
  ],
  template: `
    @if (layout.mobileOpen()) {
      <div class="overlay" (click)="layout.closeMobile()"></div>
    }

    <div class="shell" [class.sidebar-collapsed]="collapsed()">

      <!-- ══ SIDEBAR ══════════════════════════════════════════ -->
      <aside class="sidebar" [class.mobile-open]="layout.mobileOpen()">

        <div class="brand">
          <div class="brand-mark">L</div>
          @if (!collapsed()) {
            <div class="brand-text">
              <span class="brand-name">LuxStay</span>
              <span class="brand-sub">COLLECTION</span>
            </div>
          }
        </div>

        <nav class="nav">
          @for (item of visibleNav(); track item.route) {
            @if (item.dividerBefore) {
              <div class="nav-divider"></div>
            }
            <a class="nav-item"
               [routerLink]="item.route"
               routerLinkActive="active"
               [matTooltip]="collapsed() ? item.label : ''"
               matTooltipPosition="right"
               (click)="layout.closeMobile()">
              <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
              @if (!collapsed()) {
                <span class="nav-label">{{ item.label }}</span>
              }
            </a>
          }
        </nav>

        <button class="collapse-btn"
                (click)="toggleCollapse()"
                [matTooltip]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
                matTooltipPosition="right">
          <mat-icon>{{ collapsed() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
        </button>
      </aside>

      <!-- ══ MAIN ══════════════════════════════════════════════ -->
      <div class="main">

        <!-- TOP BAR -->
        <header class="topbar">

          <div class="topbar-left">
            <button mat-icon-button disableRipple
                    class="mobile-menu-btn"
                    (click)="layout.toggleMobile()"
                    aria-label="Toggle navigation">
              <mat-icon>menu</mat-icon>
            </button>

            <div class="search-wrap">
              <mat-icon class="search-icon">search</mat-icon>
              <input class="search-input"
                     type="text"
                     [(ngModel)]="searchQuery"
                     placeholder="Search reservations, guests, rooms…"
                     (keydown.escape)="searchQuery = ''" />
              <kbd class="search-kbd">⌘K</kbd>
            </div>
          </div>

          <div class="topbar-right">

            <!-- Property selector -->
            <button type="button" class="property-btn" [matMenuTriggerFor]="propMenu">
              <div class="property-info">
                <span class="property-collection">LUXSTAY COLLECTION</span>
                <span class="property-name">{{ ctx.active()?.name ?? 'Select property' }}</span>
              </div>
              <mat-icon class="chevron-icon">expand_more</mat-icon>
            </button>

            <mat-menu #propMenu="matMenu" xPosition="before">
              @for (p of ctx.properties(); track p.id) {
                <button mat-menu-item (click)="ctx.setActive(p.id)">
                  @if (p.id === ctx.activeId()) {
                    <mat-icon style="color:var(--accent)">check</mat-icon>
                  } @else {
                    <mat-icon style="opacity:0">check</mat-icon>
                  }
                  <span>{{ p.name }}</span>
                </button>
              }
            </mat-menu>

            <div class="topbar-sep"></div>

            <!-- Notifications -->
            <button mat-icon-button disableRipple
                    class="notif-btn"
                    matTooltip="Notifications"
                    [matMenuTriggerFor]="notifMenu"
                    aria-label="Notifications">
              <mat-icon>notifications</mat-icon>
              <span class="notif-badge">3</span>
            </button>

            <mat-menu #notifMenu="matMenu" xPosition="before" class="notif-menu">
              <div class="notif-panel-header" (click)="$event.stopPropagation()">
                <span class="notif-panel-title">Notifications</span>
                <span class="notif-panel-badge">3</span>
              </div>
              <button mat-menu-item class="notif-item-btn">
                <div class="notif-item">
                  <span class="notif-dot info"></span>
                  <div class="notif-content">
                    <div class="notif-title">New reservation</div>
                    <div class="notif-meta">Sofia booked Suite 502 · 2m ago</div>
                  </div>
                </div>
              </button>
              <button mat-menu-item class="notif-item-btn">
                <div class="notif-item">
                  <span class="notif-dot warning"></span>
                  <div class="notif-content">
                    <div class="notif-title">Late checkout request</div>
                    <div class="notif-meta">Room 304 · 12m ago</div>
                  </div>
                </div>
              </button>
              <button mat-menu-item class="notif-item-btn">
                <div class="notif-item">
                  <span class="notif-dot danger"></span>
                  <div class="notif-content">
                    <div class="notif-title">Maintenance flagged</div>
                    <div class="notif-meta">AC unit, Room 401 · 1h ago</div>
                  </div>
                </div>
              </button>
            </mat-menu>

            <div class="topbar-sep"></div>

            <!-- User -->
            <button type="button" class="user-btn" [matMenuTriggerFor]="userMenu">
              <div class="avatar">{{ auth.initials() }}</div>
              <div class="user-info">
                <span class="user-name">{{ auth.user()?.firstName }} {{ auth.user()?.lastName }}</span>
                <span class="user-role">{{ auth.role() }}</span>
              </div>
              <mat-icon class="chevron-icon">expand_more</mat-icon>
            </button>

            <mat-menu #userMenu="matMenu">
              <button mat-menu-item routerLink="/app/settings">
                <mat-icon>manage_accounts</mat-icon>
                <span>Account settings</span>
              </button>
              <button mat-menu-item>
                <mat-icon>help_outline</mat-icon>
                <span>Help &amp; support</span>
              </button>
              <mat-divider></mat-divider>
              <button mat-menu-item (click)="auth.logout()">
                <mat-icon style="color:#DC2626">logout</mat-icon>
                <span style="color:#DC2626">Sign out</span>
              </button>
            </mat-menu>

          </div>
        </header>

        <!-- PAGE CONTENT -->
        <main class="content">
          <router-outlet />
        </main>

      </div>
    </div>
  `,
  styles: [`
    /* ── Shell layout ─────────────────────────────────────────── */
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }

    .overlay {
      position: fixed; inset: 0;
      top: 64px;
      background: rgba(0,0,0,.45);
      z-index: 99;
    }

    .shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: var(--bg, #F6F3EE);
    }

    /* ══ SIDEBAR ══════════════════════════════════════════════ */
    .sidebar {
      width: 240px;
      min-width: 240px;
      flex-shrink: 0;
      /* Hardcoded fallback so sidebar is always navy even if CSS vars not loaded */
      background: var(--navy, #0F1B35);
      color: #fff;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 220ms ease, min-width 220ms ease;
      position: relative;
      z-index: 100;
    }

    .shell.sidebar-collapsed .sidebar {
      width: 64px;
      min-width: 64px;
    }

    @media (max-width: 768px) {
      .sidebar {
        position: fixed;
        top: 0; left: 0; bottom: 0;
        transform: translateX(-100%);
        transition: transform 220ms ease;
        width: 240px !important;
        min-width: 240px !important;
      }
      .sidebar.mobile-open { transform: translateX(0); }
    }

    /* Brand */
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 16px 16px;
      min-height: 64px;
      flex-shrink: 0;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .brand-mark {
      width: 32px; height: 32px; min-width: 32px;
      background: var(--accent-gold, #C9A84C);
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 16px;
      color: var(--navy, #0F1B35);
      flex-shrink: 0;
    }
    .brand-text { display: flex; flex-direction: column; overflow: hidden; }
    .brand-name {
      font-size: 15px; font-weight: 700;
      white-space: nowrap; color: #fff;
    }
    .brand-sub {
      font-size: 9px; letter-spacing: 0.14em; font-weight: 600;
      color: var(--accent-gold, #C9A84C);
    }

    /* Nav */
    .nav {
      flex: 1;
      padding: 12px 8px;
      display: flex; flex-direction: column; gap: 2px;
      overflow-y: auto; overflow-x: hidden;
    }
    .nav-divider {
      height: 1px;
      background: rgba(255,255,255,.08);
      margin: 8px 4px;
    }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; border-radius: 8px;
      color: rgba(255,255,255,.6);
      text-decoration: none;
      font-size: 13.5px; font-weight: 500;
      cursor: pointer;
      transition: background 150ms, color 150ms;
      white-space: nowrap; overflow: hidden;
    }
    .nav-item:hover { background: rgba(255,255,255,.07); color: #fff; }
    .nav-item.active { background: rgba(255,255,255,.14); color: #fff; }

    .nav-icon {
      font-family: 'Material Icons' !important;
      font-size: 20px !important;
      width: 20px !important; height: 20px !important;
      flex-shrink: 0;
      overflow: hidden;
      line-height: 1 !important;
    }
    .nav-label { overflow: hidden; text-overflow: ellipsis; }

    /* Collapse toggle */
    .collapse-btn {
      display: flex; align-items: center; justify-content: center;
      margin: 8px; padding: 8px;
      background: rgba(255,255,255,.06);
      border: none; border-radius: 8px;
      color: rgba(255,255,255,.5);
      cursor: pointer;
      transition: background 150ms, color 150ms;
      flex-shrink: 0;
    }
    .collapse-btn:hover { background: rgba(255,255,255,.12); color: #fff; }
    @media (max-width: 768px) { .collapse-btn { display: none; } }

    /* ══ MAIN ═════════════════════════════════════════════════ */
    .main {
      flex: 1;
      min-width: 0;
      display: flex; flex-direction: column;
      overflow: hidden;
    }

    /* Top bar */
    .topbar {
      height: 64px; min-height: 64px; flex-shrink: 0;
      background: var(--surface, #fff);
      border-bottom: 1px solid var(--border, #E5E0D8);
      display: flex; align-items: center;
      padding: 0 20px 0 16px;
      gap: 12px;
      overflow: visible;
      z-index: 101;
      position: relative;
    }

    /* Topbar left */
    .topbar-left {
      display: flex; align-items: center; gap: 10px;
      flex: 1; min-width: 0;
    }
    .mobile-menu-btn { display: none !important; }
    @media (max-width: 768px) {
      .mobile-menu-btn {
        display: inline-flex !important;
        color: var(--text-muted, #6B7280) !important;
      }
      .mobile-menu-btn:hover { color: var(--text, #111827) !important; }
    }

    /* Notification badge sits inside the mat-icon-button */
    .notif-btn {
      color: var(--text-muted, #6B7280) !important;
      position: relative !important;
    }
    .notif-btn:hover { color: var(--text, #111827) !important; }

    .search-wrap {
      display: flex; align-items: center; gap: 8px;
      background: var(--surface-2, #F1EDE7);
      border: 1px solid var(--border, #E5E0D8);
      border-radius: 8px;
      padding: 0 10px; height: 36px;
      max-width: 400px; width: 100%;
      transition: border-color 150ms;
    }
    .search-wrap:focus-within { border-color: var(--primary, #2563EB); }
    .search-icon {
      font-family: 'Material Icons' !important;
      font-size: 18px !important; width: 18px !important; height: 18px !important;
      color: var(--text-muted, #6B7280); flex-shrink: 0;
      overflow: hidden; line-height: 1 !important;
    }
    .search-input {
      flex: 1; border: none; background: transparent; outline: none;
      font-size: 13.5px; color: var(--text, #111827); min-width: 0;
      font-family: 'Inter', sans-serif;
    }
    .search-input::placeholder { color: var(--text-subtle, #9CA3AF); }
    .search-kbd {
      font-size: 11px; color: var(--text-subtle, #9CA3AF);
      background: var(--surface, #fff);
      border: 1px solid var(--border, #E5E0D8);
      border-radius: 4px; padding: 1px 5px;
      white-space: nowrap; flex-shrink: 0;
      font-family: 'Inter', sans-serif;
    }

    /* Topbar right */
    .topbar-right {
      display: flex; align-items: center; gap: 4px;
      flex-shrink: 0;           /* never compress */
    }
    .topbar-sep {
      width: 1px; height: 24px;
      background: var(--border, #E5E0D8);
      margin: 0 8px; flex-shrink: 0;
    }

    /* Property button */
    .property-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 10px; height: 40px;
      background: transparent;
      border: 1px solid var(--border, #E5E0D8);
      border-radius: 8px; cursor: pointer;
      transition: background 150ms, border-color 150ms;
      max-width: 220px;
      outline: none;
      -webkit-tap-highlight-color: transparent;
    }
    .property-btn:hover {
      background: var(--surface-2, #F1EDE7);
      border-color: var(--primary, #2563EB);
    }
    .property-btn:active {
      background: var(--surface-2, #F1EDE7);
    }
    .property-btn:focus { outline: none; }
    .property-info {
      display: flex; flex-direction: column; text-align: left; overflow: hidden;
    }
    .property-collection {
      font-size: 9px; letter-spacing: 0.12em; font-weight: 600;
      color: var(--text-muted, #6B7280); white-space: nowrap;
    }
    .property-name {
      font-size: 13px; font-weight: 600;
      color: var(--text, #111827);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* Shared chevron icon used in property + user buttons */
    .chevron-icon {
      font-family: 'Material Icons' !important;
      font-size: 18px !important; width: 18px !important; height: 18px !important;
      color: var(--text-muted, #6B7280); flex-shrink: 0;
      overflow: hidden; line-height: 1 !important;
    }

    /* Icon button base */
    .icon-btn {
      width: 36px; height: 36px; min-width: 36px;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 8px;
      color: var(--text-muted, #6B7280); cursor: pointer;
      position: relative;
      transition: background 150ms, color 150ms;
      -webkit-appearance: none; appearance: none;
      outline: none;
      -webkit-tap-highlight-color: transparent;
    }
    .icon-btn:hover {
      background: var(--surface-2, #F1EDE7);
      color: var(--text, #111827);
    }
    .icon-btn:active {
      background: var(--surface-2, #F1EDE7);
      color: var(--text, #111827);
    }
    .icon-btn:focus { outline: none; }
    .icon-btn:focus-visible {
      outline: 2px solid var(--primary, #2563EB);
      outline-offset: 2px;
    }
    .icon-btn mat-icon {
      font-family: 'Material Icons' !important;
      font-size: 20px !important; width: 20px !important; height: 20px !important;
      overflow: hidden; line-height: 1 !important;
    }

    /* Notification badge */
    .notif-badge {
      position: absolute; top: 4px; right: 4px;
      width: 16px; height: 16px;
      background: #DC2626; color: #fff;
      font-size: 10px; font-weight: 700;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
    }

    /* Notification panel (rendered in CDK overlay, use ::ng-deep or global styles
       but since this is scoped component styles, we use the host class trick) */
    .notif-panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px 10px;
      border-bottom: 1px solid var(--border, #E5E0D8);
      pointer-events: none;
    }
    .notif-panel-title { font-size: 13px; font-weight: 600; color: var(--text, #111827); }
    .notif-panel-badge {
      font-size: 10px; font-weight: 700;
      background: #DC2626; color: #fff;
      border-radius: 9999px; padding: 1px 6px;
    }
    .notif-item { display: flex; align-items: flex-start; gap: 10px; padding: 2px 0; }
    .notif-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
    }
    .notif-dot.info    { background: var(--info, #2563EB); }
    .notif-dot.warning { background: var(--warning, #D97706); }
    .notif-dot.danger  { background: var(--danger, #DC2626); }
    .notif-content { display: flex; flex-direction: column; }
    .notif-title { font-size: 13px; font-weight: 500; color: var(--text, #111827); }
    .notif-meta  { font-size: 11px; color: var(--text-muted, #6B7280); margin-top: 2px; }

    /* User button */
    .user-btn {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 8px 4px 4px; height: 40px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 8px; cursor: pointer;
      transition: background 150ms, border-color 150ms;
      flex-shrink: 0;
      outline: none;
      -webkit-tap-highlight-color: transparent;
    }
    .user-btn:hover {
      background: var(--surface-2, #F1EDE7);
      border-color: var(--border, #E5E0D8);
    }
    .user-btn:focus { outline: none; }
    .avatar {
      width: 32px; height: 32px; min-width: 32px;
      background: var(--primary, #2563EB); color: #fff;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; letter-spacing: 0.02em;
      flex-shrink: 0;
    }
    .user-info {
      display: flex; flex-direction: column; text-align: left; overflow: hidden;
    }
    .user-name {
      font-size: 13px; font-weight: 600;
      color: var(--text, #111827);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 120px;
    }
    .user-role {
      font-size: 10px; color: var(--text-muted, #6B7280);
      text-transform: capitalize; white-space: nowrap;
    }

    @media (max-width: 640px) {
      .user-info, .chevron-icon { display: none; }
      .property-collection { display: none; }
      .property-btn { max-width: 140px; }
    }

    /* Content */
    .content {
      flex: 1; overflow-y: auto;
      padding: var(--space-6, 24px);
      background: var(--bg, #F6F3EE);
    }
    @media (max-width: 768px) {
      .content { padding: var(--space-4, 16px); }
    }
  `],
})
export class ShellComponent {
  auth   = inject(AuthService);
  ctx    = inject(PropertyContextService);
  layout = inject(LayoutService);

  searchQuery = '';
  collapsed   = signal(false);

  constructor() {
    this.ctx.load();
  }

  visibleNav = computed(() => {
    const role = this.auth.role();
    if (!role) return [];
    return NAV.filter(item => !item.roles || item.roles.includes(role as Role));
  });

  toggleCollapse(): void { this.collapsed.update(v => !v); }

  @HostListener('document:keydown', ['$event'])
  handleKey(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.querySelector<HTMLInputElement>('.search-input')?.focus();
    }
  }
}
