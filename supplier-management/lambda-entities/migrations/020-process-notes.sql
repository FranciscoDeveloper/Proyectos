-- 020 — Notas de proceso del terapeuta (Fase 1 de psicologia-oportunidades-arquitectura.md).
--
-- Separa la ficha oficial (clinical_record, compartida entre los profesionales que
-- atienden al paciente) de las notas de trabajo del terapeuta: hipótesis, contratransferencia,
-- material que orienta la sesión siguiente y que no forma parte del registro clínico
-- que otro profesional puede pedir.
--
-- Alcance real de la privacidad, para que quede escrito y nadie prometa de más:
-- estas notas son **visibles solo para el terapeuta que las escribió**. Eso se
-- consigue filtrando por `author_id = <usuario autenticado>` en processNotesHandler.mjs,
-- en TODAS las sentencias (SELECT/UPDATE/DELETE), además del chequeo de propiedad de
-- la ficha (lib/recordAccess.mjs).
--
-- Deliberadamente NO se crea una POLICY de RLS aquí. La conexión del BFF entra como
-- `postgres`, superusuario y dueño de la tabla, así que una policy no se evaluaría y
-- daría una falsa sensación de defensa en profundidad. El control real es el filtro
-- de aplicación; documentarlo así vale más que un CREATE POLICY decorativo.
--
-- `content_iv` / `is_encrypted` quedan creadas para un cifrado del lado del cliente en
-- el futuro. Hoy se escriben siempre NULL/false: no hay cifrado en esta entrega, y por
-- eso no se afirma en ninguna parte que el contenido sea inaccesible para Dairi.
--
-- Idempotente: se puede reaplicar sin efectos.

CREATE TABLE IF NOT EXISTS process_notes (
  id           SERIAL PRIMARY KEY,
  record_id    INTEGER NOT NULL REFERENCES clinical_record(id) ON DELETE CASCADE,
  author_id    INTEGER NOT NULL REFERENCES app_user(id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content      TEXT NOT NULL,
  content_iv   TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Calza con la única consulta de listado del handler:
-- WHERE record_id = $1 AND author_id = $2 ORDER BY session_date DESC.
CREATE INDEX IF NOT EXISTS idx_process_notes_record_author
  ON process_notes(record_id, author_id, session_date DESC);
