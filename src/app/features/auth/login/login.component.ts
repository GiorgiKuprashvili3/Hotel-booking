import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../core/auth/auth.service';
import { Role } from '../../../domain/enums';
import { DEMO_USERS } from '../../../core/auth/models/demo-users';

export interface DemoCard {
  role: Role;
  title: string;
  description: string;
  icon: string;
  accent: string;
}

/** Icon and accent colour per role — purely presentational config, not business data. */
const ROLE_DISPLAY: Record<Role, { icon: string; accent: string }> = {
  [Role.Admin]:        { icon: 'shield_person',      accent: '#C9A961' },
  [Role.Manager]:      { icon: 'workspace_premium',  accent: '#1A3A5C' },
  [Role.Receptionist]: { icon: 'concierge',          accent: '#4A6B8A' },
  [Role.Housekeeper]:  { icon: 'cleaning_services',  accent: '#4A7C59' },
  [Role.Accountant]:   { icon: 'calculate',          accent: '#7C4A6B' },
};

@Component({
  selector: 'lux-login',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './login.component.html',
  styleUrl:    './login.component.scss',
})
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  /** Pre-fill with the Manager demo user's email so it looks realistic. */
  email    = DEMO_USERS[Role.Manager].email;
  password = '••••••••';

  /**
   * Build demo cards entirely from DEMO_USERS — no hardcoded strings.
   * Description is derived from the user's name, role, and property count.
   */
  demoCards: DemoCard[] = (Object.values(Role) as Role[])
    .filter(role => role in DEMO_USERS && role in ROLE_DISPLAY)
    .map(role => {
      const user      = DEMO_USERS[role];
      const display   = ROLE_DISPLAY[role];
      const propCount = user.propertyIds.length;
      const propLabel = propCount === 1 ? '1 property' : `${propCount} properties`;

      const roleDescriptions: Record<Role, string> = {
        [Role.Admin]:        `Full system access · ${propLabel}`,
        [Role.Manager]:      `Operations & analytics · ${propLabel}`,
        [Role.Receptionist]: `Front desk & reservations · ${propLabel}`,
        [Role.Housekeeper]:  `Cleaning tasks & maintenance · ${propLabel}`,
        [Role.Accountant]:   `Financials & reporting · ${propLabel}`,
      };

      return {
        role,
        title:       user.firstName + ' ' + user.lastName,
        description: roleDescriptions[role],
        icon:        display.icon,
        accent:      display.accent,
      };
    });

  loginAs(role: Role): void {
    this.auth.loginAsDemo(role);
    this.router.navigateByUrl('/app/dashboard');
  }
}
