/**
 * dairi-soap-processor
 *
 * Triggered by S3 ObjectCreated events on *.md files in recordings/
 * Runs OUTSIDE VPC so it can reach both S3 and the internet.
 * DB writes go through the BFF API (which IS in VPC and has DB access).
 *
 * Filename format (split on '--'):
 *   atencion--{date}--{rut}--{patientName}--dr{doctorId}--{doctorName}.md
 *   [0]       [1]     [2]    [3]            [4]            [5]
 *
 * Expected markdown structure:
 *   ## Subjetivo   (or Subjective / S)
 *   ## Objetivo    (or Objective  / O)
 *   ## Evaluación  (or Assessment / A)
 *   ## Diagnóstico (or Diagnosis / Impresión Diagnóstica) — optional
 *   ## Plan        (or P)
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createHmac } from "crypto";

// jsonwebtoken is lighter than importing the full package; use inline HS256 sign
function signJwt(payload, secret) {
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body    = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 120 })).toString("base64url");
  const sig     = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

const s3      = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const BFF_URL = process.env.BFF_URL || "https://cwhwahvqr0.execute-api.us-east-1.amazonaws.com";
const JWT_SECRET = process.env.JWT_SECRET || "dairi-secret-key-2026";
// Internal service user ID — must exist in app_user and have clinical-records access
const SERVICE_USER_ID = parseInt(process.env.SERVICE_USER_ID || "4");

// ── Filename parser ────────────────────────────────────────────────────────────

function parseFilename(key) {
  // Strip compound extensions: .soap.md, .transcript.md, .md
  const filename = key.split("/").pop().replace(/\.(soap|transcript)\.md$/i, "").replace(/\.md$/i, "");
  // Strip optional numeric timestamp prefix: "1782786734181_atencion" → "atencion"
  const base  = filename.replace(/^\d+_/, "");
  const parts = base.split("--");
  if (parts.length !== 6 || parts[0] !== "atencion") return null;

  const [, rawDate, rut, patientSafe, drPart, doctorSafe] = parts;
  const drMatch = drPart.match(/^dr(\d+)$/i);
  if (!drMatch) return null;

  const encounterDate = rawDate.replace(
    /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/,
    "$1-$2-$3T$4:$5:$6"
  );

  return {
    encounterDate,
    rut:        rut.replace(/\./g, "").replace(/\s/g, ""),
    patientName: patientSafe.replace(/_/g, " "),
    doctorId:   parseInt(drMatch[1], 10),
    doctorName: doctorSafe.replace(/_/g, " "),
  };
}

// ── SOAP markdown parser ───────────────────────────────────────────────────────

const SOAP_ALIASES = {
  subjetivo: "subjective", objetivo: "objective",
  evaluacion: "assessment", evaluacion_clinica: "assessment", impresion: "assessment",
  plan: "plan", plan_de_tratamiento: "plan",
  subjective: "subjective", objective: "objective", assessment: "assessment",
  plan_of_care: "plan",
  s: "subjective", o: "objective", a: "assessment", p: "plan",
  diagnostico: "diagnosis", diagnostico_clinico: "diagnosis",
  impresion_diagnostica: "diagnosis", diagnosis: "diagnosis",
};

function normalize(s) {
  return s.toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function parseSoap(content) {
  const soap  = { subjective: "", objective: "", assessment: "", plan: "", diagnosis: "" };
  const lines = content.split(/\r?\n/);
  let current = null;
  const buf   = [];

  const flush = () => {
    if (current !== null) soap[current] = buf.splice(0).join("\n").trim();
  };

  for (const line of lines) {
    const m = line.match(/^#{1,4}\s+(.+)/);
    if (m) {
      flush();
      const key = normalize(m[1]);
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

// ── S3 helper ─────────────────────────────────────────────────────────────────

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data",  c => chunks.push(Buffer.from(c)));
    stream.on("end",   () => resolve(Buffer.concat(chunks).toString("utf-8")));
    stream.on("error", reject);
  });
}

// ── BFF API helpers ───────────────────────────────────────────────────────────

async function bffGet(path, token) {
  const res = await fetch(`${BFF_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`BFF GET ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

async function bffPut(path, token, body) {
  const res = await fetch(`${BFF_URL}${path}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BFF PUT ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Handler ────────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const token = signJwt({ sub: SERVICE_USER_ID, email: "soap-processor@dairi.cl", role: "admin" }, JWT_SECRET);

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key    = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    console.log(JSON.stringify({ msg: "S3 event", bucket, key }));

    if (!key.toLowerCase().endsWith(".md")) continue;

    // ── 1. Parse filename ──────────────────────────────────────────────────────
    const meta = parseFilename(key);
    if (!meta) {
      console.error(JSON.stringify({ msg: "Filename format unrecognized", key }));
      continue;
    }
    console.log(JSON.stringify({ msg: "Filename parsed", ...meta }));

    // ── 2. Read .md from S3 ────────────────────────────────────────────────────
    let content;
    try {
      const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      content   = await streamToString(obj.Body);
      console.log(JSON.stringify({ msg: "S3 read OK", bytes: content.length }));
    } catch (err) {
      console.error(JSON.stringify({ msg: "S3 read failed", key, error: err.message }));
      continue;
    }

    // ── 3. Parse SOAP ──────────────────────────────────────────────────────────
    const soap    = parseSoap(content);
    const hasSoap = soap.subjective || soap.objective || soap.assessment || soap.plan;
    if (!hasSoap) {
      console.warn(JSON.stringify({ msg: "No SOAP headings — raw content → Subjetivo" }));
      soap.subjective = content.trim();
    }
    console.log(JSON.stringify({ msg: "SOAP parsed", s: !!soap.subjective, o: !!soap.objective, a: !!soap.assessment, p: !!soap.plan, dx: !!soap.diagnosis }));

    // ── 4. Find patient via BFF ────────────────────────────────────────────────
    let patients;
    try {
      patients = await bffGet("/api/entities/patients", token);
    } catch (err) {
      console.error(JSON.stringify({ msg: "BFF patients fetch failed", error: err.message }));
      continue;
    }

    // Normalize RUT for comparison (strip dots/spaces)
    const normRut = (r = "") => r.replace(/\./g, "").replace(/\s/g, "");
    const patient = patients.find(p => normRut(p.rut) === meta.rut);

    if (!patient) {
      // Fallback: name match
      const byName = patients.find(p =>
        (p.name || "").toLowerCase().trim() === meta.patientName.toLowerCase().trim()
      );
      if (!byName) {
        console.error(JSON.stringify({ msg: "Patient not found", rut: meta.rut, name: meta.patientName }));
        continue;
      }
      console.warn(JSON.stringify({ msg: "Matched by name (RUT not found)", name: byName.name }));
      Object.assign(patient ?? {}, byName);
    }

    const patientId = (patient ?? patients.find(p =>
      (p.name || "").toLowerCase().trim() === meta.patientName.toLowerCase().trim()
    ))?.id;

    if (!patientId) {
      console.error(JSON.stringify({ msg: "Patient not resolved", rut: meta.rut }));
      continue;
    }
    console.log(JSON.stringify({ msg: "Patient found", patientId }));

    // ── 5. Find clinical record via BFF ───────────────────────────────────────
    let records;
    try {
      records = await bffGet("/api/entities/clinical-records", token);
    } catch (err) {
      console.error(JSON.stringify({ msg: "BFF clinical-records fetch failed", error: err.message }));
      continue;
    }

    const crList = records.filter(r => r.patientId === patientId)
                          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (crList.length === 0) {
      console.error(JSON.stringify({ msg: "No clinical_record for patient", patientId }));
      continue;
    }

    const cr        = crList[0];
    const crId      = cr.id;
    const encounters = Array.isArray(cr.encounters) ? cr.encounters : [];

    const newEncounter = {
      encounterDate:  meta.encounterDate,
      soapSubjective: soap.subjective  || null,
      soapObjective:  soap.objective   || null,
      soapAssessment: soap.assessment  || null,
      soapPlan:       soap.plan        || null,
      diagnosisLabel: soap.diagnosis   || null,
      doctor:         meta.doctorName,
      doctorId:       meta.doctorId,
      source:         "audio-transcription",
      audioKey:       key,
      status:         "active",
    };

    const updatedEncounters = [newEncounter, ...encounters];

    // ── 6. Update clinical record via BFF ─────────────────────────────────────
    try {
      const updated = await bffPut(`/api/entities/clinical-records/${crId}`, token, {
        soapSubjective: soap.subjective  || null,
        soapObjective:  soap.objective   || null,
        soapAssessment: soap.assessment  || null,
        soapPlan:       soap.plan        || null,
        ...(soap.diagnosis ? { diagnosisLabel: soap.diagnosis } : {}),
        professionalId: meta.doctorId,
        lastVisit:      meta.encounterDate,
        encounters:     updatedEncounters,
      });

      console.log(JSON.stringify({
        msg:             "SOAP written via BFF",
        clinicalRecordId: crId,
        patientId,
        doctorId:        meta.doctorId,
        encounterDate:   meta.encounterDate,
        diagnosisLabel:  soap.diagnosis || null,
        totalEncounters: updatedEncounters.length,
      }));
    } catch (err) {
      console.error(JSON.stringify({ msg: "BFF PUT failed", crId, error: err.message }));
    }
  }

  return { statusCode: 200 };
};
