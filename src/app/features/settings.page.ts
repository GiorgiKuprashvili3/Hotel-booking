import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../shared/components/feature-placeholder.component';

@Component({
  selector: 'lux-settings-page',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <lux-feature-placeholder
      title="Settings"
      subtitle="Property configuration, rates, taxes, integrations"
      icon="settings"
      [week]="7"
      message="Tax rate, currency, check-in/out times, rate plan editor, and integration toggles." />
  `,
})
export class SettingsPageComponent {}
