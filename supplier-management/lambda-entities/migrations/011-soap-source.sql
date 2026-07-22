-- Indica el origen del SOAP actual en la ficha clínica
-- Valores: NULL (sin SOAP), 'ai-transcription' (generado por IA, pendiente revisión),
--          'ai-reviewed' (IA revisado y confirmado por el profesional), 'manual' (ingresado manualmente)
ALTER TABLE clinical_record
  ADD COLUMN IF NOT EXISTS soap_source TEXT DEFAULT NULL;
