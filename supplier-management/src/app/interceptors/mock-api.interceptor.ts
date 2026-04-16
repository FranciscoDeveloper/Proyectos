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

import { HttpInterceptorFn, HttpRequest, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { MOCK_USERS } from '../services/auth.service';
import { ENTITY_CATALOG } from '../services/schema.service';
import { Supplier } from '../models/supplier.model';

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
// Supplier store
// ─────────────────────────────────────────────────────────────────────────────
let _suppliers: Supplier[] | null = null;
let _supplierNextId = 9;

function supplierStore(): Supplier[] {
  if (!_suppliers) {
    _suppliers = [
      { id: 1, name: 'TechCorp Solutions',      code: 'TC-001', email: 'contact@techcorp.com',      phone: '+1 (555) 234-5678',  category: 'technology',    status: 'active',      country: 'United States', city: 'San Francisco', address: '123 Silicon Valley Blvd',      website: 'https://techcorp.com',         taxId: 'US-123456789',          contactPerson: 'Alice Johnson',  rating: 4.8, totalOrders: 245, totalSpent: 1250000, createdAt: new Date('2022-01-15'), updatedAt: new Date('2024-11-10'), tags: ['IT','cloud','enterprise'],             notes: 'Premium technology partner. Fast delivery and excellent support.' },
      { id: 2, name: 'Global Logistics Co',     code: 'GL-002', email: 'ops@globallogistics.com',    phone: '+44 20 7946 0958',   category: 'logistics',     status: 'active',      country: 'United Kingdom', city: 'London',        address: '45 Freight Lane, EC1A 1BB',   website: 'https://globallogistics.co.uk', taxId: 'GB-987654321',          contactPerson: 'James Wilson',   rating: 4.5, totalOrders: 512, totalSpent: 890000,  createdAt: new Date('2021-06-20'), updatedAt: new Date('2024-12-01'), tags: ['shipping','warehousing','international'], notes: 'Reliable logistics partner with global reach.' },
      { id: 3, name: 'PrimeMaterials SA',       code: 'PM-003', email: 'ventas@primematerials.es',   phone: '+34 91 234 5678',    category: 'raw-materials', status: 'active',      country: 'Spain',        city: 'Madrid',        address: 'Av. Industria 78, 28001',      website: undefined,                      taxId: 'ES-B12345678',          contactPerson: 'Carlos Ruiz',    rating: 4.2, totalOrders: 178, totalSpent: 650000,  createdAt: new Date('2022-03-10'), updatedAt: new Date('2024-10-15'), tags: ['metals','polymers','certified'],        notes: 'ISO 9001 certified raw materials supplier.' },
      { id: 4, name: 'FoodBev International',   code: 'FB-004', email: 'supply@foodbev.int',         phone: '+49 30 12345678',    category: 'food-beverage', status: 'pending',     country: 'Germany',      city: 'Berlin',        address: 'Industriestraße 55, 10115',    website: 'https://foodbev.int',          taxId: 'DE-234567890',          contactPerson: 'Monika Braun',   rating: 3.9, totalOrders: 45,  totalSpent: 120000,  createdAt: new Date('2024-08-01'), updatedAt: new Date('2024-12-10'), tags: ['organic','HACCP','EU-certified'],       notes: 'New supplier under evaluation. Promising initial orders.' },
      { id: 5, name: 'BuildRight Construcción', code: 'BR-005', email: 'info@buildright.mx',         phone: '+52 55 9876 5432',   category: 'construction',  status: 'inactive',    country: 'Mexico',       city: 'Mexico City',   address: 'Blvd. Insurgentes 1200, CDMX', website: undefined,                      taxId: 'MX-RFC123456',          contactPerson: 'Roberto Méndez', rating: 3.5, totalOrders: 32,  totalSpent: 430000,  createdAt: new Date('2020-11-05'), updatedAt: new Date('2024-07-20'), tags: ['construction','cement','steel'],        notes: 'Contract paused. Renegotiating terms.' },
      { id: 6, name: 'HealthPlus Supplies',     code: 'HP-006', email: 'procurement@healthplus.ca',  phone: '+1 416 555 0199',    category: 'healthcare',    status: 'active',      country: 'Canada',       city: 'Toronto',       address: '789 Medical Drive, ON M5H 2N2', website: 'https://healthplus.ca',        taxId: 'CA-BN123456789',        contactPerson: 'Sarah Mitchell', rating: 4.9, totalOrders: 390, totalSpent: 2100000, createdAt: new Date('2019-05-12'), updatedAt: new Date('2024-12-15'), tags: ['FDA-approved','medical','PPE'],         notes: 'Top-rated healthcare supplier. Critical partnership.' },
      { id: 7, name: 'ManufacturePro Asia',     code: 'MA-007', email: 'b2b@manufacturepro.cn',      phone: '+86 21 5555 8888',   category: 'manufacturing', status: 'blacklisted', country: 'China',        city: 'Shanghai',      address: '88 Factory Road, Pudong',      website: undefined,                      taxId: 'CN-91310000MA1FL1A12',  contactPerson: 'Wei Zhang',      rating: 2.1, totalOrders: 12,  totalSpent: 75000,   createdAt: new Date('2023-02-28'), updatedAt: new Date('2024-09-05'), tags: ['components','electronics'],             notes: 'BLACKLISTED: Repeated quality failures and delivery issues.' },
      { id: 8, name: 'ProServices Group',       code: 'PS-008', email: 'hello@proservices.com.au',   phone: '+61 2 9876 5432',    category: 'services',      status: 'active',      country: 'Australia',    city: 'Sydney',        address: '321 Business Park, NSW 2000',  website: 'https://proservices.com.au',   taxId: 'AU-ABN12345678',        contactPerson: 'Emma Thompson',  rating: 4.6, totalOrders: 156, totalSpent: 540000,  createdAt: new Date('2021-09-18'), updatedAt: new Date('2024-11-30'), tags: ['consulting','maintenance','SLA'],       notes: 'Excellent SLA compliance. Preferred services vendor.' },
    ];
  }
  return _suppliers;
}

// ─────────────────────────────────────────────────────────────────────────────
// Patient self-booking tokens
// Each UUID maps to a clinic/doctor configuration.
// Share /#/book/<token> with patients to let them book without logging in.
// ─────────────────────────────────────────────────────────────────────────────
interface BookingTokenConfig {
  clinicName:     string;
  doctorName:     string;
  specialty:      string;
  duration:       number;   // minutes
  entityKey:      string;   // appointments store to write into
  workDays:       number[]; // JS getDay() values: 0=Sun,1=Mon,...,5=Fri,6=Sat
  availableHours: string[]; // HH:MM slots offered each workday
}

const BOOKING_TOKENS: Record<string, BookingTokenConfig> = {
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': {
    clinicName: 'Clínica Dairi', doctorName: 'Dra. Morales',
    specialty: 'Medicina General', duration: 45, entityKey: 'appointments',
    workDays: [1, 2, 3, 4, 5],
    availableHours: ['09:00','09:45','10:30','11:15','12:00','15:00','15:45','16:30','17:15']
  },
  'b2c3d4e5-f6a7-8901-bcde-f12345678901': {
    clinicName: 'Clínica Dairi', doctorName: 'Ps. Carolina Vega',
    specialty: 'Psicología', duration: 50, entityKey: 'psych-sessions',
    workDays: [1, 2, 3, 4, 5],
    availableHours: ['10:00','11:00','12:00','15:00','16:00','17:00']
  },
  'c3d4e5f6-a7b8-9012-cdef-123456789012': {
    clinicName: 'Clínica Dairi', doctorName: 'Dr. Ramírez',
    specialty: 'Odontología', duration: 60, entityKey: 'dental-sessions',
    workDays: [1, 2, 3, 4, 5],
    availableHours: ['09:00','10:00','11:00','14:00','15:00','16:00']
  }
};

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

  // ── Supplier CRUD ─────────────────────────────────────────────────────────
  const supplierListMatch = url.match(/^\/api\/suppliers$/);
  const supplierItemMatch = url.match(/^\/api\/suppliers\/(\d+)$/);

  if (method === 'GET' && supplierListMatch) {
    return ok([...supplierStore()]);
  }

  if (method === 'POST' && supplierListMatch) {
    const data = req.body as Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>;
    const item: Supplier = { ...data, id: _supplierNextId++, createdAt: new Date(), updatedAt: new Date() };
    supplierStore().push(item);
    return ok(item);
  }

  if (method === 'PUT' && supplierItemMatch) {
    const id = Number(supplierItemMatch[1]);
    const data = req.body as Partial<Supplier>;
    const list = supplierStore();
    const idx  = list.findIndex(s => s.id === id);
    if (idx < 0) return err(404, `Proveedor ${id} no encontrado`);
    list[idx] = { ...list[idx], ...data, id, updatedAt: new Date() };
    return ok(list[idx]);
  }

  if (method === 'DELETE' && supplierItemMatch) {
    const id = Number(supplierItemMatch[1]);
    const list = supplierStore();
    const idx  = list.findIndex(s => s.id === id);
    if (idx < 0) return err(404, `Proveedor ${id} no encontrado`);
    list.splice(idx, 1);
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

  // ── Patient self-booking ─────────────────────────────────────────────────
  const bookInfoMatch  = url.match(/^\/api\/book\/([^/]+)$/);
  const bookSlotsMatch = url.match(/^\/api\/book\/([^/]+)\/slots$/);

  // GET /api/book/:token → clinic/doctor info
  if (method === 'GET' && bookInfoMatch) {
    const token = bookInfoMatch[1];
    const cfg   = BOOKING_TOKENS[token];
    if (!cfg) return err(404, 'Token de agenda inválido o expirado');
    return ok({
      clinicName: cfg.clinicName, doctorName: cfg.doctorName,
      specialty:  cfg.specialty,  duration:   cfg.duration,
      workDays:   cfg.workDays
    });
  }

  // GET /api/book/:token/slots?date=YYYY-MM-DD → available time slots
  if (method === 'GET' && bookSlotsMatch) {
    const token = bookSlotsMatch[1];
    const cfg   = BOOKING_TOKENS[token];
    if (!cfg) return err(404, 'Token de agenda inválido');
    const dateStr    = new URL(url, 'http://x').searchParams.get('date') ?? '';
    const store      = entityStore(cfg.entityKey);
    const bookedTimes = store
      .filter(r => (r['startDate'] as string)?.startsWith(dateStr))
      .map(r    => (r['startDate'] as string)?.slice(11, 16));
    const available  = cfg.availableHours.filter(h => !bookedTimes.includes(h));
    return ok(available);
  }

  // POST /api/book/:token → create appointment
  if (method === 'POST' && bookInfoMatch) {
    const token = bookInfoMatch[1];
    const cfg   = BOOKING_TOKENS[token];
    if (!cfg) return err(404, 'Token de agenda inválido');
    const data = req.body as {
      date: string; time: string;
      patientName: string; patientEmail?: string;
      patientPhone?: string; reason?: string;
    };
    const startDate = `${data.date}T${data.time}`;
    const startMs   = new Date(startDate).getTime();
    const endDate   = new Date(startMs + cfg.duration * 60_000).toISOString().slice(0, 16);
    const key       = cfg.entityKey;
    const id        = _entityNextId[key] ?? (entityStore(key), _entityNextId[key]);
    _entityNextId[key] = id + 1;
    const confirmCode = `DAI-${String(Date.now()).slice(-6)}`;
    const item = {
      id, title: data.reason || 'Consulta paciente',
      patientName: data.patientName, patientEmail: data.patientEmail ?? '',
      patientPhone: data.patientPhone ?? '',
      startDate, endDate, status: 'scheduled', room: 'Por asignar',
      notes: `Agendado por portal paciente. ${data.reason ?? ''}`.trim(),
      confirmCode,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    entityStore(key).push(item);
    return ok({
      confirmCode, doctorName: cfg.doctorName,
      clinicName: cfg.clinicName, specialty: cfg.specialty,
      date: data.date, time: data.time, patientName: data.patientName
    });
  }

  // ── Unknown /api/* → 404 ─────────────────────────────────────────────────
  return err(404, `Endpoint no encontrado: ${method} ${url}`);
};
