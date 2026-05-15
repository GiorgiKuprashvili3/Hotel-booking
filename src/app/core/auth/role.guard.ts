import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Role } from '../../domain/enums';

/**
 * Usage in routes:
 *   { path: 'analytics', loadComponent: ..., canActivate: [roleGuard],
 *     data: { roles: [Role.Manager, Role.Admin] } }
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowed = (route.data?.['roles'] ?? []) as Role[];

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }
  if (allowed.length === 0 || auth.hasRole(...allowed)) return true;

  return router.createUrlTree(['/app/dashboard']);
};
