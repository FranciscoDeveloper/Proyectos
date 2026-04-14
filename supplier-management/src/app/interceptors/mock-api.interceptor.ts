/**
 * Mock API Interceptor
 *
 * Intercepts all HTTP requests to /api/* and returns simulated backend
 * responses. Maintains in-memory state so mutations (POST/PUT/DELETE)
 * persist during the session — exactly like a real REST backend would.
 *
 * Defined endpoints
 * ─────────────────
 * Auth
 *   POST   /api/auth/login
 *
 * Entities (generic CRUD)
 *   GET    /api/entities/:entity
 *   GET    /api/entities/:entity/:id
 *   POST   /api/entities/:entity
 *   PUT    /api/entities/:entity/:id
 *   DELETE /api/entities/:entity/:id
 *   POST   /api/entities/:entity/:id/encounters
 *
 * Chat
 *   GET    /api/chat/users
 *   GET    /api/chat/messages?conversationId=:id
 *   POST   /api/chat/messages
 */

import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ENTITY_CATALOG } from '../services/schema.service';
// ── Simulated network delay (ms) ─────────────────────────────────────────────
const DELAY = 80;

// ─────────────────────────────────────────────────────────────────────────────
// In-memory entity stores  (initialised lazily from ENTITY_CATALOG seed data)
// ─────────────────────────────────────────────────────────────────────────────
const _entityStores: Record<string, Record<string, any>[]> = {};
const _entityNextId: Record<string, number> = {};

