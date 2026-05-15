# LuxStay — Hotel Management System

Premium hotel PMS portfolio project. Angular 18 + Material + custom navy/gold/cream theme.

## Setup

```bash
# 1. Create a fresh Angular project
ng new luxstay --standalone --routing --style=scss --ssr=false
cd luxstay

# 2. Add Material + dependencies
ng add @angular/material
# Choose: Custom theme, Yes typography, Yes animations
npm install @angular/cdk date-fns @faker-js/faker
npm install apexcharts ng-apexcharts

# 3. Replace the generated src/ with the files from this starter
# 4. Run
ng serve
```

## What's in this Week 1 starter

- ✅ Design tokens (navy / gold / cream) wired through CSS variables
- ✅ Material theme override using your palette
- ✅ Typography (Playfair Display + Inter)
- ✅ Light + dark theme toggle
- ✅ Auth service with role-based access (signals-based)
- ✅ `*hasRole` structural directive
- ✅ Auth + role guards
- ✅ Login page with demo role-switcher
- ✅ Shell layout: sidebar + topbar + property switcher
- ✅ Shared components: KpiTile, StatusChip, EmptyState, Skeleton, PageHeader, ConfirmDialog
- ✅ Domain models for every entity
- ✅ Fake-backend service architecture (interface + token + mock impl pattern)
- ✅ Seed data generator (Faker)
- ✅ Placeholder dashboard with live KPIs
- ✅ Responsive shell (drawer on mobile)
- ✅ Branded 404 page

## Demo roles

The login page has 4 quick-pick buttons:

- **Admin** — full access including staff management & settings
- **Manager** — operations + analytics, no admin-only settings
- **Receptionist** — front-desk: reservations, guests, check-in/out
- **Housekeeper** — housekeeping + maintenance only

Different sidebar items appear per role via `*hasRole`.

## Folder structure

```
src/app/
  core/         singletons (auth, interceptors, config)
  shared/       reusable components, directives, pipes
  layout/       shell, sidebar, topbar
  domain/       pure TS interfaces & enums
  data/         services (interface + mock impl, HTTP impl later)
  features/    lazy-loaded feature modules
  public/      marketing site + booking widget
```

## Swap mock backend for real later

Each service is registered via an InjectionToken:

```ts
{ provide: RESERVATION_SERVICE, useClass: MockReservationService }
```

When NestJS is ready, change one line:

```ts
{ provide: RESERVATION_SERVICE, useClass: HttpReservationService }
```

No component changes needed.
