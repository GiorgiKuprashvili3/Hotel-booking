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
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
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
