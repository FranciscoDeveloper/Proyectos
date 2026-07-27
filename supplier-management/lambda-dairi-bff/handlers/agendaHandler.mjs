// Handles the internal calendar for agenda ("Starter" free plan) accounts.
//
// Agenda accounts (tokenPayload.accountType === 'agenda') live 100% in DynamoDB and
// have NO Postgres presence. This handler serves their appointments straight from the
// dairi-agenda-appointments table — it never touches the pg pool or crudService.
//
// Table dairi-agenda-appointments: PK professionalId (= the account's accountId, taken
// from the JWT sub) + SK appointmentId (uuid). All queries are scoped to the caller's
// own accountId, so an agenda account can only ever see/edit its own agenda — there is
// no cross-tenant path here. Scan is intentionally NOT used (and not granted by IAM):
// every read is a Query by partition key.
//
// The returned object shape mirrors the Postgres `appointments` entity (see
// config/entities.mjs) so the generic frontend calendar/list/form need no changes.

import { DynamoDBClient, QueryCommand, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { randomUUID }           from 'crypto';
import { getLogger }            from '../lib/logger.mjs';
import { response }             from '../lib/response.mjs';

const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const AGENDA_APPTS_TABLE = process.env.AGENDA_APPOINTMENTS_TABLE || 'dairi-agenda-appointments';

// Matches /api/agenda/appointments[/:id] and /api/entities/appointments[/:id]. The
// frontend calls the latter unchanged; agenda tokens are routed here regardless.
const APPTS_RE = /^\/api\/(?:agenda|entities)\/appointments(?:\/([^/]+))?$/;

// Map a stored DynamoDB item to the shape the frontend appointments module expects.
function toClient(item) {
  return {
    id:               item.appointmentId,
    patientId:        item.patientId        ?? null,
    professionalId:   item.professionalId   ?? null,
    status:           item.status           ?? 'scheduled',
    service:          item.service          ?? null,
    modality:         item.modality         ?? null,
    dateTime:         item.dateTime         ?? null,
    durationMinutes:  item.durationMinutes != null ? Number(item.durationMinutes) : null,
    reason:           item.reason           ?? null,
    notes:            item.notes            ?? null,
    meetLink:         item.meetLink         ?? null,
    googleEventId:    null,
    confirmCode:      item.confirmCode      ?? null,
    patientName:      item.patientName      ?? null,
    patientEmail:     item.patientEmail     ?? null,
    patientPhone:     item.patientPhone     ?? null,
    professionalName: item.professionalName ?? null,
    createdAt:        item.createdAt        ?? null,
    updatedAt:        item.updatedAt        ?? null
  };
}

// Whitelist of writable fields coming from the client form.
const WRITABLE = ['patientId', 'status', 'service', 'modality', 'dateTime', 'durationMinutes',
                  'reason', 'notes', 'meetLink', 'confirmCode', 'patientName', 'patientEmail',
                  'patientPhone', 'professionalName'];

function pickWritable(body) {
  const out = {};
  for (const k of WRITABLE) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

/**
 * Dispatch agenda-account calendar routes. Returns null only when the path is NOT an
 * appointments route (the caller then denies by default). Any appointments route always
 * returns a real HTTP response here.
 *
 * @param {string} rawPath
 * @param {string} method
 * @param {object} event         Lambda event.
 * @param {object} tokenPayload  Verified JWT payload (accountType === 'agenda').
 */
export async function handleAgenda(rawPath, method, event, tokenPayload) {
  const log = getLogger();
  const m = rawPath.match(APPTS_RE);
  if (!m) return null;

  const professionalId = String(tokenPayload.sub);   // = the account's accountId
  const id = m[1] ?? null;

  let body = null;
  if (event.body) {
    try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
    catch { return response(400, { message: 'Body inválido: se esperaba JSON' }); }
  }

  try {
    // ── LIST: GET /appointments ───────────────────────────────────────────────
    if (method === 'GET' && !id) {
      const r = await ddb.send(new QueryCommand({
        TableName: AGENDA_APPTS_TABLE,
        KeyConditionExpression: 'professionalId = :p',
        ExpressionAttributeValues: marshall({ ':p': professionalId })
      }));
      const items = (r.Items ?? []).map(i => toClient(unmarshall(i)));
      return response(200, items);
    }

    // ── GET one: GET /appointments/:id ────────────────────────────────────────
    if (method === 'GET' && id) {
      const r = await ddb.send(new GetItemCommand({
        TableName: AGENDA_APPTS_TABLE,
        Key: marshall({ professionalId, appointmentId: id })
      }));
      if (!r.Item) return response(404, { message: 'Cita no encontrada' });
      return response(200, toClient(unmarshall(r.Item)));
    }

    // ── CREATE: POST /appointments ────────────────────────────────────────────
    if (method === 'POST' && !id) {
      const now  = new Date().toISOString();
      const item = {
        professionalId,
        appointmentId: randomUUID(),
        ...pickWritable(body ?? {}),
        status:    (body?.status) ?? 'scheduled',
        createdAt: now,
        updatedAt: now
      };
      await ddb.send(new PutItemCommand({
        TableName: AGENDA_APPTS_TABLE,
        Item: marshall(item, { removeUndefinedValues: true }),
        ConditionExpression: 'attribute_not_exists(appointmentId)'
      }));
      log.info('Agenda appointment created', { professionalId, appointmentId: item.appointmentId });
      return response(201, toClient(item));
    }

    // ── UPDATE: PUT /appointments/:id ─────────────────────────────────────────
    if (method === 'PUT' && id) {
      const cols = pickWritable(body ?? {});
      const sets = ['updatedAt = :u'];
      const values = { ':u': new Date().toISOString() };
      const names = {};
      let n = 0;
      for (const [k, v] of Object.entries(cols)) {
        const nk = `#f${n}`, vk = `:v${n}`;
        names[nk] = k; values[vk] = v; sets.push(`${nk} = ${vk}`); n++;
      }
      const r = await ddb.send(new UpdateItemCommand({
        TableName: AGENDA_APPTS_TABLE,
        Key: marshall({ professionalId, appointmentId: id }),
        UpdateExpression: 'SET ' + sets.join(', '),
        ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
        ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
        ConditionExpression: 'attribute_exists(appointmentId)',
        ReturnValues: 'ALL_NEW'
      }));
      return response(200, toClient(unmarshall(r.Attributes)));
    }

    // ── DELETE: DELETE /appointments/:id ──────────────────────────────────────
    if (method === 'DELETE' && id) {
      await ddb.send(new DeleteItemCommand({
        TableName: AGENDA_APPTS_TABLE,
        Key: marshall({ professionalId, appointmentId: id })
      }));
      return response(200, { success: true, id });
    }

    return response(405, { message: 'Método no permitido' });
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException')
      return response(404, { message: 'Cita no encontrada' });
    log.error('Agenda handler error', { message: err.message, rawPath, method });
    return response(500, { message: 'Error interno del servidor', error: err.message });
  }
}
