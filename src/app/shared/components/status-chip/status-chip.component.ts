import { Component, Input } from '@angular/core';
import { CommonModule }     from '@angular/common';

export type ChipVariant =
  | 'success' | 'info' | 'warning' | 'danger'
  | 'accent'  | 'neutral';

@Component({
  selector: 'lux-status-chip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-chip.component.html',
  styleUrl:    './status-chip.component.scss',
})
export class StatusChipComponent {
  @Input() variant: ChipVariant = 'neutral';
  @Input() label = '';
}
