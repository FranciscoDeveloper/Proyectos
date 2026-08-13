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
 * Entity keys whose owning professional is decided by the server and can never be
 * chosen — nor changed — by the client.
 *
 * `psych-records`: una ficha psicológica pertenece siempre al psicólogo autenticado.
 * El formulario ofrecía un desplegable "Psicólogo/a" obligatorio sobre `medicos`, así
 * que el body SIEMPRE traía `professionalId` y el auto-estampado de createEntity (que
 * sólo rellena la columna `if (!(col in cols))`) nunca llegaba a dispararse: el dueño
 * de la ficha acababa siendo el que mandara el cliente. Quitar el desplegable arregla
 * la UI, pero un cliente hecho a mano seguiría pudiendo reasignar la ficha de un
 * paciente a otro profesional — de ahí que la regla viva aquí, en el servidor.
 *
 * Se compara contra el `entityKey` de la petición, no contra la config: las nueve
 * fichas de especialidad comparten la config `clinical-records` (ver ENTITY_ALIASES),
 * y esto es deliberadamente sólo para psicología.
 */
const OWNER_LOCKED_KEYS = new Set(['psych-records']);

/**
 * Strip the professional-ownership columns from a payload for owner-locked entities,
 * so an update can never re-point a record at a different professional. Ownership is
 * assigned once, at creation, from the authenticated token.
 *
 * Skipped when the caller holds the superadmin bypass (internal service accounts such
 * as the SOAP-note pipeline, which legitimately writes on behalf of the treating
 * professional — and does so through the `clinical-records` key anyway).
 *
 * @param {object} cols            Columns produced by config.toDb(body).
 * @param {object} config          Entity descriptor.
 * @param {string} entityKey       Requested entity key.
 * @param {object|null} profScope  Resolved professional scope.
 * @returns {string[]} Names of the columns that were dropped (for logging).
 */
function stripOwnerCols(cols, config, entityKey, profScope) {
  if (!OWNER_LOCKED_KEYS.has(entityKey) || !config.profFilter || profScope?.bypass) return [];
  const dropped = [];
  for (const key of ['idCol', 'nameCol']) {
    const raw = config.profFilter[key];
    if (!raw) continue;
    const col = raw.replace(/^\w+\./, '');
    if (col in cols) { delete cols[col]; dropped.push(col); }
  }
  return dropped;
}

/**
 * Fecha (YYYY-MM-DD) de una atención, tolerando los dos formatos que se guardan en el
 * JSONB `encounters`: el formulario manual escribe "2026-08-13" (input type=date) y la
 * cola de transcripción un ISO completo con hora.
 *
 * @param {object} enc Atención.
 * @returns {string|null} Fecha en YYYY-MM-DD, o null si no hay ninguna utilizable.
 */
