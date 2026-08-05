import pg from "pg";
import { createHmac, randomUUID } from "crypto";
import { DynamoDBClient, QueryCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const { Pool } = pg;

// ── DynamoDB (agenda "Starter" free plan professionals only) ───────────────────
// Agenda accounts have NO Postgres row — their public booking is served straight from
// DynamoDB. This is purely additive: Postgres is always tried first, so the Pro/Enterprise
// booking path is byte-for-byte unchanged. dairi-book runs in the VPC and reaches DynamoDB
// through the existing VPC Gateway Endpoint. Agenda plan has NO online payment (no Flow).
const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const AGENDA_ACCOUNTS_TABLE     = process.env.AGENDA_ACCOUNTS_TABLE     || "dairi-agenda-accounts";
const AGENDA_APPOINTMENTS_TABLE = process.env.AGENDA_APPOINTMENTS_TABLE || "dairi-agenda-appointments";

// ── Logger ─────────────────────────────────────────────────────────────────────
const log = (level, msg, data) => {
  const entry = { ts: new Date().toISOString(), level, msg };
  if (data !== undefined) entry.data = data;
  console[level === "ERROR" ? "error" : "log"](JSON.stringify(entry));
};

log("INFO", "dairi-book cold start");

// ── DB pool ────────────────────────────────────────────────────────────────────
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
const FLOW_BASE_URL       = process.env.FLOW_BASE_URL       || "https://sandbox.flow.cl/api";
const FLOW_API_KEY        = process.env.FLOW_API_KEY        || "";
const FLOW_SECRET_KEY     = process.env.FLOW_SECRET_KEY     || "";
const BOOK_FUNCTION_URL   = process.env.BOOK_FUNCTION_URL   || "";
const APP_URL             = process.env.APP_URL             || "https://dairi.cl";
const CONSULTATION_AMOUNT = parseInt(process.env.CONSULTATION_AMOUNT || "25000");
const APP_SECRET          = process.env.APP_SECRET          || "";

// ── Rate limiter ───────────────────────────────────────────────────────────────
// POST /api/book/{id}: max 5 requests per IP per 10 minutes (booking creation)
// All other routes:   max 60 requests per IP per minute
const rateLimitStore = new Map();
const POST_LIMIT  = 5;
const POST_WINDOW = 10 * 60 * 1000;
const GET_LIMIT   = 60;
const GET_WINDOW  = 60 * 1000;

// Purge stale entries to avoid unbounded memory growth in long-lived containers
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

function checkRateLimit(ip, isPost) {
  const max    = isPost ? POST_LIMIT  : GET_LIMIT;
  const window = isPost ? POST_WINDOW : GET_WINDOW;
  const key    = `${isPost ? "p" : "g"}:${ip}`;
  const now    = Date.now();
  const entry  = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + window });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