function entityStore(key: string): Record<string, any>[] {
  if (!_entityStores[key]) {
    const seed = ENTITY_CATALOG[key]?.data ?? [];
    _entityStores[key] = seed.map(r => ({ ...r }));
    _entityNextId[key] = _entityStores[key].reduce(
      (max, r) => Math.max(max, Number(r['id'] ?? 0)), 0
    ) + 1;
  }
  return _entityStores[key];
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat store
// ─────────────────────────────────────────────────────────────────────────────
const CHAT_USERS = [
  { id: 1, name: 'Admin General',     avatar: 'AG', role: 'admin',   online: true,  color: '#6366f1' },
  { id: 2, name: 'Jefe de Compras',   avatar: 'JC', role: 'manager', online: true,  color: '#10b981' },
  { id: 3, name: 'Dra. Morales',      avatar: 'DM', role: 'manager', online: true,  color: '#ef4444' },
  { id: 4, name: 'Auditor',           avatar: 'AU', role: 'viewer',  online: false, color: '#f59e0b' },
  { id: 5, name: 'Ps. Carolina Vega', avatar: 'CV', role: 'manager', online: true,  color: '#8b5cf6' },
  { id: 6, name: 'Dr. Ramírez',       avatar: 'DR', role: 'manager', online: true,  color: '#14b8a6' },
];

const d = (m: number) => new Date(Date.now() - m * 60_000);
let _chatMessages = [
  { id: 1,  conversationId: 'ch-general',  senderId: 1, senderName: 'Admin General',     senderAvatar: 'AG', content: '¡Bienvenidos al sistema! Este es el canal general del equipo.',                          timestamp: d(120) },
  { id: 2,  conversationId: 'ch-general',  senderId: 3, senderName: 'Dra. Morales',      senderAvatar: 'DM', content: 'Gracias. Recuerden actualizar las fichas clínicas pendientes.',                         timestamp: d(110) },
  { id: 3,  conversationId: 'ch-general',  senderId: 5, senderName: 'Ps. Carolina Vega', senderAvatar: 'CV', content: 'Entendido. También aviso que el lunes hay capacitación sobre el nuevo módulo.',          timestamp: d(105) },
  { id: 4,  conversationId: 'ch-general',  senderId: 6, senderName: 'Dr. Ramírez',       senderAvatar: 'DR', content: '¿A qué hora es la capacitación?',                                                        timestamp: d(100) },
  { id: 5,  conversationId: 'ch-general',  senderId: 1, senderName: 'Admin General',     senderAvatar: 'AG', content: 'Será a las 9:00 AM en sala de reuniones 2.',                                            timestamp: d(95)  },
  { id: 6,  conversationId: 'ch-general',  senderId: 2, senderName: 'Jefe de Compras',   senderAvatar: 'JC', content: 'Confirmado, estaremos presentes del área de compras.',                                   timestamp: d(90)  },
  { id: 7,  conversationId: 'ch-anuncios', senderId: 1, senderName: 'Admin General',     senderAvatar: 'AG', content: '📌 Sistema actualizado. Nuevas funciones: módulo de odontología y psicología.',         timestamp: d(60)  },
  { id: 8,  conversationId: 'ch-anuncios', senderId: 1, senderName: 'Admin General',     senderAvatar: 'AG', content: '📌 Recordatorio: las contraseñas se deben cambiar cada 90 días.',                       timestamp: d(30)  },
  { id: 9,  conversationId: 'ch-clinica',  senderId: 3, senderName: 'Dra. Morales',      senderAvatar: 'DM', content: 'Revisé las fichas pendientes. Hay 3 pacientes con controles vencidos.',                 timestamp: d(50)  },
  { id: 10, conversationId: 'ch-clinica',  senderId: 5, senderName: 'Ps. Carolina Vega', senderAvatar: 'CV', content: 'En mi agenda tengo a Valentina Rojas para esta semana. La evaluación va bien.',         timestamp: d(45)  },
  { id: 11, conversationId: 'ch-clinica',  senderId: 6, senderName: 'Dr. Ramírez',       senderAvatar: 'DR', content: 'Andrea Muñoz tiene su ortodoncia progresando muy bien. Estimamos alta en 6 meses.',     timestamp: d(40)  },
  { id: 12, conversationId: 'ch-clinica',  senderId: 3, senderName: 'Dra. Morales',      senderAvatar: 'DM', content: 'Excelente. Coordinemos una reunión clínica el próximo viernes.',                        timestamp: d(35)  },
  { id: 13, conversationId: 'dm-1-3',      senderId: 1, senderName: 'Admin General',     senderAvatar: 'AG', content: 'Hola Dra., ¿ya tiene acceso al nuevo módulo de fichas clínicas?',                      timestamp: d(80)  },
  { id: 14, conversationId: 'dm-1-3',      senderId: 3, senderName: 'Dra. Morales',      senderAvatar: 'DM', content: 'Sí, perfecto. Muy intuitivo. Gracias por el trabajo del equipo.',                       timestamp: d(75)  },
  { id: 15, conversationId: 'dm-1-2',      senderId: 2, senderName: 'Jefe de Compras',   senderAvatar: 'JC', content: 'Necesito acceso al reporte de proveedores del Q1. ¿Puedes generarlo?',                  timestamp: d(20)  },
  { id: 16, conversationId: 'dm-1-2',      senderId: 1, senderName: 'Admin General',     senderAvatar: 'AG', content: 'Claro, te lo envío esta tarde.',                                                         timestamp: d(15)  },
];
let _chatNextId = _chatMessages.length + 1;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build an OK response
// ─────────────────────────────────────────────────────────────────────────────
function ok<T>(body: T) {
  return of(new HttpResponse<T>({ status: 200, body })).pipe(delay(DELAY));
}

function err(status: number, message: string) {
  return throwError(() =>
    new HttpErrorResponse({ status, error: { message } })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The interceptor function
// ─────────────────────────────────────────────────────────────────────────────
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const { method, url } = req;

  // Only intercept /api/* paths
  if (!url.startsWith('/api/')) return next(req);

  // ── Entity CRUD ───────────────────────────────────────────────────────────
  const entityListMatch   = url.match(/^\/api\/entities\/([^/]+)$/);
  const entityItemMatch   = url.match(/^\/api\/entities\/([^/]+)\/(\d+)$/);
  const entityEncMatch    = url.match(/^\/api\/entities\/([^/]+)\/(\d+)\/encounters$/);

  // POST /api/entities/:entity/:id/encounters
  if (method === 'POST' && entityEncMatch) {
    const [, entity, idStr] = entityEncMatch;
    const id = Number(idStr);
    const encounter = req.body as Record<string, any>;
    const store = entityStore(entity);
    const idx = store.findIndex(r => r['id'] === id);
    if (idx < 0) return err(404, `Registro ${id} no encontrado`);
    const existing = Array.isArray(store[idx]['encounters']) ? store[idx]['encounters'] : [];
    store[idx] = {
      ...store[idx],
      encounters: [encounter, ...existing],
      lastVisit: encounter['encounterDate'] ?? new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString()
    };
    return ok(store[idx]);
  }

  // GET /api/entities/:entity
  if (method === 'GET' && entityListMatch) {
    const [, entity] = entityListMatch;
    return ok([...entityStore(entity)]);
  }

  // GET /api/entities/:entity/:id
  if (method === 'GET' && entityItemMatch) {
    const [, entity, idStr] = entityItemMatch;
    const id   = Number(idStr);
    const item = entityStore(entity).find(r => r['id'] === id);
    if (!item) return err(404, `Registro ${id} no encontrado`);
    return ok({ ...item });
  }

  // POST /api/entities/:entity
  if (method === 'POST' && entityListMatch) {
    const [, entity] = entityListMatch;
    const data = req.body as Record<string, any>;
    const id = _entityNextId[entity] ?? (entityStore(entity), _entityNextId[entity]);
    _entityNextId[entity] = id + 1;
    const item = { ...data, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    entityStore(entity).push(item);
    return ok(item);
  }

  // PUT /api/entities/:entity/:id
  if (method === 'PUT' && entityItemMatch) {
    const [, entity, idStr] = entityItemMatch;
    const id = Number(idStr);
    const data = req.body as Record<string, any>;
    const store = entityStore(entity);
    const idx = store.findIndex(r => r['id'] === id);
    if (idx < 0) return err(404, `Registro ${id} no encontrado`);
    store[idx] = { ...store[idx], ...data, id, updatedAt: new Date().toISOString() };
    return ok(store[idx]);
  }

  // DELETE /api/entities/:entity/:id
  if (method === 'DELETE' && entityItemMatch) {
    const [, entity, idStr] = entityItemMatch;
    const id = Number(idStr);
    const store = entityStore(entity);
    const idx = store.findIndex(r => r['id'] === id);
    if (idx < 0) return err(404, `Registro ${id} no encontrado`);
    store.splice(idx, 1);
    return ok({ ok: true, id });
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  if (method === 'GET' && url === '/api/chat/users') {
    return ok([...CHAT_USERS]);
  }

  if (method === 'GET' && url.startsWith('/api/chat/messages')) {
    const convId = new URL(url, 'http://x').searchParams.get('conversationId') ?? '';
    const msgs = convId
      ? _chatMessages.filter(m => m.conversationId === convId)
      : _chatMessages;
    return ok([...msgs]);
  }

  if (method === 'POST' && url === '/api/chat/messages') {
    const data = req.body as { conversationId: string; senderId: number; senderName: string; senderAvatar: string; content: string };
    const msg = { ...data, id: _chatNextId++, timestamp: new Date() };
    _chatMessages.push(msg);
    return ok(msg);
  }

  // ── Unknown /api/* → 404 ─────────────────────────────────────────────────
  return err(404, `Endpoint no encontrado: ${method} ${url}`);
};
