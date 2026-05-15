import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../shared/components/feature-placeholder.component';

@Component({
  selector: 'lux-loyalty-page',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <lux-feature-placeholder
      title="Loyalty program"
      subtitle="Tiers, points, member benefits"
      icon="workspace_premium"
      [week]="7"
      message="Bronze/Silver/Gold/Platinum tiers, points ledger, and tier-based benefit configuration." />
  `,
})
export class LoyaltyPageComponent {}
