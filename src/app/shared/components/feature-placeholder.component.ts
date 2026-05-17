import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageHeaderComponent } from './page-header.component';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  selector: 'lux-feature-placeholder',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './feature-placeholder.component.html',
  styleUrl:    './feature-placeholder.component.scss',
})
export class FeaturePlaceholderComponent {
  @Input() title    = 'Feature';
  @Input() subtitle?: string;
  @Input() icon     = 'construction';
  @Input() week: number = 2;
  @Input() message  = 'This feature is on the roadmap and will be implemented in an upcoming week.';
}
