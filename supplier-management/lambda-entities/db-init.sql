-- ─────────────────────────────────────────────────────────────────────────────
-- DDL: supplier, product, expense tables
-- Run once against RDS PostgreSQL to create the tables used by lambda-entities
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Suppliers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100)   NOT NULL,
  code           VARCHAR(50)    NOT NULL UNIQUE,
  email          VARCHAR(255)   NOT NULL,
  phone          VARCHAR(50)    NOT NULL,
  category       VARCHAR(50)    NOT NULL,
  status         VARCHAR(20)    NOT NULL DEFAULT 'active',
  country        VARCHAR(100)   NOT NULL,
  city           VARCHAR(100)   NOT NULL,
  address        VARCHAR(255)   NOT NULL,
  website        VARCHAR(255),
  tax_id         VARCHAR(100)   NOT NULL,
  contact_person VARCHAR(150)   NOT NULL,
  rating         NUMERIC(3,1)   NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  total_orders   INTEGER        NOT NULL DEFAULT 0,
  total_spent    NUMERIC(15,2)  NOT NULL DEFAULT 0,
  notes          TEXT,
  tags           JSONB          NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Products ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255)   NOT NULL,
  sku         VARCHAR(50)    NOT NULL UNIQUE,
  category    VARCHAR(50)    NOT NULL,
  status      VARCHAR(30)    NOT NULL DEFAULT 'available',
  price       NUMERIC(15,2)  NOT NULL DEFAULT 0,
  stock       INTEGER        NOT NULL DEFAULT 0,
  supplier    VARCHAR(255),
  weight      NUMERIC(10,3),
  description TEXT,
  tags        JSONB          NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Clinical Records ──────────────────────────────────────────────────────────
-- References paciente(id) and profesional(id) via TEXT FKs (stored as codes)
CREATE TABLE IF NOT EXISTS ficha_clinica (
  id                     SERIAL PRIMARY KEY,
  full_name              VARCHAR(200)   NOT NULL,
  patient_code           VARCHAR(50)    NOT NULL UNIQUE,
  rut                    VARCHAR(20)    NOT NULL,
  birth_date             DATE,
  age                    INTEGER,
  gender                 VARCHAR(20),
  blood_type             VARCHAR(10),
  insurance              VARCHAR(30),
  phone                  VARCHAR(50),
  email                  VARCHAR(255),
  address                VARCHAR(255),
  emergency_contact      VARCHAR(200),
  doctor                 VARCHAR(200),
  last_visit             DATE,
  status                 VARCHAR(30)    NOT NULL DEFAULT 'active',
  -- Alerts
  allergies              JSONB          NOT NULL DEFAULT '[]',
  contraindications      TEXT           NOT NULL DEFAULT '',
  alert_notes            TEXT           NOT NULL DEFAULT '',
  -- Vital signs (updated each encounter)
  bp                     VARCHAR(20),
  heart_rate             NUMERIC(5,1),
  temperature            NUMERIC(4,1),
  o2_saturation          NUMERIC(5,1),
  weight                 NUMERIC(6,1),
  height                 NUMERIC(5,1),
  bmi                    NUMERIC(5,1),
  respiratory_rate       NUMERIC(5,1),
  -- Medical history (stable)
  personal_history       TEXT           NOT NULL DEFAULT '',
  family_history         TEXT           NOT NULL DEFAULT '',
  habits                 TEXT           NOT NULL DEFAULT '',
  -- Surgical (stable)
  surgical_history       TEXT           NOT NULL DEFAULT '',
  planned_interventions  TEXT           NOT NULL DEFAULT '',
  -- Medications / Diagnosis
  current_medications    TEXT           NOT NULL DEFAULT '',
  chronic_conditions     JSONB          NOT NULL DEFAULT '[]',
  diagnosis_code         VARCHAR(30),
  diagnosis_label        VARCHAR(255),
  differential_dx        TEXT           NOT NULL DEFAULT '',
  -- SOAP note (updated each encounter)
  soap_subjective        TEXT           NOT NULL DEFAULT '',
  soap_objective         TEXT           NOT NULL DEFAULT '',
  soap_assessment        TEXT           NOT NULL DEFAULT '',
  soap_plan              TEXT           NOT NULL DEFAULT '',
  -- Encounter history
  encounters             JSONB          NOT NULL DEFAULT '[]',
  created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Expenses ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense (
  id             SERIAL PRIMARY KEY,
  description    VARCHAR(255)   NOT NULL,
  supplier       VARCHAR(255),
  date           DATE           NOT NULL,
  category       VARCHAR(50)    NOT NULL,
  amount         NUMERIC(15,2)  NOT NULL DEFAULT 0,
  payment_method VARCHAR(50)    NOT NULL,
  status         VARCHAR(30)    NOT NULL DEFAULT 'pendiente',
  receipt_number VARCHAR(100),
  notes          TEXT,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
