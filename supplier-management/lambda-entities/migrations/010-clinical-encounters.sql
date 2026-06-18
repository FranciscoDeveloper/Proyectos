-- Add encounters JSONB column and last_visit to clinical_record
-- encounters stores the list of clinical encounters as a JSON array
ALTER TABLE clinical_record
  ADD COLUMN IF NOT EXISTS encounters  JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS last_visit  DATE;
