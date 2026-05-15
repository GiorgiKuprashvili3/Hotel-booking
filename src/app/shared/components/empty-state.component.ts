import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'lux-empty-state',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="empty">
      <div class="empty-icon">
        <mat-icon>{{ icon }}</mat-icon>
      </div>
      <h3 class="empty-title">{{ title }}</h3>
      @if (message) { <p class="empty-message">{{ message }}</p> }
      <div class="empty-actions">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .empty {
      text-align: center;
      padding: var(--space-12) var(--space-6);
      max-width: 440px;
      margin: 0 auto;
    }
    .empty-icon {
      width: 64px; height: 64px;
      margin: 0 auto var(--space-4);
      border-radius: 50%;
      background: var(--surface-2);
      display: flex; align-items: center; justify-content: center;
      color: var(--text-subtle);
    }
    .empty-icon mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .empty-title {
      font-size: var(--text-xl);
      margin-bottom: var(--space-2);
      color: var(--text);
    }
    .empty-message {
      color: var(--text-muted);
      font-size: var(--text-sm);
      margin-bottom: var(--space-4);
    }
    .empty-actions { display: flex; gap: var(--space-2); justify-content: center; }
  `],
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = 'No data';
  @Input() message?: string;
}
