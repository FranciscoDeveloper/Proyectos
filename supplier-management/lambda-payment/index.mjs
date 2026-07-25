import { createHmac } from "node:crypto";

const FLOW_API_KEY        = process.env.FLOW_API_KEY        || "";
const FLOW_SECRET_KEY     = process.env.FLOW_SECRET_KEY     || "";
const FLOW_BASE_URL       = process.env.FLOW_BASE_URL       || "https://www.flow.cl/api";
const APP_URL             = process.env.APP_URL             || "https://dairi.cl";
const BOOK_FUNCTION_URL   = process.env.BOOK_FUNCTION_URL   || "";
const APP_SECRET          = process.env.APP_SECRET          || "";
// dairi-payment's own Function URL. Used as urlConfirmation (Flow's server-to-server
// webhook target) instead of dairi-book: dairi-book runs inside a VPC with no NAT
// Gateway / internet route, so it can never reach Flow.cl to call payment/getStatus.
// dairi-payment is NOT VPC-attached (needs real internet egress to talk to Flow for
// payment/create), so Flow's webhook and status checks are routed here instead; this
// Lambda then relays the verified result to dairi-book's /payment/apply-status so it
// can persist it to the DB (which does need the VPC).
const PAYMENT_FUNCTION_URL = process.env.PAYMENT_FUNCTION_URL || "https://koxzbg6zrjrlfvx2j2kqrlokv40jkzzp.lambda-url.us-east-1.on.aws";

function resp(status, body) {
  return { statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function verifyBookingToken(token, appointmentId, amount) {
  if (!APP_SECRET || !token) return false;
  const now  = Math.floor(Date.now() / 600000);
  const sign = (w) => createHmac("sha256", APP_SECRET)
    .update(`${appointmentId}:${amount}:${w}`)
    .digest("hex");
  return token === sign(now) || token === sign(now - 1);
}

function log(level, msg, data = {}) {
  console.log(JSON.stringify({ level, msg, ...data, ts: new Date().toISOString() }));
}

function signParams(params) {
  const sorted = Object.keys(params).sort();
  const toSign = sorted.map(k => k + params[k]).join("");
  return createHmac("sha256", FLOW_SECRET_KEY).update(toSign).digest("hex");
}

async function callFlow(endpoint, params) {
  const payload = { ...params, apiKey: FLOW_API_KEY };
  payload.s = signParams(payload);

  const form = new URLSearchParams(payload);
  const url  = `${FLOW_BASE_URL}/${endpoint}`;

  log("INFO", "calling Flow", { endpoint, commerceOrder: params.commerceOrder });

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    form.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    log("ERROR", "Flow HTTP error", { status: res.status, body: text });
    throw new Error(`Flow ${endpoint} → HTTP ${res.status}: ${text}`);
  }

  let json;
  try { json = JSON.parse(text); } catch {
    log("ERROR", "Flow non-JSON response", { body: text });
    throw new Error(`Flow ${endpoint} returned non-JSON: ${text}`);
  }

  if (json.code && json.code !== 200) {
    log("ERROR", "Flow API error", { code: json.code, message: json.message });
    throw new Error(`Flow API error ${json.code}: ${json.message}`);
  }

  return json;
}

async function flowGet(endpoint, params) {
  const p = { ...params, apiKey: FLOW_API_KEY };
  p.s = signParams(p);
  const res  = await fetch(`${FLOW_BASE_URL}/${endpoint}?${new URLSearchParams(p).toString()}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`Flow ${endpoint} HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

function flowStatusCodeToPayStatus(code) {
  return code === 2 ? "paid"
       : code === 3 ? "rejected"
       : code === 4 ? "cancelled"
       : "pending";
}

// Relays a resolved payment status to dairi-book so it can persist it to the DB.
// Signed with APP_SECRET (shared with dairi-book) so /payment/apply-status can
// trust the payload without dairi-book needing to re-verify with Flow itself.
async function relayStatusToBook(token, commerceOrder, flowOrder, status) {
  if (!BOOK_FUNCTION_URL) {
    log("WARN", "BOOK_FUNCTION_URL not configured — cannot relay payment status", { token });
    return;
  }
  const sig = createHmac("sha256", APP_SECRET)
    .update(`${token}:${status}:${commerceOrder ?? ""}`)
    .digest("hex");
  const bookBase = BOOK_FUNCTION_URL.replace(/\/$/, "");
  const res = await fetch(`${bookBase}/payment/apply-status`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ token, commerceOrder, flowOrder, status, sig }),
  });
  if (!res.ok) {
    const text = await res.text();
    log("ERROR", "Relay to dairi-book failed", { status: res.status, body: text, token });
  }
}

