// lib/auth.mjs
// Single Responsibility: authentication (JWT) and authorization (per-module access).
// No business logic, no DB pooling, no HTTP shaping lives here.

import jwt from 'jsonwebtoken';
import { getLogger } from './logger.mjs';

// Exported so the admin handler (which issues tokens) signs with the same secret.
export const JWT_SECRET = process.env.JWT_SECRET;

// HTTP methods that mutate state; blocked for the 'viewer' role.
const WRITE_METHODS = new Set(['POST', 'PUT', 'DELETE']);

// Roles that bypass the per-module schema check entirely.
const FULL_ACCESS_ROLES = new Set(['admin', 'superadmin']);

/**
 * Extracts and verifies the Bearer token from an API Gateway / Lambda event.
 *
 * @param {object} event - Lambda invocation event.
 * @returns {object} The decoded JWT payload ({ sub, email, role, ... }).
 * @throws {Error} If the header is missing/malformed or the token is invalid/expired.
 */
export function verifyToken(event) {
  const authHeader =
    event?.headers?.['authorization'] ||
    event?.headers?.['Authorization'] ||
    '';

  if (!authHeader.startsWith('Bearer ')) {
    getLogger().warn('Missing or malformed Authorization header');
    throw new Error('Token de autenticación requerido');
  }

  const token = authHeader.slice(7).trim();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    getLogger().info('JWT verified', { sub: payload.sub, role: payload.role });
    return payload;
  } catch (err) {
    getLogger().warn('JWT verification failed', { error: err.message });
    throw new Error('Token inválido o expirado');
  }
}

/**
 * Checks whether a user may perform `method` on the entity identified by
 * `resolvedKey` (with optional `aliasKey` fallback so both the canonical and
 * aliased schema keys match the same app_schema row).
 *
 * Rules:
 *   1. admin / superadmin bypass the per-module check.
 *   2. Otherwise the user must have the schema assigned in user_schema.
 *   3. Write methods (POST/PUT/DELETE) are denied to the 'viewer' role.
 *
 * @param {import('pg').PoolClient} client - Active PostgreSQL client.
 * @param {number|string} userId - Authenticated user id (JWT sub).
 * @param {string} role - Authenticated user role.
 * @param {string} resolvedKey - Canonical schema_key for the entity.
 * @param {string} method - HTTP method of the request.
 * @param {string|null} [aliasKey=null] - Original (un-resolved) schema_key, if different.
 * @returns {Promise<{ allowed: boolean, status?: number, message?: string }>}
 */
export async function authorizeRequest(client, userId, role, resolvedKey, method, aliasKey = null) {
  // 1. Per-module schema check (skipped for full-access roles).
  if (!FULL_ACCESS_ROLES.has(role)) {
    const { rows } = await client.query(
      `SELECT 1
         FROM user_schema us
         JOIN app_schema  s ON s.id = us.schema_id
        WHERE us.user_id   = $1
          AND (s.schema_key = $2 OR ($3::text IS NOT NULL AND s.schema_key = $3))
        LIMIT 1`,
      [userId, resolvedKey, aliasKey]
    );

    if (rows.length === 0) {
      getLogger().warn('Schema access denied', { userId, resolvedKey, aliasKey });
      return { allowed: false, status: 403, message: 'No tienes acceso a este módulo' };
    }
  }

  // 2. Write-method restriction for the viewer role.
  if (role === 'viewer' && WRITE_METHODS.has(method)) {
    getLogger().warn('Write access denied — viewer role', { userId, resolvedKey, method });
    return { allowed: false, status: 403, message: 'Tu rol solo permite consultar registros' };
  }

  return { allowed: true };
}
