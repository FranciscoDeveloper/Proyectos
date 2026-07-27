// Handles GET /api/clinical-summary/{recordId} — AI narrative summary for a clinical record.
//
// The narrative is generated once, upstream, by lambda-transcribe (transcribe-nova-3) in the
// same Bedrock call that produces the SOAP note, and stored in clinical_record.ai_summary.
// This handler only reads it — it does NOT call Bedrock. dairi-bff runs inside the VPC, which
// has no route to Bedrock (no free VPC Gateway Endpoint for Bedrock, only a paid Interface
// Endpoint), so any live Bedrock call from here hangs until Lambda timeout. Reading the
// pre-generated column avoids that entirely.

import { getLogger }         from '../lib/logger.mjs';
import { response }          from '../lib/response.mjs';
import * as profScopeService from '../services/profScopeService.mjs';

/**
 * Return the pre-generated AI narrative summary for a clinical record.
 * Returns null when the path does not match.
 *
 * Scoped the same way the `clinical-records` entity is (see config/entities.mjs):
 * the caller must own the record (professional_id) or have an appointment with that
 * patient, unless their resolved scope bypasses row-level filtering (superadmin).
 * Previously unscoped — any authenticated user could read any patient's AI summary
 * by id (IDOR, found in a full-app security audit).
 *
 * @param {string}              rawPath      Normalized request path.
 * @param {string}              method       HTTP method.
 * @param {import('pg').PoolClient} client   Active DB client.
 * @param {object}              tokenPayload Verified JWT payload.
 */
export async function handleClinicalSummary(rawPath, method, client, tokenPayload) {
  const match = rawPath.match(/^\/api\/clinical-summary\/(\d+)$/);
  if (!match || method !== 'GET') return null;

  const log      = getLogger();
  const recordId = parseInt(match[1], 10);

  const profScope = await profScopeService.resolveProfScope(client, tokenPayload.sub, tokenPayload.role);
  const { clause, params } = profScopeService.buildProfWhere(
    { profFilter: { idCol: 'c.professional_id', existsIn: { table: 'appointment', patientCol: 'patient_id', profCol: 'professional_id', pkCol: 'patient_id' } } },
    profScope, 1
  );
  const andOrWhere = clause ? clause.replace(' WHERE ', ' AND ') : '';

  const { rows } = await client.query(`
    SELECT ai_summary, updated_at
    FROM clinical_record c
    WHERE c.id = $1${andOrWhere}
  `, [recordId, ...params]);

  if (!rows.length) return response(404, { message: 'Registro no encontrado' });
  const r = rows[0];

  if (!r.ai_summary) {
    log.info('Clinical summary not available yet', { recordId });
    return response(200, { summary: null, available: false });
  }

  log.info('Clinical summary read', { recordId, chars: r.ai_summary.length });
  return response(200, {
    summary:     r.ai_summary,
    available:   true,
    generatedAt: r.updated_at ?? null,
  });
}
