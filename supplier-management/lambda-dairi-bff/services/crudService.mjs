// Generic CRUD and clinical-encounter operations for entities exposed
// through /api/entities/{entity}.
//
// Each entity is driven by an ENTITY_CONFIG descriptor (`config`) that declares
// its table, column mappers (toDb/fromDb), optional JOIN select, primary key,
// ordering and per-professional filter. This service applies that descriptor
// uniformly across list/read/create/update/delete plus the append-encounter
// action used by clinical records.
//
// Per-professional data isolation is enforced through profScope and the
// buildProfWhere helper from profScopeService.
//
// AWS Lambda (Node.js 20, ES modules).

import { getLogger } from '../lib/logger.mjs';
import { response } from '../lib/response.mjs';
import * as profScopeService from './profScopeService.mjs';

/**
 * List every row of an entity, applying per-professional filtering when the
 * entity is scoped and a professional scope is present.
 *
 * @param {import('pg').PoolClient} client Active DB client.
 * @param {object} config                  Entity descriptor.
 * @param {string} entityKey               Requested entity key (for logging).
 * @param {object|null} profScope          Resolved professional scope, or null.
 * @returns {Promise<object>} HTTP response with the mapped rows.
 */
export async function listEntities(client, config, entityKey, profScope) {
  const log = getLogger();
  log.info('listEntities — querying', { table: config.table, hasJoin: !!config.joinSelect });

  const orderBy = config.orderBy ?? (config.joinSelect ? 'c.created_at DESC' : 'id DESC');

  let result;
  if (config.joinSelect) {
    const { clause, params } = profScopeService.buildProfWhere(config, profScope);
    result = await client.query(`${config.joinSelect}${clause} ORDER BY ${orderBy}`, params);
  } else {
    result = await client.query(`SELECT * FROM ${config.table} ORDER BY ${orderBy}`);
  }

  log.info('listEntities — done', { table: config.table, rowCount: result.rowCount });
  return response(200, result.rows.map(config.fromDb));
}

/**
 * Fetch a single entity row by id, enforcing per-professional filtering for
 * scoped entities.
 *
 * @param {import('pg').PoolClient} client Active DB client.
 * @param {object} config                  Entity descriptor.
 * @param {number|string} id               Primary key value.
 * @param {string} entityKey               Requested entity key (for logging).
 * @param {object|null} profScope          Resolved professional scope, or null.
 * @returns {Promise<object>} HTTP response with the mapped row or 404.
 */
export async function getEntity(client, config, id, entityKey, profScope) {
  const log = getLogger();
  log.info('getEntity — querying', { table: config.table, id, hasJoin: !!config.joinSelect });

  const pkCol = config.pkCol ?? 'id';

  let result;
  if (config.joinSelect) {
    const { clause, params } = profScopeService.buildProfWhere(config, profScope, 1);
    const andOrWhere = clause ? clause.replace(' WHERE ', ' AND ') : '';
    result = await client.query(
      `${config.joinSelect} WHERE c.${pkCol} = $1${andOrWhere} LIMIT 1`,
      [id, ...params]
    );
  } else {
    result = await client.query(`SELECT * FROM ${config.table} WHERE ${pkCol} = $1 LIMIT 1`, [id]);
  }

  if (result.rowCount === 0) {
    log.warn('getEntity — not found', { table: config.table, id });
    return response(404, { message: 'Registro no encontrado' });
  }

  log.info('getEntity — found', { table: config.table, id });
  return response(200, config.fromDb(result.rows[0]));
}

/**
 * Insert a new entity row. The creating professional's identity is auto-stamped
 * onto scoped entities so records are always linked to their owner. When the
 * entity uses a JOIN select, the created row is re-fetched with the join so the
 * response carries related demographics.
 *
 * @param {import('pg').PoolClient} client Active DB client.
 * @param {object} config                  Entity descriptor.
 * @param {object} body                    Incoming record payload.
 * @param {string} entityKey               Requested entity key (for logging).
 * @param {object|null} profScope          Resolved professional scope, or null.
 * @returns {Promise<object>} HTTP response with the created row or a 400.
 */
