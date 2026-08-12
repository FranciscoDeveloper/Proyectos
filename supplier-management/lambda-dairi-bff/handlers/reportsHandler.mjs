// /api/psych/reports/* — borradores de informe psicológico generados por IA.
//
//   POST /api/psych/reports/draft        → 202 { jobId }
//   GET  /api/psych/reports/job/{jobId}  → { status, draft?, warnings, requiresReview, ... }
//
// ── Asíncrono por obligación ─────────────────────────────────────────────────
// Igual que el brief pre-sesión: `dairi-bff` está en la VPC y no alcanza Bedrock, así
// que aquí solo se reúne el contexto desde RDS y se encola. El modelo lo llama
// `dairi-ai-worker`, fuera de la VPC. Ver lib/aiJobs.mjs.
//
// ── Lo que se está generando ─────────────────────────────────────────────────
// Informes para tribunal de familia, para colegios, certificados para licencia médica
// y de avance terapéutico. Son documentos con consecuencias legales y clínicas para el
// paciente y con la firma del profesional encima. Por eso:
//
//   · Toda respuesta lleva `requiresReview: true` y una lista de `warnings` calculada
//     sobre los datos reales (qué falta, qué el modelo no pudo saber).
//   · Los prompts piden `[COMPLETAR]` explícito donde falte información, en vez de
//     dejar que el modelo rellene el hueco.
//   · La UI lo presenta como borrador y nunca como documento terminado.
//
// ── S1: la búsqueda del tipo de informe ──────────────────────────────────────
// `REPORT_TYPES[reportType]` a secas es explotable: `reportType = "constructor"` (o
// "toString", "__proto__"…) devuelve un miembro heredado de Object.prototype, que es
// truthy, y la validación pasa. Se usa `Object.prototype.hasOwnProperty.call` — el
// worker aplica la misma guarda sobre su tabla de prompts, para que la validación no
// dependa solo de que el BFF haya filtrado bien.

import { getLogger }                          from '../lib/logger.mjs';
import { response }                           from '../lib/response.mjs';
import { denyUnlessRecordAccess }             from '../lib/recordAccess.mjs';
import { createRateLimiter }                  from '../lib/rateLimit.mjs';
import { enqueueJob, getJob, JOB_ID_PATTERN } from '../lib/aiJobs.mjs';

// Catálogo de tipos válidos. Los prompts completos viven en `dairi-ai-worker`, que es
// quien llama al modelo; aquí solo hace falta saber qué es aceptable y cómo se llama.
// Objeto sin prototipo: ni siquiera hereda las claves que S1 describe.
const REPORT_TYPES = Object.assign(Object.create(null), {
  'tribunal-familia':   'Informe para Tribunal de Familia',
  'colegio':            'Informe para establecimiento educacional',
  'licencia':           'Certificado de diagnóstico para licencia médica',
  'avance-terapeutico': 'Informe de avance terapéutico',
});

/** Tope del texto libre que el profesional agrega. Va a un prompt: se acota. */
const MAX_ADDITIONAL_CONTEXT = 4_000;

// K9 — cada borrador es una llamada a Bedrock con miles de tokens de salida.
const reportRateLimit = createRateLimiter({ windowMs: 10 * 60_000, maxRequests: 6 });

/**
 * S2 — `additionalContext` es texto libre del usuario que termina dentro de un prompt.
 * Se envuelve en un delimitador y se le quita cualquier cierre de ese delimitador que
 * venga en el texto, para que no pueda "salirse" del bloque de datos. El prompt de
 * sistema del worker declara que lo que está ahí dentro es información, no órdenes.
 */
function wrapAdditionalContext(raw) {
  const text = String(raw ?? '').trim().slice(0, MAX_ADDITIONAL_CONTEXT);
  if (!text) return null;
  const sanitized = text.replace(/<\/?contexto_profesional>/gi, '');
  return `<contexto_profesional>\n${sanitized}\n</contexto_profesional>`;
}

