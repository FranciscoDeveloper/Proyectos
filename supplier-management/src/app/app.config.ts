import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';

class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' })),
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};
