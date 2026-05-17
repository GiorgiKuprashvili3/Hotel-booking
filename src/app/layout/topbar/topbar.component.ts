import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/config/theme.service';
import { LayoutService } from '../../core/config/layout.service';
import { PropertySwitcherComponent } from '../property-switcher/property-switcher.component';

@Component({
  selector: 'lux-topbar',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule, MatMenuModule,
    MatBadgeModule, MatTooltipModule, PropertySwitcherComponent,
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  auth   = inject(AuthService);
  theme  = inject(ThemeService);
  layout = inject(LayoutService);
}