export const handler = async (event) => {
  const method  = event.requestContext?.http?.method;
  const rawPath = (event.rawPath || "/").replace(/\/+$/, "") || "/";

  if (method !== "POST") {
    return resp(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return resp(400, { error: "Invalid JSON body" });
  }

  // ── Flow webhook: Flow POSTs {token} here server-to-server after a payment ─────
  // (urlConfirmation, set below when creating the payment). This Lambda is NOT
  // VPC-attached, so — unlike dairi-book — it can actually reach Flow.
  if (rawPath === "/confirm") {
    const token = body?.token;
    if (!token) return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: "ok" };
    try {
      const flowStatus = await flowGet("payment/getStatus", { token });
      const payStatus  = flowStatusCodeToPayStatus(flowStatus.status);
      await relayStatusToBook(token, flowStatus.commerceOrder, flowStatus.flowOrder, payStatus);
      log("INFO", "Webhook relayed", { token, payStatus, commerceOrder: flowStatus.commerceOrder });
    } catch (err) {
      log("ERROR", "Webhook processing error", { message: err.message, token });
    }
    return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: "OK" };
  }

  // ── Status check for the patient-facing UI: {action: 'status', token} ──────────
  // Called by payment-result.component.ts / patient-booking.component.ts after the
  // Flow redirect. Queries Flow directly (read-only, no charge/email side effects)
  // instead of going through dairi-book's now-broken /api/book/payment/status route.
  if (body.action === "status") {
    const { token } = body;
    if (!token) return resp(400, { error: "token requerido" });
    try {
      const flowStatus = await flowGet("payment/getStatus", { token });
      const payStatus  = flowStatusCodeToPayStatus(flowStatus.status);
      // Best-effort DB sync — awaited (Lambda may freeze the execution environment
      // right after returning, so a fire-and-forget call here could be dropped
      // mid-flight) but doesn't fail the status response if the relay itself fails —
      // the patient-facing status still reflects Flow's real, authoritative answer.
      try {
        await relayStatusToBook(token, flowStatus.commerceOrder, flowStatus.flowOrder, payStatus);
      } catch (err) {
        log("ERROR", "Best-effort relay from status check failed", { message: err.message, token });
      }
      return resp(200, {
        status:        payStatus,
        flowStatus:    flowStatus.status,
        amount:        flowStatus.amount,
        currency:      flowStatus.currency,
        commerceOrder: flowStatus.commerceOrder,
        flowOrder:     flowStatus.flowOrder,
      });
    } catch (err) {
      log("ERROR", "getStatus error", { message: err.message, token });
      return resp(502, { error: "Error consultando estado de pago" });
    }
  }

  const { appointmentId, amount, patientEmail, subject, bookingToken } = body;

  if (!appointmentId || !amount) {
    return resp(400, { error: "appointmentId and amount are required" });
  }

  if (!verifyBookingToken(bookingToken, appointmentId, amount)) {
    log("WARN", "Booking token verification failed", { appointmentId });
    return resp(401, { error: "Token de reserva inválido o expirado" });
  }

  if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
    log("ERROR", "Missing Flow credentials");
    return resp(500, { error: "Payment service misconfigured" });
  }

  const commerceOrder = `APPT-${appointmentId}-${Date.now()}`;
  const bookBase = BOOK_FUNCTION_URL.replace(/\/$/, "");
  // Webhook goes to dairi-payment itself (this Lambda, non-VPC — see PAYMENT_FUNCTION_URL
  // comment above) so it can actually reach Flow's payment/getStatus. It relays the
  // verified result to dairi-book's /payment/apply-status to persist it to the DB.
  // The browser return (urlReturn) stays on dairi-book: /payment/return only issues a
  // 302 redirect to the SPA, no Flow call involved, and that's confirmed to work fine.
  const urlConfirmation = `${PAYMENT_FUNCTION_URL.replace(/\/$/, "")}/confirm`;
  const urlReturn       = bookBase
    ? `${bookBase}/payment/return`
    : `${APP_URL}/#/book/payment-result`;

  const params = {
    commerceOrder,
    subject:     subject || `Cita médica #${appointmentId}`,
    amount:      String(amount),
    currency:    "CLP",
    urlConfirmation,
    urlReturn,
    ...(patientEmail ? { email: patientEmail } : {}),
  };

  try {
    const flow = await callFlow("payment/create", params);

    log("INFO", "Flow payment created", {
      commerceOrder,
      flowOrder: flow.flowOrder,
      token:     flow.token,
    });

    return resp(200, {
      paymentLink:   `${flow.url}?token=${flow.token}`,
      token:         flow.token,
      flowOrder:     flow.flowOrder,
      commerceOrder,
    });

  } catch (err) {
    log("ERROR", "Failed to create Flow payment", { message: err.message });
    return resp(502, { error: "Failed to create payment", detail: err.message });
  }
};
