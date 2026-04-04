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
