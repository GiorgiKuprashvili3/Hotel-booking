import { Injectable, signal } from '@angular/core';

const KEY = 'luxstay.theme';
export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _theme = signal<Theme>(this.load());
  readonly theme = this._theme.asReadonly();

  constructor() {
    this.apply(this._theme());
  }

  toggle(): void {
    this.set(this._theme() === 'light' ? 'dark' : 'light');
  }

  set(theme: Theme): void {
    this._theme.set(theme);
    this.apply(theme);
    localStorage.setItem(KEY, theme);
  }

  private apply(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private load(): Theme {
    const stored = localStorage.getItem(KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
