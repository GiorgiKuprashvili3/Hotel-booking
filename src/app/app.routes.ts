import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [

  // ── Public ──────────────────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./features/public-booking/landing-page.component')
        .then(m => m.LandingPageComponent),
  },

  // ── Auth shell (lazy) ────────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell/shell.component')
        .then(m => m.ShellComponent),
    children: [

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component')
            .then(m => m.DashboardComponent),
      },

      {
        path: 'reservations',
        loadComponent: () =>
          import('./features/reservations.page')
            .then(m => m.ReservationsPageComponent),
      },

      {
        path: 'reservations/check-in',
        loadComponent: () =>
          import('./features/reservations/check-in-wizard.component')
            .then(m => m.CheckInWizardComponent),
      },

      {
        path: 'reservations/check-out',
        loadComponent: () =>
          import('./features/reservations/check-out-wizard.component')
            .then(m => m.CheckOutWizardComponent),
      },

      {
        path: 'rooms',
        loadComponent: () =>
          import('./features/rooms.page')
            .then(m => m.RoomsPageComponent),
      },

      {
        path: 'guests',
        loadComponent: () =>
          import('./features/guests.page')
            .then(m => m.GuestsPageComponent),
      },

      {
        path: 'housekeeping',
        loadComponent: () =>
          import('./features/housekeeping.page')
            .then(m => m.HousekeepingPageComponent),
      },

      {
        path: 'maintenance',
        loadComponent: () =>
          import('./features/maintenance.page')
            .then(m => m.MaintenancePageComponent),
      },

      {
        path: 'concierge',
        loadComponent: () =>
          import('./features/concierge.page')
            .then(m => m.ConciergePageComponent),
      },

      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics.page')
            .then(m => m.AnalyticsPageComponent),
      },

      {
        path: 'loyalty',
        loadComponent: () =>
          import('./features/loyalty.page')
            .then(m => m.LoyaltyPageComponent),
      },

      {
        path: 'audit',
        loadComponent: () =>
          import('./features/audit.page')
            .then(m => m.AuditPageComponent),
      },

      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar.page')
            .then(m => m.CalendarPageComponent),
      },

    ],
  },

  // ── Fallback ─────────────────────────────────────────────────────────────
  {
    path: '**',
    redirectTo: '',
  },

];
