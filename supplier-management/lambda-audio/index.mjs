import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const BUCKET = process.env.AUDIO_BUCKET || "budget-riquelmetapia";
const s3     = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

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
    try {
      const body     = JSON.parse(event.body || "{}");
      const { filename, mimeType, entityKey, recordId, duration } = body;

      if (!filename || !mimeType) {
        return resp(400, { message: "filename y mimeType son requeridos." });
      }

      const id  = randomUUID();
      const key = `recordings/${filename}`;

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
    try {
      const body = JSON.parse(event.body || "{}");
      const { key, id, filename, entityKey, recordId, duration } = body;

      if (!key) {
        return resp(400, { message: "key es requerido." });
      }

      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: key }),
        { expiresIn: 604800 } // 7 días
      );

      return resp(201, {
        id:        id || randomUUID(),
        url,
        filename:  filename || key.split("/").pop(),
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
