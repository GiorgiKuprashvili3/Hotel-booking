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
  template: `
    <button mat-button class="switcher" [matMenuTriggerFor]="menu">
      <span class="dot"></span>
      <div class="info">
        <span class="brand">{{ ctx.active()?.brand }}</span>
        <span class="name">{{ ctx.active()?.name ?? 'Select property' }}</span>
      </div>
      <mat-icon>expand_more</mat-icon>
    </button>

    <mat-menu #menu="matMenu" class="property-menu" xPosition="before">
      @for (p of ctx.properties(); track p.id) {
        <button mat-menu-item
                (click)="ctx.setActive(p.id)"
                [class.active]="p.id === ctx.activeId()">
          <div class="prop-item">
            <div class="prop-stars">
              @for (s of starRange(p.starRating); track $index) { <mat-icon>star</mat-icon> }
            </div>
            <div>
              <div class="prop-name">{{ p.name }}</div>
              <div class="prop-meta">{{ p.city }}, {{ p.country }} · {{ p.totalRooms }} rooms</div>
            </div>
            @if (p.id === ctx.activeId()) {
              <mat-icon class="check">check</mat-icon>
            }
          </div>
        </button>
      }
    </mat-menu>
  `,
  styles: [`
    .switcher {
      height: 48px !important;
      padding: 0 var(--space-3) !important;
      border-radius: var(--radius-md) !important;
      display: flex !important;
      align-items: center !important;
      gap: var(--space-2);
    }
    .switcher:hover { background: var(--surface-2) !important; }

    .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--success); flex-shrink: 0;
      box-shadow: 0 0 0 3px var(--success-bg);
    }
    .info {
      display: flex; flex-direction: column; align-items: flex-start;
      line-height: 1.1; text-align: left;
    }
    .brand {
      font-size: 10px;
      color: var(--text-subtle);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 500;
    }
    .name {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text);
      font-family: var(--font-display);
    }

    .prop-item {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-1) 0;
    }
    .prop-stars { display: flex; }
    .prop-stars mat-icon {
      font-size: 12px !important; width: 12px !important; height: 12px !important;
      color: var(--accent);
    }
    .prop-name { font-weight: 500; font-size: var(--text-sm); }
    .prop-meta { font-size: var(--text-xs); color: var(--text-muted); }
    .check { color: var(--accent); }
  `],
})
export class PropertySwitcherComponent {
  ctx = inject(PropertyContextService);
  starRange(n: number): number[] { return Array.from({ length: n }, (_, i) => i); }
}
