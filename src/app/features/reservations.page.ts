import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../shared/components/feature-placeholder.component';

@Component({
  selector: 'lux-reservations-page',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <lux-feature-placeholder
      title="Reservations"
      subtitle="Search, filter, and manage all bookings"
      icon="event_available"
      [week]="4"
      message="Full CRUD: create reservations, modify dates, assign rooms, manage check-in/out and folios." />
  `,
})
export class ReservationsPageComponent {}
