-- 018-widen-vitals-to-text.sql
--
-- 8 of the 9 specialty schemas in auth.service.ts repurpose the vitals fields
-- (heartRate, temperature, o2Saturation, weight, height, bmi, respiratoryRate)
-- as free-text for specialty-specific data (e.g. dental's "Sangrado al Sondaje",
-- psych's "Afecto"). Only medicina general uses them as actual numeric vitals.
-- The clinical_record columns were only ever the numeric type medicina general
-- needs, so any other specialty saving a non-numeric string got a hard 500.
--
-- Widening to text is lossless for the numeric rows already stored (Postgres
-- casts numeric/integer -> text automatically) and unblocks the other 8
-- schemas. `bp` already went through this exact change earlier and is text
-- today, which is why it's the only vitals field that works everywhere.
--
-- Frontend already anticipated this: clinical-detail.component.ts's `vitals`
-- computed signal does `String(raw)` for display and has an isNonMedical()
-- gate that suppresses the unit/normal-range hint for non-medical specialties.
-- No frontend change needed. entities.mjs's fromDb() must stop force-parsing
-- these fields with parseInt/parseFloat (that turns non-numeric text into
-- null on read-back) — see that change alongside this migration.

ALTER TABLE clinical_record
  ALTER COLUMN heart_rate        TYPE text USING heart_rate::text,
  ALTER COLUMN respiratory_rate  TYPE text USING respiratory_rate::text,
  ALTER COLUMN temperature       TYPE text USING temperature::text,
  ALTER COLUMN o2_saturation     TYPE text USING o2_saturation::text,
  ALTER COLUMN weight             TYPE text USING weight::text,
  ALTER COLUMN height             TYPE text USING height::text,
  ALTER COLUMN bmi                TYPE text USING bmi::text;
