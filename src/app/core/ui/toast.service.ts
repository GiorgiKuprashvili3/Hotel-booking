import { Injectable, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
  /** Auto-dismiss ms; 0 = sticky. Default 4000. */
  duration?: number;
  /** Optional action to render — clicking dismisses the toast. */
  action?: { label: string; handler: () => void };
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(toast: Omit<Toast, 'id'>): number {
    const id = this.nextId++;
    const t: Toast = { duration: 4000, ...toast, id };
    this.toasts.update(list => [...list, t]);
    if ((t.duration ?? 0) > 0) {
      setTimeout(() => this.dismiss(id), t.duration);
    }
    return id;
  }

  info(title: string, message?: string)    { return this.show({ tone: 'info',    title, message }); }
  success(title: string, message?: string) { return this.show({ tone: 'success', title, message }); }
  warning(title: string, message?: string) { return this.show({ tone: 'warning', title, message }); }
  error(title: string, message?: string)   { return this.show({ tone: 'danger',  title, message, duration: 6000 }); }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
