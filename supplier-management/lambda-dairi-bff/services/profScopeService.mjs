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
  if (!profScope || !config.profFilter) return { conditions: [], params: [] };

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
 * See buildProfConditions for the condition set. Fails closed (1=0) when the
 * entity declares a profFilter and the professional has a resolved scope but
 * none of the configured conditions could be built.
 *
 * @param {object} config             Entity config; may carry a `profFilter` descriptor.
 * @param {object|null} profScope     Resolved scope: { professionalId, professionalName }.
 * @param {number} existingParamCount Number of positional params already bound before this clause.
 * @returns {{ clause: string, params: any[] }} Clause already contains its WHERE prefix.
 */
export function buildProfWhere(config, profScope, existingParamCount = 0) {
  if (!profScope || !config.profFilter) return { clause: '', params: [] };

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
  if (!profScope || !config.profFilter) return { clause: '', params: [] };

  const { conditions, params } = buildProfConditions(config, profScope, existingParamCount);
  if (conditions.length === 0) return { clause: ' AND (1=0)', params: [] };
  return { clause: ` AND (${conditions.join(' OR ')})`, params };
}

/**
 * Resolve the professional scope for a given user.
 * Looks up the `professional` row linked to the user and returns the scope
 * used for per-professional data filtering, or null when the user maps to
 * no professional (e.g. non-clinical admin accounts).
 *
 * @param {import('pg').PoolClient} client Active DB client.
 * @param {number|string} userId           Authenticated user id (token `sub`).
 * @returns {Promise<{ professionalId: number, professionalName: string }|null>}
 */
export async function resolveProfScope(client, userId) {
  const log = getLogger();

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
