-- ─────────────────────────────────────────────────────────────────────────────
-- DDL: tablas faltantes
-- Prerequisito: supplier, product y expense ya existen (db-init.sql).
-- Este script crea el resto: autenticación, pacientes, fichas clínicas,
-- psicológicas y dentales, citas, pagos y las tablas de sesiones.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- AUTENTICACIÓN & CONTROL DE ACCESO (Java JPA / Spring Boot backend)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Usuarios ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_user (
  id       BIGSERIAL    PRIMARY KEY,
  name     VARCHAR(128) NOT NULL,
  email    VARCHAR(256) NOT NULL UNIQUE,
  password VARCHAR(256) NOT NULL,              -- hash BCrypt
  role     VARCHAR(16)  NOT NULL,              -- admin | manager | viewer
  avatar   VARCHAR(8)
);

-- ── Schemas de entidad ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_schema (
  id          BIGSERIAL   PRIMARY KEY,
  schema_key  VARCHAR(64) NOT NULL UNIQUE,     -- suppliers, patients, appointments…
  singular    VARCHAR(128) NOT NULL,
  plural      VARCHAR(128) NOT NULL,
  icon        VARCHAR(64),
  module_type VARCHAR(32)                      -- list | calendar | clinical-record
);

-- ── Join table usuario ↔ schema ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_schema (
  user_id   BIGINT NOT NULL REFERENCES app_user   (id) ON DELETE CASCADE,
  schema_id BIGINT NOT NULL REFERENCES app_schema (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, schema_id)
);


