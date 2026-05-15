import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

@Component({
  selector: 'lux-feature-placeholder',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, PageHeaderComponent, EmptyStateComponent],
  template: `
    <lux-page-header [title]="title" [subtitle]="subtitle">
      <button mat-stroked-button disabled>
        <mat-icon>add</mat-icon>
        New
      </button>
    </lux-page-header>

    <div class="surface placeholder-surface">
      <lux-empty-state
        [icon]="icon"
        title="Coming in Week {{ week }}"
        [message]="message">
        <button mat-flat-button color="primary" disabled>
          <mat-icon>construction</mat-icon>
          Under construction
        </button>
      </lux-empty-state>
    </div>
  `,
  styles: [`
    .placeholder-surface {
      padding: var(--space-12) var(--space-6);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-1);
    }
  `],
})
export class FeaturePlaceholderComponent {
  @Input() title = 'Feature';
  @Input() subtitle?: string;
  @Input() icon = 'construction';
  @Input() week: number = 2;
  @Input() message = 'This feature is on the roadmap and will be implemented in an upcoming week.';
}
