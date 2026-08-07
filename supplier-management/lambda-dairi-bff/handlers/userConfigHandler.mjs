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

  const log = getLogger();

  // GET → estado de configuración del usuario.
  //
  // Existe para que onboardingGuard pueda recuperarse cuando la caché local no
  // está: hasta ahora la finalización del onboarding vivía SÓLO en localStorage,
  // así que limpiar datos del navegador, cambiar de navegador o entrar desde un
  // segundo dispositivo re-disparaba el onboarding de una cuenta que ya lo había
  // completado. El guard consulta localStorage primero (sin red) y sólo llega
  // aquí en MISS, así que la navegación normal no paga ninguna llamada extra.
  if (method === 'GET') {
    try {
      const { rows } = await client.query(
        `SELECT zk_enabled, onboarding_completed_at
           FROM user_config WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      const row = rows[0];
      return response(200, {
        zkEnabled:             row?.zk_enabled ?? false,
        onboardingCompleted:   row?.onboarding_completed_at != null,
        onboardingCompletedAt: row?.onboarding_completed_at ?? null
      });
    } catch (err) {
      log.error('handleUserConfig GET error', { message: err.message });
      return response(500, { message: 'Error interno del servidor' });
    }
  }

  if (method !== 'PATCH') return response(405, { message: 'Método no permitido' });
  let body  = null;
  if (event.body) {
    try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
    catch { return response(400, { message: 'Body inválido' }); }
  }

  // PATCH parcial: sólo se toca lo que el body trae de verdad.
  //
  // `zkEnabled` se envía como null cuando está ausente para NO pisar el valor
  // guardado. Antes se colapsaba un body sin zkEnabled a `false`, lo que estaba
  // bien mientras el onboarding era el único llamador y siempre lo mandaba; ahora
  // proceed() hace un PATCH sólo con onboardingCompleted, y con la lógica anterior
  // ese segundo PATCH habría desactivado el cifrado ZK que el usuario acababa de
  // activar — silenciosamente y sin borrar su certificado.
  const zkEnabled = typeof body?.zkEnabled === 'boolean' ? body.zkEnabled : null;

  // `onboardingCompleted` sólo puede marcar, nunca desmarcar, y una vez fijado
  // conserva su timestamp original (COALESCE). Cubre el camino "Omitir" del
  // onboarding, que no llega a POST /api/professionals/onboarding y por lo tanto
  // no dejaría rastro server-side: sin esto, quien omite el onboarding lo volvería
  // a ver en cada navegador o dispositivo nuevo.
  const markOnboarded = body?.onboardingCompleted === true;

  try {
    const { rows } = await client.query(
      `INSERT INTO user_config (user_id, zk_enabled, onboarding_completed_at, updated_at)
       VALUES ($1, COALESCE($2::boolean, false),
               CASE WHEN $3::boolean THEN NOW() ELSE NULL END, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         zk_enabled = COALESCE($2::boolean, user_config.zk_enabled),
         onboarding_completed_at = CASE
           WHEN $3::boolean THEN COALESCE(user_config.onboarding_completed_at, NOW())
           ELSE user_config.onboarding_completed_at
         END,
         updated_at = NOW()
       RETURNING zk_enabled, onboarding_completed_at`,
      [userId, zkEnabled, markOnboarded]
    );
    return response(200, {
      zkEnabled:           rows[0].zk_enabled,
      onboardingCompleted: rows[0].onboarding_completed_at != null
    });
  } catch (err) {
    log.error('handleUserConfig error', { message: err.message });
    return response(500, { message: 'Error interno del servidor' });
  }
}
