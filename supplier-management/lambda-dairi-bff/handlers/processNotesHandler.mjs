// /api/process-notes/{recordId}[/{noteId}] — notas de proceso del terapeuta.
//
// Qué son: el cuaderno de trabajo del profesional (hipótesis, contratransferencia,
// qué probar la sesión que viene), separado de la ficha oficial que otros
// profesionales que atienden al mismo paciente sí pueden leer.
//
// Alcance real de la privacidad — dos filtros distintos, ambos obligatorios:
//
//   1. `denyUnlessRecordAccess` (lib/recordAccess.mjs): la ficha tiene que pertenecer
//      al profesional autenticado. `clinical_record.id` es un serial, así que sin esto
//      bastaría con cambiar el número de la URL para llegar a otra cuenta. Responde
//      404, no 403, para no confirmar que la ficha existe.
//   2. `author_id = $userId` en TODAS las sentencias (SELECT/UPDATE/DELETE). Ese es el
//      filtro que hace que una nota sea **visible solo para el terapeuta que la
//      escribió**, incluso frente a otro profesional que sí tiene acceso legítimo a la
//      misma ficha (clinical_record es una fila compartida por paciente).
//
// El (1) sin el (2) dejaría las notas visibles a cualquier colega con acceso a la
// ficha; el (2) sin el (1) permitiría enumerar fichas ajenas para descubrir cuáles
// existen. Se aplican los dos.
//
// Lo que este módulo NO hace, y por qué se dice explícitamente: no cifra nada. Las
// columnas `content_iv` / `is_encrypted` existen para un cifrado del lado del cliente
// más adelante y hoy se escriben siempre NULL/false. El contenido es legible por quien
// administre la base de datos. La afirmación correcta de cara al usuario es "visible
// solo para el terapeuta que la escribió", y no ninguna otra más fuerte.

import { getLogger }              from '../lib/logger.mjs';
import { response }               from '../lib/response.mjs';
import { denyUnlessRecordAccess } from '../lib/recordAccess.mjs';

/** Tope de longitud por nota. Evita que un pegado accidental infle la fila. */
const MAX_CONTENT_LENGTH = 20_000;

/** `YYYY-MM-DD` o nada: un string libre acabaría en un error de Postgres. */
function normalizeDate(value) {
  if (value == null || value === '') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : undefined;
}

/**
 * Enruta /api/process-notes/*. Devuelve null cuando la ruta no corresponde.
 *
 * @param {string} rawPath                  Ruta normalizada de la petición.
 * @param {string} method                   Método HTTP.
 * @param {object} event                    Evento Lambda (body).
 * @param {object} tokenPayload             Payload JWT verificado ({ sub, role, ... }).
 * @param {import('pg').PoolClient} client  Cliente de BD activo (del pool compartido).
 */
export async function handleProcessNotes(rawPath, method, event, tokenPayload, client) {
  const match = rawPath.match(/^\/api\/process-notes\/(\d+)(?:\/(\d+))?$/);
  if (!match) return null;

  const log      = getLogger();
  const recordId = parseInt(match[1], 10);
  const noteId   = match[2] ? parseInt(match[2], 10) : null;
  const userId   = tokenPayload.sub;

  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.body); }
    catch { return response(400, { message: 'JSON inválido en el cuerpo de la petición' }); }
  }

  // Filtro (1): propiedad de la ficha. Antes de tocar ningún dato.
  const denied = await denyUnlessRecordAccess(client, recordId, tokenPayload);
  if (denied) return denied;

  // GET /api/process-notes/{recordId} — solo las notas escritas por quien pregunta.
  if (method === 'GET' && !noteId) {
    const { rows } = await client.query(
      `SELECT id, session_date, content, is_encrypted, created_at, updated_at
         FROM process_notes
        WHERE record_id = $1 AND author_id = $2
        ORDER BY session_date DESC, id DESC`,
      [recordId, userId]
    );
    return response(200, rows);
  }

  // POST /api/process-notes/{recordId}
  if (method === 'POST' && !noteId) {
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return response(400, { message: 'content requerido' });
    if (content.length > MAX_CONTENT_LENGTH)
      return response(400, { message: `content supera los ${MAX_CONTENT_LENGTH} caracteres` });

    const sessionDate = normalizeDate(body.session_date);
    if (sessionDate === undefined)
      return response(400, { message: 'session_date debe tener formato YYYY-MM-DD' });

    // is_encrypted / content_iv se fuerzan a false / NULL: esta entrega no cifra.
    // Aceptarlos del cliente marcaría filas como cifradas sin estarlo.
    const { rows } = await client.query(
      `INSERT INTO process_notes (record_id, author_id, session_date, content, is_encrypted, content_iv)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, false, NULL)
       RETURNING id, session_date, content, is_encrypted, created_at, updated_at`,
      [recordId, userId, sessionDate, content]
    );
    log.info('Process note created', { recordId, noteId: rows[0].id });
    return response(201, rows[0]);
  }

  // PATCH /api/process-notes/{recordId}/{noteId}
  if (method === 'PATCH' && noteId) {
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return response(400, { message: 'content requerido' });
    if (content.length > MAX_CONTENT_LENGTH)
      return response(400, { message: `content supera los ${MAX_CONTENT_LENGTH} caracteres` });

    const { rows } = await client.query(
      `UPDATE process_notes
          SET content = $1, updated_at = NOW()
        WHERE id = $2 AND record_id = $3 AND author_id = $4
      RETURNING id, session_date, content, is_encrypted, created_at, updated_at`,
      [content, noteId, recordId, userId]
    );
    // Mismo 404 para "no existe" y "no es tuya": la diferencia revelaría que otro
    // profesional tiene una nota en esta ficha.
    if (!rows.length) return response(404, { message: 'Nota no encontrada' });
    return response(200, rows[0]);
  }

  // DELETE /api/process-notes/{recordId}/{noteId}
  if (method === 'DELETE' && noteId) {
    const { rowCount } = await client.query(
      `DELETE FROM process_notes WHERE id = $1 AND record_id = $2 AND author_id = $3`,
      [noteId, recordId, userId]
    );
    if (!rowCount) return response(404, { message: 'Nota no encontrada' });
    log.info('Process note deleted', { recordId, noteId });
    return response(200, { deleted: true });
  }

  return response(405, { message: 'Método no permitido' });
}
