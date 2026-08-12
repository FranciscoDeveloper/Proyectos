// Psicología — rutas /api/psych/*: tareas intersesión, registro de humor y
// escalas de medición basada en resultados (MBC: PHQ-9, GAD-7).
//
// Todas las rutas que reciben un `recordId` (o que llegan a uno a través de una
// instancia de escala) comprueban la propiedad del registro ANTES de tocar dato
// alguno: `clinical_record.id` es un serial, así que sin ese filtro bastaría con
// cambiar el número de la URL para leer o escribir la ficha de otro profesional.
// El chequeo vive en lib/recordAccess.mjs y responde 404 (no 403) para no revelar
// si el registro existe.
//
// El cliente de BD lo entrega index.mjs desde el pool compartido; este handler no
// abre conexiones propias ni transacciones (ver la nota de C2 más abajo).

import { getLogger }              from '../lib/logger.mjs';
import { response }               from '../lib/response.mjs';
import { denyUnlessRecordAccess } from '../lib/recordAccess.mjs';

/**
 * Suma las respuestas y ubica el total en el rango de severidad del template.
 *
 * @param {Array<{item_id: string, value: number}>} responses Respuestas por ítem.
 * @param {object} scoring Bloque `scoring` del template ({ options, ranges }).
 * @returns {{ total: number, severity: string, label: string }}
 */
function calcScore(responses, scoring) {
  const total = responses.reduce((s, r) => s + (Number(r.value) || 0), 0);
  const range = (scoring?.ranges ?? []).find(r => total >= r.min && total <= r.max);
  return { total, severity: range?.severity ?? 'desconocido', label: range?.label ?? '' };
}

/** Normaliza y valida el arreglo de respuestas recibido del cliente. */
function parseResponses(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out = [];
  for (const r of raw) {
    const itemId = typeof r?.item_id === 'string' ? r.item_id.trim() : '';
    const value  = Number(r?.value);
    if (!itemId || !Number.isInteger(value) || value < 0 || value > 100) return null;
    out.push({ item_id: itemId, value });
  }
  return out;
}

/**
 * Enruta /api/psych/*. Devuelve null cuando la ruta no corresponde a este handler.
 *
 * @param {string} rawPath                     Ruta normalizada de la petición.
 * @param {string} method                      Método HTTP.
 * @param {object} event                       Evento Lambda (body, query string).
 * @param {object} tokenPayload                Payload JWT verificado.
 * @param {import('pg').PoolClient} client     Cliente de BD activo (del pool compartido).
 */
