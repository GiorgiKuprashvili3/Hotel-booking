import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../shared/components/feature-placeholder.component';

@Component({
  selector: 'lux-analytics-page',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <lux-feature-placeholder
      title="Analytics"
      subtitle="Occupancy, ADR, RevPAR, channel performance"
      icon="analytics"
      [week]="6"
      message="Charts powered by ApexCharts: revenue trends, occupancy heatmap, booking source breakdown, top-performing room types." />
  `,
})
export class AnalyticsPageComponent {}
