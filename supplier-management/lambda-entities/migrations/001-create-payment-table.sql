-- Migration 001: Create payment table
-- Run against RDS PostgreSQL:
--   psql $DATABASE_URL -f lambda-entities/migrations/001-create-payment-table.sql

CREATE TABLE IF NOT EXISTS payment (
  id                SERIAL PRIMARY KEY,
  patient_name      VARCHAR(200),
  invoice_number    VARCHAR(50) UNIQUE,
  date              DATE,
  concept           VARCHAR(50),
  amount            NUMERIC(12, 2),
  payment_method    VARCHAR(50),
  status            VARCHAR(30)  DEFAULT 'pendiente',
  notes             TEXT,
  professional_name VARCHAR(200),
  commission_rate   NUMERIC(5, 2),
  commission_amount NUMERIC(12, 2),
  commission_status VARCHAR(30)  DEFAULT 'no_aplica',
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_status           ON payment (status);
CREATE INDEX IF NOT EXISTS idx_payment_date             ON payment (date);
CREATE INDEX IF NOT EXISTS idx_payment_professional     ON payment (professional_name);
CREATE INDEX IF NOT EXISTS idx_payment_commission_status ON payment (commission_status);
