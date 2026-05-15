import { Component, Input } from '@angular/core';
import { CommonModule }     from '@angular/common';

export type ChipVariant =
  | 'success' | 'info' | 'warning' | 'danger'
  | 'accent'  | 'neutral';

@Component({
  selector: 'lux-status-chip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="chip" [attr.data-variant]="variant">
      <ng-content />
    </span>
  `,
  styles: [`
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    .chip[data-variant="success"] { background: var(--success-bg); color: var(--success); }
    .chip[data-variant="info"]    { background: var(--info-bg);    color: var(--info);    }
    .chip[data-variant="warning"] { background: var(--warning-bg); color: var(--warning); }
    .chip[data-variant="danger"]  { background: var(--danger-bg);  color: var(--danger);  }
    .chip[data-variant="accent"]  { background: var(--accent-bg);  color: var(--accent);  }
    .chip[data-variant="neutral"] { background: var(--surface-2);  color: var(--text-muted); }
  `],
})
export class StatusChipComponent {
  @Input() variant: ChipVariant = 'neutral';
  @Input() label = '';
}
