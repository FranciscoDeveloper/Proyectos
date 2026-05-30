import { createHmac } from "node:crypto";

const FLOW_API_KEY      = process.env.FLOW_API_KEY      || "";
const FLOW_SECRET_KEY   = process.env.FLOW_SECRET_KEY   || "";
const FLOW_BASE_URL     = process.env.FLOW_BASE_URL     || "https://www.flow.cl/api";
const APP_URL           = process.env.APP_URL           || "https://dairi.cl";
const BOOK_FUNCTION_URL = process.env.BOOK_FUNCTION_URL || "";
const APP_SECRET        = process.env.APP_SECRET        || "";

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

export const handler = async (event) => {
  const method = event.requestContext?.http?.method;

  if (method !== "POST") {
    return resp(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return resp(400, { error: "Invalid JSON body" });
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
  const urlConfirmation = BOOK_FUNCTION_URL
    ? `${BOOK_FUNCTION_URL.replace(/\/$/, "")}/api/webhook/flow`
    : `${APP_URL}/api/webhook/flow`;
  const urlReturn = `${APP_URL}/book/payment-result`;

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
