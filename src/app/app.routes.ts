import { Routes } from '@angular/router';

export const routes: Routes = [

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
          import('./features/reservations/reservations.component')
            .then(m => m.ReservationsComponent),
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
          import('./features/rooms/rooms.component')
            .then(m => m.RoomsComponent),
      },

      {
        path: 'guests',
        loadComponent: () =>
          import('./features/guests/guests.component')
            .then(m => m.GuestsComponent),
      },

      {
        path: 'housekeeping',
        loadComponent: () =>
          import('./features/housekeeping/housekeeping.component')
            .then(m => m.HousekeepingComponent),
      },

      {
        path: 'maintenance',
        loadComponent: () =>
          import('./features/maintenance/maintenance.component')
            .then(m => m.MaintenanceComponent),
      },

      {
        path: 'concierge',
        loadComponent: () =>
          import('./features/concierge/concierge.component')
            .then(m => m.ConciergeComponent),
      },

      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics.component')
            .then(m => m.AnalyticsComponent),
      },

      {
        path: 'loyalty',
        loadComponent: () =>
          import('./features/loyalty/loyalty.component')
            .then(m => m.LoyaltyComponent),
      },

      {
        path: 'audit',
        loadComponent: () =>
          import('./features/audit/audit.component')
            .then(m => m.AuditComponent),
      },

      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/calendar.component')
            .then(m => m.CalendarComponent),
      },

    ],
  },

  // ── Fallback ─────────────────────────────────────────────────────────────
  {
    path: '**',
    redirectTo: '',
  },

];