export async function handlePsych(rawPath, method, event, tokenPayload, client) {
  const log    = getLogger();
  const userId = tokenPayload.sub;

  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.body); }
    catch { return response(400, { message: 'JSON inválido en el cuerpo de la petición' }); }
  }

  // ── TAREAS INTERSESIÓN ─────────────────────────────────────────────────────
  // GET    /api/psych/tasks/{recordId}
  // POST   /api/psych/tasks/{recordId}
  // POST   /api/psych/tasks/{recordId}/{taskId}/complete
  // DELETE /api/psych/tasks/{recordId}/{taskId}
  const taskMatch = rawPath.match(/^\/api\/psych\/tasks\/(\d+)(?:\/(\d+)(\/complete)?)?$/);
  if (taskMatch) {
    const recordId = parseInt(taskMatch[1], 10);
    const taskId   = taskMatch[2] ? parseInt(taskMatch[2], 10) : null;
    const complete = !!taskMatch[3];

    const denied = await denyUnlessRecordAccess(client, recordId, tokenPayload);
    if (denied) return denied;

    if (method === 'GET' && !taskId) {
      const { rows } = await client.query(
        `SELECT id, description, due_date, completed, completed_at, patient_note, session_date, created_at
           FROM intersession_task
          WHERE record_id = $1
          ORDER BY completed, created_at DESC`,
        [recordId]
      );
      return response(200, rows);
    }

    if (method === 'POST' && !taskId) {
      const { description, due_date, session_date } = body;
      if (!description?.trim()) return response(400, { message: 'description requerido' });
      const { rows } = await client.query(
        `INSERT INTO intersession_task (record_id, created_by, description, due_date, session_date)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, description, due_date, completed, completed_at, patient_note, session_date, created_at`,
        [recordId, userId, description.trim(), due_date || null,
         session_date || new Date().toISOString().slice(0, 10)]
      );
      log.info('Intersession task created', { recordId, taskId: rows[0].id });
      return response(201, rows[0]);
    }

    if (method === 'POST' && taskId && complete) {
      const { patient_note } = body;
      const { rows } = await client.query(
        `UPDATE intersession_task
            SET completed = true, completed_at = NOW(), patient_note = $1
          WHERE id = $2 AND record_id = $3
        RETURNING id, description, due_date, completed, completed_at, patient_note, session_date, created_at`,
        [patient_note || null, taskId, recordId]
      );
      if (!rows.length) return response(404, { message: 'Tarea no encontrada' });
      return response(200, rows[0]);
    }

    if (method === 'DELETE' && taskId) {
      const { rowCount } = await client.query(
        `DELETE FROM intersession_task WHERE id = $1 AND record_id = $2`,
        [taskId, recordId]
      );
      if (rowCount === 0) return response(404, { message: 'Tarea no encontrada' });
      return response(200, { deleted: true });
    }

    return response(405, { message: 'Método no permitido' });
  }

  // ── REGISTRO DE HUMOR ──────────────────────────────────────────────────────
  // GET  /api/psych/mood/{recordId}
  // POST /api/psych/mood/{recordId}
  const moodMatch = rawPath.match(/^\/api\/psych\/mood\/(\d+)$/);
  if (moodMatch) {
    const recordId = parseInt(moodMatch[1], 10);

    const denied = await denyUnlessRecordAccess(client, recordId, tokenPayload);
    if (denied) return denied;

    if (method === 'GET') {
      const { rows } = await client.query(
        `SELECT id, mood_score, mood_label, note, logged_by, logged_at
           FROM mood_log
          WHERE record_id = $1
          ORDER BY logged_at DESC
          LIMIT 30`,
        [recordId]
      );
      return response(200, rows);
    }

    if (method === 'POST') {
      const score = Number(body.mood_score);
      if (!Number.isInteger(score) || score < 1 || score > 10)
        return response(400, { message: 'mood_score debe ser un entero entre 1 y 10' });
      const { rows } = await client.query(
        `INSERT INTO mood_log (record_id, logged_by, mood_score, mood_label, note)
         VALUES ($1, 'therapist', $2, $3, $4)
         RETURNING id, mood_score, mood_label, note, logged_by, logged_at`,
        [recordId, score, body.mood_label || null, body.note || null]
      );
      return response(201, rows[0]);
    }

    return response(405, { message: 'Método no permitido' });
  }

  // ── ESCALAS MBC ────────────────────────────────────────────────────────────
  // GET  /api/psych/mbc/templates?schemaKey=psych-records
  // Catálogo público entre profesionales: no lleva dato de paciente, solo el
  // cuestionario, así que no hay recordId contra el que comprobar propiedad.
  if (rawPath === '/api/psych/mbc/templates' && method === 'GET') {
    const schemaKey = event.queryStringParameters?.schemaKey;
    const { rows } = await client.query(
      schemaKey
        ? `SELECT id, code, name, description, items, scoring
             FROM scale_template WHERE active = true AND $1 = ANY(schema_keys) ORDER BY code`
        : `SELECT id, code, name, description, items, scoring
             FROM scale_template WHERE active = true ORDER BY code`,
      schemaKey ? [schemaKey] : []
    );
    return response(200, rows);
  }

  // POST /api/psych/mbc/instances  body: { recordId, templateId }
  if (rawPath === '/api/psych/mbc/instances' && method === 'POST') {
    const recordId   = parseInt(body.recordId, 10);
    const templateId = parseInt(body.templateId, 10);
    if (!Number.isInteger(recordId) || !Number.isInteger(templateId))
      return response(400, { message: 'recordId y templateId requeridos' });

    const denied = await denyUnlessRecordAccess(client, recordId, tokenPayload);
    if (denied) return denied;

    const { rows: tpl } = await client.query(
      `SELECT 1 FROM scale_template WHERE id = $1 AND active = true`, [templateId]
    );
    if (!tpl.length) return response(400, { message: 'templateId inválido' });

    const { rows } = await client.query(
      `INSERT INTO scale_instance (record_id, template_id)
       VALUES ($1, $2) RETURNING id, administered_at`,
      [recordId, templateId]
    );
    log.info('Scale instance started', { recordId, templateId, instanceId: rows[0].id });
    return response(201, rows[0]);
  }

  // POST /api/psych/mbc/instances/{id}/responses  body: { responses: [{item_id, value}] }
  const instanceResMatch = rawPath.match(/^\/api\/psych\/mbc\/instances\/(\d+)\/responses$/);
  if (instanceResMatch && method === 'POST') {
    const instanceId = parseInt(instanceResMatch[1], 10);

    const responses = parseResponses(body.responses);
    if (!responses) return response(400, { message: 'responses[] inválido o vacío' });

    // La instancia lleva al recordId: se resuelve primero y se comprueba propiedad
    // antes de escribir nada. Sin esto, el recordId viaja implícito en el id de
    // instancia y el chequeo de /instances quedaría sin efecto para esta ruta.
    const { rows: [inst] } = await client.query(
      `SELECT i.record_id, t.scoring
         FROM scale_instance i
         JOIN scale_template t ON t.id = i.template_id
        WHERE i.id = $1`,
      [instanceId]
    );
    if (!inst) return response(404, { message: 'Instancia no encontrada' });

    const denied = await denyUnlessRecordAccess(client, inst.record_id, tokenPayload);
    if (denied) return denied;

    // C2 — una sola sentencia atómica en lugar del BEGIN/INSERT-en-bucle/COMMIT del
    // diseño original. Aquel `ON CONFLICT DO NOTHING` sin target no deduplicaba nada
    // (solo cubría el PK serial), así que un doble click duplicaba las 9 filas del
    // PHQ-9 — incluido el ítem 9, ideación suicida. Con UNIQUE (instance_id, item_id)
    // el reenvío es last-write-wins y el conteo de filas se mantiene estable.
    // Al no abrir transacción propia tampoco puede dejar el cliente del pool a medio
    // BEGIN si algo falla.
    await client.query(
      `INSERT INTO scale_response (instance_id, item_id, value)
       SELECT $1, x.item_id, x.value
         FROM unnest($2::text[], $3::smallint[]) AS x(item_id, value)
       ON CONFLICT (instance_id, item_id) DO UPDATE SET value = EXCLUDED.value`,
      [instanceId, responses.map(r => r.item_id), responses.map(r => r.value)]
    );

    const { total, severity, label } = calcScore(responses, inst.scoring ?? {});
    await client.query(
      `UPDATE scale_instance SET total_score = $1, severity = $2 WHERE id = $3`,
      [total, severity, instanceId]
    );
    log.info('Scale responses saved', { instanceId, items: responses.length, total, severity });
    return response(200, { instanceId, total, severity, label });
  }

  // GET /api/psych/mbc/trajectory/{recordId}
  const trajectoryMatch = rawPath.match(/^\/api\/psych\/mbc\/trajectory\/(\d+)$/);
  if (trajectoryMatch && method === 'GET') {
    const recordId = parseInt(trajectoryMatch[1], 10);

    const denied = await denyUnlessRecordAccess(client, recordId, tokenPayload);
    if (denied) return denied;

    const { rows } = await client.query(
      `SELECT t.code, t.name, i.id AS instance_id, i.total_score, i.severity, i.administered_at
         FROM scale_instance i
         JOIN scale_template t ON t.id = i.template_id
        WHERE i.record_id = $1 AND i.total_score IS NOT NULL
        ORDER BY i.administered_at`,
      [recordId]
    );

    // Agrupado por escala para que el gráfico dibuje una línea por instrumento.
    const grouped = rows.reduce((acc, r) => {
      if (!acc[r.code]) acc[r.code] = { code: r.code, name: r.name, points: [] };
      acc[r.code].points.push({
        instanceId: r.instance_id,
        score:      r.total_score,
        severity:   r.severity,
        date:       r.administered_at
      });
      return acc;
    }, {});
    return response(200, Object.values(grouped));
  }

  return null;
}
