// Ownership check for endpoints addressed by `clinical_record.id`.
//
// Any route that takes a recordId from the URL is otherwise enumerable: the id is a
// plain serial, so without a check an authenticated professional could read or write
// another tenant's clinical data simply by changing the number. `clinicalHandler` and
// `documentsHandler` each grew their own copy of this check after an audit found that
// exact gap; this module factors it out so new record-scoped handlers get it by import
// instead of by remembering to re-implement it.
//
// The rule is the same one the `clinical-records` entity is filtered by (see
// config/entities.mjs): the caller must own the record (professional_id) or have an
// appointment with that patient — clinical_record is one shared row per patient, so a
// second specialist treating the same person legitimately reaches it. `superadmin`
// bypasses, exactly as resolveProfScope defines it (platform-level trust, also used by
// the SOAP pipeline's service token).

import { getLogger }         from './logger.mjs';
import { response }          from './response.mjs';
import * as profScopeService from '../services/profScopeService.mjs';

// Kept identical to the `clinical-records` profFilter so this check can never drift
// into being stricter or looser than what the entity endpoints already allow.
const RECORD_PROF_FILTER = {
  profFilter: {
    idCol: 'c.professional_id',
    existsIn: { table: 'appointment', patientCol: 'patient_id', profCol: 'professional_id', pkCol: 'patient_id' }
  }
};

/**
 * Resolve whether `tokenPayload`'s user may touch clinical record `recordId`.
 *
 * @param {import('pg').PoolClient} client      Active DB client.
 * @param {number|string}           recordId    clinical_record.id from the URL.
 * @param {object}                  tokenPayload Verified JWT payload ({ sub, role, ... }).
 * @returns {Promise<boolean>} true when the caller may read/write that record.
 */
export async function assertRecordAccess(client, recordId, tokenPayload) {
  // resolveProfScope takes (client, userId, role) and returns { bypass: true } for
  // superadmin, { professionalId, professionalName } for a linked professional, or
  // null when the user has no professional row at all. buildProfWhere fails closed
  // (WHERE 1=0) on null, so a user with no professional row matches nothing.
  const profScope = await profScopeService.resolveProfScope(client, tokenPayload.sub, tokenPayload.role);
  const { clause, params } = profScopeService.buildProfWhere(RECORD_PROF_FILTER, profScope, 1);
  const andOrWhere = clause ? clause.replace(' WHERE ', ' AND ') : '';

  const { rowCount } = await client.query(
    `SELECT 1 FROM clinical_record c WHERE c.id = $1${andOrWhere} LIMIT 1`,
    [recordId, ...params]
  );
  return rowCount > 0;
}

/**
 * Same check, shaped for handlers: returns null when access is granted, or a ready
 * 404 response when it is not.
 *
 * 404 rather than 403 on purpose — a 403 would confirm that the record exists, which
 * is itself information about another tenant's patients. A caller who may not see the
 * record gets the same answer as for a record that does not exist.
 *
 * @param {import('pg').PoolClient} client       Active DB client.
 * @param {number|string}           recordId     clinical_record.id from the URL.
 * @param {object}                  tokenPayload Verified JWT payload.
 * @returns {Promise<object|null>} null when allowed, else a 404 response object.
 */
export async function denyUnlessRecordAccess(client, recordId, tokenPayload) {
  const allowed = await assertRecordAccess(client, recordId, tokenPayload);
  if (allowed) return null;

  getLogger().warn('Record access denied', { recordId, sub: tokenPayload?.sub });
  return response(404, { message: 'Registro no encontrado' });
}
