import pg from "pg";
import { createHmac } from "crypto";

const { Pool } = pg;

// ── Logger ─────────────────────────────────────────────────────────────────────
const log = (level, msg, data) => {
  const entry = { ts: new Date().toISOString(), level, msg };
  if (data !== undefined) entry.data = data;
  console[level === "ERROR" ? "error" : "log"](JSON.stringify(entry));
};

// ── DB pool ────────────────────────────────────────────────────────────────────
log("INFO", "dairi-book cold start");

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },
  max:      5,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 5000,
});
pool.on("error", (err) => log("ERROR", "Pool idle error", { message: err.message }));

// ── Config ─────────────────────────────────────────────────────────────────────
const FLOW_BASE_URL        = process.env.FLOW_BASE_URL        || "https://sandbox.flow.cl/api";
const FLOW_API_KEY         = process.env.FLOW_API_KEY         || "";
const FLOW_SECRET_KEY      = process.env.FLOW_SECRET_KEY      || "";
const BOOK_FUNCTION_URL    = process.env.BOOK_FUNCTION_URL    || "";
const APP_URL              = process.env.APP_URL              || "http://friquelme-firstpage.s3-website-sa-east-1.amazonaws.com";
const CONSULTATION_AMOUNT  = parseInt(process.env.CONSULTATION_AMOUNT || "25000");

