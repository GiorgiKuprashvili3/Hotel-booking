import { Component, Inject, Injectable, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  icon?: string;
}

@Component({
  selector: 'lux-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm">
      <div class="confirm-icon" [class.danger]="data.variant === 'danger'">
        <mat-icon>{{ data.icon ?? (data.variant === 'danger' ? 'warning' : 'help_outline') }}</mat-icon>
      </div>
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>{{ data.message }}</mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button [mat-dialog-close]="false">{{ data.cancelLabel ?? 'Cancel' }}</button>
        <button mat-flat-button
                [color]="data.variant === 'danger' ? 'warn' : 'primary'"
                [mat-dialog-close]="true">
          {{ data.confirmLabel ?? 'Confirm' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm { text-align: center; padding: var(--space-4) var(--space-2) 0; }
    .confirm-icon {
      width: 56px; height: 56px; margin: 0 auto var(--space-3);
      border-radius: 50%; background: var(--info-bg); color: var(--info);
      display: flex; align-items: center; justify-content: center;
    }
    .confirm-icon mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .confirm-icon.danger { background: var(--danger-bg); color: var(--danger); }
    h2 { margin: 0 0 var(--space-2) !important; font-family: var(--font-display); }
    mat-dialog-content { color: var(--text-muted); text-align: center; min-width: 320px; }
    mat-dialog-actions { padding: var(--space-3) 0 0 !important; }
  `],
})
export class ConfirmDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: ConfirmOptions) {}
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private dialog = inject(MatDialog);

  async confirm(opts: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, { data: opts, width: '440px' });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