-- ══════════════════════════════════════════════════════════════════════════════
-- MÓDULO CLÍNICO GENERAL
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Citas médicas (calendar) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointment (
  id            SERIAL       PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,           -- motivo de consulta
  patient_name  VARCHAR(255) NOT NULL,
  start_date    TIMESTAMPTZ  NOT NULL,
  end_date      TIMESTAMPTZ,
  status        VARCHAR(30)  NOT NULL DEFAULT 'scheduled',  -- scheduled | completed | cancelled | no_show
  patient_email VARCHAR(255),
  room          VARCHAR(100),
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Fichas clínicas ───────────────────────────────────────────────────────────
-- Los campos de signos vitales y notas SOAP corresponden al encuentro más
-- reciente; el historial completo se almacena en encounters (JSONB).
CREATE TABLE IF NOT EXISTS clinical_record (
  id                  SERIAL       PRIMARY KEY,

  -- Demographics (stable)
  full_name           VARCHAR(255) NOT NULL,
  patient_id          VARCHAR(20)  NOT NULL UNIQUE,  -- formato PAC-00000
  rut                 VARCHAR(20)  NOT NULL,
  birth_date          DATE         NOT NULL,
  age                 INTEGER      NOT NULL CHECK (age >= 0 AND age <= 150),
  gender              VARCHAR(20)  NOT NULL,
  blood_type          VARCHAR(5)   NOT NULL,
  insurance           VARCHAR(20)  NOT NULL,          -- fonasa_a…fonasa_d | isapre | particular
  phone               VARCHAR(50)  NOT NULL,
  email               VARCHAR(255),
  address             VARCHAR(255),
  emergency_contact   VARCHAR(255),
  doctor              VARCHAR(150) NOT NULL,
  last_visit          DATE,
  status              VARCHAR(30)  NOT NULL DEFAULT 'active',

  -- Alerts (stable)
  allergies           JSONB        NOT NULL DEFAULT '[]',
  contraindications   TEXT,
  alert_notes         TEXT,

  -- Vital signs (last encounter)
  bp                  VARCHAR(30),               -- presión arterial, ej. "120/80 mmHg"
  heart_rate          INTEGER,                   -- lpm
  temperature         NUMERIC(4,1),              -- °C
  o2_saturation       INTEGER,                   -- %
  weight              NUMERIC(5,1),              -- kg
  height              INTEGER,                   -- cm
  bmi                 NUMERIC(4,1),              -- kg/m²
  respiratory_rate    INTEGER,                   -- rpm

  -- Medical history (stable)
  personal_history    TEXT,
  family_history      TEXT,
  habits              TEXT,

  -- Surgical (stable)
  surgical_history    TEXT,
  planned_interventions TEXT,

  -- Medications & diagnosis (mutable)
  current_medications TEXT,
  chronic_conditions  JSONB        NOT NULL DEFAULT '[]',
  diagnosis_code      VARCHAR(20),               -- CIE-10
  diagnosis_label     VARCHAR(255),
  differential_dx     TEXT,

  -- SOAP note (last encounter)
  soap_subjective     TEXT,
  soap_objective      TEXT,
  soap_assessment     TEXT,
  soap_plan           TEXT,

  -- Encounter history
  encounters          JSONB        NOT NULL DEFAULT '[]',

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Cobros / pagos (solo inserción — disableEdit + disableDelete) ─────────────
CREATE TABLE IF NOT EXISTS payment (
  id             SERIAL        PRIMARY KEY,
  patient_name   VARCHAR(255)  NOT NULL,
  invoice_number VARCHAR(100),
  date           DATE          NOT NULL,
  concept        VARCHAR(50)   NOT NULL,          -- consulta | procedimiento | examenes | psicologia | odontologia | medicamentos | otro
  amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50)   NOT NULL,          -- efectivo | debito | credito | transferencia | fonasa | isapre
  status         VARCHAR(30)   NOT NULL DEFAULT 'pendiente',  -- pagado | pendiente | anulado
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════════════════════
-- MÓDULO PSICOLOGÍA
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Sesiones psicológicas (calendar) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psych_session (
  id            SERIAL       PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,           -- motivo de sesión
  patient_name  VARCHAR(255) NOT NULL,
  start_date    TIMESTAMPTZ  NOT NULL,
  end_date      TIMESTAMPTZ,
  session_type  VARCHAR(30)  NOT NULL,            -- individual | couple | family | group | evaluation
  status        VARCHAR(30)  NOT NULL DEFAULT 'scheduled',  -- scheduled | completed | cancelled | no_show
  patient_email VARCHAR(255),
  room          VARCHAR(100),
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Fichas psicológicas ───────────────────────────────────────────────────────
-- Los 8 campos del examen del estado mental (bp, heart_rate…) se almacenan
-- como TEXT porque en psicología representan: apariencia, ánimo, afecto,
-- pensamiento, percepción, cognición, insight y juicio.
CREATE TABLE IF NOT EXISTS psych_record (
  id                  SERIAL       PRIMARY KEY,

  -- Demographics (stable)
  full_name           VARCHAR(255) NOT NULL,
  patient_id          VARCHAR(20)  NOT NULL UNIQUE,  -- formato PSI-00000
  rut                 VARCHAR(20)  NOT NULL,
  birth_date          DATE         NOT NULL,
  age                 INTEGER      NOT NULL CHECK (age >= 0 AND age <= 150),
  gender              VARCHAR(20)  NOT NULL,
  occupation          VARCHAR(150),
  education           VARCHAR(30),               -- basic | secondary | technical | university | postgrad
  marital_status      VARCHAR(20),               -- single | married | divorced | widowed | cohabiting
  insurance           VARCHAR(20)  NOT NULL,
  phone               VARCHAR(50)  NOT NULL,
  email               VARCHAR(255),
  address             VARCHAR(255),
  emergency_contact   VARCHAR(255),
  doctor              VARCHAR(150) NOT NULL,      -- psicólogo/a tratante
  last_visit          DATE,
  status              VARCHAR(30)  NOT NULL DEFAULT 'active',  -- active | discharged | critical | scheduled

  -- Alerts / risk factors (stable)
  allergies           JSONB        NOT NULL DEFAULT '[]',   -- factores de riesgo
  contraindications   TEXT,                                 -- riesgo suicida
  alert_notes         TEXT,

  -- Mental status exam (repurposed vital-sign grid — all TEXT)
  bp                  TEXT,   -- Apariencia
  heart_rate          TEXT,   -- Ánimo
  temperature         TEXT,   -- Afecto
  o2_saturation       TEXT,   -- Pensamiento
  weight              TEXT,   -- Percepción
  height              TEXT,   -- Cognición
  bmi                 TEXT,   -- Insight
  respiratory_rate    TEXT,   -- Juicio

  -- Psychological assessments (stable)
  personal_history    TEXT,   -- historia personal y familiar
  family_history      TEXT,   -- dinámica familiar
  habits              TEXT,   -- instrumentos aplicados (PHQ-9, GAD-7…)

  -- Therapeutic interventions (stable)
  surgical_history    TEXT,   -- terapias previas
  planned_interventions TEXT, -- intervenciones / procesos activos

  -- Treatment (mutable)
  current_medications TEXT,   -- plan terapéutico
  chronic_conditions  JSONB   NOT NULL DEFAULT '[]',  -- diagnósticos activos

  -- DSM-5 / CIE-10 diagnosis (stable)
  diagnosis_code      VARCHAR(20),
  diagnosis_label     VARCHAR(255),
  differential_dx     TEXT,

  -- Session notes SOAP (mutable)
  soap_subjective     TEXT,   -- relato del paciente
  soap_objective      TEXT,   -- observación clínica
  soap_assessment     TEXT,   -- formulación clínica
  soap_plan           TEXT,   -- plan terapéutico

  -- Session history
  encounters          JSONB   NOT NULL DEFAULT '[]',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════════════════════
-- MÓDULO ODONTOLOGÍA
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Citas dentales (calendar) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dental_session (
  id             SERIAL       PRIMARY KEY,
  title          VARCHAR(255) NOT NULL,          -- procedimiento
  patient_name   VARCHAR(255) NOT NULL,
  start_date     TIMESTAMPTZ  NOT NULL,
  end_date       TIMESTAMPTZ,
  treatment_type VARCHAR(30)  NOT NULL,           -- checkup | cleaning | filling | extraction | root_canal | orthodontics | implant | whitening | surgery
  status         VARCHAR(30)  NOT NULL DEFAULT 'scheduled',
  patient_email  VARCHAR(255),
  chair          VARCHAR(100),                   -- sillón
  notes          TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Fichas dentales ───────────────────────────────────────────────────────────
-- Los 8 campos del examen dental (bp, heart_rate…) se almacenan como TEXT
-- y representan: dolor EVA, higiene oral, sangrado al sondaje, movilidad
-- dental, índice de placa, maloclusión, oclusión y sensibilidad.
CREATE TABLE IF NOT EXISTS dental_record (
  id                  SERIAL       PRIMARY KEY,

  -- Demographics (stable)
  full_name           VARCHAR(255) NOT NULL,
  patient_id          VARCHAR(20)  NOT NULL UNIQUE,  -- formato DEN-00000
  rut                 VARCHAR(20)  NOT NULL,
  birth_date          DATE         NOT NULL,
  age                 INTEGER      NOT NULL CHECK (age >= 0 AND age <= 150),
  gender              VARCHAR(20)  NOT NULL,
  insurance           VARCHAR(20)  NOT NULL,
  phone               VARCHAR(50)  NOT NULL,
  email               VARCHAR(255),
  doctor              VARCHAR(150) NOT NULL,      -- odontólogo/a
  last_visit          DATE,
  status              VARCHAR(30)  NOT NULL DEFAULT 'active',  -- active | discharged | maintenance | orthodontic

  -- Alerts (stable)
  allergies           JSONB        NOT NULL DEFAULT '[]',
  contraindications   TEXT,
  alert_notes         TEXT,

  -- Dental exam (repurposed vital-sign grid — all TEXT)
  bp                  TEXT,   -- Dolor (EVA 0-10)
  heart_rate          TEXT,   -- Higiene Oral (Buena/Regular/Deficiente)
  temperature         TEXT,   -- Sangrado al Sondaje (Sí/No/%)
  o2_saturation       TEXT,   -- Movilidad Dental (Grado 0-3)
  weight              TEXT,   -- Índice de Placa (%)
  height              TEXT,   -- Maloclusión (Clase I/II/III)
  bmi                 TEXT,   -- Oclusión (Normal/Alterada)
  respiratory_rate    TEXT,   -- Sensibilidad (Térmica/Táctil)

  -- Dental anamnesis (stable)
  personal_history    TEXT,   -- antecedentes médicos relevantes
  family_history      TEXT,   -- antecedentes familiares
  habits              TEXT,   -- hábitos parafuncionales (bruxismo, onicofagia…)

  -- Dental procedures (stable)
  surgical_history    TEXT,   -- tratamientos previos
  planned_interventions TEXT, -- procedimientos planificados

  -- Current treatment (mutable)
  current_medications TEXT,   -- medicación actual
  chronic_conditions  JSONB   NOT NULL DEFAULT '[]',

  -- Diagnosis CIE / ICDAS (stable)
  diagnosis_code      VARCHAR(20),
  diagnosis_label     VARCHAR(255),
  differential_dx     TEXT,   -- plan de tratamiento

  -- SOAP dental (mutable)
  soap_subjective     TEXT,   -- motivo de consulta
  soap_objective      TEXT,   -- examen clínico
  soap_assessment     TEXT,   -- diagnóstico de sesión
  soap_plan           TEXT,   -- procedimiento realizado

  -- Encounter history
  encounters          JSONB   NOT NULL DEFAULT '[]',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
