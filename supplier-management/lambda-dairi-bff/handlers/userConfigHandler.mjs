// Handles PATCH /api/user/config — persists per-user UI settings (zkEnabled, etc.).

import { getLogger } from '../lib/logger.mjs';
import { response }  from '../lib/response.mjs';

/**
 * Upsert user config in DB.
 * Returns null when the path / method does not match.
 *
 * @param {string}              rawPath   Normalized request path.
 * @param {string}              method    HTTP method.
 * @param {object}              event     Lambda event.
 * @param {string|number}       userId    Authenticated user id (JWT sub).
 * @param {import('pg').PoolClient} client Active DB client.
 */
export async function handleUserConfig(rawPath, method, event, userId, client) {
  if (rawPath !== '/api/user/config') return null;
  if (method !== 'PATCH') return response(405, { message: 'Método no permitido' });

  const log = getLogger();
  let body  = null;
  if (event.body) {
    try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
    catch { return response(400, { message: 'Body inválido' }); }
  }

  const zkEnabled = typeof body?.zkEnabled === 'boolean' ? body.zkEnabled : false;
  try {
    await client.query(
      `INSERT INTO user_config (user_id, zk_enabled, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET zk_enabled = EXCLUDED.zk_enabled, updated_at = NOW()`,
      [userId, zkEnabled]
    );
    return response(200, { zkEnabled });
  } catch (err) {
    log.error('handleUserConfig error', { message: err.message });
    return response(500, { message: 'Error interno del servidor' });
  }
}
