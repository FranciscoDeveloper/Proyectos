// Cola de trabajos de IA entre `dairi-bff` (dentro de la VPC) y `dairi-ai-worker`
// (fuera de la VPC), sobre la tabla DynamoDB `dairi-ai-jobs`.
//
// ── Por qué existe esta indirección ──────────────────────────────────────────
// `dairi-bff` está adjunta a la VPC para hablar con RDS, y esa VPC no tiene NAT
// Gateway ni VPC Endpoint de Bedrock (solo los Gateway Endpoints gratuitos de S3 y
// DynamoDB). Una llamada a Bedrock desde aquí no falla: se queda colgada hasta el
// timeout de la Lambda. La misma restricción ya está documentada en
// handlers/clinicalHandler.mjs para el resumen narrativo, que se resuelve leyendo una
// columna que generó otra Lambda fuera de la VPC.
//
// Un VPC Endpoint de Interface para Bedrock lo arreglaría, pero es de pago mensual; se
// eligió deliberadamente la vía gratuita.
//
// ── El flujo ─────────────────────────────────────────────────────────────────
//   1. El BFF reúne el contexto desde RDS (rápido, RDS sí es alcanzable) y escribe un
//      ítem `status:'pending'` en `dairi-ai-jobs` por el Gateway Endpoint de DynamoDB.
//      Responde 202 con el `jobId`.
//   2. El stream de DynamoDB (NEW_IMAGE) dispara `dairi-ai-worker`, que no está en la
//      VPC y sí alcanza Bedrock. Escribe `status:'done'` + `result`, o `status:'error'`.
//   3. El frontend hace polling sobre `GET .../job/{jobId}`, que lee el mismo ítem.
//
// Es el mismo patrón que ya usa la app para el audio (S3 → `transcribe-nova-3` fuera de
// la VPC → resultado que otro paso persiste), con DynamoDB en vez de S3 porque el
// contexto es texto estructurado y hace falta un estado consultable.
//
// ── Retención ────────────────────────────────────────────────────────────────
// El ítem transporta texto clínico (contexto del paciente y el borrador generado).
// Lleva `ttl` a ~1 hora para que DynamoDB lo borre solo: es una cola de paso, no un
// almacén. Nada de esto se guarda en RDS.

import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall }                           from '@aws-sdk/util-dynamodb';
import { randomUUID }                                     from 'node:crypto';

const dynamo     = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const JOBS_TABLE = process.env.AI_JOBS_TABLE || 'dairi-ai-jobs';

/** Vida del ítem en la tabla. Suficiente para el polling del navegador y su reintento. */
const JOB_TTL_SECONDS = 60 * 60;

/** Formato de `jobId` aceptado en la URL de consulta (UUID v4 en minúsculas). */
export const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Encola un trabajo para el worker y devuelve su id.
 *
 * @param {object} job
 * @param {'pre-session-brief'|'report-draft'} job.type Qué debe generar el worker.
 * @param {number} job.recordId    clinical_record.id — se re-verifica al consultar.
 * @param {number} job.userId      `sub` del JWT — dueño del trabajo.
 * @param {string} job.contextData Texto ya armado desde RDS. El worker no alcanza RDS,
 *                                 así que esto es TODO lo que va a tener.
 * @param {string} [job.promptType] Tipo de informe, solo para 'report-draft'.
 * @param {string[]} [job.warnings] Avisos calculados desde los datos (huecos, faltantes).
 * @returns {Promise<string>} jobId.
 */
export async function enqueueJob({ type, recordId, userId, contextData, promptType, warnings }) {
  const jobId = randomUUID();
  const item  = {
    jobId,
    type,
    status:      'pending',
    recordId:    Number(recordId),
    userId:      Number(userId),
    contextData: String(contextData ?? ''),
    createdAt:   new Date().toISOString(),
    ttl:         Math.floor(Date.now() / 1000) + JOB_TTL_SECONDS,
  };
  if (promptType) item.promptType = String(promptType);
  if (warnings?.length) item.warnings = warnings.map(String);

  await dynamo.send(new PutItemCommand({
    TableName: JOBS_TABLE,
    Item:      marshall(item, { removeUndefinedValues: true }),
  }));

  return jobId;
}

/**
 * Lee un trabajo. Devuelve null cuando no existe (o ya expiró por TTL).
 *
 * @param {string} jobId
 * @returns {Promise<object|null>}
 */
export async function getJob(jobId) {
  const { Item } = await dynamo.send(new GetItemCommand({
    TableName: JOBS_TABLE,
    Key:       marshall({ jobId }),
  }));
  return Item ? unmarshall(Item) : null;
}
