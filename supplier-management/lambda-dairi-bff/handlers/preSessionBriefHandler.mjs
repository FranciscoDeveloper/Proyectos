// /api/clinical/pre-session-brief/* — brief de preparación de sesión generado por IA.
//
//   POST /api/clinical/pre-session-brief/{recordId}   → 202 { jobId }
//   GET  /api/clinical/pre-session-brief/job/{jobId}  → { status, brief?, ... }
//
// ── Por qué son dos llamadas y no una ────────────────────────────────────────
// El diseño original hacía la llamada a Bedrock aquí mismo y devolvía el brief en la
// misma respuesta. No puede funcionar: `dairi-bff` vive en la VPC (para hablar con RDS)
// y esa VPC no tiene salida a Bedrock — la petición no falla, se cuelga hasta el timeout
// de la Lambda. Ver lib/aiJobs.mjs para el detalle y el flujo completo.
//
// Este handler hace la parte que sí puede hacer: leer RDS y dejar el contexto en la cola.
// La llamada al modelo la hace `dairi-ai-worker`, fuera de la VPC.
//
// ── Qué es (y qué no es) el resultado ────────────────────────────────────────
// Un borrador de apoyo para que el terapeuta retome el hilo, no una valoración clínica.
// Toda respuesta lleva `requiresReview: true` y sus `warnings`; la UI los muestra.

import { getLogger }                        from '../lib/logger.mjs';
import { response }                         from '../lib/response.mjs';
import { denyUnlessRecordAccess }           from '../lib/recordAccess.mjs';
import { createRateLimiter }                from '../lib/rateLimit.mjs';
import { enqueueJob, getJob, JOB_ID_PATTERN } from '../lib/aiJobs.mjs';

// K9 — a diferencia del CRUD de la Fase 2, esto termina en una llamada a Bedrock que se
// paga por token. El límite es por usuario y por instancia caliente de la Lambda.
const briefRateLimit = createRateLimiter({ windowMs: 5 * 60_000, maxRequests: 10 });

/**
 * Reúne desde RDS todo lo que el worker va a necesitar. El worker no alcanza RDS,
 * así que lo que no se arme aquí no existe para el modelo.
 */
async function buildContext(client, recordId) {
  const [recordRes, tasksRes, moodsRes, scalesRes, notesCountRes] = await Promise.all([
    client.query(
      `SELECT c.encounters, c.soap_plan, c.soap_assessment, c.diagnosis_label, c.last_visit
         FROM clinical_record c WHERE c.id = $1`,
      [recordId]
    ),
    client.query(
      `SELECT description, due_date, completed, patient_note
         FROM intersession_task
        WHERE record_id = $1
        ORDER BY completed, created_at DESC
        LIMIT 8`,
      [recordId]
    ),
    client.query(
      `SELECT mood_score, mood_label, logged_at
         FROM mood_log
        WHERE record_id = $1
        ORDER BY logged_at DESC
        LIMIT 7`,
      [recordId]
    ),
    client.query(
      `SELECT t.code, t.name, i.total_score, i.severity, i.administered_at
         FROM scale_instance i
         JOIN scale_template t ON t.id = i.template_id
        WHERE i.record_id = $1 AND i.total_score IS NOT NULL
        ORDER BY i.administered_at DESC
        LIMIT 4`,
      [recordId]
    ),
    client.query(
      `SELECT COUNT(*)::int AS n FROM process_notes WHERE record_id = $1`,
      [recordId]
    ),
  ]);

  if (!recordRes.rows.length) return null;

  const r          = recordRes.rows[0];
  const encounters = Array.isArray(r.encounters) ? r.encounters : [];
  const lastEnc    = encounters.length ? encounters[encounters.length - 1] : null;

  const pending   = tasksRes.rows.filter(t => !t.completed);
  const completed = tasksRes.rows.filter(t =>  t.completed);

  const moodAvg = moodsRes.rows.length
    ? Math.round((moodsRes.rows.reduce((s, m) => s + Number(m.mood_score), 0) / moodsRes.rows.length) * 10) / 10
    : null;

  const fmtDate = d => (d ? new Date(d).toLocaleDateString('es-CL') : 's/f');

  const contextData = [
    `Sesiones registradas: ${encounters.length}`,
    `Última sesión: ${lastEnc ? fmtDate(lastEnc.lastVisit ?? lastEnc.encounterDate ?? lastEnc.date) : fmtDate(r.last_visit)}`,
    r.diagnosis_label ? `Impresión diagnóstica registrada: ${r.diagnosis_label}` : null,
    r.soap_assessment ? `Análisis de la última nota: ${r.soap_assessment}` : null,
    r.soap_plan       ? `Plan vigente: ${r.soap_plan}` : null,
    '',
    `Tareas intersesión pendientes: ${pending.length ? pending.map(t => `${t.description}${t.due_date ? ` (para el ${fmtDate(t.due_date)})` : ''}`).join('; ') : 'ninguna'}`,
    `Tareas completadas recientemente: ${completed.length ? completed.map(t => `${t.description}${t.patient_note ? ` — el paciente anotó: "${t.patient_note}"` : ''}`).join('; ') : 'ninguna'}`,
    '',
    `Registro de ánimo (1-10), últimas ${moodsRes.rows.length} entradas: ${moodsRes.rows.length ? moodsRes.rows.map(m => `${m.mood_score}${m.mood_label ? ` (${m.mood_label})` : ''} el ${fmtDate(m.logged_at)}`).join(', ') : 'sin registros'}`,
    `Promedio de ánimo: ${moodAvg ?? 'sin datos'}`,
    '',
    `Escalas aplicadas: ${scalesRes.rows.length
      ? scalesRes.rows.map(s => `${s.code} = ${s.total_score} puntos, severidad ${s.severity}, aplicada el ${fmtDate(s.administered_at)}`).join('; ')
      : 'ninguna aplicada'}`,
  ].filter(v => v !== null).join('\n');

  // Los avisos se calculan aquí, sobre los datos reales, y no los inventa el modelo.
  const warnings = [];
  if (!encounters.length)          warnings.push('La ficha no tiene sesiones registradas: el brief se apoya en muy poco material.');
  if (!scalesRes.rows.length)      warnings.push('Sin escalas aplicadas — no hay medición objetiva de evolución.');
  if (!moodsRes.rows.length)       warnings.push('Sin registro de ánimo en el período.');
  if (notesCountRes.rows[0].n > 0) warnings.push('Las notas de proceso no se incluyen en el brief: son privadas del terapeuta y no se envían al modelo.');

  return { contextData, warnings };
}

