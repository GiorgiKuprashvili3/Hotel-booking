import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Slim, public-facing chrome wrapping the marketing landing page and the
 * booking flow. No sidebar, no app shell — this is what a recruiter / a
 * guest would land on first.
 */
@Component({
  selector: 'lux-public-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './public-shell.component.html',
  styleUrl: './public-shell.component.scss',
})
export class PublicShellComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  goToAdmin() { this.router.navigateByUrl('/app/dashboard'); }
}
