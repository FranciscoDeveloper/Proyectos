-- Resumen narrativo generado por IA (Bedrock) para la ficha clínica.
-- Se genera en el mismo paso que la nota SOAP (lambda-transcribe / transcribe-nova-3)
-- y queda embebido en la fila, para que GET /api/clinical-summary/{id} solo lo lea
-- sin necesitar una llamada a Bedrock en vivo desde dairi-bff (que está en VPC sin
-- salida a Bedrock).
-- Valores: NULL (aún no generado — ficha manual o previa a este cambio), texto (resumen).
ALTER TABLE clinical_record
  ADD COLUMN IF NOT EXISTS ai_summary TEXT DEFAULT NULL;
