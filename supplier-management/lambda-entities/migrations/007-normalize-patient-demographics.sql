-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007: normalizar demografía de paciente
--
-- Problema: presupuesto duplica campos del paciente (patient_name, patient_rut,
-- patient_phone, patient_email) en vez de derivarlos del FK patient_id.
-- Esos campos quedan obsoletos cada vez que el paciente actualiza su contacto.
--
-- Solución en dos pasos:
--   1. Asegurar que patient tenga todos los campos demográficos.
--   2. Eliminar columnas redundantes de presupuesto (una vez validado en staging).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Paso 1: columnas demográficas en patient (defensivo) ──────────────────────
ALTER TABLE patient
  ADD COLUMN IF NOT EXISTS birth_date        DATE,
  ADD COLUMN IF NOT EXISTS gender            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS blood_type        VARCHAR(10),
  ADD COLUMN IF NOT EXISTS address           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255);

-- ── Paso 2: backfill desde presupuesto cuando patient_id está enlazado ────────
-- Rellena phone/email del paciente si estaban vacíos y el presupuesto los tiene.
UPDATE patient p
SET
  phone = COALESCE(NULLIF(p.phone, ''), sub.patient_phone),
  email = COALESCE(NULLIF(p.email, ''), sub.patient_email)
FROM (
  SELECT DISTINCT ON (patient_id)
    patient_id, patient_phone, patient_email
  FROM presupuesto
  WHERE patient_id IS NOT NULL
    AND (patient_phone IS NOT NULL OR patient_email IS NOT NULL)
  ORDER BY patient_id, created_at DESC
) sub
WHERE p.id = sub.patient_id
  AND (p.phone IS NULL OR p.email IS NULL);

-- ── Paso 3: asegurar FK explícita presupuesto → patient ──────────────────────
-- (por si la tabla fue creada sin constraint formal)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'presupuesto_patient_id_fkey'
      AND table_name = 'presupuesto'
  ) THEN
    ALTER TABLE presupuesto
      ADD CONSTRAINT presupuesto_patient_id_fkey
      FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Paso 4 (diferido — ejecutar tras validar en staging) ─────────────────────
-- Una vez confirmado que el BFF usa el JOIN, eliminar las columnas redundantes:
--
-- ALTER TABLE presupuesto
--   DROP COLUMN IF EXISTS patient_name,
--   DROP COLUMN IF EXISTS patient_rut,
--   DROP COLUMN IF EXISTS patient_phone,
--   DROP COLUMN IF EXISTS patient_email;
