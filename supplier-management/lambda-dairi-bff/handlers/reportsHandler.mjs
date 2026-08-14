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

/**
 * ¿La especialidad dueña de estos informes codifica el diagnóstico en CIE-10?
 *
 * No. Este handler cuelga sólo de `/api/psych/reports/draft` y la ficha psicológica no
 * tiene campo de código: se le quitó a propósito en el commit 6cb84330 ("psicología no
 * codifica el diagnóstico"). La columna `clinical_record.diagnosis_code` sigue existiendo
 * porque el resto de las especialidades la usan, pero para psicología está vacía siempre.
 *
 * Por eso `diagnosis_code IS NULL` aquí no significa "el profesional olvidó rellenarlo"
 * sino "este tipo de ficha no tiene dónde rellenarlo", y el aviso que salía con ese texto
 * iba a dispararse en el 100 % de los informes de psicología, para siempre. Un aviso que
 * siempre sale no informa de nada y enseña a saltarse la lista completa.
 *
 * Si otra especialidad monta su propio endpoint sobre este handler, esto pasa a ser un
 * parámetro: la distinción que importa es "no tiene el campo" (no avisar) frente a "tiene
 * el campo y está vacío" (avisar, es un hueco real que el profesional puede llenar).
 */
const SPECIALTY_CODES_DIAGNOSES = false;

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

/**
 * Renderiza las escalas en DOS bloques separados y encabezados, en vez de una lista con
 * la marca "vigente"/"anterior" incrustada en cada línea.
 *
 * La marca por línea no bastó: nova-lite leyó "GAD-7 — aplicación anterior: 14 puntos" y
 * escribió el informe como si 14 fuera el valor histórico y el actual faltara
 * ("Última aplicación: [COMPLETAR]"), e hizo lo mismo con PHQ-9 citando el 9 antiguo.
 * Separar físicamente los dos grupos elimina la ambigüedad: para el estado actual sólo
 * hay un bloque donde mirar.
 *
 * @param {Array<{code:string,name:string,total_score:number,severity:string,administered_at:*,rn:number}>} rows
 * @param {(d:*) => string} fmtDate
 */
function renderScales(rows, fmtDate) {
  if (!rows.length) return 'Escalas aplicadas: ninguna registrada.';

  const line = s => `- ${s.code} (${s.name}): ${s.total_score} puntos, severidad ${s.severity}, aplicada el ${fmtDate(s.administered_at)}`;
  // Number(): la consulta ya castea `rn` a int, pero comparar el valor crudo dejaría el
  // bloque de escalas vacío en silencio si ese cast se pierde en una edición futura.
  const current  = rows.filter(s => Number(s.rn) === 1);
  const previous = rows.filter(s => Number(s.rn) === 2);

  // Los encabezados se redactan como etiquetas de datos y no como órdenes en mayúsculas:
  // una versión anterior decía "ESCALAS — ESTADO ACTUAL. Estos son los valores vigentes:
  // úsalos SIEMPRE que..." y el modelo la copiaba tal cual como título de una sección del
  // informe, o directamente perdía los datos y escribía que no se habían proporcionado.
  const blocks = [
    'Escalas aplicadas — resultado más reciente de cada escala (este es el estado actual ' +
    `del paciente):\n${current.map(line).join('\n')}`,
  ];

  if (previous.length) {
    blocks.push(
      'Escalas — resultado de la aplicación anterior de cada escala (sólo para comparar la ' +
      `evolución; no es el estado actual):\n${previous.map(line).join('\n')}`
    );
  }

  return blocks.join('\n\n');
}

/**
 * Campos que la ficha psicológica no contiene en absoluto. Declararlos como ausentes es lo
 * que hace que el modelo escriba `[COMPLETAR]` en vez de rellenarlos: la regla genérica
 * "escribe [COMPLETAR] donde falte información" no bastaba porque el modelo no tenía forma
 * de saber que faltaban — el silencio del contexto se leía como permiso para redactar.
 * Con el código CIE-10 declararlo explícitamente fue justo lo que detuvo la invención.
 */
