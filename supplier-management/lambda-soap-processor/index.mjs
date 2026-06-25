/**
 * dairi-soap-processor
 *
 * Triggered by S3 ObjectCreated events on *.md files in recordings/
 * Parses the filename to identify patient + professional, reads the
 * SOAP note from the markdown content, and writes it to clinical_record.
 *
 * Filename format (split on '--'):
 *   atencion--{date}--{rut}--{patientName}--dr{doctorId}--{doctorName}.md
 *   [0]       [1]     [2]    [3]            [4]            [5]
 *
 * Expected markdown structure:
 *   ## Subjetivo   (or Subjective / S)
 *   ## Objetivo    (or Objective  / O)
 *   ## Evaluación  (or Assessment / A)
 *   ## Plan        (or P)
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import pg from "pg";

const { Pool } = pg;
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

const pool = new Pool({
  host:                    process.env.DB_HOST,
  port:                    parseInt(process.env.DB_PORT || "5432"),
  database:                process.env.DB_NAME,
  user:                    process.env.DB_USER,
  password:                process.env.DB_PASSWORD,
  ssl:                     { rejectUnauthorized: false },
  max:                     3,
  idleTimeoutMillis:       20000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", err =>
  console.error(JSON.stringify({ level: "ERROR", msg: "DB pool error", error: err.message }))
);

// ── Filename parser ────────────────────────────────────────────────────────────

/**
 * Parses: atencion--2026-06-25-10-30-00--12345678K--Maria_Lopez--dr3--Dra_Morales.md
 * Returns null if the format doesn't match.
 */
function parseFilename(key) {
  const base  = key.split("/").pop().replace(/\.md$/i, "");
  const parts = base.split("--");
  if (parts.length !== 6 || parts[0] !== "atencion") return null;

  const [, rawDate, rut, patientSafe, drPart, doctorSafe] = parts;

  const drMatch = drPart.match(/^dr(\d+)$/i);
  if (!drMatch) return null;

  // 2026-06-25-10-30-00 → 2026-06-25T10:30:00
  const encounterDate = rawDate.replace(
    /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/,
    "$1-$2-$3T$4:$5:$6"
  );

  return {
    encounterDate,
    rut,
    patientName: patientSafe.replace(/_/g, " "),
    doctorId:    parseInt(drMatch[1], 10),
    doctorName:  doctorSafe.replace(/_/g, " "),
  };
}

// ── SOAP markdown parser ───────────────────────────────────────────────────────

const SOAP_ALIASES = {
  // Spanish
  subjetivo:  "subjective",
  objetivo:   "objective",
  evaluacion: "assessment",
  evaluacion_clinica: "assessment",
  impresion:  "assessment",
  plan:       "plan",
  plan_de_tratamiento: "plan",
  // English
  subjective: "subjective",
  objective:  "objective",
  assessment: "assessment",
  plan_of_care: "plan",
  // Single-letter SOAP
  s: "subjective",
  o: "objective",
  a: "assessment",
  p: "plan",
};

function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip diacritics
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseSoap(content) {
  const soap   = { subjective: "", objective: "", assessment: "", plan: "" };
  const lines  = content.split(/\r?\n/);
  let current  = null;
  const buf    = [];

  const flush = () => {
    if (current !== null) {
      soap[current] = buf.splice(0).join("\n").trim();
    }
  };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,4}\s+(.+)/);
    if (headingMatch) {
      flush();
      const key = normalize(headingMatch[1]);

      // Exact match first, then prefix match
      current = SOAP_ALIASES[key] ?? null;
      if (!current) {
        for (const [alias, section] of Object.entries(SOAP_ALIASES)) {
          if (key.startsWith(alias)) { current = section; break; }
        }
      }
    } else if (current !== null) {
      buf.push(line);
    }
  }
  flush();
  return soap;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data",  c => chunks.push(Buffer.from(c)));
    stream.on("end",   () => resolve(Buffer.concat(chunks).toString("utf-8")));
    stream.on("error", reject);
  });
}

