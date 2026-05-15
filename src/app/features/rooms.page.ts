import { Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../shared/components/feature-placeholder.component';

@Component({
  selector: 'lux-rooms-page',
  standalone: true,
  imports: [FeaturePlaceholderComponent],
  template: `
    <lux-feature-placeholder
      title="Rooms"
      subtitle="Floor map + grid view with live status"
      icon="meeting_room"
      [week]="4"
      message="Visual floor map, room type management, and bulk status updates." />
  `,
})
export class RoomsPageComponent {}