function getClientIp(event) {
  return (
    event.requestContext?.http?.sourceIp ||
    event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// ── Input validation ───────────────────────────────────────────────────────────
const RE_DATE  = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const RE_TIME  = /^([01]\d|2[0-3]):[0-5]\d$/;
const RE_EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
// Accepts: 12345678-9, 12345678-K, 123456789 (sin guión)
const RE_RUT   = /^(\d{7,8}-[\dkK]|\d{7,9})$/;

function validateBookingBody(body) {
  const errors = [];
  const date   = String(body.date         ?? "").trim();
  const time   = String(body.time         ?? "").trim();
  const name   = String(body.patientName  ?? "").trim();
  const email  = String(body.patientEmail ?? "").trim().toLowerCase();
  const rut    = String(body.patientRut   ?? "").trim().replace(/\./g, "");
  const phone  = body.patientPhone ? String(body.patientPhone).trim().slice(0, 20) : null;
  const reason = body.reason       ? String(body.reason).trim().slice(0, 1000)     : null;

  if (!RE_DATE.test(date)) {
    errors.push("date debe tener formato YYYY-MM-DD");
  } else {
    const todaySantiago = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Santiago" });
    if (date < todaySantiago) errors.push("No se pueden agendar citas en fechas pasadas");
    else if (date === todaySantiago && RE_TIME.test(time)) {
      const nowSantiago = new Date().toLocaleTimeString("sv-SE", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" });
      if (time < nowSantiago) errors.push("No se pueden agendar citas en horas pasadas");
    }
  }

  if (!RE_TIME.test(time)) errors.push("time debe tener formato HH:MM (00:00 – 23:59)");

  if (name.length < 2)   errors.push("patientName demasiado corto (mínimo 2 caracteres)");
  if (name.length > 150) errors.push("patientName demasiado largo (máximo 150 caracteres)");

  if (!RE_EMAIL.test(email)) errors.push("patientEmail no es válido");
  if (email.length > 255)    errors.push("patientEmail demasiado largo");

  if (!RE_RUT.test(rut)) errors.push("patientRut inválido (formato: 12345678-9 o 12345678-K)");

  return { errors, date, time, name, email, rut, phone, reason };
}

// ── Generates a short-lived HMAC token (valid 10 min) ─────────────────────────
function generateBookingToken(appointmentId, amount) {
  const window = Math.floor(Date.now() / 600000);
  return createHmac("sha256", APP_SECRET)
    .update(`${appointmentId}:${amount}:${window}`)
    .digest("hex");
}

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
  await client.query(`
    ALTER TABLE appointment_payment
    ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payment(id)
  `);
  // Prevents two patients from booking the same professional/slot concurrently.
  // POST /api/book/{id} previously inserted unconditionally — a race (or a stale
  // /slots response) could double-book the same datetime. The partial index only
  // applies to live appointments, so a cancelled/no-show slot can be rebooked.
  // Wrapped: if pre-existing duplicate rows make the index creation fail, don't
  // block every request forever — log and keep going (INSERT-time check below
  // still catches new races via ON CONFLICT DO NOTHING).
  try {
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_no_double_book
      ON appointment (professional_id, datetime)
      WHERE status NOT IN ('cancelled', 'no_show')
    `);
  } catch (err) {
    log("ERROR", "Could not create no-double-book index (likely pre-existing duplicates)", { message: err.message });
  }
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
// professional.rating_avg / rating_count son columnas materializadas que mantiene el trigger
// `trg_professional_rating_refresh` sobre `professional_rating` (migración 015). pg devuelve
// NUMERIC como string, así que hay que convertirlo o el frontend recibe "4.3" en vez de 4.3.
// Un profesional sin calificaciones queda en { ratingAvg: null, ratingCount: 0 } — el frontend
// oculta el bloque de estrellas en ese caso, no muestra 0 estrellas.
function ratingFields(prof) {
  const count = Number(prof?.rating_count) || 0;
  const avg = prof?.rating_avg == null ? null : Number(prof.rating_avg);
  return {
    ratingAvg:   count > 0 && avg != null && !isNaN(avg) ? avg : null,
    ratingCount: count,
  };
}

async function findProfessional(client, idOrToken) {
  const numId = parseInt(idOrToken);
  const res = !isNaN(numId)
    ? await client.query("SELECT * FROM professional WHERE id = $1 AND active = true LIMIT 1", [numId])
    : await client.query("SELECT * FROM professional WHERE booking_token = $1 AND active = true LIMIT 1", [idOrToken]);
  if (res.rowCount > 0) return res.rows[0];

  // Fallback: agenda accounts (DynamoDB). The public identifier is the accountId (uuid),
  // resolved via the accountId-index GSI. Only reached on a Postgres miss, so this never
  // affects existing Pro/Enterprise professionals.
  if (isNaN(numId)) {
    const agenda = await findAgendaProfessional(idOrToken);
    if (agenda) return agenda;
  }
  return null;
}

// Resolve an agenda account by accountId and normalize it to the `professional` row shape
// the booking routes already consume (id, name, specialty, consultation_duration, ...).
async function findAgendaProfessional(accountId) {
  try {
    const r = await ddb.send(new QueryCommand({
      TableName: AGENDA_ACCOUNTS_TABLE,
      IndexName: "accountId-index",
      KeyConditionExpression: "accountId = :a",
      ExpressionAttributeValues: marshall({ ":a": accountId }),
      Limit: 1
    }));
    if (!r.Items || r.Items.length === 0) return null;
    const a = unmarshall(r.Items[0]);
    if (a.active === false || !a.emailVerified) return null;
    return {
      id:                    a.accountId,
      _agenda:               true,
      name:                  a.name,
      specialty:             a.specialty ?? "Consulta general",
      consultation_duration: Number(a.consultationDuration) || 45,
      working_days:          a.workingDays ?? null,
      video_consultation:    a.videoConsultation ?? false,
      // Las cuentas agenda (Starter) viven sólo en DynamoDB, no tienen fila en `professional`
      // y por lo tanto no tienen calificaciones. Se normalizan a "sin calificaciones".
      rating_avg:            null,
      rating_count:          0,
      consultation_price:    a.consultationPrice != null ? Number(a.consultationPrice) : null,
      active:                a.active !== false
    };
  } catch (err) {
    log("ERROR", "findAgendaProfessional error", { message: err.message, accountId });
    return null;
  }
}

// Booked HH:MM times for an agenda professional on a given date (America/Santiago),
// excluding cancelled/no_show. Query by partition key only — no Scan.
async function agendaBookedTimes(professionalId, date) {
  const r = await ddb.send(new QueryCommand({
    TableName: AGENDA_APPOINTMENTS_TABLE,
    KeyConditionExpression: "professionalId = :p",
    ExpressionAttributeValues: marshall({ ":p": String(professionalId) })
  }));
  const set = new Set();
  for (const it of (r.Items ?? [])) {
    const a = unmarshall(it);
    if (a.status === "cancelled" || a.status === "no_show") continue;
    // dateTime stored as "YYYY-MM-DDTHH:MM[:SS]" in Santiago local time
    if (typeof a.dateTime === "string" && a.dateTime.slice(0, 10) === date) {
      set.add(a.dateTime.slice(11, 16));
    }
  }
  return set;
}

// Create a public booking for an agenda professional directly in DynamoDB. No patient
// table, no clinical_record, no payment ledger, no Flow — agenda is a free, no-online-pay
// tier. Double-book guard is check-then-act (query booked slots, then conditional Put):
// acceptable for a single-professional, low-concurrency tier (documented trade-off vs the
// Postgres partial unique index used for Pro/Enterprise).
async function bookAgenda(prof, { date, time, name, email, rut, phone, reason, modality }) {
  const booked = await agendaBookedTimes(prof.id, date);
  if (booked.has(time)) {
    return resp(409, { message: "Ese horario ya no está disponible. Por favor elige otro horario." });
  }

  const appointmentId = randomUUID();
  const confirmCode   = generateConfirmCode();
  const dbModality    = modality === "video" ? "video" : modality === "phone" ? "phone" : "in_person";
  const now           = new Date().toISOString();

  const item = {
    professionalId:   String(prof.id),
    appointmentId,
    status:           "scheduled",
    service:          prof.specialty ?? "Consulta",
    modality:         dbModality,
    dateTime:         `${date}T${time}:00`,
    durationMinutes:  prof.consultation_duration ?? 45,
    reason:           reason ?? null,
    confirmCode,
    patientName:      name,
    patientEmail:     email,
    patientPhone:     phone ?? null,
    patientRut:       rut,
    professionalName: prof.name,
    createdAt:        now,
    updatedAt:        now
  };

  try {
    await ddb.send(new PutItemCommand({
      TableName: AGENDA_APPOINTMENTS_TABLE,
      Item: marshall(item, { removeUndefinedValues: true }),
      ConditionExpression: "attribute_not_exists(appointmentId)"
    }));
  } catch (err) {
    log("ERROR", "Agenda booking put error", { message: err.message, appointmentId });
    return resp(500, { message: "No se pudo registrar la cita. Intenta nuevamente." });
  }

  log("INFO", "Agenda booking created", { professionalId: prof.id, appointmentId });
  return resp(201, {
    appointmentId: String(appointmentId),
    confirmCode,
    doctorName:    prof.name,
    clinicName:    "Dairi",
    specialty:     prof.specialty,
    date,
    time,
    patientName:   name,
    modality:      dbModality,
    meetLink:      null,
    paymentLink:   null,
    paymentAmount: null,
    bookingToken:  undefined
  });
}

// ── Applies a resolved Flow payment status to appointment_payment / payment / appointment ──
// Shared by /payment/confirm (calls Flow itself — only reachable if this Lambda ever gets
// internet egress) and /payment/apply-status (status already resolved by dairi-payment,
// which IS reachable from Flow since it isn't VPC-attached — see route comment below).
async function applyPaymentStatus(client, { token, commerceOrder, flowOrder, payStatus }) {
  let apRec = await client.query(
    `SELECT id, appointment_id, payment_id FROM appointment_payment WHERE flow_token = $1`,
    [token]
  );

  if (apRec.rowCount > 0) {
    await client.query(
      `UPDATE appointment_payment SET status = $1, updated_at = NOW() WHERE flow_token = $2`,
      [payStatus, token]
    );
  } else {
    const match = commerceOrder?.match(/^APPT-(\d+)-/);
    if (match) {
      const apptId = parseInt(match[1]);
      apRec = await client.query(
        `SELECT id, appointment_id, payment_id FROM appointment_payment
         WHERE appointment_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [apptId]
      );
      if (apRec.rowCount > 0) {
        await client.query(
          `UPDATE appointment_payment
           SET flow_token = $1, commerce_order = $2, flow_order = $3, status = $4, updated_at = NOW()
           WHERE id = $5`,
          [token, commerceOrder, flowOrder ?? null, payStatus, apRec.rows[0].id]
        );
      }
    }
  }

  if (apRec.rowCount > 0) {
    const { appointment_id: apptId, payment_id: paymentId } = apRec.rows[0];

    if (paymentId) {
      const ledgerStatus = payStatus === "paid" ? "paid"
                         : payStatus === "cancelled" ? "cancelled"
                         : "pending";
      await client.query(`UPDATE payment SET status = $1 WHERE id = $2`, [ledgerStatus, paymentId]);
    }

    if (payStatus === "paid" && apptId) {
      await client.query(
        `UPDATE appointment SET status = 'confirmed' WHERE id = $1 AND status = 'scheduled'`,
        [apptId]
      );
    }
  }

  return apRec.rowCount > 0;
}

