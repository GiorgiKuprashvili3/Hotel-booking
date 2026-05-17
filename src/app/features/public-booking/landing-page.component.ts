import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { ROOM_SERVICE, PROPERTY_SERVICE } from '../../data/services/service-tokens';
import { RoomType, Property } from '../../domain';

/** The featured property — single fictional hotel that fronts the public site. */
const FEATURED_PROPERTY_ID = 'prop-1';

interface AmenityCard {
  icon: string;
  title: string;
  body: string;
}

const AMENITIES: AmenityCard[] = [
  { icon: 'restaurant',       title: 'Two restaurants',  body: 'Modern Georgian by chef Tamuna Sulava, plus a rooftop wine bar.' },
  { icon: 'spa',              title: 'Aurora Spa',       body: 'Six treatment rooms, hammam, indoor lap pool — open to guests and members.' },
  { icon: 'pool',             title: 'Rooftop pool',     body: 'Heated year-round with skyline views over Old Town and Mtatsminda.' },
  { icon: 'fitness_center',   title: '24-hour fitness',  body: 'Technogym studio with a resident trainer Monday through Saturday.' },
  { icon: 'meeting_room',     title: 'Meetings & events',body: 'Six adaptable salons, the largest hosting 180 for a seated dinner.' },
  { icon: 'concierge',        title: 'Concierge',        body: 'Private guides, sommelier-led wine country trips, last-minute reservations.' },
];

const GALLERY = [
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80',
  'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80',
  'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=80',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80',
];

/**
 * Curated photo per room-type code. Falls back to a generic suite shot if a code
 * isn't in the map. We deliberately don't trust seed `photoUrl` — the seed file
 * has some broken placeholder URLs we want to override on the public surface.
 */
const ROOM_IMAGES: Record<string, string> = {
  STD:  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=80',
  DLX:  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&q=80',
  STE:  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80',
  EXC:  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200&q=80',
  PRES: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80',
};
const ROOM_FALLBACK = 'https://images.unsplash.com/photo-1590490359683-658d3d23f972?w=1200&q=80';

@Component({
  selector: 'lux-landing-page',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatIconModule, MatButtonModule, SkeletonComponent,
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent {
  private router    = inject(Router);
  private roomSvc   = inject(ROOM_SERVICE);
  private propSvc   = inject(PROPERTY_SERVICE);

  amenities = AMENITIES;
  gallery   = GALLERY;

  property    = signal<Property | undefined>(undefined);
  roomTypes   = signal<RoomType[]>([]);
  loading     = signal(true);
  error       = signal(false);

  /* Hero search inputs */
  todayIso = new Date().toISOString().slice(0, 10);
  checkIn  = this.todayIso;
  checkOut = this.tomorrow(this.todayIso);
  guests   = 2;

  minCheckoutIso = computed(() => this.tomorrow(this.checkIn));

  /* Lightbox */
  lightboxIndex = signal<number | null>(null);

  constructor() {
    this.propSvc.getById(FEATURED_PROPERTY_ID).subscribe(p => this.property.set(p));
    this.loadRoomTypes();

    // Keep checkout >= checkIn + 1 day if user shifts checkIn forward
    effect(() => {
      const min = this.minCheckoutIso();
      if (this.checkOut < min) this.checkOut = min;
    });
  }

  loadRoomTypes(): void {
    this.loading.set(true);
    this.error.set(false);
    this.roomSvc.listTypes(FEATURED_PROPERTY_ID).subscribe({
      next: types => {
        this.roomTypes.set(types);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  imageFor(rt: RoomType): string {
    return ROOM_IMAGES[rt.code] ?? rt.photoUrl ?? ROOM_FALLBACK;
  }

  searchAvailability(): void {
    this.router.navigate(['/book/reserve'], {
      queryParams: {
        checkIn:  this.checkIn,
        checkOut: this.checkOut,
        guests:   this.guests,
      },
    });
  }

  /* ── Lightbox controls ─────────────────────────────────── */
  openLightbox(i: number)  { this.lightboxIndex.set(i); }
  closeLightbox()          { this.lightboxIndex.set(null); }
  nextPhoto() {
    const i = this.lightboxIndex();
    if (i === null) return;
    this.lightboxIndex.set((i + 1) % this.gallery.length);
  }
  prevPhoto() {
    const i = this.lightboxIndex();
    if (i === null) return;
    this.lightboxIndex.set((i - 1 + this.gallery.length) % this.gallery.length);
  }

  private tomorrow(iso: string): string {
    const d = new Date(iso);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
}