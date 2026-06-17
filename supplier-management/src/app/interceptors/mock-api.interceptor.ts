/**
 * Mock API Interceptor — currently a no-op pass-through.
 * This interceptor is not registered in app.config.ts and has no effect at runtime.
 */
import { HttpInterceptorFn } from '@angular/common/http';

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => next(req);
