import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { APP_ROUTES } from './app.routes';
import { MOCK_DATA_PROVIDERS } from './data/mock/mock-data.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      APP_ROUTES,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()),

    /* Mock data layer — replace with HTTP_DATA_PROVIDERS later when NestJS is ready. */
    ...MOCK_DATA_PROVIDERS,
  ],
};
