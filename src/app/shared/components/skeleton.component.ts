import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lux-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skeleton"
         [style.width]="width"
         [style.height]="height"
         [style.borderRadius]="radius"></div>
  `,
  styles: [`
    .skeleton {
      display: block;
      background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }
    @keyframes shimmer { 0% {background-position: 200% 0;} 100% {background-position: -200% 0;} }
  `],
})
export class SkeletonComponent {
  @Input() width  = '100%';
  @Input() height = '16px';
  @Input() radius = 'var(--radius-sm)';
}
