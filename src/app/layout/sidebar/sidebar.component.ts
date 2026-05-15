import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { Role } from '../../domain/enums';
import { LayoutService } from '../../core/config/layout.service';

interface NavItem {
  label: string;
  icon: string;
  link: string;
  roles?: Role[];
}

@Component({
  selector: 'lux-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatTooltipModule, HasRoleDirective],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed()" [class.open]="layout.mobileOpen()">
      <div class="logo">
        <div class="logo-mark">L</div>
        @if (!collapsed()) {
          <div class="logo-text">
            <span class="logo-name">LuxStay</span>
            <span class="logo-tag">Collection</span>
          </div>
        }
      </div>

      <nav class="nav">
        @for (group of groups; track group.title) {
          @if (!collapsed() && group.title) {
            <div class="nav-group-title">{{ group.title }}</div>
          }
          @if (collapsed() && $index > 0) { <div class="nav-divider"></div> }

          @for (item of group.items; track item.link) {
            <a *hasRole="item.roles ?? []"
               [routerLink]="item.link"
               routerLinkActive="active"
               class="nav-item"
               (click)="layout.closeMobile()"
               [matTooltip]="collapsed() ? item.label : ''"
               matTooltipPosition="right">
              <mat-icon>{{ item.icon }}</mat-icon>
              @if (!collapsed()) { <span class="nav-label">{{ item.label }}</span> }
            </a>
          }
        }
      </nav>

      <button class="collapse-btn" (click)="toggle()" [matTooltip]="collapsed() ? 'Expand' : 'Collapse'" matTooltipPosition="right">
        <mat-icon>{{ collapsed() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
      </button>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: var(--sidebar-width);
      height: 100vh;
      background: var(--navy-900);
      color: #FFFFFF;
      padding: var(--space-4) var(--space-3);
      display: flex;
      flex-direction: column;
      transition: width var(--t-base);
      position: relative;
      flex-shrink: 0;
    }
    .sidebar.collapsed { width: var(--sidebar-width-collapsed); padding: var(--space-4) var(--space-2); }

    .logo {
      display: flex; align-items: center; gap: var(--space-3);
      padding: 0 var(--space-2) var(--space-4);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      margin-bottom: var(--space-4);
      min-height: 56px;
    }
    .logo-mark {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, var(--gold-500), var(--gold-300));
      border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      color: var(--navy-900);
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 20px;
      flex-shrink: 0;
      box-shadow: var(--shadow-gold);
    }
    .logo-text { display: flex; flex-direction: column; line-height: 1; }
    .logo-name { font-family: var(--font-display); font-size: var(--text-xl); font-weight: 700; letter-spacing: -0.01em; }
    .logo-tag {
      font-size: 10px;
      color: var(--gold-300);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-top: 4px;
    }

    .nav { flex: 1; overflow-y: auto; }
    .nav-group-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: rgba(255,255,255,0.4);
      padding: var(--space-3) var(--space-3) var(--space-1);
      font-weight: 600;
    }
    .nav-divider { height: 1px; background: rgba(255,255,255,0.08); margin: var(--space-2) var(--space-2); }

    .nav-item {
      display: flex; align-items: center; gap: var(--space-3);
      padding: 10px var(--space-3);
      border-radius: var(--radius-md);
      color: rgba(255,255,255,0.7);
      text-decoration: none;
      font-size: var(--text-sm);
      font-weight: 500;
      transition: all var(--t-fast);
      position: relative;
      margin-bottom: 2px;
    }
    .nav-item:hover { background: rgba(255,255,255,0.06); color: #FFFFFF; }
    .nav-item.active {
      background: rgba(201, 169, 97, 0.12);
      color: var(--gold-300);
    }
    .nav-item.active::before {
      content: '';
      position: absolute;
      left: 0; top: 50%;
      transform: translateY(-50%);
      width: 3px; height: 20px;
      background: var(--gold-500);
      border-radius: 0 2px 2px 0;
    }
    .nav-item mat-icon {
      font-size: 20px; width: 20px; height: 20px;
      flex-shrink: 0;
    }
    .sidebar.collapsed .nav-item { justify-content: center; padding: 10px; }

    .collapse-btn {
      position: absolute;
      top: 28px; right: -12px;
      width: 24px; height: 24px;
      background: var(--surface);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 50%;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: var(--shadow-1);
      transition: all var(--t-fast);
    }
    .collapse-btn:hover { color: var(--primary); border-color: var(--primary); }
    .collapse-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    @media (max-width: 1024px) {
      .sidebar { position: fixed; z-index: var(--z-overlay); transform: translateX(-100%); }
      .sidebar.open { transform: translateX(0); box-shadow: var(--shadow-3); }
    }
  `],
})
export class SidebarComponent {
  collapsed = signal(false);
  layout = inject(LayoutService);

  toggle() { this.collapsed.update(v => !v); }

  groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard',  icon: 'space_dashboard', link: '/app/dashboard' },
      ],
    },
    {
      title: 'Front desk',
      items: [
        { label: 'Calendar',     icon: 'calendar_month', link: '/app/calendar',
          roles: [Role.Admin, Role.Manager, Role.Receptionist] },
        { label: 'Reservations', icon: 'event_available', link: '/app/reservations',
          roles: [Role.Admin, Role.Manager, Role.Receptionist] },
        { label: 'Rooms',        icon: 'meeting_room', link: '/app/rooms',
          roles: [Role.Admin, Role.Manager, Role.Receptionist, Role.Housekeeper] },
        { label: 'Guests',       icon: 'group', link: '/app/guests',
          roles: [Role.Admin, Role.Manager, Role.Receptionist] },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'Housekeeping', icon: 'cleaning_services', link: '/app/housekeeping',
          roles: [Role.Admin, Role.Manager, Role.Housekeeper] },
        { label: 'Maintenance',  icon: 'build', link: '/app/maintenance',
          roles: [Role.Admin, Role.Manager, Role.Housekeeper] },
        { label: 'Concierge',    icon: 'concierge', link: '/app/concierge',
          roles: [Role.Admin, Role.Manager, Role.Receptionist] },
      ],
    },
    {
      title: 'Insights',
      items: [
        { label: 'Analytics', icon: 'analytics', link: '/app/analytics',
          roles: [Role.Admin, Role.Manager, Role.Accountant] },
        { label: 'Loyalty',   icon: 'workspace_premium', link: '/app/loyalty',
          roles: [Role.Admin, Role.Manager] },
      ],
    },
    {
      title: 'Admin',
      items: [
        { label: 'Staff',    icon: 'badge', link: '/app/staff',
          roles: [Role.Admin, Role.Manager] },
        { label: 'Settings', icon: 'settings', link: '/app/settings',
          roles: [Role.Admin] },
      ],
    },
  ];
}