function flowStatusCodeToPayStatus(code) {
  return code === 2 ? "paid"
       : code === 3 ? "rejected"
       : code === 4 ? "cancelled"
       : "pending";
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
      "Access-Control-Allow-Origin":  APP_URL,
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

// ── Lambda entry point ─────────────────────────────────────────────────────────
export const handler = async (event) => {
  const method  = (event.requestContext?.http?.method || event.httpMethod || "GET").toUpperCase();
  const rawPath = (event.rawPath || event.path || "/").replace(/\/+$/, "") || "/";
  const qs      = event.queryStringParameters ?? {};

  if (method === "OPTIONS") return resp(204, {});

  // Flow webhook is server-to-server — skip rate limiting
  if (rawPath !== "/payment/confirm") {
    const ip     = getClientIp(event);
    const isPost = method === "POST";
    if (!checkRateLimit(ip, isPost)) {
      log("WARN", "Rate limit exceeded", { ip, method, rawPath });
      return resp(429, { message: "Demasiadas solicitudes. Intenta más tarde." });
    }
  }

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

  // ── Flow browser return: POST /payment/return ─────────────────────────────
  // Flow POSTs to urlReturn after payment — redirect browser to the Angular SPA
  if (rawPath === "/payment/return") {
    const token = body?.token ?? qs?.token ?? "";
    const dest  = `${APP_URL}/#/book/payment-result${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    return {
      statusCode: 302,
      headers: { Location: dest, "Cache-Control": "no-store" },
      body: "",
    };
  }

  // ── Flow webhook: POST /payment/confirm ───────────────────────────────────
  // NOTE: dairi-book runs inside vpc-0e99bc3b783e6f17c, which has no NAT Gateway /
  // internet route (same root cause already found for dairi-bff↔DynamoDB/Bedrock).
  // flowGet() below therefore cannot actually reach Flow.cl from this Lambda — it
  // will fail after a long connect timeout. Kept only as a legacy fallback for any
  // in-flight Flow payment already created with urlConfirmation pointing here.
  // New payments now get urlConfirmation pointed at dairi-payment (not VPC-attached,
  // has real internet egress) — see /payment/apply-status below for the working path.
  if (rawPath === "/payment/confirm") {
    if (method !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
    const token = body?.token;
    if (!token) return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: "ok" };

    try {
      const flowStatus = await flowGet("payment/getStatus", { token });
      const payStatus = flowStatusCodeToPayStatus(flowStatus.status);
      await applyPaymentStatus(client, { token, commerceOrder: flowStatus.commerceOrder, flowOrder: flowStatus.flowOrder, payStatus });
      log("INFO", "Payment webhook handled", { token, payStatus, commerceOrder: flowStatus.commerceOrder });
    } catch (err) {
      log("ERROR", "Webhook processing error", { message: err.message, token });
    }

    return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: "OK" };
  }

  // ── Trusted status relay: POST /payment/apply-status ───────────────────────
  // Called by dairi-payment (non-VPC, actually reachable from Flow) after it verifies
  // the payment status directly with Flow's payment/getStatus. dairi-book only needs
  // to persist the already-verified result to the DB — no outbound Flow call needed,
  // so this works despite dairi-book having no internet egress. Authenticated with an
  // HMAC over the payload using APP_SECRET (shared with dairi-payment) so this internal
  // endpoint can't be used to arbitrarily flip payment/appointment status.
  if (rawPath === "/payment/apply-status") {
    if (method !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
    const { token, commerceOrder, flowOrder, status, sig } = body ?? {};
    if (!token || !status) return resp(400, { message: "token y status son requeridos" });
    if (!APP_SECRET) return resp(500, { message: "APP_SECRET no configurado" });
    const expectedSig = createHmac("sha256", APP_SECRET)
      .update(`${token}:${status}:${commerceOrder ?? ""}`)
      .digest("hex");
    if (sig !== expectedSig) {
      log("WARN", "apply-status signature mismatch", { token });
      return resp(401, { message: "Firma inválida" });
    }
    try {
      const applied = await applyPaymentStatus(client, { token, commerceOrder, flowOrder, payStatus: status });
      log("INFO", "Payment status applied", { token, status, commerceOrder, applied });
      return resp(200, { success: true, applied });
    } catch (err) {
      log("ERROR", "apply-status error", { message: err.message, token });
      return resp(500, { message: "Error aplicando estado de pago" });
    }
  }

  // ── Payment status: GET /api/book/payment/status?token= ───────────────────
  // NOTE: same VPC/no-NAT limitation as /payment/confirm above — flowGet() here
  // cannot reach Flow either. The frontend now queries payment status through
  // dairi-payment's function URL instead (see PAYMENT_LAMBDA_URL in
  // patient-booking.component.ts / payment-result.component.ts). Left in place
  // as a legacy/manual-diagnostic path only.
  if (rawPath === "/api/book/payment/status" && method === "GET") {
    const token = qs.token;
    if (!token) return resp(400, { message: "token requerido" });
    try {
      const flowStatus = await flowGet("payment/getStatus", { token });
      const payStatus = flowStatusCodeToPayStatus(flowStatus.status);
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
      SELECT id, name, specialty, consultation_duration, working_days, video_consultation,
             rating_avg, rating_count
      FROM professional WHERE active = true ORDER BY name
    `);
    return resp(200, r.rows.map((p) => ({
      id:            String(p.id),
      nombre:        p.name,
      especialidad:  p.specialty,
      duration:      p.consultation_duration,
      workDays:      p.working_days,
      videoconsulta: p.video_consultation,
      ...ratingFields(p),
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
    if (!date || !RE_DATE.test(date)) return resp(400, { message: "Parámetro date inválido (formato: YYYY-MM-DD)" });

    const prof = await findProfessional(client, slotsMatch[1]);
    if (!prof) return resp(404, { message: "Profesional no encontrado" });

    let bookedSet;
    if (prof._agenda) {
      bookedSet = await agendaBookedTimes(prof.id, date);
    } else {
      const booked = await client.query(
        `SELECT to_char(datetime AT TIME ZONE 'America/Santiago', 'HH24:MI') AS t
         FROM appointment
         WHERE professional_id = $1
           AND (datetime AT TIME ZONE 'America/Santiago')::date = $2::date
           AND status NOT IN ('cancelled', 'no_show')`,
        [prof.id, date]
      );
      bookedSet = new Set(booked.rows.map((r) => r.t));
    }
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

    if (method === "GET") {
      return resp(200, {
        professionalId: String(prof.id),
        doctorName:     prof.name,
        specialty:      prof.specialty,
        clinicName:     "Dairi Clínica",
        duration:       prof.consultation_duration,
        workDays:       prof.working_days,
        videoconsulta:  prof.video_consultation,
        ...ratingFields(prof),
      });
    }

    if (method === "POST") {
      const { errors, date, time, name, email, rut, phone, reason } = validateBookingBody(body ?? {});
      if (errors.length > 0) {
        log("WARN", "Booking validation failed", { errors });
        return resp(400, { message: errors[0], errors });
      }

      // ── Agenda ("Starter") professional: DynamoDB-only, no payment, no clinical record ──
      if (prof._agenda) {
        return await bookAgenda(prof, { date, time, name, email, rut, phone, reason, modality: body.modality });
      }

      // Find or create patient by RUT
      let patientId;
      const existing = await client.query("SELECT id FROM patient WHERE rut = $1 LIMIT 1", [rut]);
      if (existing.rowCount > 0) {
        patientId = existing.rows[0].id;
      } else {
        const created = await client.query(
          "INSERT INTO patient (name, email, phone, rut) VALUES ($1, $2, $3, $4) RETURNING id",
          [name, email, phone, rut]
        );
        patientId = created.rows[0].id;
      }

      // Find or create the initial clinical record for this patient — empty, no
      // encounters yet. Lets the doctor start registering atenciones right away
      // and gives lambda-soap-processor a record to write the first SOAP note into.
      // clinical_record.patient_id is UNIQUE (one shared record per patient, across
      // whichever professionals treat them), so the existence check is patient-only —
      // it must not also filter by professional_id or a second booking with a
      // different doctor would try to INSERT a duplicate and violate that constraint.
      try {
        const crExisting = await client.query(
          "SELECT id FROM clinical_record WHERE patient_id = $1 LIMIT 1",
          [patientId]
        );
        if (crExisting.rowCount === 0) {
          await client.query(
            "INSERT INTO clinical_record (patient_id, professional_id, status) VALUES ($1, $2, 'active')",
            [patientId, prof.id]
          );
        }
      } catch (err) {
        log("ERROR", "Initial clinical_record insert error", { message: err.message, patientId });
      }

      const datetimeStr = `${date}T${time}:00`;
      const confirmCode = generateConfirmCode();
      const dbModality  = body.modality === "video" ? "video" : body.modality === "phone" ? "phone" : "in_person";
      const amount      = prof.consultation_price ?? prof.price ?? CONSULTATION_AMOUNT;

      // ON CONFLICT DO NOTHING against idx_appointment_no_double_book (partial unique
      // index on professional_id+datetime for live appointments, created in ensureSchema)
      // — this is the authoritative, race-safe guard against double-booking a slot.
      // The /slots endpoint filters already-booked times for display, but two patients
      // can still race each other between fetching slots and submitting; the DB
      // constraint is what actually prevents the second INSERT from succeeding.
      const insertParams = [patientId, prof.id, datetimeStr, prof.consultation_duration, prof.specialty, dbModality, reason, confirmCode];
      let appt;
      try {
        appt = await client.query(
          `INSERT INTO appointment
             (patient_id, professional_id, datetime, duration_minutes, service, modality, status, reason, confirm_code)
           VALUES ($1, $2, $3::timestamp AT TIME ZONE 'America/Santiago', $4, $5, $6, 'scheduled', $7, $8)
           ON CONFLICT (professional_id, datetime) WHERE status NOT IN ('cancelled', 'no_show') DO NOTHING
           RETURNING id, confirm_code, modality`,
          insertParams
        );
      } catch (err) {
        // 42P10 = "no unique or exclusion constraint matching the ON CONFLICT specification".
        // Happens only if idx_appointment_no_double_book failed to create in ensureSchema
        // (pre-existing duplicate rows) — fall back to a plain insert so booking still works,
        // just without the race guard, rather than hard-failing every booking attempt.
        if (err.code !== "42P10") throw err;
        log("ERROR", "ON CONFLICT unsupported (index missing) — inserting without race guard", { message: err.message });
        appt = await client.query(
          `INSERT INTO appointment
             (patient_id, professional_id, datetime, duration_minutes, service, modality, status, reason, confirm_code)
           VALUES ($1, $2, $3::timestamp AT TIME ZONE 'America/Santiago', $4, $5, $6, 'scheduled', $7, $8)
           RETURNING id, confirm_code, modality`,
          insertParams
        );
      }
      if (appt.rowCount === 0) {
        return resp(409, { message: "Ese horario ya no está disponible. Por favor elige otro horario." });
      }
      const row    = appt.rows[0];
      const apptId = row.id;

      // Ledger payment row (non-fatal)
      let paymentId = null;
      try {
        const payRec = await client.query(
          `INSERT INTO payment
             (patient_id, professional_id, invoice_number, date, concept, amount, payment_method, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, NULL, 'pending', $7)
           RETURNING id`,
          [
            patientId, prof.id,
            `RCV-${apptId}`,
            date,
            `Consulta ${prof.specialty} - ${prof.name}`,
            amount,
            `Cita agendada online. Código: ${confirmCode}`,
          ]
        );
        paymentId = payRec.rows[0].id;
        log("INFO", "Ledger payment created", { paymentId, apptId });
      } catch (err) {
        log("ERROR", "Ledger payment insert error", { message: err.message, apptId });
      }

      try {
        await client.query(
          `INSERT INTO appointment_payment (appointment_id, payment_id, amount, currency, status)
           VALUES ($1, $2, $3, 'CLP', 'pending')`,
          [apptId, paymentId, amount]
        );
      } catch (err) {
        log("ERROR", "appointment_payment insert error", { message: err.message, apptId });
      }

      const bookingToken = APP_SECRET ? generateBookingToken(apptId, amount) : undefined;

      return resp(201, {
        appointmentId: String(apptId),
        confirmCode:   row.confirm_code,
        doctorName:    prof.name,
        clinicName:    "Dairi Clínica",
        specialty:     prof.specialty,
        date,
        time,
        patientName:   name,
        modality:      row.modality,
        meetLink:      null,
        paymentLink:   null,
        paymentAmount: amount,
        bookingToken,
      });
    }

    return resp(405, { message: "Método no permitido" });
  }

  return resp(404, { message: "Ruta no encontrada", path: rawPath });
}
