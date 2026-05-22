-- Migration 004: Schema cleanup
-- 1. Drop legacy ficha_clinica table
-- 2. Replace patient_name/professional_name text cols in payment with FK columns
-- 3. Replace category/supplier varchar cols in product with FK columns

-- ── 1. Drop legacy table ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS ficha_clinica;

-- ── 2. payment: text → FK columns ────────────────────────────────────────────
ALTER TABLE payment
  ADD COLUMN IF NOT EXISTS patient_id      INTEGER REFERENCES patient(id),
  ADD COLUMN IF NOT EXISTS professional_id INTEGER REFERENCES professional(id);

-- Backfill via appointment_payment link (covers bookings from dairi-book)
UPDATE payment p
SET patient_id      = a.patient_id,
    professional_id = a.professional_id
FROM appointment_payment ap
JOIN appointment a ON a.id = ap.appointment_id
WHERE ap.payment_id = p.id;

ALTER TABLE payment
  DROP COLUMN IF EXISTS patient_name,
  DROP COLUMN IF EXISTS professional_name;

-- ── 3. product: varchar → FK columns ─────────────────────────────────────────
ALTER TABLE product
  ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES category(id),
  ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES supplier(id);

-- Backfill category by name match (case-insensitive)
UPDATE product p
SET category_id = c.id
FROM category c
WHERE lower(c.name) = lower(p.category);

-- Backfill supplier by name match (case-insensitive)
UPDATE product p
SET supplier_id = s.id
FROM supplier s
WHERE lower(s.name) = lower(p.supplier);

ALTER TABLE product
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS supplier;
