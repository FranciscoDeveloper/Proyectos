// Handles /api/admin/* routes — user management for admin/superadmin roles.

import jwt    from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getLogger }           from '../lib/logger.mjs';
import { response }            from '../lib/response.mjs';
import { JWT_SECRET }          from '../lib/auth.mjs';
import { buildActivationEmail } from '../services/emailService.mjs';

const APP_URL = process.env.APP_URL || 'https://dairi.cl';

/**
 * Dispatch /api/admin/* routes.
 * Returns null when the path does not start with /api/admin.
 *
 * @param {string}              rawPath      Normalized request path.
 * @param {string}              method       HTTP method.
 * @param {object}              event        Lambda event.
 * @param {object}              tokenPayload Verified JWT payload.
 * @param {import('pg').PoolClient} client   Active DB client.
 */
export async function handleAdmin(rawPath, method, event, tokenPayload, client) {
  if (!rawPath.startsWith('/api/admin/')) return null;

  const log = getLogger();

  if (tokenPayload.role !== 'admin' && tokenPayload.role !== 'superadmin') {
    return response(403, { message: 'Acceso denegado' });
  }

  let body = null;
  if (event.body) {
    try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
    catch { return response(400, { message: 'Body inválido' }); }
  }

  // GET /api/admin/users → all users with assigned schemas
  if (rawPath === '/api/admin/users' && method === 'GET') {
    const { rows } = await client.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.avatar,
        u.email_verified, u.created_at,
        COALESCE(
          json_agg(s.schema_key ORDER BY s.schema_key)
          FILTER (WHERE s.schema_key IS NOT NULL), '[]'
        ) AS schemas
      FROM app_user u
      LEFT JOIN user_schema us ON us.user_id = u.id
      LEFT JOIN app_schema  s  ON s.id = us.schema_id
      GROUP BY u.id
      ORDER BY u.id ASC
    `);
    return response(200, rows.map(r => ({
      id:            r.id,
      name:          r.name,
      email:         r.email,
      role:          r.role,
      avatar:        r.avatar ?? null,
      emailVerified: r.email_verified,
      createdAt:     r.created_at,
      schemas:       r.schemas ?? []
    })));
  }

  // PUT /api/admin/users/:id/status → activate (resend activation email) or deactivate
  const statusMatch = rawPath.match(/^\/api\/admin\/users\/(\d+)\/status$/);
  if (statusMatch && method === 'PUT') {
    const userId = parseInt(statusMatch[1], 10);
    const { active } = body ?? {};

    if (active) {
      const { rows } = await client.query(
        'SELECT id, name, email FROM app_user WHERE id = $1', [userId]
      );
      if (!rows.length) return response(404, { message: 'Usuario no encontrado' });
      const user = rows[0];

      const activationToken = jwt.sign(
        { sub: user.id, email: user.email, type: 'activation' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      await client.query(
        'UPDATE app_user SET activation_token = $1 WHERE id = $2',
        [activationToken, userId]
      );

      const activationUrl = `${APP_URL}/#/activate?token=${encodeURIComponent(activationToken)}`;
      const emailPayload  = buildActivationEmail({ name: user.name, email: user.email, activationUrl });
      log.info('Activation email generated', { userId });

      return response(200, { message: 'Email de activación generado', emailPayload, activationUrl });
    } else {
      await client.query(
        'UPDATE app_user SET email_verified = false, activation_token = NULL WHERE id = $1',
        [userId]
      );
      return response(200, { message: 'Usuario desactivado' });
    }
  }

  // PUT /api/admin/users/:id/schemas → replace user schema assignments
  const schemasMatch = rawPath.match(/^\/api\/admin\/users\/(\d+)\/schemas$/);
  if (schemasMatch && method === 'PUT') {
    const userId           = parseInt(schemasMatch[1], 10);
    const { schemaKeys = [] } = body ?? {};

    await client.query('DELETE FROM user_schema WHERE user_id = $1', [userId]);
    if (schemaKeys.length > 0) {
      await client.query(
        `INSERT INTO user_schema (user_id, schema_id)
         SELECT $1, s.id FROM app_schema s WHERE s.schema_key = ANY($2::text[])`,
        [userId, schemaKeys]
      );
    }
    const { rows } = await client.query(
      `SELECT s.schema_key FROM user_schema us
       JOIN app_schema s ON s.id = us.schema_id
       WHERE us.user_id = $1`,
      [userId]
    );
    return response(200, { schemas: rows.map(r => r.schema_key) });
  }

  // PUT /api/admin/users/:id/password → change password
  const passwordMatch = rawPath.match(/^\/api\/admin\/users\/(\d+)\/password$/);
  if (passwordMatch && method === 'PUT') {
    const userId     = parseInt(passwordMatch[1], 10);
    const { password } = body ?? {};
    if (!password || password.length < 8)
      return response(400, { message: 'La contraseña debe tener al menos 8 caracteres' });
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      'UPDATE app_user SET password_hash = $1 WHERE id = $2', [hash, userId]
    );
    return response(200, { message: 'Contraseña actualizada' });
  }

  return response(404, { message: 'Ruta de administración no encontrada' });
}
