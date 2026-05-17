import { Component, Input } from '@angular/core';
import { CommonModule }     from '@angular/common';
import { MatIconModule }    from '@angular/material/icon';

@Component({
  selector: 'lux-kpi-tile',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './kpi-tile.component.html',
  styleUrl:    './kpi-tile.component.scss',
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
