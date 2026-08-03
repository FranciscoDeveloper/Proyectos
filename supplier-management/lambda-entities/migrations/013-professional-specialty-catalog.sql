-- Migration 013: professional specialty catalog + drop blocking FK on professional.user_id
--
-- Context: Pro-plan self-serve registration lets a prospective user pick a specialty
-- before any professional row exists for them. professional.user_id had a NOT NULL FK
-- to app_user(id) with ON DELETE RESTRICT, which made it impossible to pre-provision a
-- professional row ahead of admin-linking it to a real account. The FK is dropped; the
-- UNIQUE constraint on user_id is kept so a single account still can't back two rows.
--
-- Applied directly against RDS via db-access on 2026-07-31; this migration documents
-- that change for anyone rebuilding the schema from scratch.

CREATE TABLE IF NOT EXISTS professional_specialty (
  value       TEXT     PRIMARY KEY,
  label       TEXT     NOT NULL,
  sort_order  INTEGER  DEFAULT 0
);

INSERT INTO professional_specialty (value, label, sort_order) VALUES
  ('medicina-general',     'Medicina General',      1),
  ('psicologia',           'Psicología',             2),
  ('odontologia',          'Odontología',            3),
  ('kinesiologia',         'Kinesiología',           4),
  ('nutricion',            'Nutrición',              5),
  ('fonoaudiologia',       'Fonoaudiología',         6),
  ('terapia-ocupacional',  'Terapia Ocupacional',   7),
  ('matrona',              'Matrona',                8),
  ('tecnologia-medica',    'Tecnología Médica',      9)
ON CONFLICT (value) DO NOTHING;

ALTER TABLE professional DROP CONSTRAINT IF EXISTS professional_user_id_fkey;
