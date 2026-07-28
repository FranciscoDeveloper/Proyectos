// Sincronizado con el código realmente desplegado en AWS (función dairi-helpdesk) el
// 2026-07-28, descargado directo del paquete en ejecución — la versión anterior de este
// archivo (basada en SQS) llevaba tiempo desincronizada de lo que corre en producción:
// alguien desplegó esta reimplementación directo a DynamoDB sin subir el cambio a git.
// La ruta real /api/helpdesk/message no pasa por SQS en absoluto (confirmado: cero
// referencias a @aws-sdk/client-sqs en el bundle desplegado). El par
// dairi-helpdesk-messages (SQS) + dairi-helpdesk-worker sigue existiendo pero no recibe
// tráfico de este Lambda — evalúa si conviene desmantelarlo.
//
// Nota: maneja también /api/chat/messages (GET/POST), pero API Gateway rutea esos paths
// a dairi-bff (chatHandler.mjs), así que esas dos ramas están efectivamente inactivas en
// producción — se dejan tal cual están desplegadas, sin recortar, para no divergir de
// lo que realmente corre.

import {
  DynamoDBClient, PutItemCommand, ScanCommand
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import jwt from "jsonwebtoken";

const dynamo     = new DynamoDBClient({ region: "us-east-1" });
const TABLE      = process.env.HELPDESK_TABLE || "dairi-helpdesk";
const JWT_SECRET = process.env.JWT_SECRET || "dairi-secret-key-2026";
const MAX_CHARS  = 500;

// In-memory rate limiter — persists across warm invocations
const _rateMap    = new Map();
const RATE_WINDOW = 5 * 60_000;
const RATE_LIMIT  = 5;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "https://dairi.cl",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body:    JSON.stringify(body),
  };
}

function verifyJwt(event) {
  const authHeader = event.headers?.["authorization"] || event.headers?.["Authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}

export const handler = async (event) => {
  const method  = event.requestContext?.http?.method || event.httpMethod || "UNKNOWN";
  const rawPath = event.rawPath || event.path || "";

  if (method === "OPTIONS") return response(204, null);

  // ── GET /api/chat/messages ──────────────────────────────────────────────────
  if (rawPath === "/api/chat/messages" && method === "GET") {
    const tokenPayload = verifyJwt(event);
    if (!tokenPayload) return response(401, { message: "Token requerido o inválido" });

    const convId = event.queryStringParameters?.conversationId;
    if (!convId) return response(400, { message: "conversationId requerido" });

    try {
      const result = await dynamo.send(new ScanCommand({
        TableName:                 TABLE,
        FilterExpression:          "conversationId = :cid AND #src = :src",
        ExpressionAttributeNames:  { "#src": "source" },
        ExpressionAttributeValues: marshall({ ":cid": convId, ":src": "dairi-chat" }),
        Limit:                     500,
      }));
      const items = (result.Items ?? [])
        .map(item => unmarshall(item))
        .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
        .slice(-200);
      return response(200, items.map(r => ({
        id:             r.ticketId,
        conversationId: r.conversationId,
        senderId:       Number(r.senderId) || 0,
        senderName:     r.senderName   ?? "",
        senderAvatar:   r.senderAvatar ?? "",
        content:        r.content,
        timestamp:      r.timestamp,
      })));
    } catch (err) {
      console.error("DynamoDB scan chat messages failed", err.message);
      return response(200, []); // chat still opens even if messages fail
    }
  }

  // ── POST /api/chat/messages ─────────────────────────────────────────────────
  if (rawPath === "/api/chat/messages" && method === "POST") {
    const tokenPayload = verifyJwt(event);
    if (!tokenPayload) return response(401, { message: "Token requerido o inválido" });

    let body;
    try {
      body = typeof event.body === "string" ? JSON.parse(event.body) : (event.body ?? {});
    } catch {
      return response(400, { message: "Body inválido" });
    }

    const conversationId = String(body?.conversationId ?? "").trim();
    const content        = String(body?.content        ?? "").trim();
    const senderId       = body?.senderId ?? tokenPayload.sub;
    const senderName     = String(body?.senderName   ?? "").trim();
    const senderAvatar   = String(body?.senderAvatar ?? "").trim();

    if (!conversationId || !content) {
      return response(400, { message: "conversationId y content son requeridos" });
    }

    const ticketId  = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    try {
      await dynamo.send(new PutItemCommand({
        TableName: TABLE,
        Item: marshall({
          ticketId,
          conversationId,
          senderId:     String(senderId ?? "0"),
          senderName,
          senderAvatar,
          content,
          timestamp,
          source:  "dairi-chat",
          status:  "delivered",
        }, { removeUndefinedValues: true }),
      }));
      return response(201, {
        id:             ticketId,
        conversationId,
        senderId:       Number(senderId) || 0,
        senderName,
        senderAvatar,
        content,
        timestamp,
      });
    } catch (err) {
      console.error("DynamoDB write chat message failed", err.message);
      return response(500, { message: "Error al guardar el mensaje" });
    }
  }

  // ── POST /api/helpdesk/message ──────────────────────────────────────────────
  if (rawPath === "/api/helpdesk/message" && method === "POST") {
    const tokenPayload = verifyJwt(event);
    if (!tokenPayload) return response(401, { message: "Token requerido o inválido" });

    const userId = String(tokenPayload.sub);

    // Rate limiting
    const now      = Date.now();
    const rateData = _rateMap.get(userId) ?? { count: 0, windowStart: now };
    if (now - rateData.windowStart > RATE_WINDOW) {
      rateData.count       = 0;
      rateData.windowStart = now;
    }
    if (rateData.count >= RATE_LIMIT) {
      const waitSec = Math.ceil((RATE_WINDOW - (now - rateData.windowStart)) / 1000);
      return response(429, { message: `Demasiados mensajes. Intenta nuevamente en ${waitSec} segundos.` });
    }
    rateData.count++;
    _rateMap.set(userId, rateData);

    let body;
    try {
      body = typeof event.body === "string" ? JSON.parse(event.body) : (event.body ?? {});
    } catch {
      return response(400, { message: "Body inválido" });
    }

    const content  = String(body?.content  ?? "").trim();
    const userName = String(body?.userName ?? "").trim();

    if (!content) return response(400, { message: "El mensaje no puede estar vacío" });
    if (content.length > MAX_CHARS) {
      return response(400, { message: `El mensaje supera el límite de ${MAX_CHARS} caracteres` });
    }

    const item = {
      ticketId:  crypto.randomUUID(),
      source:    "dairi-helpdesk",
      userId,
      userEmail: tokenPayload.email ?? "",
      userName,
      content,
      status:    "open",
      timestamp: new Date().toISOString(),
    };

    try {
      await dynamo.send(new PutItemCommand({
        TableName: TABLE,
        Item:      marshall(item),
      }));
      console.log("Helpdesk message saved", { id: item.ticketId, userId });
      return response(200, { ticketId: item.ticketId, timestamp: item.timestamp, message: "Mensaje recibido" });
    } catch (err) {
      console.error("DynamoDB write helpdesk failed", err.message);
      return response(500, { message: "Error al guardar el mensaje" });
    }
  }

  return response(404, { message: "Ruta no encontrada" });
};
