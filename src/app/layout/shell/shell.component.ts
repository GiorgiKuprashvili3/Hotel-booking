import {
  Component, computed, HostListener, inject, signal,
} from '@angular/core';
import { CommonModule }           from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { MatIconModule }          from '@angular/material/icon';
import { MatButtonModule }        from '@angular/material/button';
import { MatMenuModule }          from '@angular/material/menu';
import { MatTooltipModule }       from '@angular/material/tooltip';
import { MatDividerModule }       from '@angular/material/divider';
import { FormsModule }            from '@angular/forms';
import { AuthService }            from '../../core/auth/auth.service';
import { PropertyContextService } from '../../core/config/property-context.service';
import { LayoutService }          from '../../core/config/layout.service';
import { BookingBroadcastService } from '../../core/realtime/booking-broadcast.service';
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
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  auth      = inject(AuthService);
  ctx       = inject(PropertyContextService);
  layout    = inject(LayoutService);
  broadcast = inject(BookingBroadcastService);
  private router = inject(Router);

  searchQuery = '';
  collapsed   = signal(false);

  /** Most recent booking events received via the realtime channel. */
  recentBookings = computed(() =>
    this.broadcast.recent()
      .filter(e => e.type === 'booking.created')
      .slice(0, 5));

  notifCount = computed(() => this.recentBookings().length);

  notifAriaLabel = computed(() =>
    this.notifCount() > 0
      ? `Notifications, ${this.notifCount()} unread`
      : 'Notifications, no unread');

  constructor() {
    this.ctx.load();
  }

  goToReservation(id: string): void {
    this.router.navigate(['/app/reservations', id]);
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