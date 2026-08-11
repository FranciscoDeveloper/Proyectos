import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

const BUCKET     = process.env.AUDIO_BUCKET || "budget-riquelmetapia";
const s3         = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const JWT_SECRET = process.env.JWT_SECRET;

// Neither route checked Authorization at all: /presign let anyone upload to
// this bucket and trigger the transcribe+Bedrock pipeline for free, and
// /confirm signed a 7-day GET URL for any `key` the caller supplied — i.e.
// unauthenticated read access to every clinical audio recording (therapy
// sessions included) ever stored here. This is the minimum fix: require the
// same Bearer JWT every other endpoint in this app requires.
function requireAuth(event) {
  const authHeader = event?.headers?.authorization || event?.headers?.Authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7).trim(), JWT_SECRET);
  } catch {
    return null;
  }
}

// La S3 key lleva la especialidad y la ficha en el prefijo:
//   recordings/{entityKey}/{recordId}/{filename}
// `transcribe-nova-3` lee `entityKey` de ahí para elegir el prompt clínico de
// su especialidad (config/ai-prompts.json) sin consultar la BD — esta Lambda no
// está en la VPC y no puede hablar con RDS. `dairi-soap-processor` sigue
// funcionando porque parsea sólo el nombre del archivo (`key.split("/").pop()`),
// no el prefijo.
//
// Además es la única fuente de la key: /confirm ya NO firma la que manda el
// cliente, la reconstruye con esta misma función. Por eso cada segmento se
// sanitiza: sin esto, un `entityKey` con "../" dejaría firmar objetos fuera del
// propio prefijo. Se conservan las tildes y la ñ porque el nombre del archivo
// codifica el nombre del paciente y del profesional, y `dairi-soap-processor`
// los usa para encontrar la ficha.
function segment(value, fallback) {
  const clean = String(value ?? "")
    .replace(/[/\\]/g, "_")   // nada de separadores de ruta
    .replace(/\.\.+/g, ".")   // nada de traversal
    .trim();
  return clean || fallback;
}

function buildKey(entityKey, recordId, filename) {
  const id = Number.parseInt(String(recordId ?? ""), 10);
  return [
    "recordings",
    segment(entityKey, "unknown"),
    Number.isFinite(id) && id > 0 ? String(id) : "unknown",
    segment(filename, "audio.webm"),
  ].join("/");
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age":       "86400",
};

function resp(status, body) {
  return {
    statusCode: status,
    headers:    { "Content-Type": "application/json", ...CORS },
    body:       JSON.stringify(body),
  };
}

export const handler = async (event) => {
  const method  = event.requestContext?.http?.method ?? "POST";
  const rawPath = event.rawPath ?? event.path ?? "";

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  // ── POST /api/audio-recordings/presign ────────────────────────────────────
  // Genera una presigned PUT URL para que el browser suba directo a S3.
  // El binario nunca pasa por Lambda, eliminando el límite de 6 MB.
  if (rawPath.endsWith("/presign") && method === "POST") {
    if (!requireAuth(event)) return resp(401, { message: "Token de autenticación requerido o inválido." });
    try {
      const body     = JSON.parse(event.body || "{}");
      const { filename, mimeType, entityKey, recordId, duration } = body;

      if (!filename || !mimeType) {
        return resp(400, { message: "filename y mimeType son requeridos." });
      }

      // entityKey/recordId no son obligatorios a propósito: el SPA se sirve por
      // CloudFront y un cliente con el bundle viejo en caché podría no mandarlos.
      // Cae a "unknown" y `transcribe-nova-3` usa el prompt `default`.
      const id  = randomUUID();
      const key = buildKey(entityKey, recordId, filename);

      // IMPORTANTE: no firmar Metadata (x-amz-meta-*) en la URL presignada.
      // El browser sólo envía Content-Type en el PUT; si la firma incluye
      // headers x-amz-meta-* que el browser no manda, S3 rechaza con 403
      // SignatureDoesNotMatch y el navegador lo reporta como "0 Unknown Error".
      // Los metadatos (entityKey, recordId, duration) se persisten en /confirm.
      const presignedUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket:      BUCKET,
          Key:         key,
          ContentType: mimeType,
        }),
        { expiresIn: 900 } // válida 15 minutos
      );

      return resp(200, { presignedUrl, key, id });

    } catch (err) {
      console.error("Presign error:", err.message);
      return resp(500, { message: "Error generando URL de subida.", detail: err.message });
    }
  }

  // ── POST /api/audio-recordings/confirm ────────────────────────────────────
  // Llamado por el frontend tras el PUT exitoso a S3.
  // Genera la presigned GET URL de reproducción y devuelve el resultado final.
  if (rawPath.endsWith("/confirm") && method === "POST") {
    if (!requireAuth(event)) return resp(401, { message: "Token de autenticación requerido o inválido." });
    try {
      const body = JSON.parse(event.body || "{}");
      const { id, filename, entityKey, recordId, duration } = body;

      // `key` del body se IGNORA deliberadamente (antes se firmaba tal cual).
      // Firmar la key del cliente convertía este endpoint en un lector universal
      // del bucket: con un JWT cualquiera — el de una cuenta de prueba propia —
      // se podía pedir una GET firmada de 7 días para el audio de la sesión de
      // psicoterapia de otro profesional, sólo adivinando su ruta. La key se
      // reconstruye con los mismos datos que usó /presign, así que un llamador
      // sólo puede firmar dentro de su propio {entityKey}/{recordId}.
      if (!filename) {
        return resp(400, { message: "filename es requerido." });
      }

      const key = buildKey(entityKey, recordId, filename);

      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: key }),
        { expiresIn: 604800 } // 7 días
      );

      return resp(201, {
        id:        id || randomUUID(),
        url,
        key,
        filename:  filename,
        duration:  parseInt(String(duration || 0)),
        entityKey: entityKey || "",
        recordId:  parseInt(String(recordId || 0)),
      });

    } catch (err) {
      console.error("Confirm error:", err.message);
      return resp(500, { message: "Error confirmando subida.", detail: err.message });
    }
  }

  return resp(404, { message: "Ruta no encontrada." });
};
