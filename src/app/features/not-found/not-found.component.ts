import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule }   from '@angular/material/icon';

@Component({
  selector: 'lux-not-found',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="not-found">
      <div class="code">404</div>
      <h1 class="title">Page not found</h1>
      <p class="body">The page you're looking for doesn't exist or has been moved.</p>
      <a mat-flat-button color="primary" routerLink="/app/dashboard">
        <mat-icon>arrow_back</mat-icon>
        Back to dashboard
      </a>
    </div>
  `,
  styles: [`
    .not-found {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      text-align: center;
      padding: 40px;
      background: var(--bg);
    }
    .code {
      font-size: 96px;
      font-weight: 800;
      line-height: 1;
      color: var(--border);
      letter-spacing: -4px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      color: var(--text);
      margin: 0;
    }
    .body {
      font-size: 14px;
      color: var(--text-muted);
      max-width: 340px;
      margin: 0 0 8px;
    }
  `],
})
export class NotFoundComponent {}
