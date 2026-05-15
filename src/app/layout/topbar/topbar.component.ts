import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/config/theme.service';
import { LayoutService } from '../../core/config/layout.service';
import { PropertySwitcherComponent } from '../property-switcher/property-switcher.component';

@Component({
  selector: 'lux-topbar',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule, MatMenuModule,
    MatBadgeModule, MatTooltipModule, PropertySwitcherComponent,
  ],
  template: `
    <header class="topbar">
      <!-- Mobile hamburger — only visible below 1024px -->
      <button mat-icon-button class="hamburger" (click)="layout.toggleMobile()" aria-label="Open navigation">
        <mat-icon>menu</mat-icon>
      </button>

      <div class="search">
        <mat-icon>search</mat-icon>
        <input placeholder="Search reservations, guests, rooms…" />
        <kbd>⌘ K</kbd>
      </div>

      <div class="right">
        <lux-property-switcher></lux-property-switcher>

        <button mat-icon-button (click)="theme.toggle()"
                [matTooltip]="theme.theme() === 'light' ? 'Dark mode' : 'Light mode'">
          <mat-icon>{{ theme.theme() === 'light' ? 'dark_mode' : 'light_mode' }}</mat-icon>
        </button>

        <button mat-icon-button matTooltip="Notifications" [matMenuTriggerFor]="notif">
          <mat-icon matBadge="3" matBadgeColor="warn" matBadgeSize="small">notifications</mat-icon>
        </button>
        <mat-menu #notif="matMenu" class="notif-menu">
          <div class="notif-header">Notifications</div>
          <button mat-menu-item>
            <div class="notif-item">
              <div class="notif-dot info"></div>
              <div>
                <div class="notif-title">New reservation</div>
                <div class="notif-time">Sofia booked Suite 502 · 2m ago</div>
              </div>
            </div>
          </button>
          <button mat-menu-item>
            <div class="notif-item">
              <div class="notif-dot warning"></div>
              <div>
                <div class="notif-title">Late checkout request</div>
                <div class="notif-time">Room 304 · 12m ago</div>
              </div>
            </div>
          </button>
          <button mat-menu-item>
            <div class="notif-item">
              <div class="notif-dot danger"></div>
              <div>
                <div class="notif-title">Maintenance flagged</div>
                <div class="notif-time">AC unit, Room 401 · 1h ago</div>
              </div>
            </div>
          </button>
        </mat-menu>

        <button class="user-btn" [matMenuTriggerFor]="userMenu">
          <div class="avatar">{{ auth.initials() }}</div>
          <div class="user-info">
            <span class="user-name">{{ auth.user()?.firstName }} {{ auth.user()?.lastName }}</span>
            <span class="user-role">{{ auth.role() }}</span>
          </div>
          <mat-icon>expand_more</mat-icon>
        </button>
        <mat-menu #userMenu="matMenu" xPosition="before">
          <button mat-menu-item><mat-icon>person</mat-icon> Profile</button>
          <button mat-menu-item><mat-icon>tune</mat-icon> Preferences</button>
          <button mat-menu-item (click)="auth.logout()">
            <mat-icon>logout</mat-icon> Sign out
          </button>
        </mat-menu>
      </div>
    </header>
  `,
  styles: [`
    .topbar {
      height: var(--topbar-height);
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0 var(--space-6);
      display: flex;
      align-items: center;
      gap: var(--space-4);
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
    }

    .hamburger {
      display: none;
      flex-shrink: 0;
    }
    @media (max-width: 1024px) {
      .hamburger { display: flex; }
    }

    .search {
      flex: 1;
      max-width: 480px;
      display: flex; align-items: center; gap: var(--space-2);
      background: var(--surface-2);
      border: 1px solid transparent;
      border-radius: var(--radius-md);
      padding: 0 var(--space-3);
      height: 40px;
      transition: all var(--t-fast);
    }
    .search:focus-within {
      background: var(--surface);
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(26, 58, 92, 0.08);
    }
    .search mat-icon { color: var(--text-muted); font-size: 18px; width: 18px; height: 18px; }
    .search input {
      flex: 1; border: none; background: transparent; outline: none;
      font-size: var(--text-sm);
      color: var(--text);
      font-family: inherit;
    }
    .search input::placeholder { color: var(--text-subtle); }
    kbd {
      font-family: var(--font-mono);
      font-size: 10px;
      padding: 2px 6px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
    }

    .right { display: flex; align-items: center; gap: var(--space-1); }

    .user-btn {
      display: flex; align-items: center; gap: var(--space-2);
      padding: 4px 10px 4px 4px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background var(--t-fast);
      height: 44px;
      margin-left: var(--space-2);
    }
    .user-btn:hover { background: var(--surface-2); }
    .avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--navy-700), var(--navy-500));
      color: #FFFFFF;
      display: flex; align-items: center; justify-content: center;
      font-size: var(--text-xs);
      font-weight: 600;
      flex-shrink: 0;
    }
    .user-info { display: flex; flex-direction: column; line-height: 1.1; text-align: left; }
    .user-name { font-size: var(--text-sm); font-weight: 500; color: var(--text); }
    .user-role { font-size: 10px; color: var(--text-subtle); text-transform: capitalize; }
    .user-btn mat-icon { color: var(--text-muted); font-size: 16px; width: 16px; height: 16px; }

    .notif-header {
      padding: var(--space-3) var(--space-4);
      font-weight: 600;
      border-bottom: 1px solid var(--border);
    }
    .notif-item { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-1) 0; }
    .notif-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
    .notif-dot.info { background: var(--info); }
    .notif-dot.warning { background: var(--warning); }
    .notif-dot.danger { background: var(--danger); }
    .notif-title { font-size: var(--text-sm); font-weight: 500; }
    .notif-time { font-size: var(--text-xs); color: var(--text-muted); }

    @media (max-width: 768px) {
      .search { display: none; }
      .user-info { display: none; }
    }
  `],
})
export class TopbarComponent {
  auth   = inject(AuthService);
  theme  = inject(ThemeService);
  layout = inject(LayoutService);
}
