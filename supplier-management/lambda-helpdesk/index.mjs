import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import jwt from "jsonwebtoken";

const sqs        = new SQSClient({ region: process.env.AWS_REGION || "sa-east-1" });
const QUEUE_URL  = process.env.SQS_QUEUE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const MAX_CHARS  = 500;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body:    JSON.stringify(body),
  };
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "UNKNOWN";

  if (method === "OPTIONS") return response(204, null);

  if (method !== "POST") return response(405, { message: "Método no permitido" });

  // ── JWT verification ────────────────────────────────────────────────────────
  const authHeader = event.headers?.["authorization"] || event.headers?.["Authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) return response(401, { message: "Token requerido" });

  let tokenPayload;
  try {
    tokenPayload = jwt.verify(authHeader.slice(7), JWT_SECRET);
  } catch {
    return response(401, { message: "Token inválido o expirado" });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return response(400, { message: "Body inválido" });
  }

  const content  = String(body?.content ?? "").trim();
  const userName = String(body?.userName ?? "").trim();

  if (!content) return response(400, { message: "El mensaje no puede estar vacío" });
  if (content.length > MAX_CHARS) {
    return response(400, { message: `El mensaje supera el límite de ${MAX_CHARS} caracteres` });
  }

  // ── Send to SQS ─────────────────────────────────────────────────────────────
  if (!QUEUE_URL) {
    console.error("SQS_QUEUE_URL not configured");
    return response(500, { message: "Servicio no configurado" });
  }

  const messageBody = JSON.stringify({
    userId:    tokenPayload.sub,
    userEmail: tokenPayload.email,
    userName,
    content,
    timestamp: new Date().toISOString(),
    source:    "dairi-helpdesk",
  });

  try {
    const result = await sqs.send(new SendMessageCommand({
      QueueUrl:    QUEUE_URL,
      MessageBody: messageBody,
      MessageAttributes: {
        UserId:    { DataType: "Number", StringValue: String(tokenPayload.sub) },
        UserEmail: { DataType: "String", StringValue: tokenPayload.email ?? "" },
      },
    }));

    console.log("Message queued", { messageId: result.MessageId, userId: tokenPayload.sub });

    return response(200, {
      messageId: result.MessageId,
      status:    "queued",
    });
  } catch (err) {
    console.error("SQS send failed", { message: err.message });
    return response(500, { message: "Error al encolar el mensaje" });
  }
};
