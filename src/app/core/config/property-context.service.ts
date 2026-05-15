import { Injectable, computed, inject, signal } from '@angular/core';
import { PROPERTY_SERVICE } from '../../data/services/service-tokens';
import { Property } from '../../domain';

const KEY = 'luxstay.activeProperty';

@Injectable({ providedIn: 'root' })
export class PropertyContextService {
  private svc = inject(PROPERTY_SERVICE);

  private _properties = signal<Property[]>([]);
  private _activeId   = signal<string | null>(localStorage.getItem(KEY));

  readonly properties = this._properties.asReadonly();
  readonly activeId   = this._activeId.asReadonly();
  readonly active     = computed(() =>
    this._properties().find(p => p.id === this._activeId()) ?? null);

  load(): void {
    this.svc.list().subscribe(list => {
      this._properties.set(list);
      if (!this._activeId() && list.length) this.setActive(list[0].id);
    });
  }

  setActive(id: string): void {
    this._activeId.set(id);
    localStorage.setItem(KEY, id);
  }
}