const ABSENT_FIELDS =
  'DATOS QUE NO EXISTEN EN ESTA FICHA (no hay ninguna información sobre ellos; escribe ' +
  '[COMPLETAR] en cada sección del documento que los pida, y no los deduzcas del resto):\n' +
  '- Motivo de derivación y quién deriva o solicita el informe.\n' +
  '- Institución, tribunal o establecimiento destinatario y el número de causa o expediente.\n' +
  '- Antecedentes familiares, escolares, laborales y de tratamientos previos.\n' +
  '- Resultados de instrumentos distintos de las escalas listadas más arriba.\n\n' +
  'Esta lista describe únicamente la FICHA CLÍNICA. Si más abajo hay un bloque "Contexto ' +
  'aportado por el profesional", esa es una fuente distinta y posterior: cualquier dato que ' +
  'ese contexto sí entregue (por ejemplo, quién solicita el informe y por qué) YA NO está ' +
  'ausente — úsalo, no escribas [COMPLETAR] para algo que el contexto acaba de darte.';

/**
 * Reúne desde RDS el bloque de datos del paciente y los avisos derivados de sus huecos.
 *
 * `reportType` sólo se usa para redactar los avisos: el aviso del código CIE-10 afirma
 * una obligación legal que únicamente rige para el certificado de licencia médica, y
 * salía en los cuatro tipos de informe. Un aviso que no aplica al documento que se está
 * redactando enseña a ignorar la lista de avisos completa, que es justo lo contrario de
 * lo que debe conseguir.
 */
