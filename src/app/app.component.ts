import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHostComponent } from './shared/components/toast-host.component';

@Component({
  selector: 'lux-root',
  standalone: true,
  imports: [RouterOutlet, ToastHostComponent],
  template: `
    <router-outlet></router-outlet>
    <lux-toast-host />
  `,
})
export class AppComponent {}
