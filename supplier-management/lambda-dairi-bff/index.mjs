// Dairi BFF — entry point.
// Thin router: parses the request, verifies JWT, dispatches to domain handlers.
// All business logic lives in handlers/ and services/.

import { getLogger, setTraceId }    from './lib/logger.mjs';
import { response }                  from './lib/response.mjs';
import { verifyToken }               from './lib/auth.mjs';
import { pool }                      from './lib/db.mjs';

import { handleBookingProxy }        from './handlers/bookingProxyHandler.mjs';
import { handleChat }                from './handlers/chatHandler.mjs';
import { handleDocuments }           from './handlers/documentsHandler.mjs';
import { handleClinicalSummary }     from './handlers/clinicalHandler.mjs';
import { handleUserConfig }          from './handlers/userConfigHandler.mjs';
import { handleAdmin }               from './handlers/adminHandler.mjs';
import { handleEntities }            from './handlers/entitiesHandler.mjs';

// Cold-start log so we know what environment is configured.
const bootLog = getLogger();
bootLog.info('Lambda cold start — initialising DB pool', {
  DB_HOST:    process.env.DB_HOST     || '(not set)',
  DB_PORT:    process.env.DB_PORT     || '5432 (default)',
  DB_NAME:    process.env.DB_NAME     || '(not set)',
  DB_USER:    process.env.DB_USER     || '(not set)',
  DB_PASSWORD: process.env.DB_PASSWORD ? '***set***' : '(not set)',
  JWT_SECRET:  process.env.JWT_SECRET  ? '***set***' : '(using default — insecure!)',
});

if (!process.env.JWT_SECRET) {
  bootLog.error('JWT_SECRET env var is not set — refusing to start');
  process.exit(1);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event, context) => {
  setTraceId(context?.awsRequestId || `local-${Date.now()}`);
  const log = getLogger();

  const method = event.requestContext?.http?.method || event.httpMethod || 'UNKNOWN';
  const rawPath = event.rawPath || event.path || '';

  log.info('Request received', {
    method,
    path:       rawPath,
    sourceIp:   event.requestContext?.http?.sourceIp || event.requestContext?.identity?.sourceIp || 'unknown',
    userAgent:  event.requestContext?.http?.userAgent || 'unknown',
    hasBody:    !!event.body,
    bodyLength: event.body?.length ?? 0
  });

  // ── CORS preflight ────────────────────────────────────────────────────────
  if (method === 'OPTIONS') {
    log.info('CORS preflight — returning 204');
    return response(204, null);
  }

  // ── Public: booking proxy (no JWT required) ───────────────────────────────
  const bookResult = await handleBookingProxy(event);
  if (bookResult) return bookResult;

  // ── JWT verification ──────────────────────────────────────────────────────
  let tokenPayload;
  try {
    tokenPayload = verifyToken(event);
  } catch (err) {
    return response(401, { message: err.message });
  }

  // ── Routes that use DynamoDB only (no DB client needed) ───────────────────
  const chatResult = await handleChat(rawPath, method, event, tokenPayload);
  if (chatResult) return chatResult;

  // ── Documents (S3 only, no DB client needed) ──────────────────────────────
  const docsResult = await handleDocuments(rawPath, method);
  if (docsResult) return docsResult;

  // ── Routes that need a DB client ──────────────────────────────────────────
  let client;
  try {
    log.info('Acquiring DB connection');
    client = await pool.connect();
    log.info('DB connection acquired');

    // GET /api/chat/users — needs DB but no entity auth
    if (rawPath === '/api/chat/users' && method === 'GET') {
      const COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#06b6d4'];
      const { rows } = await client.query(
        `SELECT id, name, email, role FROM app_user WHERE email_verified = true ORDER BY id`
      );
      return response(200, rows.map(r => ({
        id:     r.id,
        name:   r.name || r.email.split('@')[0],
        avatar: (r.name || r.email).charAt(0).toUpperCase(),
        role:   r.role || 'user',
        online: false,
        color:  COLORS[r.id % COLORS.length]
      })));
    }

    // PATCH /api/user/config
    const cfgResult = await handleUserConfig(rawPath, method, event, tokenPayload.sub, client);
    if (cfgResult) return cfgResult;

    // GET /api/clinical-summary/{id}
    const clinResult = await handleClinicalSummary(rawPath, method, client);
    if (clinResult) return clinResult;

    // /api/admin/*
    const adminResult = await handleAdmin(rawPath, method, event, tokenPayload, client);
    if (adminResult) return adminResult;

    // /api/entities/* and /api/suppliers/*
    const entityResult = await handleEntities(rawPath, method, event, tokenPayload, client);
    if (entityResult) return entityResult;

    log.warn('Path did not match any handler', { rawPath });
    return response(404, { message: 'Ruta no encontrada' });

  } catch (error) {
    log.error('Unhandled error', { message: error.message, code: error.code, stack: error.stack, rawPath, method });
    return response(500, { message: 'Error interno del servidor', error: error.message });
  } finally {
    if (client) {
      client.release();
      log.info('DB connection released');
    }
  }
};