async function buildContext(client, recordId, additionalContext, reportType) {
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
    // Últimas DOS aplicaciones de CADA escala, no las seis últimas en total.
    //
    // El `ORDER BY administered_at DESC LIMIT 6` anterior mezclaba varias aplicaciones de
    // la misma escala sin decir cuál era la vigente: la ficha 59 tiene PHQ-9 = 0 (ninguna),
    // 9 (leve) y 17 (moderada-grave), y el modelo redactaba "severidad leve a moderada-grave
    // en diferentes momentos" o citaba directamente un puntaje viejo como estado actual.
    // Con la ventana por `code` cada escala aporta su valor vigente y, como mucho, el
    // anterior — que se etiqueta como tal para poder describir el cambio sin confundirlo
    // con el presente.
    client.query(
      // `::int` no es cosmético: ROW_NUMBER() devuelve bigint y node-postgres entrega los
      // bigint como STRING para no perder precisión, así que `rn === 1` era false para
      // todas las filas y el filtro las descartaba enteras.
      `SELECT code, name, total_score, severity, administered_at, rn
         FROM (
           SELECT t.code, t.name, i.total_score, i.severity, i.administered_at,
                  (ROW_NUMBER() OVER (PARTITION BY t.code ORDER BY i.administered_at DESC))::int AS rn
             FROM scale_instance i
             JOIN scale_template t ON t.id = i.template_id
            WHERE i.record_id = $1 AND i.total_score IS NOT NULL
         ) s
        WHERE rn <= 2
        ORDER BY code, rn`,
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
  // `patient.gender` guarda el value en inglés del <select> del formulario
  // (male/female/other) — sin traducir, el modelo lo citaba tal cual en el
  // borrador ("Género: female").
  const GENDER_ES = { male: 'Masculino', female: 'Femenino', other: 'Otro' };

  const contextData = [
    `Nombre: ${r.name ?? '[COMPLETAR]'}`,
    age != null ? `Edad: ${age} años` : 'Fecha de nacimiento: [COMPLETAR]',
    r.gender ? `Género: ${GENDER_ES[r.gender] ?? r.gender}` : null,
    r.diagnosis_code || r.diagnosis_label
      ? `Diagnóstico: ${[r.diagnosis_code, r.diagnosis_label].filter(Boolean).join(' — ')}`
      : 'Diagnóstico: [COMPLETAR]',
    // Decirle al modelo, explícitamente, que el código no existe. Antes el contexto
    // simplemente no lo mencionaba, y el modelo trataba el silencio como un hueco que
    // debía rellenar: inventó "F10.2" (dependencia del alcohol) para una ansiedad.
    // Un hueco declarado se puede respetar; uno tácito, no.
    !r.diagnosis_code
      ? 'Código CIE-10: NO DISPONIBLE. Esta ficha no registra codificación diagnóstica y en los ' +
        'datos entregados no hay ningún código CIE-10. No existe un código que puedas citar.'
      : null,
    // "Diagnóstico diferencial" a secas se leía como conclusión: la ficha dice "Descartar
    // trastorno depresivo mayor comórbido" y el informe salía con "Se descartó un Trastorno
    // Depresivo Mayor comórbido", que afirma lo contrario. La etiqueta lleva el estado.
    r.differential_dx
      ? `Diagnóstico diferencial (hipótesis PENDIENTES de descartar, no confirmadas ni ` +
        `descartadas): ${r.differential_dx}`
      : null,
    `Número de sesiones registradas: ${encounters.length}`,
    '',
    r.soap_subjective ? `Relato del paciente (subjetivo): ${r.soap_subjective}` : null,
    r.soap_objective  ? `Observación clínica (objetivo): ${r.soap_objective}`   : null,
    r.soap_assessment ? `Análisis clínico: ${r.soap_assessment}`                : null,
    r.soap_plan       ? `Plan de tratamiento: ${r.soap_plan}`                   : null,
    '',
    renderScales(scalesRes.rows, fmtDate),
    tasksRes.rows.length
      ? `Trabajo intersesión: ${tasksRes.rows.map(t => `${t.description} (${t.completed ? 'completada' : 'pendiente'})`).join('; ')}`
      : null,
    '',
    ABSENT_FIELDS,
    additionalContext ? `\nContexto aportado por el profesional:\n${additionalContext}` : null,
  ].filter(v => v !== null).join('\n');

  const warnings = [];
  if (!r.name)             warnings.push('Sin nombre de paciente en la ficha — el borrador queda con [COMPLETAR].');

  // El aviso del CIE-10 sólo tiene sentido si la especialidad tiene el campo y quedó vacío.
  // En psicología no existe el campo (ver SPECIALTY_CODES_DIAGNOSES), así que el único caso
  // que hay que decir es el del certificado de licencia médica, donde el código sí se exige
  // por fuera de la ficha: no es "te faltó rellenarlo", es "lo tienes que escribir tú".
  if (!r.diagnosis_code) {
    if (SPECIALTY_CODES_DIAGNOSES)
      warnings.push('Sin código CIE-10 registrado en la ficha — el borrador cita el diagnóstico sin codificar.');
    else if (reportType === 'licencia')
      warnings.push('La ficha psicológica no registra código CIE-10 y el certificado de licencia médica lo exige: ' +
                    'el borrador lo deja como [CÓDIGO CIE-10 NO DISPONIBLE] y debes escribirlo tú antes de emitirlo.');
  }

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

  // `wrapAdditionalContext` devuelve null cuando el profesional no escribió nada, y ese
  // null viaja hasta el worker: sin bloque, el prompt de sistema ni siquiera nombra la
  // etiqueta <contexto_profesional>. Mencionarla cuando no había contenido que envolver
  // hacía que el modelo la escribiera en la salida con texto inventado atribuido a un
  // "profesional derivante" que no existe.
  const professionalContext = wrapAdditionalContext(body.additionalContext);

  const ctx = await buildContext(client, recordId, professionalContext, reportType);
  if (!ctx) return response(404, { message: 'Registro no encontrado' });

  const jobId = await enqueueJob({
    type:        'report-draft',
    recordId,
    userId:      tokenPayload.sub,
    contextData: ctx.contextData,
    promptType:  reportType,
    warnings:    ctx.warnings,
    hasProfessionalContext: professionalContext !== null,
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