// ── Handler ────────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key    = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    console.log(JSON.stringify({ msg: "S3 event received", bucket, key }));

    // ── 1. Validate file ────────────────────────────────────────────────────
    if (!key.toLowerCase().endsWith(".md")) {
      console.log(JSON.stringify({ msg: "Skipping — not .md", key }));
      continue;
    }

    // ── 2. Parse filename ────────────────────────────────────────────────────
    const meta = parseFilename(key);
    if (!meta) {
      console.error(JSON.stringify({
        msg: "Filename format unrecognized — expected atencion--date--rut--patient--drId--doctor.md",
        key,
      }));
      continue;
    }
    console.log(JSON.stringify({ msg: "Filename parsed", ...meta }));

    // ── 3. Read .md from S3 ─────────────────────────────────────────────────
    let content;
    try {
      const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      content   = await streamToString(obj.Body);
    } catch (err) {
      console.error(JSON.stringify({ msg: "S3 read failed", key, error: err.message }));
      continue;
    }

    // ── 4. Parse SOAP sections ───────────────────────────────────────────────
    const soap    = parseSoap(content);
    const hasSoap = soap.subjective || soap.objective || soap.assessment || soap.plan;

    if (!hasSoap) {
      // No recognizable headings — store full content as subjective fallback
      console.warn(JSON.stringify({ msg: "No SOAP headings found, using raw content as Subjetivo", key }));
      soap.subjective = content.trim();
    }

    console.log(JSON.stringify({
      msg:           "SOAP parsed",
      hasSubjective: !!soap.subjective,
      hasObjective:  !!soap.objective,
      hasAssessment: !!soap.assessment,
      hasPlan:       !!soap.plan,
    }));

    // ── 5. DB operations ─────────────────────────────────────────────────────
    const client = await pool.connect();
    try {

      // 5a. Find patient by RUT (fallback: name)
      let patientId;
      const byRut = await client.query(
        "SELECT id FROM patient WHERE rut = $1 LIMIT 1",
        [meta.rut]
      );

      if (byRut.rowCount > 0) {
        patientId = byRut.rows[0].id;
      } else {
        console.warn(JSON.stringify({ msg: "RUT not found, trying name", rut: meta.rut }));
        const byName = await client.query(
          "SELECT id FROM patient WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1",
          [meta.patientName]
        );
        if (byName.rowCount === 0) {
          console.error(JSON.stringify({
            msg: "Patient not found in DB — skipping",
            rut: meta.rut,
            name: meta.patientName,
          }));
          continue;
        }
        patientId = byName.rows[0].id;
      }

      // 5b. Find latest clinical_record for the patient
      const recRes = await client.query(
        `SELECT id, encounters
         FROM   clinical_record
         WHERE  patient_id = $1
         ORDER  BY created_at DESC
         LIMIT  1`,
        [patientId]
      );

      if (recRes.rowCount === 0) {
        console.error(JSON.stringify({
          msg: "No clinical_record found for patient — skipping",
          patientId,
        }));
        continue;
      }

      const crId       = recRes.rows[0].id;
      const rawEnc     = recRes.rows[0].encounters;
      const encounters = Array.isArray(rawEnc)
        ? rawEnc
        : (rawEnc ? JSON.parse(rawEnc) : []);

      // 5c. Build new encounter entry
      const newEncounter = {
        encounterDate:  meta.encounterDate,
        soapSubjective: soap.subjective  || null,
        soapObjective:  soap.objective   || null,
        soapAssessment: soap.assessment  || null,
        soapPlan:       soap.plan        || null,
        doctor:         meta.doctorName,
        doctorId:       meta.doctorId,
        source:         "audio-transcription",
        audioKey:       key,
        status:         "active",
      };

      const updatedEncounters = [newEncounter, ...encounters];

      // 5d. Update clinical_record: flat SOAP columns + encounters JSONB
      await client.query(
        `UPDATE clinical_record
         SET soap_subjective = $1,
             soap_objective  = $2,
             soap_assessment = $3,
             soap_plan       = $4,
             doctor          = $5,
             encounters      = $6,
             last_visit      = $7::timestamptz,
             updated_at      = NOW()
         WHERE id = $8`,
        [
          soap.subjective  || null,
          soap.objective   || null,
          soap.assessment  || null,
          soap.plan        || null,
          meta.doctorName,
          JSON.stringify(updatedEncounters),
          meta.encounterDate,
          crId,
        ]
      );

      console.log(JSON.stringify({
        msg:              "SOAP written to DB",
        clinicalRecordId: crId,
        patientId,
        doctorId:         meta.doctorId,
        encounterDate:    meta.encounterDate,
        totalEncounters:  updatedEncounters.length,
      }));

    } catch (dbErr) {
      console.error(JSON.stringify({ msg: "DB error", error: dbErr.message, stack: dbErr.stack, key }));
    } finally {
      client.release();
    }
  }

  return { statusCode: 200 };
};
