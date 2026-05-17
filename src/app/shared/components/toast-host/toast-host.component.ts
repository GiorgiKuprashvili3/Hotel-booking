import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../../core/ui/toast.service';

@Component({
  selector: 'lux-toast-host',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './toast-host.component.html',
  styleUrl:    './toast-host.component.scss',
})
export class ToastHostComponent {
  svc = inject(ToastService);

  iconFor(tone: string): string {
    switch (tone) {
      case 'success': return 'check_circle';
      case 'warning': return 'warning';
      case 'danger':  return 'error';
      default:        return 'info';
    }
  }
}
