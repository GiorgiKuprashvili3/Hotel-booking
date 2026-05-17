import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PropertyContextService } from '../../core/config/property-context.service';

@Component({
  selector: 'lux-property-switcher',
  standalone: true,
  imports: [CommonModule, MatMenuModule, MatIconModule, MatButtonModule],
  templateUrl: './property-switcher.component.html',
  styleUrl: './property-switcher.component.scss',
})
export class PropertySwitcherComponent {
  ctx = inject(PropertyContextService);
  starRange(n: number): number[] { return Array.from({ length: n }, (_, i) => i); }
}
