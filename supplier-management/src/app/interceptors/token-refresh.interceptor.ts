import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const tokenRefreshInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const auth = inject(AuthService);

  // Skip auth endpoints to avoid infinite loops
  if (req.url.includes('/api/auth/')) {
    return next(req);
  }

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        return auth.refreshAccessToken().pipe(
          switchMap(() => {
            // Retry with the new token that handleAuthResponse already stored
            const token = auth.token();
            const retried = token
              ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
              : req;
            return next(retried);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
