import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Real API Interceptor
 *
 * Replaces the mock interceptor for production. For every relative /api/*
 * request it:
 *   1. Rewrites the URL to the real API Gateway backend.
 *   2. Attaches the JWT token from the active session as a Bearer header.
 *
 * Absolute URLs (e.g. the login call) pass through untouched.
 *
 * Backend base URL: https://cwhwahvqr0.execute-api.us-east-1.amazonaws.com
 *
 * Endpoints forwarded
 * ───────────────────
 * Auth
 *   POST   /api/auth/login                              (absolute — bypasses this interceptor)
 *
 * Entities (generic CRUD)
 *   GET    /api/entities/:entity
 *   GET    /api/entities/:entity/:id
 *   POST   /api/entities/:entity
 *   PUT    /api/entities/:entity/:id
 *   DELETE /api/entities/:entity/:id
 *   POST   /api/entities/:entity/:id/encounters
 *
 * Suppliers (typed module)
 *   GET    /api/suppliers
 *   POST   /api/suppliers
 *   PUT    /api/suppliers/:id
 *   DELETE /api/suppliers/:id
 *
 * Chat
 *   GET    /api/chat/users
 *   GET    /api/chat/messages?conversationId=:id
 *   POST   /api/chat/messages
 */

const API_BASE = 'https://cwhwahvqr0.execute-api.us-east-1.amazonaws.com';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  // Only rewrite relative /api/* paths — absolute URLs pass through as-is
  if (!req.url.startsWith('/api/')) return next(req);

  const token = inject(AuthService).token();

  const newReq = req.clone({
    url: `${API_BASE}${req.url}`,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {})
  });

  return next(newReq);
};
