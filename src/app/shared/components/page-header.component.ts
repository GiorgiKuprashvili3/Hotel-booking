import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lux-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">{{ title }}</h1>
        @if (subtitle !== undefined && subtitle !== '') {
          <p class="page-subtitle">{{ subtitle }}</p>
        }
      </div>
      @if (hasActions) {
        <div class="page-actions">
          <ng-content />
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
      flex-wrap: wrap;
    }
    .page-title {
      font-size: var(--text-2xl);
      font-weight: 700;
      color: var(--text);
      margin: 0;
      letter-spacing: -0.01em;
    }
    .page-subtitle {
      font-size: var(--text-sm);
      color: var(--text-muted);
      margin: 4px 0 0;
    }
    .page-actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-shrink: 0;
    }
  `],
})
export class PageHeaderComponent {
  @Input() title:      string           = '';
  @Input() subtitle:   string | undefined = undefined;
  @Input() hasActions: boolean           = true;
}
