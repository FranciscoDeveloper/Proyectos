/**
 * Mock API Interceptor
 *
 * Only intercepts POST /api/auth/login to authenticate against the hardcoded
 * MOCK_USERS list (roles + schemas). All other /api/* requests pass through
 * to the real backend unchanged.
 */

import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { MOCK_USERS } from '../services/auth.service';

const DELAY = 80;

function ok<T>(body: T) {
  return of(new HttpResponse<T>({ status: 200, body })).pipe(delay(DELAY));
}

function err(status: number, message: string) {
  return throwError(() =>
    new HttpErrorResponse({ status, error: { message } })
  );
}

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const { method, url } = req;

  if (method === 'POST' && url === '/api/auth/login') {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    const found = MOCK_USERS.find(
      u => u.user.email.toLowerCase() === (email ?? '').toLowerCase().trim()
        && u.password === password
    );
    if (!found) return err(401, 'Credenciales inválidas. Verifique su email y contraseña.');
    return ok({
      token:   `mock.${btoa(found.user.email)}.${Date.now()}`,
      user:    found.user,
      schemas: found.schemas
    });
  }

  return next(req);
};
