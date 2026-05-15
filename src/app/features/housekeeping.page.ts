import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../shared/components/feature-placeholder.component';

@Component({
  selector: 'lux-housekeeping-page',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <lux-feature-placeholder
      title="Housekeeping"
      subtitle="Today's cleaning queue and assignments"
      icon="cleaning_services"
      [week]="5"
      message="Kanban board for cleaning tasks (Dirty → In progress → Clean → Inspected), mobile-friendly for housekeepers." />
  `,
})
export class HousekeepingPageComponent {}