function encounterDateOnly(enc) {
  const raw = enc?.encounterDate ?? enc?.lastVisit ?? enc?.date;
  if (!raw) return null;
  const s = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * La atención más reciente por fecha. Comparación lexicográfica sobre YYYY-MM-DD, que
 * para ese formato equivale a la cronológica y no arrastra ninguna zona horaria.
 *
 * Empates y atenciones sin fecha utilizable: gana la que esté antes en el array, es decir
 * la escrita más recientemente (appendEncounter antepone). Así dos notas del mismo día se
 * resuelven por orden de escritura, que es lo que espera quien las acaba de guardar.
 *
 * @param {object[]} encounters Atenciones, la más recientemente escrita primero.
 * @returns {object} La atención ganadora.
 */
function pickLatestEncounter(encounters) {
  let best = encounters[0];
  let bestDate = encounterDateOnly(best) ?? '';
  for (const enc of encounters.slice(1)) {
    const d = encounterDateOnly(enc);
    if (d && d > bestDate) { best = enc; bestDate = d; }
  }
  return best;
}

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

  // Owner-locked entities (psych-records): discard whatever professional the client
  // sent, so the stamping below is the only thing that decides the owner.
  const droppedOnCreate = stripOwnerCols(cols, config, entityKey, profScope);
  if (droppedOnCreate.length) {
    log.warn('createEntity — ignoring client-supplied professional owner', { entityKey, dropped: droppedOnCreate });
  }

  // Let the entity override/generate columns server-side (e.g. a globally-unique
  // sequential number) — always runs with full table visibility, ignoring profFilter,
  // since values like `numero` must be unique across every professional.
  if (config.beforeInsert) {
    await config.beforeInsert(client, cols);
  }

  // Auto-stamp professional identity so records are always linked to the creator.
  // Only fills the column when the body did not carry it; for owner-locked entities
  // stripOwnerCols() above guarantees it never does, so the stamp always wins.
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

  // Owner-locked entities (psych-records): the owning professional is stamped once at
  // creation and is not part of the editable surface. Dropping the column here means
  // "leave unchanged" — the UPDATE simply never mentions it — so neither the edit form
  // (which no longer submits it) nor a hand-crafted request can re-assign the record.
  const droppedOnUpdate = stripOwnerCols(cols, config, entityKey, profScope);
  if (droppedOnUpdate.length) {
    log.warn('updateEntity — ignoring client-supplied professional owner', { entityKey, id, dropped: droppedOnUpdate });
  }

  const keys = Object.keys(cols);
  if (keys.length === 0) {
    log.warn('updateEntity — no valid fields', { entityKey, id, receivedKeys: Object.keys(body) });
    return response(400, { message: 'Ningún campo válido proporcionado' });
  }

  const pkCol      = config.pkCol ?? 'id';
  const tsClause   = config.noTimestamp ? '' : ', updated_at = NOW()';
  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');

  // Build ownership check for professionals. Mirrors buildProfWhere (list/get) so a
  // professional can update exactly the rows they're allowed to see — e.g. entities
  // scoped via existsIn (shared rows like clinical-records, visible to every
  // professional with an appointment for that patient, not just whoever "owns" it).
  // The table is aliased `c` so profFilter's `c.`-prefixed idCol/existsIn conditions
  // (written for the joinSelect context) resolve the same way here.
  const { clause: ownerClause, params: ownerParams } = profScopeService.buildProfAndClause(
    config,
    profScope,
    keys.length + 1
  );
  const values = [...keys.map(k => cols[k]), id, ...ownerParams];

  log.info('updateEntity — updating', { table: config.table, id, columns: keys });
  const result = await client.query(
    `UPDATE ${config.table} AS c
     SET ${setClauses}${tsClause}
     WHERE c.${pkCol} = $${keys.length + 1}${ownerClause}
     RETURNING c.*`,
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

  // Build ownership check for professionals — see updateEntity for why this is shared
  // with list/get instead of a idCol/nameCol-only subset (existsIn-scoped entities need
  // the same OR'd condition set here too, and the `c` alias matches those conditions).
  const { clause: ownerClause, params: ownerParams } = profScopeService.buildProfAndClause(
    config,
    profScope,
    1
  );

  const result = await client.query(
    `DELETE FROM ${config.table} AS c WHERE c.${pkCol} = $1${ownerClause} RETURNING c.${pkCol}`,
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
 * @param {object|null} profScope          Resolved professional scope, or null.
 * @returns {Promise<object>} HTTP response with the updated record or a 400/404.
 */
export async function appendEncounter(client, config, id, encounter, profScope) {
  const log = getLogger();

  if (!encounter || typeof encounter !== 'object') {
    return response(400, { message: 'Body requerido para registrar atención' });
  }

  const pkCol = config.pkCol ?? 'id';

  // Fetch current record to get existing encounters, scoped the same way getEntity
  // is — otherwise any professional with module access could append an encounter to
  // a clinical record they have no relationship to, just by guessing/enumerating id.
  const { clause, params: scopeParams } = profScopeService.buildProfWhere(config, profScope, 1);
  const andOrWhere = clause ? clause.replace(' WHERE ', ' AND ') : '';
  const current = await client.query(
    `SELECT encounters FROM ${config.table} AS c WHERE c.${pkCol} = $1${andOrWhere}`,
    [id, ...scopeParams]
  );
  if (current.rowCount === 0) {
    return response(404, { message: 'Ficha clínica no encontrada' });
  }

  const raw = current.rows[0].encounters;
  const existing = Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : []);

  const newEncounter = { ...encounter, encounterDate: encounter.encounterDate ?? new Date().toISOString() };
  // Se antepone (no se reordena por fecha) a propósito: rejectAiContent asume que la
  // última escritura vive en el índice 0 para poder retirar la nota que acaba de generar
  // la transcripción de voz. El orden cronológico lo resuelve quien lee el historial.
  const updated = [newEncounter, ...existing];

  // Las columnas planas (soap_*, examen mental, diagnóstico) son el resumen "actual" que
  // pinta la ficha — la sección NOTA DE SESIÓN. Deben reflejar UNA atención concreta: la
  // más reciente por encounterDate.
  //
  // Antes se copiaban con toDb(encounter), es decir sólo las claves que traía la atención
  // recién escrita, dejando intactas las demás. Registrar una sesión con fecha ANTERIOR y
  // sólo la S rellena sobrescribía soap_subjective y dejaba O/A/P de la sesión posterior:
  // el resumen mostraba una nota SOAP mezcla de dos sesiones distintas, que nunca existió
  // como consulta real. (El array `encounters` sí guardaba ambas correctamente, así que el
  // historial se veía bien y sólo mentía el resumen.)
  //
  // Ahora gana la atención más reciente entera: se mapea esa, y toda columna que otra
  // atención haya aportado alguna vez pero que la ganadora no traiga se pone a NULL en vez
  // de conservar el valor de una sesión ajena.
  const latest = pickLatestEncounter(updated);
  const flatCols = config.toDb ? config.toDb(latest) : {};
  if (config.toDb) {
    const contributed = {};
    for (const e of updated) Object.assign(contributed, config.toDb(e));
    for (const k of Object.keys(contributed)) if (!(k in flatCols)) flatCols[k] = null;
  }
  // Estas dos las fija la propia sentencia más abajo; dejarlas también en el SET generado
  // haría que Postgres rechace el UPDATE por asignar dos veces la misma columna.
  delete flatCols.last_visit;
  delete flatCols.encounters;
  const flatKeys   = Object.keys(flatCols);
  const flatSet    = flatKeys.map((k, i) => `${k} = $${i + 4}`).join(', ');
  const flatValues = flatKeys.map(k => flatCols[k]);

  // last_visit sigue a la atención ganadora, no al reloj: registrar hoy una sesión que
  // ocurrió la semana pasada no debe mover la "Última Sesión" a hoy.
  const lastVisit = encounterDateOnly(latest) ?? new Date().toISOString().slice(0, 10);

  const result = await client.query(
    `UPDATE ${config.table}
     SET encounters = $1, last_visit = $3, updated_at = NOW()${flatSet ? ', ' + flatSet : ''}
     WHERE ${pkCol} = $2
     RETURNING *`,
    [JSON.stringify(updated), id, lastVisit, ...flatValues]
  );

  log.info('appendEncounter — success', {
    table: config.table, id, totalEncounters: updated.length,
    flatUpdated: flatKeys, mirrored: latest.encounterDate, lastVisit
  });

  // Re-fetch with JOIN so patient demographics are included in the response
  if (config.joinSelect) {
    const full = await client.query(`${config.joinSelect} WHERE c.${pkCol} = $1 LIMIT 1`, [id]);
    if (full.rowCount > 0) return response(201, config.fromDb(full.rows[0]));
  }
  return response(201, config.fromDb(result.rows[0]));
}

/** Marker written by lambda-soap-processor on every encounter it generates. */
const AI_ENCOUNTER_SOURCE = 'audio-transcription';

/**
 * Reject the AI-generated content of a clinical record ("Rechazar" in the ficha
 * clínica): erases everything the voice-transcription pipeline wrote and leaves the
 * record certified again, since nothing uncertified remains afterwards.
 *
 * Concretely it:
 *  1. Nulls the flat SOAP columns mirrored from the AI write (soap_*, ai_summary,
 *     soap_source), plus diagnosis_label when that same AI encounter carried one.
 *     diagnosis_code is never touched — lambda-soap-processor does not write it, so it
 *     can only hold a value the professional entered by hand.
 *  2. Drops the newest encounter from the `encounters` JSONB array, but only when it is
 *     actually the AI one (entries are prepended, so the AI write is always index 0).
 *  3. Sets certified = true.
 *
 * The operation is idempotent-ish and defensive: if the record is already certified or
 * the newest encounter is not AI-sourced, only the certification flag is normalised and
 * no clinical content is destroyed.
 *
 * @param {import('pg').PoolClient} client Active DB client.
 * @param {object} config                  Entity descriptor.
 * @param {number|string} id               Primary key value.
 * @param {object|null} profScope          Resolved professional scope, or null.
 * @returns {Promise<object>} HTTP response with the updated record or a 404.
 */
export async function rejectAiContent(client, config, id, profScope) {
  const log = getLogger();

  const pkCol = config.pkCol ?? 'id';

  // Scope the read exactly like getEntity/appendEncounter do — otherwise any professional
  // with module access could wipe the SOAP note of a record they have no relationship to,
  // just by guessing the id. This is a destructive action, so the check matters even more.
  const { clause, params: scopeParams } = profScopeService.buildProfWhere(config, profScope, 1);
  const andOrWhere = clause ? clause.replace(' WHERE ', ' AND ') : '';
  const current = await client.query(
    `SELECT encounters FROM ${config.table} AS c WHERE c.${pkCol} = $1${andOrWhere}`,
    [id, ...scopeParams]
  );
  if (current.rowCount === 0) {
    log.warn('rejectAiContent — not found', { table: config.table, id });
    return response(404, { message: 'Ficha clínica no encontrada' });
  }

  const raw      = current.rows[0].encounters;
  const existing = Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : []);

  // New encounters are always prepended, so the AI write — if it is still the latest — is
  // at index 0. Anything else means the professional already wrote over it manually and
  // there is no AI content left to remove.
  const newest   = existing[0] ?? null;
  const isAi     = !!newest && newest.source === AI_ENCOUNTER_SOURCE;
  const remaining = isAi ? existing.slice(1) : existing;

  const sets   = ['certified = true', 'updated_at = NOW()'];
  const values = [];

  if (isAi) {
    sets.push(
      'soap_subjective = NULL',
      'soap_objective  = NULL',
      'soap_assessment = NULL',
      'soap_plan       = NULL',
      'ai_summary      = NULL',
      'soap_source     = NULL'
    );
    // Only clear the diagnosis when it came from this very AI write.
    if (newest.diagnosisLabel != null && newest.diagnosisLabel !== '') {
      sets.push('diagnosis_label = NULL');
    }
    values.push(JSON.stringify(remaining));
    sets.push(`encounters = $${values.length}`);
  }

  values.push(id);
  const result = await client.query(
    `UPDATE ${config.table} AS c
     SET ${sets.join(', ')}
     WHERE c.${pkCol} = $${values.length}
     RETURNING c.*`,
    values
  );

  if (result.rowCount === 0) {
    log.warn('rejectAiContent — update matched no row', { table: config.table, id });
    return response(404, { message: 'Ficha clínica no encontrada' });
  }

  log.info('rejectAiContent — success', {
    table: config.table, id, aiContentRemoved: isAi, remainingEncounters: remaining.length
  });

  // Re-fetch with JOIN so patient demographics are not lost in the response
  if (config.joinSelect) {
    const full = await client.query(`${config.joinSelect} WHERE c.${pkCol} = $1 LIMIT 1`, [id]);
    if (full.rowCount > 0) return response(200, config.fromDb(full.rows[0]));
  }
  return response(200, config.fromDb(result.rows[0]));
}