export async function createEntity(client, config, body, entityKey, profScope) {
  const log = getLogger();

  if (!body || typeof body !== 'object') {
    log.warn('createEntity — missing body', { entityKey });
    return response(400, { message: 'Body requerido para crear un registro' });
  }

  const cols = config.toDb(body);

  // Let the entity override/generate columns server-side (e.g. a globally-unique
  // sequential number) — always runs with full table visibility, ignoring profFilter,
  // since values like `numero` must be unique across every professional.
  if (config.beforeInsert) {
    await config.beforeInsert(client, cols);
  }

  // Auto-stamp professional identity so records are always linked to the creator
  if (profScope && config.profFilter) {
    const f = config.profFilter;
    if (f.idCol && profScope.professionalId != null) {
      const col = f.idCol.replace(/^\w+\./, '');     // strip alias 'c.' → 'professional_id'
      if (!(col in cols)) cols[col] = profScope.professionalId;
    } else if (f.nameCol && profScope.professionalName) {
      const col = f.nameCol.replace(/^\w+\./, '');   // strip alias 'c.' → 'doctor'
      if (!(col in cols)) cols[col] = profScope.professionalName;
    }
  }

  const keys = Object.keys(cols);
  if (keys.length === 0) {
    log.warn('createEntity — no valid fields', { entityKey, receivedKeys: Object.keys(body) });
    return response(400, { message: 'Ningún campo válido proporcionado' });
  }

  const colNames  = keys.join(', ');
  const colParams = keys.map((_, i) => `$${i + 1}`).join(', ');
  const values    = keys.map(k => cols[k]);

  log.info('createEntity — inserting', { table: config.table, columns: keys });
  const result = await client.query(
    `INSERT INTO ${config.table} (${colNames}) VALUES (${colParams}) RETURNING *`,
    values
  );
  log.info('createEntity — success', { table: config.table, newId: result.rows[0]?.id });

  // Re-fetch with JOIN so patient demographics are included in the response
  if (config.joinSelect && result.rows[0]?.id) {
    const pkCol = config.pkCol ?? 'id';
    const full  = await client.query(`${config.joinSelect} WHERE c.${pkCol} = $1 LIMIT 1`, [result.rows[0].id]);
    if (full.rowCount > 0) return response(201, config.fromDb(full.rows[0]));
  }
  return response(201, config.fromDb(result.rows[0]));
}

/**
 * Update an entity row by id. Scoped entities additionally require the row to
 * belong to the authenticated professional. When the entity uses a JOIN select,
 * the updated row is re-fetched with the join so demographics are preserved.
 *
 * @param {import('pg').PoolClient} client Active DB client.
 * @param {object} config                  Entity descriptor.
 * @param {number|string} id               Primary key value.
 * @param {object} body                    Fields to update.
 * @param {string} entityKey               Requested entity key (for logging).
 * @param {object|null} profScope          Resolved professional scope, or null.
 * @returns {Promise<object>} HTTP response with the updated row or a 400/404.
 */
export async function updateEntity(client, config, id, body, entityKey, profScope) {
  const log = getLogger();

  if (!body || typeof body !== 'object') {
    log.warn('updateEntity — missing body', { entityKey, id });
    return response(400, { message: 'Body requerido para actualizar' });
  }

  const cols = config.toDb(body);
  const keys = Object.keys(cols);
  if (keys.length === 0) {
    log.warn('updateEntity — no valid fields', { entityKey, id, receivedKeys: Object.keys(body) });
    return response(400, { message: 'Ningún campo válido proporcionado' });
  }

  const pkCol      = config.pkCol ?? 'id';
  const tsClause   = config.noTimestamp ? '' : ', updated_at = NOW()';
  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');

  // Build ownership check for professionals
  let ownerClause = '';
  let ownerParams = [];
  if (profScope && config.profFilter) {
    const f = config.profFilter;
    if (f.idCol && profScope.professionalId != null) {
      const col = f.idCol.replace(/^\w+\./, '');
      ownerParams.push(profScope.professionalId);
      ownerClause = ` AND ${col} = $${keys.length + 1 + ownerParams.length}`;
    } else if (f.nameCol && profScope.professionalName) {
      const col = f.nameCol.replace(/^\w+\./, '');
      ownerParams.push(profScope.professionalName);
      ownerClause = ` AND ${col} = $${keys.length + 1 + ownerParams.length}`;
    }
  }
  const values = [...keys.map(k => cols[k]), id, ...ownerParams];

  log.info('updateEntity — updating', { table: config.table, id, columns: keys });
  const result = await client.query(
    `UPDATE ${config.table}
     SET ${setClauses}${tsClause}
     WHERE ${pkCol} = $${keys.length + 1}${ownerClause}
     RETURNING *`,
    values
  );

  if (result.rowCount === 0) {
    log.warn('updateEntity — not found', { table: config.table, id });
    return response(404, { message: 'Registro no encontrado' });
  }
  log.info('updateEntity — success', { table: config.table, id });

  // Re-fetch with JOIN so patient demographics are not lost in the response
  if (config.joinSelect) {
    const full = await client.query(`${config.joinSelect} WHERE c.${pkCol} = $1 LIMIT 1`, [id]);
    if (full.rowCount > 0) return response(200, config.fromDb(full.rows[0]));
  }
  return response(200, config.fromDb(result.rows[0]));
}

