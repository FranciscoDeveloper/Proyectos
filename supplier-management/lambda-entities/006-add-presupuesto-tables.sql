-- ── Módulo de Presupuestos ────────────────────────────────────────────────────
-- Tabla principal: presupuesto (cabecera + ítems como JSONB)
-- Los ítems se almacenan como array JSONB para evitar joins y simplificar el CRUD.

CREATE TABLE IF NOT EXISTS presupuesto (
  id                 BIGSERIAL    PRIMARY KEY,
  numero             VARCHAR(30)  NOT NULL UNIQUE,          -- PRES-2025-0001
  patient_name       VARCHAR(200) NOT NULL,
  patient_rut        VARCHAR(20),
  patient_phone      VARCHAR(50),
  patient_email      VARCHAR(255),
  doctor_name        VARCHAR(200) NOT NULL,
  specialty          VARCHAR(100),
  fecha_emision      DATE         NOT NULL,
  fecha_vencimiento  DATE         NOT NULL,
  prevision          VARCHAR(20)  NOT NULL DEFAULT 'particular', -- particular|fonasa|isapre|capredena
  coverage_percent   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (coverage_percent >= 0 AND coverage_percent <= 100),
  discount_global    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_global  >= 0 AND discount_global  <= 100),
  -- JSONB array: [{description, quantity, unitPrice, discountPct, subtotal}]
  items              JSONB        NOT NULL DEFAULT '[]',
  notes              TEXT,
  status             VARCHAR(20)  NOT NULL DEFAULT 'draft',  -- draft|sent|approved|rejected|expired|converted
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índices útiles para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_presupuesto_status           ON presupuesto (status);
CREATE INDEX IF NOT EXISTS idx_presupuesto_fecha_emision    ON presupuesto (fecha_emision);
CREATE INDEX IF NOT EXISTS idx_presupuesto_fecha_vencimiento ON presupuesto (fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_presupuesto_patient_name     ON presupuesto (patient_name);

-- Trigger para mantener updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_presupuesto_updated_at
  BEFORE UPDATE ON presupuesto
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Datos de ejemplo (comentados para producción)
-- INSERT INTO presupuesto (numero, patient_name, patient_rut, doctor_name, specialty,
--   fecha_emision, fecha_vencimiento, prevision, coverage_percent, discount_global, items, notes, status)
-- VALUES (
--   'PRES-2025-0001', 'Paciente Demo', '12.345.678-9', 'Dr. Demo', 'Medicina General',
--   CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'fonasa', 60, 0,
--   '[{"description":"Consulta médica","quantity":1,"unitPrice":25000,"discountPct":0,"subtotal":25000}]',
--   'Presupuesto de ejemplo', 'draft'
-- );