/** Reúne desde RDS el bloque de datos del paciente y los avisos derivados de sus huecos. */
async function buildContext(client, recordId, additionalContext) {
  const [recordRes, scalesRes, tasksRes] = await Promise.all([
    client.query(
      `SELECT p.name, p.birth_date AS patient_birth_date, p.gender,
              c.birth_date AS record_birth_date,
              c.diagnosis_code, c.diagnosis_label, c.differential_dx,
              c.soap_subjective, c.soap_objective, c.soap_assessment, c.soap_plan,
              c.encounters
         FROM clinical_record c
         LEFT JOIN patient p ON p.id = c.patient_id
        WHERE c.id = $1`,
      [recordId]
    ),
    client.query(
      `SELECT t.code, t.name, i.total_score, i.severity, i.administered_at
         FROM scale_instance i
         JOIN scale_template t ON t.id = i.template_id
        WHERE i.record_id = $1 AND i.total_score IS NOT NULL
        ORDER BY i.administered_at DESC
        LIMIT 6`,
      [recordId]
    ),
    client.query(
      `SELECT description, completed FROM intersession_task
        WHERE record_id = $1 ORDER BY created_at DESC LIMIT 6`,
      [recordId]
    ),
  ]);

  if (!recordRes.rows.length) return null;

  const r          = recordRes.rows[0];
  const encounters = Array.isArray(r.encounters) ? r.encounters : [];
  const birthDate  = r.patient_birth_date ?? r.record_birth_date;
  const age = birthDate
    ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 864e5))
    : null;

  const fmtDate = d => (d ? new Date(d).toLocaleDateString('es-CL') : 's/f');

  const contextData = [
    `Nombre: ${r.name ?? '[COMPLETAR]'}`,
    age != null ? `Edad: ${age} años` : 'Fecha de nacimiento: [COMPLETAR]',
    r.gender ? `Género: ${r.gender}` : null,
    r.diagnosis_code || r.diagnosis_label
      ? `Diagnóstico: ${[r.diagnosis_code, r.diagnosis_label].filter(Boolean).join(' — ')}`
      : 'Diagnóstico CIE-10: [COMPLETAR]',
    r.differential_dx ? `Diagnóstico diferencial: ${r.differential_dx}` : null,
    `Número de sesiones registradas: ${encounters.length}`,
    '',
    r.soap_subjective ? `Relato del paciente (subjetivo): ${r.soap_subjective}` : null,
    r.soap_objective  ? `Observación clínica (objetivo): ${r.soap_objective}`   : null,
    r.soap_assessment ? `Análisis clínico: ${r.soap_assessment}`                : null,
    r.soap_plan       ? `Plan de tratamiento: ${r.soap_plan}`                   : null,
    '',
    scalesRes.rows.length
      ? `Escalas aplicadas:\n${scalesRes.rows.map(s => `- ${s.code} (${s.name}): ${s.total_score} puntos, severidad ${s.severity}, aplicada el ${fmtDate(s.administered_at)}`).join('\n')}`
      : 'Escalas aplicadas: ninguna registrada.',
    tasksRes.rows.length
      ? `Trabajo intersesión: ${tasksRes.rows.map(t => `${t.description} (${t.completed ? 'completada' : 'pendiente'})`).join('; ')}`
      : null,
    additionalContext ? `\nContexto aportado por el profesional:\n${additionalContext}` : null,
  ].filter(v => v !== null).join('\n');

  const warnings = [];
  if (!r.name)             warnings.push('Sin nombre de paciente en la ficha — el borrador queda con [COMPLETAR].');
  if (!r.diagnosis_code)   warnings.push('Sin código CIE-10 registrado — obligatorio en certificados de licencia médica; revísalo antes de firmar.');
  if (age == null)         warnings.push('Sin fecha de nacimiento — la edad queda como [COMPLETAR].');
  if (!encounters.length)  warnings.push('La ficha no tiene sesiones registradas: el proceso terapéutico no se puede describir a partir de los datos.');
  if (!scalesRes.rows.length) warnings.push('Sin escalas aplicadas — el informe no incluye medición objetiva.');
  warnings.push('Borrador generado por IA a partir de los datos de la ficha. Puede contener errores u omisiones: revísalo y corrígelo antes de usarlo o firmarlo.');

  return { contextData, warnings };
}