/**
 * Delete an entity row by id. Scoped entities additionally require the row to
 * belong to the authenticated professional.
 *
 * @param {import('pg').PoolClient} client Active DB client.
 * @param {object} config                  Entity descriptor.
 * @param {number|string} id               Primary key value.
 * @param {string} entityKey               Requested entity key (for logging).
 * @param {object|null} profScope          Resolved professional scope, or null.
 * @returns {Promise<object>} HTTP response confirming deletion or a 404.
 */
export async function deleteEntity(client, config, id, entityKey, profScope) {
  const log = getLogger();
  log.info('deleteEntity — deleting', { table: config.table, id });

  const pkCol = config.pkCol ?? 'id';

  // Build ownership check for professionals
  let ownerClause = '';
  let ownerParams = [];
  if (profScope && config.profFilter) {
    const f = config.profFilter;
    if (f.idCol && profScope.professionalId != null) {
      const col = f.idCol.replace(/^\w+\./, '');
      ownerParams.push(profScope.professionalId);
      ownerClause = ` AND ${col} = $2`;
    } else if (f.nameCol && profScope.professionalName) {
      const col = f.nameCol.replace(/^\w+\./, '');
      ownerParams.push(profScope.professionalName);
      ownerClause = ` AND ${col} = $2`;
    }
  }

  const result = await client.query(
    `DELETE FROM ${config.table} WHERE ${pkCol} = $1${ownerClause} RETURNING ${pkCol}`,
    [id, ...ownerParams]
  );
  if (result.rowCount === 0) {
    log.warn('deleteEntity — not found', { table: config.table, id });
    return response(404, { message: 'Registro no encontrado' });
  }
  log.info('deleteEntity — success', { table: config.table, id });
  return response(200, { message: 'Registro eliminado', id });
}

/**
 * Append a clinical encounter to a record's `encounters` array and mirror the
 * relevant flat clinical columns (soap_*, vitals, diagnosis) from the encounter
 * payload. The newest encounter is prepended and `last_visit`/`updated_at` are
 * refreshed. When the entity uses a JOIN select, the row is re-fetched with the
 * join so demographics are included in the response.
 *
 * @param {import('pg').PoolClient} client Active DB client.
 * @param {object} config                  Entity descriptor.
 * @param {number|string} id               Primary key value.
 * @param {object} encounter               Encounter payload to append.
 * @returns {Promise<object>} HTTP response with the updated record or a 400/404.
 */
export async function appendEncounter(client, config, id, encounter) {
  const log = getLogger();

  if (!encounter || typeof encounter !== 'object') {
    return response(400, { message: 'Body requerido para registrar atención' });
  }

  const pkCol = config.pkCol ?? 'id';

  // Fetch current record to get existing encounters
  const current = await client.query(
    `SELECT encounters FROM ${config.table} WHERE ${pkCol} = $1`,
    [id]
  );
  if (current.rowCount === 0) {
    return response(404, { message: 'Ficha clínica no encontrada' });
  }

  const raw = current.rows[0].encounters;
  const existing = Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : []);

  const newEncounter = { ...encounter, encounterDate: encounter.encounterDate ?? new Date().toISOString() };
  const updated = [newEncounter, ...existing];

  // Also update flat clinical columns (soap_*, vitals, diagnosis) from the encounter payload
  const flatCols   = config.toDb ? config.toDb(encounter) : {};
  const flatKeys   = Object.keys(flatCols);
  const flatSet    = flatKeys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  const flatValues = flatKeys.map(k => flatCols[k]);

  const result = await client.query(
    `UPDATE ${config.table}
     SET encounters = $1, last_visit = NOW(), updated_at = NOW()${flatSet ? ', ' + flatSet : ''}
     WHERE ${pkCol} = $2
     RETURNING *`,
    [JSON.stringify(updated), id, ...flatValues]
  );

  log.info('appendEncounter — success', { table: config.table, id, totalEncounters: updated.length, flatUpdated: flatKeys });

  // Re-fetch with JOIN so patient demographics are included in the response
  if (config.joinSelect) {
    const full = await client.query(`${config.joinSelect} WHERE c.${pkCol} = $1 LIMIT 1`, [id]);
    if (full.rowCount > 0) return response(201, config.fromDb(full.rows[0]));
  }
  return response(201, config.fromDb(result.rows[0]));
}
