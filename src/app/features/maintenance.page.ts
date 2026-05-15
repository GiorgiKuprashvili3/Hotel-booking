import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../shared/components/feature-placeholder.component';

@Component({
  selector: 'lux-maintenance-page',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <lux-feature-placeholder
      title="Maintenance"
      subtitle="Tickets, priorities, assignments"
      icon="build"
      [week]="5"
      message="Issue tracker for room and facility maintenance — categorize, assign, and resolve." />
  `,
})
export class MaintenancePageComponent {}
