// Proxies /api/book/* requests to the dairi-book Lambda function URL.
// Runs BEFORE JWT auth so public booking pages work without a token.

import { getLogger } from '../lib/logger.mjs';
import { response }  from '../lib/response.mjs';

/**
 * Forward the request to the dairi-book Lambda function URL.
 * Returns null when the path does not start with /api/book (caller should proceed).
 *
 * @param {object} event Lambda event.
 * @returns {Promise<object|null>} HTTP response or null.
 */
export async function handleBookingProxy(event) {
  const rawPath = event.rawPath || event.path || '';
  if (!rawPath.startsWith('/api/book')) return null;

  const log        = getLogger();
  const bookFnUrl  = process.env.BOOK_FUNCTION_URL;
  if (!bookFnUrl) return response(503, { message: 'Servicio de agenda no configurado' });

  const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();
  log.info('Book proxy', { method, path: rawPath });

  try {
    const qs    = event.queryStringParameters ?? {};
    const qsStr = Object.keys(qs).length > 0 ? '?' + new URLSearchParams(qs).toString() : '';
    let bodyFwd = undefined;
    if (method !== 'GET' && method !== 'OPTIONS' && event.body) {
      bodyFwd = typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
    }

    const bookRes  = await fetch(bookFnUrl + rawPath + qsStr, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    bodyFwd,
    });
    const bookData = await bookRes.json();
    return response(bookRes.status, bookData);
  } catch (err) {
    log.error('Book proxy error', { message: err.message });
    return response(502, { message: 'Error en servicio de agendamiento' });
  }
}
