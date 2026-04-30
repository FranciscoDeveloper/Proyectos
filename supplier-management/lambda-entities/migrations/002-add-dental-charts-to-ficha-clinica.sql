-- Migration 002: Add odontogram and periodontogram columns to ficha_clinica
-- These columns store JSON data for dental-records only; NULL for other specialties.

ALTER TABLE ficha_clinica
  ADD COLUMN IF NOT EXISTS odontogram     JSONB,
  ADD COLUMN IF NOT EXISTS periodontogram JSONB;
