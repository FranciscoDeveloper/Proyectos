-- Certificación de la ficha clínica por el profesional.
--
-- `certified` indica si el profesional valida el contenido SOAP de la ficha:
--   true  → la nota fue escrita manualmente por el profesional (o ya fue aprobada por él)
--   false → la nota fue rellenada por transcripción de voz / IA y está pendiente de validación
--
-- El default es true porque la escritura manual desde la UI es el caso normal; sólo
-- lambda-soap-processor escribe explícitamente certified = false.
ALTER TABLE clinical_record
  ADD COLUMN IF NOT EXISTS certified BOOLEAN NOT NULL DEFAULT true;

-- Las fichas cuya última escritura SOAP vino de la IA no deben quedar pre-certificadas
-- por el DEFAULT true de la columna recién creada.
UPDATE clinical_record SET certified = false WHERE soap_source = 'ai-transcription';
