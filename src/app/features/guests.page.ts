import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../shared/components/feature-placeholder.component';

@Component({
  selector: 'lux-guests-page',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <lux-feature-placeholder
      title="Guests"
      subtitle="Profiles, history, preferences, VIPs"
      icon="group"
      [week]="4"
      message="Searchable guest directory with stay history, preferences, ID storage, and VIP flags." />
  `,
})
export class GuestsPageComponent {}
