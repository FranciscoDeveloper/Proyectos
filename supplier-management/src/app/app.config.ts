import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter, withHashLocation, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { apiInterceptor } from './interceptors/api.interceptor';
import { tokenRefreshInterceptor } from './interceptors/token-refresh.interceptor';

class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation(), withRouterConfig({ onSameUrlNavigation: 'reload' })),
    // tokenRefreshInterceptor must come first so retried requests go through apiInterceptor
    provideHttpClient(withInterceptors([tokenRefreshInterceptor, apiInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};
