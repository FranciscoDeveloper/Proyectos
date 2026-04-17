-- ─────────────────────────────────────────────────────────────────────────────
-- seed-app-schema.sql
-- Inserta (o repara) los schemas y vínculos de usuario en la base de datos.
-- Ejecutar una sola vez contra el RDS PostgreSQL:
--   psql $DATABASE_URL -f seed-app-schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Asegurar que la tabla app_schema existe (por si no fue creada por Quarkus/DataLoader)
CREATE TABLE IF NOT EXISTS app_schema (
  id          SERIAL PRIMARY KEY,
  schema_key  VARCHAR(64)  NOT NULL UNIQUE,
  singular    VARCHAR(128) NOT NULL,
  plural      VARCHAR(128) NOT NULL,
  icon        VARCHAR(64),
  module_type VARCHAR(32)
);

-- 2. Insertar todos los schemas (no falla si ya existen)
INSERT INTO app_schema (schema_key, singular, plural, icon, module_type) VALUES
  ('suppliers',        'Proveedor',          'Proveedores',            'truck',        'list'),
  ('products',         'Producto',           'Productos',              'box',          'list'),
  ('patients',         'Paciente',           'Pacientes',              'user',         'list'),
  ('appointments',     'Cita',               'Citas',                  'calendar',     'calendar'),
  ('clinical-records', 'Ficha Clínica',      'Fichas Clínicas',        'clipboard',    'clinical-record'),
  ('payments',         'Pago',               'Pagos',                  'credit-card',  'list'),
  ('expenses',         'Gasto',              'Gastos',                 'receipt',      'list'),
  ('psych-sessions',   'Sesión',             'Sesiones Psicológicas',  'calendar',     'calendar'),
  ('psych-records',    'Ficha Psicológica',  'Fichas Psicológicas',    'clipboard',    'clinical-record'),
  ('dental-sessions',  'Sesión Dental',      'Sesiones Dentales',      'calendar',     'calendar'),
  ('dental-records',   'Ficha Dental',       'Fichas Dentales',        'clipboard',    'clinical-record')
ON CONFLICT (schema_key) DO UPDATE
  SET singular    = EXCLUDED.singular,
      plural      = EXCLUDED.plural,
      icon        = EXCLUDED.icon,
      module_type = EXCLUDED.module_type;

-- 3. Asegurar tabla user_schema (join table usuario ↔ schema)
CREATE TABLE IF NOT EXISTS user_schema (
  user_id   INTEGER NOT NULL,
  schema_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, schema_id)
);

-- 4. Vincular schemas a usuarios por email (idempotente)
-- admin@empresa.com → todos los módulos generales + fichas clínicas
INSERT INTO user_schema (user_id, schema_id)
SELECT u.id, s.id
FROM app_user u
CROSS JOIN app_schema s
WHERE u.email = 'admin@empresa.com'
  AND s.schema_key IN (
    'suppliers','products','patients','appointments',
    'clinical-records','payments','expenses'
  )
ON CONFLICT DO NOTHING;

-- compras@empresa.com → módulos de compras/gastos
INSERT INTO user_schema (user_id, schema_id)
SELECT u.id, s.id
FROM app_user u
CROSS JOIN app_schema s
WHERE u.email = 'compras@empresa.com'
  AND s.schema_key IN ('suppliers','products','payments','expenses')
ON CONFLICT DO NOTHING;

-- medico@hospital.com → módulos clínicos de medicina general
INSERT INTO user_schema (user_id, schema_id)
SELECT u.id, s.id
FROM app_user u
CROSS JOIN app_schema s
WHERE u.email = 'medico@hospital.com'
  AND s.schema_key IN ('patients','appointments','clinical-records','payments')
ON CONFLICT DO NOTHING;

-- auditor@empresa.com → solo lectura
INSERT INTO user_schema (user_id, schema_id)
SELECT u.id, s.id
FROM app_user u
CROSS JOIN app_schema s
WHERE u.email = 'auditor@empresa.com'
  AND s.schema_key IN ('suppliers','payments','expenses')
ON CONFLICT DO NOTHING;

-- psicologia@clinica.com → fichas y sesiones psicológicas
INSERT INTO user_schema (user_id, schema_id)
SELECT u.id, s.id
FROM app_user u
CROSS JOIN app_schema s
WHERE u.email = 'psicologia@clinica.com'
  AND s.schema_key IN ('psych-sessions','psych-records','payments')
ON CONFLICT DO NOTHING;

-- odontologia@clinica.com → fichas y sesiones dentales
INSERT INTO user_schema (user_id, schema_id)
SELECT u.id, s.id
FROM app_user u
CROSS JOIN app_schema s
WHERE u.email = 'odontologia@clinica.com'
  AND s.schema_key IN ('dental-sessions','dental-records','payments')
ON CONFLICT DO NOTHING;

-- 5. Verificar resultado
SELECT u.email, s.schema_key, s.module_type
FROM app_user u
JOIN user_schema us ON us.user_id = u.id
JOIN app_schema s   ON s.id = us.schema_id
ORDER BY u.email, s.id;
