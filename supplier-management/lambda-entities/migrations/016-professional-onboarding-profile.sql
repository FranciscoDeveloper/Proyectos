-- Migration 016: perfil de onboarding del profesional + precio por consulta.
--
-- Contexto: el módulo /onboarding recolecta nombre, RUT, especialidad, teléfono,
-- duración de consulta, videoconsulta, días disponibles, foto y hasta 4
-- "profesionales extra" — y hasta ahora NADA de eso se persistía. El componente
-- hacía POST a /api/professionals/onboarding, endpoint que no existía en ninguna
-- Lambda ni en API Gateway; el catch se tragaba el error y la UI avanzaba como si
-- hubiera guardado. Esta migración crea las columnas que faltaban para que ese
-- endpoint (ahora implementado en dairi-bff) tenga dónde escribir.
--
-- Además agrega `consultation_price`: lambda-book YA lee un precio por profesional
-- (`prof.consultation_price ?? prof.price ?? CONSULTATION_AMOUNT`, index.mjs ~711)
-- y sólo caía al default plano de 25.000 CLP porque la columna no existía. Es
-- NULLABLE a propósito: un profesional que todavía no fijó precio debe seguir
-- cayendo al default, no romper la reserva.
--
--   NOTA para lambda-book: pg devuelve NUMERIC como *string*, no como number
--   (por eso `ratingFields()` ya hace Number() sobre rating_avg). El cálculo de
--   `amount` se coercionó a entero en el mismo commit que esta migración, porque
--   el monto viaja a Flow como String(amount) y CLP no admite decimales, y además
--   entra en el HMAC del bookingToken.

ALTER TABLE professional
  ADD COLUMN IF NOT EXISTS consultation_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS phone              TEXT,
  ADD COLUMN IF NOT EXISTS rut                TEXT,
  ADD COLUMN IF NOT EXISTS photo_key          TEXT,
  ADD COLUMN IF NOT EXISTS owner_user_id      INTEGER;

-- ── Profesionales "extra" ────────────────────────────────────────────────────
-- Una cuenta puede onboardear hasta 4 profesionales adicionales que NO tienen
-- cuenta de login propia. No pueden compartir el `user_id` del titular porque
-- `professional.user_id` es UNIQUE y, sobre todo, porque dos rutas críticas
-- asumen "un profesional por user_id":
--
--   * profScopeService.resolveProfScope() → SELECT ... WHERE user_id = $1 LIMIT 1
--     (el LIMIT 1 elegiría una fila arbitraria y el filtrado por fila se volvería
--     no determinista — un fallo de aislamiento entre profesionales, no cosmético)
--   * lambda-auth login → LEFT JOIN professional p ON p.user_id = u.id
--     (multiplicaría las filas del login y professional_id quedaría arbitrario)
--
-- Por eso: el titular conserva `user_id` = app_user.id (sin cambios), y los extra
-- quedan con `user_id IS NULL` + `owner_user_id` apuntando a la cuenta dueña.
-- Postgres permite múltiples NULL bajo UNIQUE, así que la restricción sobrevive.
-- `owner_user_id` da el vínculo cuenta→profesionales que antes no existía.
ALTER TABLE professional ALTER COLUMN user_id DROP NOT NULL;

-- Backfill: toda fila preexistente es, por definición, la del titular.
UPDATE professional
   SET owner_user_id = user_id
 WHERE owner_user_id IS NULL
   AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_professional_owner_user
  ON professional (owner_user_id);

-- Sólo puede haber un titular por cuenta (el que tiene user_id no nulo);
-- los extra quedan fuera de este índice por el WHERE.
CREATE UNIQUE INDEX IF NOT EXISTS idx_professional_primary_per_account
  ON professional (owner_user_id)
  WHERE user_id IS NOT NULL;

-- ── Onboarding completado (server-side) ──────────────────────────────────────
-- Hasta ahora la finalización del onboarding vivía SÓLO en localStorage
-- (OnboardingService, clave dairi_onboarding_v1_<userId>). onboardingGuard
-- reenviaba a /onboarding en cada entrada a /app/* si esa clave no estaba, así
-- que limpiar datos del navegador, cambiar de navegador o entrar desde un
-- segundo dispositivo re-disparaba el onboarding de una cuenta que YA lo había
-- completado. Sin registro en servidor no había forma de distinguir esos casos.
--
-- El guard sigue leyendo localStorage primero (ruta rápida, sin red); ahora, en
-- MISS de caché, consulta GET /api/user/config y re-siembra la caché local.
ALTER TABLE user_config
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
