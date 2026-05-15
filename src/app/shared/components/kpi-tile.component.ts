import { Component, Input } from '@angular/core';
import { CommonModule }     from '@angular/common';
import { MatIconModule }    from '@angular/material/icon';

@Component({
  selector: 'lux-kpi-tile',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="tile" [class.loading]="loading">
      <div class="tile-header">
        <span class="tile-label">{{ label }}</span>
        <div class="tile-icon">
          <mat-icon>{{ icon }}</mat-icon>
        </div>
      </div>

      <div class="tile-value">
        @if (prefix) { <span class="value-prefix">{{ prefix }}</span> }
        <span class="value-main">{{ loading ? '—' : value }}</span>
        @if (suffix && !loading) { <span class="value-suffix">{{ suffix }}</span> }
      </div>

      @if (delta !== undefined && !loading) {
        <div class="tile-delta" [class.positive]="delta > 0" [class.negative]="delta < 0">
          <mat-icon class="delta-icon">
            {{ delta > 0 ? 'arrow_upward' : delta < 0 ? 'arrow_downward' : 'remove' }}
          </mat-icon>
          <span>{{ delta | number:'1.1-1' }}%</span>
          @if (deltaLabel) { <span class="delta-label">{{ deltaLabel }}</span> }
        </div>
      }
    </div>
  `,
  styles: [`
    .tile {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      transition: box-shadow var(--t-base);
    }
    .tile:hover { box-shadow: 0 2px 12px rgba(0,0,0,.06); }

    .tile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .tile-label {
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }
    .tile-icon {
      width: 32px;
      height: 32px;
      background: var(--surface-2);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary);
    }
    .tile-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .tile-value {
      display: flex;
      align-items: baseline;
      gap: 2px;
    }
    .value-prefix { font-size: var(--text-lg); color: var(--text-muted); font-weight: 600; }
    .value-main   { font-size: 28px; font-weight: 700; color: var(--text); line-height: 1; }
    .value-suffix { font-size: var(--text-lg); color: var(--text-muted); font-weight: 600; }

    .tile-delta {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: var(--text-xs);
      font-weight: 500;
      color: var(--text-subtle);
    }
    .tile-delta.positive { color: var(--success); }
    .tile-delta.negative { color: var(--danger); }
    .delta-icon { font-size: 14px; width: 14px; height: 14px; }
    .delta-label { color: var(--text-subtle); font-weight: 400; margin-left: 2px; }

    /* Loading skeleton */
    .tile.loading .tile-value,
    .tile.loading .tile-delta {
      opacity: .3;
    }
  `],
})
export class KpiTileComponent {
  @Input() label      = '';
  @Input() icon       = '';
  @Input() value: string | number = '';
  @Input() prefix     = '';
  @Input() suffix     = '';
  @Input() delta?: number;
  @Input() deltaLabel = '';
  @Input() loading    = false;
}