// ── DB: ensure appointment_payment table exists ────────────────────────────────
let schemaReady = false;
async function ensureSchema(client) {
  if (schemaReady) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS appointment_payment (
      id              SERIAL PRIMARY KEY,
      appointment_id  INTEGER REFERENCES appointment(id) ON DELETE CASCADE,
      payment_id      INTEGER REFERENCES payment(id),
      flow_token      TEXT UNIQUE,
      flow_order      BIGINT,
      commerce_order  TEXT,
      amount          NUMERIC(10,2),
      currency        TEXT    DEFAULT 'CLP',
      status          TEXT    DEFAULT 'pending',
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Idempotent migration for existing deployments that predate payment_id
  await client.query(`
    ALTER TABLE appointment_payment
    ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payment(id)
  `);
  schemaReady = true;
  log("INFO", "DB schema ready");
}

// ── Flow helpers ───────────────────────────────────────────────────────────────
function flowSign(params) {
  const str = Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha256", FLOW_SECRET_KEY).update(str).digest("hex");
}

async function flowPost(endpoint, params) {
  const p = { ...params, apiKey: FLOW_API_KEY };
  p.s = flowSign(p);
  const res = await fetch(`${FLOW_BASE_URL}/${endpoint}`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams(p).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Flow ${endpoint} HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function flowGet(endpoint, params) {
  const p = { ...params, apiKey: FLOW_API_KEY };
  p.s = flowSign(p);
  const res = await fetch(`${FLOW_BASE_URL}/${endpoint}?${new URLSearchParams(p).toString()}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`Flow ${endpoint} HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

// ── Book helpers ───────────────────────────────────────────────────────────────
async function findProfessional(client, idOrToken) {
  const numId = parseInt(idOrToken);
  const res = !isNaN(numId)
    ? await client.query("SELECT * FROM professional WHERE id = $1 AND active = true LIMIT 1", [numId])
    : await client.query("SELECT * FROM professional WHERE booking_token = $1 AND active = true LIMIT 1", [idOrToken]);
  return res.rowCount > 0 ? res.rows[0] : null;
}

function generateConfirmCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── HTTP response helper ───────────────────────────────────────────────────────
function resp(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type":                 "application/json",
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

// ── Lambda entry point ─────────────────────────────────────────────────────────
export const handler = async (event) => {
  const method  = (event.requestContext?.http?.method || event.httpMethod || "GET").toUpperCase();
  const rawPath = event.rawPath || event.path || "/";
  const qs      = event.queryStringParameters ?? {};

  if (method === "OPTIONS") return resp(204, {});

  // Parse body: JSON for Angular calls, form-encoded for Flow webhook
  let body = null;
  if (event.body) {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    try       { body = JSON.parse(raw); }
    catch (_) { body = Object.fromEntries(new URLSearchParams(raw)); }
  }

  log("INFO", "Request", { method, rawPath });

  let client;
  try {
    client = await pool.connect();
    await ensureSchema(client);
    return await route(client, method, rawPath, body, qs);
  } catch (err) {
    log("ERROR", "Unhandled error", { message: err.message, rawPath, method });
    return resp(500, { message: "Error interno del servidor" });
  } finally {
    client?.release();
  }
};

// ── Router ─────────────────────────────────────────────────────────────────────
async function route(client, method, rawPath, body, qs) {

  // ── Flow webhook: POST /payment/confirm ───────────────────────────────────
  if (rawPath === "/payment/confirm") {
    if (method !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
    const token = body?.token;
    if (!token) return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: "ok" };

    try {
      const flowStatus = await flowGet("payment/getStatus", { token });
      // Flow status codes: 1=pending, 2=paid, 3=rejected, 4=cancelled
      const payStatus = flowStatus.status === 2 ? "paid"
                      : flowStatus.status === 3 ? "rejected"
                      : flowStatus.status === 4 ? "cancelled"
                      : "pending";

      // Resolve the appointment_payment row to get linked IDs
      const apRec = await client.query(
        `SELECT appointment_id, payment_id FROM appointment_payment WHERE flow_token = $1`,
        [token]
      );

      // Update appointment_payment status
      await client.query(
        `UPDATE appointment_payment SET status = $1, updated_at = NOW() WHERE flow_token = $2`,
        [payStatus, token]
      );

      if (apRec.rowCount > 0) {
        const { appointment_id: apptId, payment_id: paymentId } = apRec.rows[0];

        // Mirror status to the ledger payment row
        if (paymentId) {
          const ledgerStatus = payStatus === "paid" ? "paid"
                             : payStatus === "cancelled" ? "cancelled"
                             : "pending";
          await client.query(
            `UPDATE payment SET status = $1 WHERE id = $2`,
            [ledgerStatus, paymentId]
          );
        }

        // When paid, promote appointment to 'confirmed'
        if (payStatus === "paid" && apptId) {
          await client.query(
            `UPDATE appointment SET status = 'confirmed' WHERE id = $1 AND status = 'scheduled'`,
            [apptId]
          );
        }
      }

      log("INFO", "Payment webhook handled", { token, payStatus });
    } catch (err) {
      log("ERROR", "Webhook processing error", { message: err.message, token });
    }

    // Flow requires HTTP 200 within 15s
    return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: "OK" };
  }

  // ── Payment status: GET /api/book/payment/status?token= ───────────────────
  if (rawPath === "/api/book/payment/status" && method === "GET") {
    const token = qs.token;
    if (!token) return resp(400, { message: "token requerido" });
    try {
      const flowStatus = await flowGet("payment/getStatus", { token });
      const payStatus = flowStatus.status === 2 ? "paid"
                      : flowStatus.status === 3 ? "rejected"
                      : flowStatus.status === 4 ? "cancelled"
                      : "pending";
      return resp(200, {
        status:        payStatus,
        flowStatus:    flowStatus.status,
        amount:        flowStatus.amount,
        currency:      flowStatus.currency,
        commerceOrder: flowStatus.commerceOrder,
        flowOrder:     flowStatus.flowOrder,
      });
    } catch (err) {
      log("ERROR", "getStatus error", { message: err.message });
      return resp(502, { message: "Error consultando estado de pago" });
    }
  }

  // ── GET /api/book → list active professionals ─────────────────────────────
  if (rawPath === "/api/book" && method === "GET") {
    const r = await client.query(`
      SELECT id, name, specialty, consultation_duration, working_days, video_consultation
      FROM professional WHERE active = true ORDER BY name
    `);
    return resp(200, r.rows.map((p) => ({
      id:            String(p.id),
      nombre:        p.name,
      especialidad:  p.specialty,
      duration:      p.consultation_duration,
      workDays:      p.working_days,
      videoconsulta: p.video_consultation,
    })));
  }

  // ── PUT /api/book/appointment/{id}/meet-link ──────────────────────────────
  const meetMatch = rawPath.match(/^\/api\/book\/appointment\/(\d+)\/meet-link$/);
  if (meetMatch) {
    if (method !== "PUT") return resp(405, { message: "Método no permitido" });
    await client.query(
      "UPDATE appointment SET meet_link = $1 WHERE id = $2",
      [body?.meetLink ?? null, parseInt(meetMatch[1])]
    );
    return resp(200, { success: true });
  }

  // ── GET /api/book/{id}/slots?date=YYYY-MM-DD ──────────────────────────────
  const slotsMatch = rawPath.match(/^\/api\/book\/([^/]+)\/slots$/);
  if (slotsMatch) {
    if (method !== "GET") return resp(405, { message: "Método no permitido" });
    const date = qs.date;
    if (!date) return resp(400, { message: "Parámetro date requerido" });

    const prof = await findProfessional(client, slotsMatch[1]);
    if (!prof) return resp(404, { message: "Profesional no encontrado" });

    const booked = await client.query(
      `SELECT to_char(datetime AT TIME ZONE 'America/Santiago', 'HH24:MI') AS t
       FROM appointment
       WHERE professional_id = $1
         AND (datetime AT TIME ZONE 'America/Santiago')::date = $2::date
         AND status NOT IN ('cancelled', 'no_show')`,
      [prof.id, date]
    );
    const bookedSet = new Set(booked.rows.map((r) => r.t));
    const dur = prof.consultation_duration || 45;
    const slots = [];
    for (let mins = 9 * 60; mins + dur <= 18 * 60; mins += dur) {
      const h = String(Math.floor(mins / 60)).padStart(2, "0");
      const m = String(mins % 60).padStart(2, "0");
      if (!bookedSet.has(`${h}:${m}`)) slots.push(`${h}:${m}`);
    }
    return resp(200, slots);
  }

  // ── /api/book/{id} → GET booking info | POST create appointment ───────────
  const profMatch = rawPath.match(/^\/api\/book\/([^/]+)$/);
  if (profMatch) {
    const prof = await findProfessional(client, profMatch[1]);
    if (!prof) return resp(404, { message: "Profesional no encontrado" });

    // GET → booking info
    if (method === "GET") {
      return resp(200, {
        professionalId: String(prof.id),
        doctorName:     prof.name,
        specialty:      prof.specialty,
        clinicName:     "Dairi Clínica",
        duration:       prof.consultation_duration,
        workDays:       prof.working_days,
        videoconsulta:  prof.video_consultation,
      });
    }

    // POST → create appointment + payment order
    if (method === "POST") {
      const { date, time, patientName, patientEmail, patientPhone, patientRut, reason, modality } = body ?? {};
      if (!date || !time || !patientName || !patientEmail || !patientRut) {
        return resp(400, { message: "Faltan campos obligatorios: date, time, patientName, patientEmail, patientRut" });
      }

      // Find or create patient by RUT
      let patientId;
      const existing = await client.query("SELECT id FROM patient WHERE rut = $1 LIMIT 1", [patientRut]);
      if (existing.rowCount > 0) {
        patientId = existing.rows[0].id;
      } else {
        const created = await client.query(
          "INSERT INTO patient (name, email, phone, rut) VALUES ($1, $2, $3, $4) RETURNING id",
          [patientName, patientEmail, patientPhone || null, patientRut]
        );
        patientId = created.rows[0].id;
      }

      const datetimeStr  = `${date}T${time}:00`;
      const confirmCode  = generateConfirmCode();
      const dbModality   = modality === "video" ? "video" : modality === "phone" ? "phone" : "in_person";
      const amount       = prof.consultation_price ?? prof.price ?? CONSULTATION_AMOUNT;

      const appt = await client.query(
        `INSERT INTO appointment
           (patient_id, professional_id, datetime, duration_minutes, service, modality, status, reason, confirm_code)
         VALUES ($1, $2, $3 AT TIME ZONE 'America/Santiago', $4, $5, $6, 'scheduled', $7, $8)
         RETURNING id, confirm_code, modality`,
        [patientId, prof.id, datetimeStr, prof.consultation_duration, prof.specialty, dbModality, reason || null, confirmCode]
      );
      const row    = appt.rows[0];
      const apptId = row.id;

      // ── Ledger payment row (always created, regardless of Flow) ───────────
      const invoiceNumber = `RCV-${apptId}`;
      const concept       = `Consulta ${prof.specialty} - ${prof.name}`;

      let paymentId = null;
      try {
        const payRec = await client.query(
          `INSERT INTO payment
             (patient_name, invoice_number, date, concept, amount, payment_method, status,
              professional_name, notes)
           VALUES ($1, $2, $3, $4, $5, NULL, 'pending', $6, $7)
           RETURNING id`,
          [
            patientName,
            invoiceNumber,
            date,
            concept,
            amount,
            prof.name,
            `Cita agendada online. Código: ${confirmCode}`,
          ]
        );
        paymentId = payRec.rows[0].id;
        log("INFO", "Ledger payment created", { paymentId, apptId });
      } catch (err) {
        // Non-fatal: log and continue (appointment already committed)
        log("ERROR", "Ledger payment insert error", { message: err.message, apptId });
      }

      // ── Flow payment order ─────────────────────────────────────────────────
      let paymentLink = null;
      if (FLOW_API_KEY && FLOW_SECRET_KEY) {
        try {
          const commerceOrder    = `APPT-${apptId}-${Date.now()}`;
          const urlConfirmation  = `${BOOK_FUNCTION_URL}/payment/confirm`;
          const urlReturn        = `${APP_URL}/book/payment-result`;

          // payment/createEmail: creates the order AND sends payment email to the customer
          const flowResp = await flowPost("payment/createEmail", {
            commerceOrder,
            subject:       `Pago de consulta con ${prof.name} — ${date} ${time}`,
            currency:      "CLP",
            amount:        String(amount),
            email:         patientEmail,
            paymentMethod: "9",
            urlConfirmation,
            urlReturn,
          });

          paymentLink = `${flowResp.url}?token=${flowResp.token}`;

          await client.query(
            `INSERT INTO appointment_payment
               (appointment_id, payment_id, flow_token, flow_order, commerce_order, amount, currency, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'CLP', 'pending')`,
            [apptId, paymentId, flowResp.token, flowResp.flowOrder ?? null, commerceOrder, amount]
          );

          log("INFO", "Flow payment created", { apptId, commerceOrder, flowOrder: flowResp.flowOrder });
        } catch (err) {
          // Payment failure must NOT cancel the booking — degrade gracefully
          log("ERROR", "Flow payment error", { message: err.message, apptId });
        }
      } else {
        // No Flow: still persist the appointment_payment row for tracking
        if (paymentId) {
          try {
            await client.query(
              `INSERT INTO appointment_payment
                 (appointment_id, payment_id, amount, currency, status)
               VALUES ($1, $2, $3, 'CLP', 'pending')`,
              [apptId, paymentId, amount]
            );
          } catch (err) {
            log("ERROR", "appointment_payment insert error (no Flow)", { message: err.message });
          }
        }
        log("WARN", "Flow not configured — ledger payment created, no payment link sent");
      }

      return resp(201, {
        appointmentId: String(apptId),
        confirmCode:   row.confirm_code,
        doctorName:    prof.name,
        clinicName:    "Dairi Clínica",
        specialty:     prof.specialty,
        date,
        time,
        patientName,
        modality:      row.modality,
        meetLink:      null,
        paymentLink,
        paymentAmount: amount,
      });
    }

    return resp(405, { message: "Método no permitido" });
  }

  return resp(404, { message: "Ruta no encontrada", path: rawPath });
}
