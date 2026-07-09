// Handles /api/chat/* and POST /api/helpdesk/message.
// Persists messages to DynamoDB (HELPDESK_TABLE).

import { DynamoDBClient, PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getLogger }           from '../lib/logger.mjs';
import { response }            from '../lib/response.mjs';
import { createRateLimiter }   from '../lib/rateLimit.mjs';

const dynamoClient   = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const HELPDESK_TABLE = process.env.HELPDESK_TABLE || 'dairi-helpdesk';

// 5 messages per user per 5 minutes — persists across warm invocations.
const helpdeskRateLimit = createRateLimiter({ windowMs: 5 * 60_000, maxRequests: 5 });

/**
 * Dispatch /api/helpdesk/message and /api/chat/* routes.
 * Returns null when the path does not match.
 *
 * @param {string}  rawPath      Normalized request path.
 * @param {string}  method       HTTP method.
 * @param {object}  event        Lambda event (body, queryStringParameters).
 * @param {object}  tokenPayload Verified JWT payload.
 */
export async function handleChat(rawPath, method, event, tokenPayload) {
  const log = getLogger();

  // ── POST /api/helpdesk/message ────────────────────────────────────────────
  if (rawPath === '/api/helpdesk/message' && method === 'POST') {
    let body = null;
    if (event.body) {
      try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
      catch { return response(400, { message: 'Body inválido' }); }
    }

    const content  = String(body?.content  ?? '').trim().slice(0, 500);
    const userName = String(body?.userName ?? tokenPayload.email ?? '').trim();
    const userId   = String(body?.userId   ?? tokenPayload.sub   ?? '0');

    const rateResult = helpdeskRateLimit(userId);
    if (!rateResult.allowed) {
      log.warn('Helpdesk rate limit exceeded', { userId });
      return response(429, { message: `Demasiados mensajes. Intenta nuevamente en ${rateResult.waitSeconds} segundos.` });
    }

    if (!content) return response(400, { message: 'El mensaje no puede estar vacío' });

    const ticketId  = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    try {
      await dynamoClient.send(new PutItemCommand({
        TableName: HELPDESK_TABLE,
        Item: marshall({
          ticketId,
          userId,
          timestamp,
          userEmail: tokenPayload.email ?? '',
          userName,
          content,
          status: 'open',
          source: 'dairi-helpdesk'
        }, { removeUndefinedValues: true })
      }));
      log.info('Helpdesk message persisted', { ticketId, userId });
    } catch (err) {
      log.error('Failed to persist helpdesk message to DynamoDB', { message: err.message, ticketId });
    }
    return response(200, { ticketId, timestamp, message: 'Mensaje recibido' });
  }

  // ── GET /api/chat/users ───────────────────────────────────────────────────
  if (rawPath === '/api/chat/users' && method === 'GET') {
    return null; // DB query — delegated to caller which already has a client
  }

  // ── GET /api/chat/messages ────────────────────────────────────────────────
  if (rawPath === '/api/chat/messages' && method === 'GET') {
    const convId = event.queryStringParameters?.conversationId;
    if (!convId) return response(400, { message: 'conversationId requerido' });
    try {
      const result = await dynamoClient.send(new ScanCommand({
        TableName:                 HELPDESK_TABLE,
        FilterExpression:          'conversationId = :cid AND #src = :src',
        ExpressionAttributeNames:  { '#src': 'source' },
        ExpressionAttributeValues: marshall({ ':cid': convId, ':src': 'dairi-chat' }),
        Limit:                     500
      }));
      const items = (result.Items ?? [])
        .map(item => unmarshall(item))
        .sort((a, b) => a.timestamp < b.timestamp ? -1 : 1)
        .slice(-200);
      return response(200, items.map(r => ({
        id:             r.ticketId,
        conversationId: r.conversationId,
        senderId:       Number(r.senderId) || 0,
        senderName:     r.senderName   ?? '',
        senderAvatar:   r.senderAvatar ?? '',
        content:        r.content,
        timestamp:      r.timestamp
      })));
    } catch (err) {
      log.error('DynamoDB Scan chat messages failed', { message: err.message });
      return response(200, []); // return empty rather than error so chat still opens
    }
  }

  // ── POST /api/chat/messages ───────────────────────────────────────────────
  if (rawPath === '/api/chat/messages' && method === 'POST') {
    let body = null;
    if (event.body) {
      try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
      catch { return response(400, { message: 'Body inválido' }); }
    }
    const { conversationId, senderId, senderName, senderAvatar, content } = body ?? {};
    if (!conversationId || !content)
      return response(400, { message: 'conversationId y content son requeridos' });

    const ticketId  = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    try {
      await dynamoClient.send(new PutItemCommand({
        TableName: HELPDESK_TABLE,
        Item: marshall({
          ticketId,
          conversationId,
          senderId:     String(senderId ?? tokenPayload.sub ?? '0'),
          senderName:   senderName   ?? '',
          senderAvatar: senderAvatar ?? '',
          content,
          timestamp,
          source:  'dairi-chat',
          status:  'delivered'
        }, { removeUndefinedValues: true })
      }));
      return response(201, {
        id:             ticketId,
        conversationId,
        senderId:       Number(senderId ?? tokenPayload.sub ?? 0),
        senderName:     senderName   ?? '',
        senderAvatar:   senderAvatar ?? '',
        content,
        timestamp
      });
    } catch (err) {
      log.error('DynamoDB PutItem chat message failed', { message: err.message });
      return response(500, { message: 'Error al guardar el mensaje' });
    }
  }

  return null; // path not handled here
}
