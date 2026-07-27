// Professional scope resolution and per-professional WHERE clause building.
//
// Multi-tenant clinical data is filtered so each authenticated professional
// only sees their own rows. This module resolves the professional identity
// tied to a user and produces the SQL fragment used to enforce that filter.
//
// AWS Lambda (Node.js 20, ES modules).

import { getLogger } from '../lib/logger.mjs';

/**
 * Build the list of OR-combined SQL conditions (with bound params) that restrict
 * rows to the authenticated professional. Shared by every call site that needs
 * row-level ownership enforcement (list/get use it via buildProfWhere; update/delete
 * append it to their own WHERE via buildProfAndClause) so all four verbs agree on
 * who can see/touch a row instead of each re-implementing a subset of profFilter.
 *
 * Uses idCol (FK) when available, nameCol (text match) as fallback, and/or existsIn
 * for entities with no direct professional FK — or, like `clinical-records`, whose
 * FK only stamps the record's creator/last-editor while the row is meant to stay
 * visible to every professional who has ever had an appointment with that patient.
 *
 * @param {object} config             Entity config; may carry a `profFilter` descriptor.
 * @param {object|null} profScope     Resolved scope: { professionalId, professionalName }.
 * @param {number} existingParamCount Number of positional params already bound before this clause.
 * @returns {{ conditions: string[], params: any[] }}
 */
function buildProfConditions(config, profScope, existingParamCount = 0) {
  if (!profScope || !config.profFilter || profScope.bypass) return { conditions: [], params: [] };

  const f = config.profFilter;
  const params = [];
  const conditions = [];

  if (f.idCol && profScope.professionalId != null) {
    params.push(profScope.professionalId);
    conditions.push(`${f.idCol} = $${existingParamCount + params.length}`);
  }
  if (f.nameCol && profScope.professionalName) {
    params.push(profScope.professionalName);
    conditions.push(`${f.nameCol} = $${existingParamCount + params.length}`);
  }
  if (f.existsIn && profScope.professionalId != null) {
    const { table, patientCol = 'patient_id', profCol = 'professional_id', pkCol = 'id' } = f.existsIn;
    params.push(profScope.professionalId);
    conditions.push(
      `EXISTS (SELECT 1 FROM ${table} x WHERE x.${patientCol} = c.${pkCol} AND x.${profCol} = $${existingParamCount + params.length})`
    );
  }

  return { conditions, params };
}

/**
 * Build a WHERE clause that restricts rows to the authenticated professional.
 * See buildProfConditions for the condition set. Fails closed (1=0) whenever the
 * entity declares a profFilter and there is no resolved scope to build a condition
 * from — including when profScope itself is null (no linked professional row).
 * A null profScope previously meant "no filter" (full table access); that was a
 * real vulnerability (any authenticated account with no professional row — including
 * a freshly self-registered one — saw every row of every profFilter-scoped entity).
 * The one sanctioned bypass is profScope.bypass (see resolveProfScope), reserved for
 * the superadmin role and trusted internal service accounts signed with it.
 *
 * @param {object} config             Entity config; may carry a `profFilter` descriptor.
 * @param {object|null} profScope     Resolved scope: { professionalId, professionalName } | { bypass: true } | null.
 * @param {number} existingParamCount Number of positional params already bound before this clause.
 * @returns {{ clause: string, params: any[] }} Clause already contains its WHERE prefix.
 */
export function buildProfWhere(config, profScope, existingParamCount = 0) {
  if (!config.profFilter) return { clause: '', params: [] };
  if (profScope?.bypass) return { clause: '', params: [] };
  if (!profScope) return { clause: ' WHERE (1=0)', params: [] };

  const { conditions, params } = buildProfConditions(config, profScope, existingParamCount);
  if (conditions.length === 0) return { clause: ' WHERE (1=0)', params: [] };
  return { clause: ` WHERE (${conditions.join(' OR ')})`, params };
}

/**
 * Build an ` AND (...)` fragment for appending to an existing WHERE (used by
 * updateEntity/deleteEntity, which filter by primary key first). Mirrors
 * buildProfWhere's condition set and fail-closed behavior so a professional
 * can only update/delete rows they'd also be able to see via list/get.
 *
 * @param {object} config             Entity config; may carry a `profFilter` descriptor.
 * @param {object|null} profScope     Resolved scope: { professionalId, professionalName }.
 * @param {number} existingParamCount Number of positional params already bound before this clause.
 * @returns {{ clause: string, params: any[] }} Clause already contains its AND prefix, or '' when unscoped.
 */
export function buildProfAndClause(config, profScope, existingParamCount = 0) {
  if (!config.profFilter) return { clause: '', params: [] };
  if (profScope?.bypass) return { clause: '', params: [] };
  if (!profScope) return { clause: ' AND (1=0)', params: [] };

  const { conditions, params } = buildProfConditions(config, profScope, existingParamCount);
  if (conditions.length === 0) return { clause: ' AND (1=0)', params: [] };
  return { clause: ` AND (${conditions.join(' OR ')})`, params };
}

/**
 * Resolve the professional scope for a given user.
 * Looks up the `professional` row linked to the user and returns the scope
 * used for per-professional data filtering, or null when the user maps to
 * no professional (e.g. non-clinical staff accounts) — which now means
 * "no access" to profFilter-scoped entities (see buildProfWhere), not "full access".
 *
 * `role === 'superadmin'` is the one sanctioned full-table bypass (platform-level
 * trust, not tenant-scoped) — used by the real superadmin account and by internal
 * service callers signed with that role (e.g. the SOAP-note pipeline, which needs to
 * write to whichever patient's record a recording is about, not just its own).
 *
 * @param {import('pg').PoolClient} client Active DB client.
 * @param {number|string} userId           Authenticated user id (token `sub`).
 * @param {string|null} [role=null]        Authenticated user role (token `role`).
 * @returns {Promise<{ professionalId: number, professionalName: string }|{ bypass: true }|null>}
 */
export async function resolveProfScope(client, userId, role = null) {
  const log = getLogger();

  if (role === 'superadmin') return { bypass: true };

  const { rows } = await client.query(
    `SELECT p.id AS prof_id, p.name AS prof_name
     FROM professional p WHERE p.user_id = $1 LIMIT 1`,
    [userId]
  );

  if (!rows.length) return null;

  const profScope = {
    professionalId: rows[0].prof_id,
    professionalName: rows[0].prof_name
  };
  log.info('profScope resolved', profScope);
  return profScope;
}
