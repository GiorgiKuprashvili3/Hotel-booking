import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../shared/components/feature-placeholder.component';

@Component({
  selector: 'lux-concierge-page',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <lux-feature-placeholder
      title="Concierge"
      subtitle="Guest requests: towels, room service, taxis, spa"
      icon="concierge"
      [week]="7"
      message="Inbox-style request handler. Each request has a type, assignee, and SLA timer." />
  `,
})
export class ConciergePageComponent {}
