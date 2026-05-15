import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../shared/components/feature-placeholder.component';

@Component({
  selector: 'lux-calendar-page',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <lux-feature-placeholder
      title="Reservation calendar"
      subtitle="Drag-and-drop bookings across rooms and dates"
      icon="calendar_month"
      [week]="3"
      message="A Gantt-style room-by-date timeline with collision detection. This will be the showpiece feature." />
  `,
})
export class CalendarPageComponent {}