/**
 * Enruta /api/clinical/pre-session-brief/*. Devuelve null cuando no corresponde.
 *
 * @param {string} rawPath                  Ruta normalizada.
 * @param {string} method                   Método HTTP.
 * @param {object} tokenPayload             Payload JWT verificado.
 * @param {import('pg').PoolClient} client  Cliente de BD activo.
 */
export async function handlePreSessionBrief(rawPath, method, tokenPayload, client) {
  const log = getLogger();

  // ── GET .../job/{jobId} — consulta de estado ───────────────────────────────
  const jobMatch = rawPath.match(/^\/api\/clinical\/pre-session-brief\/job\/([0-9a-f-]{36})$/);
  if (jobMatch) {
    if (method !== 'GET') return response(405, { message: 'Método no permitido' });
    if (!JOB_ID_PATTERN.test(jobMatch[1])) return response(400, { message: 'jobId inválido' });

    const job = await getJob(jobMatch[1]);
    // Mismo 404 para inexistente, expirado y ajeno: distinguirlos revelaría que otra
    // cuenta pidió un brief.
    if (!job || job.type !== 'pre-session-brief') return response(404, { message: 'Trabajo no encontrado' });

    // Doble comprobación de propiedad: el dueño declarado del trabajo y, además, el
    // acceso vigente a la ficha (por si el trabajo sobrevive a un cambio de permisos).
    if (Number(job.userId) !== Number(tokenPayload.sub))
      return response(404, { message: 'Trabajo no encontrado' });
    const denied = await denyUnlessRecordAccess(client, job.recordId, tokenPayload);
    if (denied) return denied;

    return response(200, {
      status:        job.status,
      brief:         job.status === 'done' ? job.result : null,
      error:         job.status === 'error' ? 'No se pudo generar el brief.' : null,
      warnings:      job.warnings ?? [],
      generatedAt:   job.completedAt ?? null,
      model:         job.model ?? null,
      requiresReview: true,
    });
  }

  // ── POST .../{recordId} — encolar ──────────────────────────────────────────
  const createMatch = rawPath.match(/^\/api\/clinical\/pre-session-brief\/(\d+)$/);
  if (!createMatch) return null;
  if (method !== 'POST') return response(405, { message: 'Método no permitido' });

  const recordId = parseInt(createMatch[1], 10);

  const denied = await denyUnlessRecordAccess(client, recordId, tokenPayload);
  if (denied) return denied;

  const rate = briefRateLimit(String(tokenPayload.sub));
  if (!rate.allowed)
    return response(429, { message: `Demasiadas solicitudes. Reintenta en ${rate.waitSeconds} segundos.` });

  const ctx = await buildContext(client, recordId);
  if (!ctx) return response(404, { message: 'Registro no encontrado' });

  const jobId = await enqueueJob({
    type:        'pre-session-brief',
    recordId,
    userId:      tokenPayload.sub,
    contextData: ctx.contextData,
    warnings:    ctx.warnings,
  });

  log.info('Pre-session brief queued', { recordId, jobId });
  return response(202, { jobId, status: 'pending', requiresReview: true, warnings: ctx.warnings });
}
