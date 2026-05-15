import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../shared/components/feature-placeholder.component';

@Component({
  selector: 'lux-staff-page',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <lux-feature-placeholder
      title="Staff"
      subtitle="Team members and access control"
      icon="badge"
      [week]="7"
      message="Staff directory with role assignment and per-property access. RBAC matrix grid." />
  `,
})
export class StaffPageComponent {}
