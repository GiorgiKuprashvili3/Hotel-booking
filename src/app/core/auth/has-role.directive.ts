import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Role } from '../../domain/enums';

/**
 * Usage:
 *   <a *hasRole="['admin','manager']" routerLink="/analytics">Analytics</a>
 *   <button *hasRole="'admin'">Delete</button>
 */
@Directive({
  selector: '[hasRole]',
  standalone: true,
})
export class HasRoleDirective {
  private tpl  = inject(TemplateRef<unknown>);
  private vcr  = inject(ViewContainerRef);
  private auth = inject(AuthService);
  private allowed: Role[] = [];
  private viewCreated = false;

  constructor() {
    effect(() => {
      const isAllowed = this.allowed.length === 0
        ? true
        : this.auth.hasRole(...this.allowed);

      if (isAllowed && !this.viewCreated) {
        this.vcr.createEmbeddedView(this.tpl);
        this.viewCreated = true;
      } else if (!isAllowed && this.viewCreated) {
        this.vcr.clear();
        this.viewCreated = false;
      }
    });
  }

  @Input() set hasRole(value: Role | Role[] | string | string[]) {
    const arr = Array.isArray(value) ? value : [value];
    this.allowed = arr as Role[];
  }
}
