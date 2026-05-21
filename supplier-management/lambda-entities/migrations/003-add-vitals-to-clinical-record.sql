-- Migration 003: Add vital signs and clinical fields to clinical_record
-- Applied: 2026-05-21

ALTER TABLE clinical_record
  ADD COLUMN IF NOT EXISTS bp                 text,
  ADD COLUMN IF NOT EXISTS heart_rate         integer,
  ADD COLUMN IF NOT EXISTS temperature        numeric(4,1),
  ADD COLUMN IF NOT EXISTS o2_saturation      numeric(5,2),
  ADD COLUMN IF NOT EXISTS weight             numeric(5,2),
  ADD COLUMN IF NOT EXISTS height             numeric(5,1),
  ADD COLUMN IF NOT EXISTS bmi               numeric(5,2),
  ADD COLUMN IF NOT EXISTS respiratory_rate   integer,
  ADD COLUMN IF NOT EXISTS current_medications text,
  ADD COLUMN IF NOT EXISTS diagnosis_code     text,
  ADD COLUMN IF NOT EXISTS diagnosis_label    text,
  ADD COLUMN IF NOT EXISTS differential_dx    text,
  ADD COLUMN IF NOT EXISTS soap_subjective    text,
  ADD COLUMN IF NOT EXISTS soap_objective     text,
  ADD COLUMN IF NOT EXISTS soap_assessment    text,
  ADD COLUMN IF NOT EXISTS soap_plan          text,
  ADD COLUMN IF NOT EXISTS doctor             text,
  ADD COLUMN IF NOT EXISTS last_visit         date,
  ADD COLUMN IF NOT EXISTS status             text DEFAULT 'active';
