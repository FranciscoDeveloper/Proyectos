-- 019 — Psicología: tareas intersesión, registro de humor y escalas MBC (PHQ-9 / GAD-7).
--
-- Fase 2 de psicologia-oportunidades-arquitectura.md, con las correcciones de la
-- revisión de la Parte 6 aplicadas:
--   · C2 — `scale_response` lleva UNIQUE (instance_id, item_id). Sin ella el
--          `ON CONFLICT DO NOTHING` del diseño original no hace nada (solo cubriría
--          el PK serial, que nunca colisiona) y un doble click duplicaría las 9 filas
--          del PHQ-9. El ítem 9 es ideación suicida: filas duplicadas o incoherentes
--          ahí no son aceptables. Con la constraint el upsert es last-write-wins.
--   · P5 — Índices corregidos: `intersession_task` se consulta por
--          (record_id, completed, created_at DESC), no por session_date; se agrega
--          además un índice parcial para el listado de pendientes. No se crea índice
--          en `scale_instance.template_id`: el JOIN va contra el PK de
--          `scale_template`, ya indexado.
--
-- Idempotente: se puede reaplicar sin efectos.

-- ── Tareas intersesión ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intersession_task (
  id           SERIAL PRIMARY KEY,
  record_id    INTEGER NOT NULL REFERENCES clinical_record(id) ON DELETE CASCADE,
  created_by   INTEGER NOT NULL REFERENCES app_user(id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description  TEXT NOT NULL,
  due_date     DATE,
  completed    BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  patient_note TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Calza con `ORDER BY completed, created_at DESC` del listado por ficha.
CREATE INDEX IF NOT EXISTS idx_intersession_task_record
  ON intersession_task(record_id, completed, created_at DESC);

-- Listado de pendientes (el caso caliente: qué le queda por hacer al paciente).
CREATE INDEX IF NOT EXISTS idx_intersession_task_pending
  ON intersession_task(record_id, created_at DESC) WHERE completed = false;

-- ── Registro de humor ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mood_log (
  id          SERIAL PRIMARY KEY,
  record_id   INTEGER NOT NULL REFERENCES clinical_record(id) ON DELETE CASCADE,
  logged_by   TEXT NOT NULL DEFAULT 'therapist',  -- 'therapist' | 'patient'
  mood_score  SMALLINT NOT NULL CHECK (mood_score BETWEEN 1 AND 10),
  mood_label  TEXT,
  note        TEXT,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mood_log_record
  ON mood_log(record_id, logged_at DESC);

-- ── Catálogo de escalas ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scale_template (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  items       JSONB NOT NULL DEFAULT '[]',
  scoring     JSONB NOT NULL DEFAULT '{}',
  schema_keys TEXT[] NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT true
);

-- ── Instancias de aplicación ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scale_instance (
  id              SERIAL PRIMARY KEY,
  record_id       INTEGER NOT NULL REFERENCES clinical_record(id) ON DELETE CASCADE,
  template_id     INTEGER NOT NULL REFERENCES scale_template(id),
  administered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_score     SMALLINT,
  severity        TEXT,
  administered_by TEXT NOT NULL DEFAULT 'clinician'  -- 'clinician' | 'self'
);
CREATE INDEX IF NOT EXISTS idx_scale_instance_record
  ON scale_instance(record_id, administered_at DESC);

-- ── Respuestas por ítem ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scale_response (
  id          SERIAL PRIMARY KEY,
  instance_id INTEGER NOT NULL REFERENCES scale_instance(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,
  value       SMALLINT NOT NULL
);

-- C2: sin esta constraint el upsert de respuestas no deduplica nada.
-- Su índice sirve además como índice de la FK `instance_id` (prefijo).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scale_response_uniq'
  ) THEN
    ALTER TABLE scale_response
      ADD CONSTRAINT scale_response_uniq UNIQUE (instance_id, item_id);
  END IF;
END $$;

-- ── Seed: catálogo PHQ-9 y GAD-7 ────────────────────────────────────────────
-- `schema_keys` incluye tanto la agenda (`psych-sessions`) como la ficha
-- (`psych-records`): la UI que aplica las escalas vive en el detalle de la ficha,
-- pero el diseño original las declaraba solo en la agenda.
INSERT INTO scale_template (code, name, description, schema_keys, items, scoring)
VALUES
('PHQ-9', 'PHQ-9 — Cuestionario de Salud del Paciente', 'Depresión (9 ítems)',
 ARRAY['psych-sessions','psych-records'],
 '[
   {"id":"q1","text":"Poco interés o placer en hacer las cosas"},
   {"id":"q2","text":"Sentirse triste, deprimido/a o sin esperanzas"},
   {"id":"q3","text":"Problemas para dormir o dormir demasiado"},
   {"id":"q4","text":"Sentirse cansado/a o con poca energía"},
   {"id":"q5","text":"Poco apetito o comer en exceso"},
   {"id":"q6","text":"Sentirse mal consigo mismo/a"},
   {"id":"q7","text":"Dificultad para concentrarse"},
   {"id":"q8","text":"Moverse o hablar tan despacio que otros lo notan, o lo contrario"},
   {"id":"q9","text":"Pensamientos de que estaría mejor muerto/a"}
 ]',
 '{"options":[{"value":0,"label":"Para nada"},{"value":1,"label":"Varios días"},{"value":2,"label":"Más de la mitad de los días"},{"value":3,"label":"Casi todos los días"}],
   "ranges":[{"min":0,"max":4,"label":"Sin depresión","severity":"ninguna"},{"min":5,"max":9,"label":"Depresión leve","severity":"leve"},{"min":10,"max":14,"label":"Depresión moderada","severity":"moderada"},{"min":15,"max":19,"label":"Depresión moderadamente grave","severity":"moderada-grave"},{"min":20,"max":27,"label":"Depresión grave","severity":"grave"}]}'
),
('GAD-7', 'GAD-7 — Trastorno de Ansiedad Generalizada', 'Ansiedad (7 ítems)',
 ARRAY['psych-sessions','psych-records'],
 '[
   {"id":"q1","text":"Sentirse nervioso/a, ansioso/a o al límite"},
   {"id":"q2","text":"No poder dejar de preocuparse"},
   {"id":"q3","text":"Preocuparse demasiado por cosas diferentes"},
   {"id":"q4","text":"Tener dificultad para relajarse"},
   {"id":"q5","text":"Estar tan inquieto/a que es difícil mantenerse quieto/a"},
   {"id":"q6","text":"Irritarse o enojarse fácilmente"},
   {"id":"q7","text":"Sentir miedo de que algo terrible podría pasar"}
 ]',
 '{"options":[{"value":0,"label":"Para nada"},{"value":1,"label":"Varios días"},{"value":2,"label":"Más de la mitad de los días"},{"value":3,"label":"Casi todos los días"}],
   "ranges":[{"min":0,"max":4,"label":"Mínima ansiedad","severity":"minima"},{"min":5,"max":9,"label":"Ansiedad leve","severity":"leve"},{"min":10,"max":14,"label":"Ansiedad moderada","severity":"moderada"},{"min":15,"max":21,"label":"Ansiedad grave","severity":"grave"}]}'
)
ON CONFLICT (code) DO UPDATE
  SET schema_keys = EXCLUDED.schema_keys,
      items       = EXCLUDED.items,
      scoring     = EXCLUDED.scoring,
      name        = EXCLUDED.name,
      description = EXCLUDED.description;
