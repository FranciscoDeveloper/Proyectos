-- Migration 015: calificación (estrellas 1–5) por profesional para el módulo público de book.
--
-- Contexto: la lista de profesionales de `/api/book` debe mostrar una calificación por
-- profesional. A futuro las calificaciones llegarán vía WhatsApp cuando el paciente termine
-- su cita — ese camino de entrada NO está implementado todavía. Esta migración sólo crea el
-- almacenamiento y los agregados que el módulo de book lee.
--
-- Diseño:
--   * `professional_rating` guarda una fila por evento de calificación (no un promedio suelto),
--     porque la futura integración de WhatsApp insertará una fila por cita completada.
--   * `appointment_id`, `patient_phone` y `comment` son nullable a propósito: la forma exacta
--     del payload de WhatsApp aún no está decidida y no conviene sobre-restringir ahora.
--   * `professional.rating_avg` / `rating_count` están materializadas y las mantiene sincronizadas
--     un trigger sobre `professional_rating`. Motivo: `findProfessional()` (SELECT *) y el SELECT
--     de la lista se ejecutan en cada carga de la página pública de reservas; dos columnas
--     mantenidas por trigger dejan esas lecturas simples y rápidas, y son correctas mientras
--     toda escritura de calificaciones pase por `professional_rating` (incluida la de WhatsApp).

CREATE TABLE IF NOT EXISTS professional_rating (
  id              SERIAL       PRIMARY KEY,
  professional_id INTEGER      NOT NULL REFERENCES professional(id),
  stars           SMALLINT     NOT NULL CHECK (stars BETWEEN 1 AND 5),
  appointment_id  INTEGER      REFERENCES appointment(id),
  patient_phone   TEXT,
  comment         TEXT,
  source          TEXT         NOT NULL DEFAULT 'whatsapp',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_professional_rating_professional
  ON professional_rating (professional_id);

-- Agregados materializados que lee lambda-book.
-- NUMERIC(2,1) alcanza para el rango 1.0–5.0 con un decimal.
ALTER TABLE professional
  ADD COLUMN IF NOT EXISTS rating_avg   NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;

-- Recalcula avg + count del profesional afectado. En UPDATE el professional_id puede cambiar,
-- por eso se recalculan tanto el OLD como el NEW.
CREATE OR REPLACE FUNCTION refresh_professional_rating() RETURNS TRIGGER AS $fn$
DECLARE
  targets INTEGER[] := ARRAY[]::INTEGER[];
  target  INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN targets := targets || OLD.professional_id; END IF;
  IF TG_OP <> 'DELETE' AND NOT (NEW.professional_id = ANY (targets)) THEN
    targets := targets || NEW.professional_id;
  END IF;

  FOREACH target IN ARRAY targets
  LOOP
    UPDATE professional p
       SET rating_avg = agg.avg_stars,
           rating_count = agg.n
      FROM (
        SELECT ROUND(AVG(stars), 1) AS avg_stars, COUNT(*) AS n
          FROM professional_rating
         WHERE professional_id = target
      ) AS agg
     WHERE p.id = target;
  END LOOP;
  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_professional_rating_refresh ON professional_rating;
CREATE TRIGGER trg_professional_rating_refresh
  AFTER INSERT OR UPDATE OR DELETE ON professional_rating
  FOR EACH ROW EXECUTE FUNCTION refresh_professional_rating();

-- Backfill para filas preexistentes (no-op en una base limpia).
UPDATE professional p
   SET rating_avg = agg.avg_stars,
       rating_count = agg.n
  FROM (
    SELECT professional_id, ROUND(AVG(stars), 1) AS avg_stars, COUNT(*) AS n
      FROM professional_rating GROUP BY professional_id
  ) AS agg
 WHERE p.id = agg.professional_id;