/**
 * Enruta /api/psych/reports/*. Devuelve null cuando no corresponde.
 *
 * @param {string} rawPath                  Ruta normalizada.
 * @param {string} method                   Método HTTP.
 * @param {object} event                    Evento Lambda (body).
 * @param {object} tokenPayload             Payload JWT verificado.
 * @param {import('pg').PoolClient} client  Cliente de BD activo.
 */
export async function handleReports(rawPath, method, event, tokenPayload, client) {
  const log = getLogger();

  // ── GET /api/psych/reports/job/{jobId} ─────────────────────────────────────
  const jobMatch = rawPath.match(/^\/api\/psych\/reports\/job\/([0-9a-f-]{36})$/);
  if (jobMatch) {
    if (method !== 'GET') return response(405, { message: 'Método no permitido' });
    if (!JOB_ID_PATTERN.test(jobMatch[1])) return response(400, { message: 'jobId inválido' });

    const job = await getJob(jobMatch[1]);
    if (!job || job.type !== 'report-draft') return response(404, { message: 'Trabajo no encontrado' });
    if (Number(job.userId) !== Number(tokenPayload.sub))
      return response(404, { message: 'Trabajo no encontrado' });
    const denied = await denyUnlessRecordAccess(client, job.recordId, tokenPayload);
    if (denied) return denied;

    return response(200, {
      status:         job.status,
      draft:          job.status === 'done'  ? job.result : null,
      error:          job.status === 'error' ? 'No se pudo generar el borrador.' : null,
      reportType:     job.promptType ?? null,
      reportLabel:    job.promptType && Object.prototype.hasOwnProperty.call(REPORT_TYPES, job.promptType)
                        ? REPORT_TYPES[job.promptType] : null,
      warnings:       job.warnings ?? [],
      generatedAt:    job.completedAt ?? null,
      model:          job.model ?? null,
      requiresReview: true,
    });
  }

  // ── POST /api/psych/reports/draft ──────────────────────────────────────────
  if (rawPath !== '/api/psych/reports/draft') return null;
  if (method !== 'POST') return response(405, { message: 'Método no permitido' });

  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.body); }
    catch { return response(400, { message: 'JSON inválido en el cuerpo de la petición' }); }
  }

  const recordId   = parseInt(body.recordId, 10);
  const reportType = typeof body.reportType === 'string' ? body.reportType : '';
  if (!Number.isInteger(recordId) || !reportType)
    return response(400, { message: 'recordId y reportType requeridos' });

  // S1 — hasOwnProperty, no truthy: `constructor`/`toString`/`__proto__` no pasan.
  if (!Object.prototype.hasOwnProperty.call(REPORT_TYPES, reportType))
    return response(400, { message: `reportType inválido: ${reportType}` });

  const denied = await denyUnlessRecordAccess(client, recordId, tokenPayload);
  if (denied) return denied;

  const rate = reportRateLimit(String(tokenPayload.sub));
  if (!rate.allowed)
    return response(429, { message: `Demasiadas solicitudes. Reintenta en ${rate.waitSeconds} segundos.` });

  const ctx = await buildContext(client, recordId, wrapAdditionalContext(body.additionalContext));
  if (!ctx) return response(404, { message: 'Registro no encontrado' });

  const jobId = await enqueueJob({
    type:        'report-draft',
    recordId,
    userId:      tokenPayload.sub,
    contextData: ctx.contextData,
    promptType:  reportType,
    warnings:    ctx.warnings,
  });

  log.info('Report draft queued', { recordId, reportType, jobId });
  return response(202, {
    jobId,
    status:         'pending',
    reportType,
    reportLabel:    REPORT_TYPES[reportType],
    warnings:       ctx.warnings,
    requiresReview: true,
  });
}
