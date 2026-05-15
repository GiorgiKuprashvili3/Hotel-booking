import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { Role } from '../../domain/enums';
import { AuthSession, AuthUser } from './models/auth-user.model';
import { DEMO_USERS } from './models/demo-users';

const STORAGE_KEY = 'luxstay.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  private _session = signal<AuthSession | null>(this.loadFromStorage());

  /** Read-only signal of the current session. */
  readonly session = this._session.asReadonly();
  readonly user        = computed<AuthUser | null>(() => this._session()?.user ?? null);
  readonly role        = computed<Role | null>(()    => this._session()?.user.role ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '';
    return (u.firstName.charAt(0) + u.lastName.charAt(0)).toUpperCase();
  });

  /** Demo login — instantly authenticates as one of the seeded roles. */
  loginAsDemo(role: Role): void {
    const user = DEMO_USERS[role];
    const session: AuthSession = {
      user,
      token: this.makeFakeJwt(user),
      refreshToken: 'fake-refresh-' + crypto.randomUUID(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 8, // 8 hours
    };
    this._session.set(session);
    this.persist(session);
  }

  logout(): void {
    this._session.set(null);
    localStorage.removeItem(STORAGE_KEY);
    this.router.navigateByUrl('/auth/login');
  }

  hasRole(...roles: Role[]): boolean {
    const r = this.role();
    return r !== null && roles.includes(r);
  }

  /** Builds a JWT-shaped string. Not signed — just so the swap to real backend later is a one-line change. */
  private makeFakeJwt(user: AuthUser): string {
    const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      properties: user.propertyIds,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
    }));
    return `${header}.${payload}.fake-signature`;
  }

  private persist(session: AuthSession): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  private loadFromStorage(): AuthSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as AuthSession;
      if (session.expiresAt < Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }
}
