// Handles /api/entities/{entity}[/{id}] and /api/suppliers[/{id}] routes.
// Applies authorization, resolves professional scope, and dispatches to crudService.

import { getLogger }             from '../lib/logger.mjs';
import { response }              from '../lib/response.mjs';
import { authorizeRequest }      from '../lib/auth.mjs';
import { ensureLookupTables }    from '../lib/db.mjs';
import { ENTITY_CONFIG, KEY_ALIASES } from '../config/entities.mjs';
import * as crudService          from '../services/crudService.mjs';
import * as profScopeService     from '../services/profScopeService.mjs';
import { sendPresupuestoEmail }  from '../services/emailService.mjs';

/**
 * Dispatch /api/entities/* and /api/suppliers/* routes.
 * Returns null when the path does not match.
 *
 * @param {string}              rawPath      Normalized request path.
 * @param {string}              method       HTTP method.
 * @param {object}              event        Lambda event.
 * @param {object}              tokenPayload Verified JWT payload.
 * @param {import('pg').PoolClient} client   Active DB client.
 */
export async function handleEntities(rawPath, method, event, tokenPayload, client) {
  const log = getLogger();

  const entitiesMatch  = rawPath.match(/\/api\/entities\/([^/]+)(?:\/([^/]+))?/);
  const suppliersMatch = rawPath.match(/\/api\/suppliers(?:\/([^/]+))?/);

  let entityKey, id;
  if (entitiesMatch) {
    entityKey = entitiesMatch[1];
    id        = entitiesMatch[2] ?? null;
  } else if (suppliersMatch) {
    entityKey = 'suppliers';
    id        = suppliersMatch[1] ?? null;
  } else {
    return null;
  }

  const resolvedKey = KEY_ALIASES[entityKey] ?? entityKey;
  const config      = ENTITY_CONFIG[resolvedKey];
  log.info('Path parsed', { entityKey, resolvedKey, id });

  if (!config) {
    log.warn('Unknown entity key', { entityKey, available: Object.keys(ENTITY_CONFIG) });
    return response(404, { message: `Entidad '${entityKey}' no existe` });
  }

  // Bootstrap lookup tables on first request
  await ensureLookupTables(client);

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body = null;
  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      log.info('Body parsed', { fields: Object.keys(body) });
    } catch (err) {
      log.error('Body parse failed', { error: err.message });
      return response(400, { message: 'Body inválido: se esperaba JSON' });
    }
  }

  // ── Authorization ───────────────────────────────────────────────────────────
  // skipAuth entities (previsiones, medicos) are shared lookups readable by any authenticated user.
  if (!config.skipAuth) {
    const reverseAlias = Object.entries(KEY_ALIASES).find(([, v]) => v === resolvedKey)?.[0] ?? null;
    const aliasKey     = entityKey !== resolvedKey ? entityKey : reverseAlias;
    const authz        = await authorizeRequest(client, tokenPayload.sub, tokenPayload.role, resolvedKey, method, aliasKey);
    if (!authz.allowed) return response(authz.status, { message: authz.message });
  }

  // ── Special action: POST /api/entities/presupuestos/{id}/send ───────────────
  if (resolvedKey === 'presupuestos' && rawPath.endsWith('/send') && method === 'POST') {
    return await sendPresupuestoEmail(client, config, id, body);
  }

  // ── Special action: POST /api/entities/{clinicalKey}/{id}/encounters ─────────
  if (rawPath.endsWith('/encounters') && method === 'POST' && id) {
    return await crudService.appendEncounter(client, config, id, body);
  }

  // ── Resolve professional scope ──────────────────────────────────────────────
  const profScope = await profScopeService.resolveProfScope(client, tokenPayload.sub);

  // ── CRUD dispatch ───────────────────────────────────────────────────────────
  if (method === 'GET'    && !id) return await crudService.listEntities(client, config, entityKey, profScope);
  if (method === 'GET'    &&  id) return await crudService.getEntity(client, config, id, entityKey, profScope);
  if (method === 'POST'   && !id) return await crudService.createEntity(client, config, body, entityKey, profScope);
  if (method === 'PUT'    &&  id) return await crudService.updateEntity(client, config, id, body, entityKey, profScope);
  if (method === 'DELETE' &&  id) return await crudService.deleteEntity(client, config, id, entityKey, profScope);

  log.warn('Method not allowed', { method });
  return response(405, { message: 'Método no permitido' });
}
