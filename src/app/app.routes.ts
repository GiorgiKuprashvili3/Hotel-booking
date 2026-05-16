import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { Role } from './domain/enums';

export const APP_ROUTES: Routes = [
  /* ---------- Auth ---------- */
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
        title: 'Sign in · LuxStay',
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },

  /* ---------- Authenticated app shell ---------- */
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'Dashboard · LuxStay',
      },

      {
        path: 'calendar',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin, Role.Manager, Role.Receptionist] },
        loadComponent: () => import('./features/calendar.page').then(m => m.CalendarPageComponent),
        title: 'Calendar · LuxStay',
      },
      {
        path: 'reservations',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin, Role.Manager, Role.Receptionist] },
        loadComponent: () => import('./features/reservations.page').then(m => m.ReservationsPageComponent),
        title: 'Reservations · LuxStay',
      },
      {
        path: 'reservations/:id',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin, Role.Manager, Role.Receptionist] },
        loadComponent: () => import('./features/reservations/reservation-detail.page').then(m => m.ReservationDetailPageComponent),
        title: 'Reservation · LuxStay',
      },
      {
        path: 'rooms',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin, Role.Manager, Role.Receptionist, Role.Housekeeper] },
        loadComponent: () => import('./features/rooms.page').then(m => m.RoomsPageComponent),
        title: 'Rooms · LuxStay',
      },
      {
        path: 'guests',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin, Role.Manager, Role.Receptionist] },
        loadComponent: () => import('./features/guests.page').then(m => m.GuestsPageComponent),
        title: 'Guests · LuxStay',
      },
      {
        path: 'guests/:id',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin, Role.Manager, Role.Receptionist] },
        loadComponent: () => import('./features/guests/guest-detail.page').then(m => m.GuestDetailPageComponent),
        title: 'Guest · LuxStay',
      },
      {
        path: 'housekeeping',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin, Role.Manager, Role.Housekeeper] },
        loadComponent: () => import('./features/housekeeping.page').then(m => m.HousekeepingPageComponent),
        title: 'Housekeeping · LuxStay',
      },
      {
        path: 'maintenance',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin, Role.Manager, Role.Housekeeper] },
        loadComponent: () => import('./features/maintenance.page').then(m => m.MaintenancePageComponent),
        title: 'Maintenance · LuxStay',
      },
      {
        path: 'concierge',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin, Role.Manager, Role.Receptionist] },
        loadComponent: () => import('./features/concierge.page').then(m => m.ConciergePageComponent),
        title: 'Concierge · LuxStay',
      },
      {
        path: 'analytics',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin, Role.Manager, Role.Accountant] },
        loadComponent: () => import('./features/analytics.page').then(m => m.AnalyticsPageComponent),
        title: 'Analytics · LuxStay',
      },
      {
        path: 'loyalty',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin, Role.Manager] },
        loadComponent: () => import('./features/loyalty.page').then(m => m.LoyaltyPageComponent),
        title: 'Loyalty · LuxStay',
      },
      {
        path: 'staff',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin, Role.Manager] },
        loadComponent: () => import('./features/staff.page').then(m => m.StaffPageComponent),
        title: 'Staff · LuxStay',
      },
      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin] },
        loadComponent: () => import('./features/settings.page').then(m => m.SettingsPageComponent),
        title: 'Settings · LuxStay',
      },
    ],
  },

  /* ---------- 404 ---------- */
  {
    path: 'not-found',
    loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent),
    title: 'Not found · LuxStay',
  },

  /* ---------- Defaults ---------- */
  { path: '',  pathMatch: 'full', redirectTo: '/app/dashboard' },
  { path: '**', redirectTo: '/not-found' },
];
