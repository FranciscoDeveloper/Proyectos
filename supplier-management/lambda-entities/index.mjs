import pg  from "pg";
import jwt from "jsonwebtoken";

const { Pool } = pg;

// ── Trace logger ──────────────────────────────────────────────────────────────
let _traceId = "boot";
const log = (level, msg, data) => {
  const entry = { ts: new Date().toISOString(), traceId: _traceId, level, msg };
  if (data !== undefined) entry.data = data;
  console[level === "ERROR" ? "error" : "log"](JSON.stringify(entry));
};

// ── DB pool ───────────────────────────────────────────────────────────────────
log("INFO", "Lambda cold start — initialising DB pool", {
  DB_HOST:     process.env.DB_HOST     || "(not set)",
  DB_PORT:     process.env.DB_PORT     || "5432 (default)",
  DB_NAME:     process.env.DB_NAME     || "(not set)",
  DB_USER:     process.env.DB_USER     || "(not set)",
  DB_PASSWORD: process.env.DB_PASSWORD ? "***set***" : "(not set)",
  JWT_SECRET:  process.env.JWT_SECRET  ? "***set***" : "(using default — insecure!)"
});

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },
  max:      5,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 5000
});

pool.on("error", (err) => log("ERROR", "DB pool idle client error", { message: err.message, stack: err.stack }));

const JWT_SECRET = process.env.JWT_SECRET || "changeme-use-secrets-manager";

// ── Entity configuration ──────────────────────────────────────────────────────
// Each entity defines:
//   table   – DB table name
//   toDb()  – camelCase payload → snake_case columns (for INSERT/UPDATE)
//   fromDb()– snake_case row    → camelCase (for GET responses)

const ENTITY_CONFIG = {

  suppliers: {
    table: "supplier",
    toDb(d) {
      const cols = {};
      if (d.name          !== undefined) cols.name           = d.name;
      if (d.code          !== undefined) cols.code           = d.code;
      if (d.email         !== undefined) cols.email          = d.email;
      if (d.phone         !== undefined) cols.phone          = d.phone;
      if (d.category      !== undefined) cols.category       = d.category;
      if (d.status        !== undefined) cols.status         = d.status;
      if (d.country       !== undefined) cols.country        = d.country;
      if (d.city          !== undefined) cols.city           = d.city;
      if (d.address       !== undefined) cols.address        = d.address;
      if (d.website       !== undefined) cols.website        = d.website;
      if (d.taxId         !== undefined) cols.tax_id         = d.taxId;
      if (d.contactPerson !== undefined) cols.contact_person = d.contactPerson;
      if (d.rating        !== undefined) cols.rating         = d.rating;
      if (d.totalOrders   !== undefined) cols.total_orders   = d.totalOrders;
      if (d.totalSpent    !== undefined) cols.total_spent    = d.totalSpent;
      if (d.notes         !== undefined) cols.notes          = d.notes;
      if (d.tags          !== undefined) cols.tags           = JSON.stringify(d.tags);
      return cols;
    },
    fromDb(r) {
      return {
        id:            r.id,
        name:          r.name,
        code:          r.code,
        email:         r.email,
        phone:         r.phone,
        category:      r.category,
        status:        r.status,
        country:       r.country,
        city:          r.city,
        address:       r.address,
        website:       r.website,
        taxId:         r.tax_id,
        contactPerson: r.contact_person,
        rating:        r.rating        !== null ? parseFloat(r.rating)      : null,
        totalOrders:   r.total_orders  !== null ? parseInt(r.total_orders)  : null,
        totalSpent:    r.total_spent   !== null ? parseFloat(r.total_spent) : null,
        notes:         r.notes,
        tags:          r.tags ?? [],
        createdAt:     r.created_at,
        updatedAt:     r.updated_at
      };
    }
  },

  products: {
    table: "product",
    toDb(d) {
      const cols = {};
      if (d.name        !== undefined) cols.name        = d.name;
      if (d.sku         !== undefined) cols.sku         = d.sku;
      if (d.category    !== undefined) cols.category    = d.category;
      if (d.status      !== undefined) cols.status      = d.status;
      if (d.price       !== undefined) cols.price       = d.price;
      if (d.stock       !== undefined) cols.stock       = d.stock;
      if (d.supplier    !== undefined) cols.supplier    = d.supplier;
      if (d.weight      !== undefined) cols.weight      = d.weight;
      if (d.description !== undefined) cols.description = d.description;
      if (d.tags        !== undefined) cols.tags        = JSON.stringify(d.tags);
      return cols;
    },
    fromDb(r) {
      return {
        id:          r.id,
        name:        r.name,
        sku:         r.sku,
        category:    r.category,
        status:      r.status,
        price:       r.price       !== null ? parseFloat(r.price)  : null,
        stock:       r.stock       !== null ? parseInt(r.stock)    : null,
        supplier:    r.supplier,
        weight:      r.weight      !== null ? parseFloat(r.weight) : null,
        description: r.description,
        tags:        r.tags ?? [],
        createdAt:   r.created_at,
        updatedAt:   r.updated_at
      };
    }
  },

  expenses: {
    table: "expense",
    toDb(d) {
      const cols = {};
      if (d.description   !== undefined) cols.description    = d.description;
      if (d.supplier      !== undefined) cols.supplier       = d.supplier;
      if (d.date          !== undefined) cols.date           = d.date;
      if (d.category      !== undefined) cols.category       = d.category;
      if (d.amount        !== undefined) cols.amount         = d.amount;
      if (d.paymentMethod !== undefined) cols.payment_method = d.paymentMethod;
      if (d.status        !== undefined) cols.status         = d.status;
      if (d.receiptNumber !== undefined) cols.receipt_number = d.receiptNumber;
      if (d.notes         !== undefined) cols.notes          = d.notes;
      return cols;
    },
    fromDb(r) {
      return {
        id:            r.id,
        description:   r.description,
        supplier:      r.supplier,
        date:          r.date,
        category:      r.category,
        amount:        r.amount        !== null ? parseFloat(r.amount) : null,
        paymentMethod: r.payment_method,
        status:        r.status,
        receiptNumber: r.receipt_number,
        notes:         r.notes,
        createdAt:     r.created_at,
        updatedAt:     r.updated_at
      };
    }
  },

  // ── payments ─────────────────────────────────────────────────────────────────
  payments: {
    table: "payment",
    toDb(d) {
      const cols = {};
      if (d.patientName      !== undefined) cols.patient_name       = d.patientName;
      if (d.invoiceNumber    !== undefined) cols.invoice_number     = d.invoiceNumber;
      if (d.date             !== undefined) cols.date               = d.date;
      if (d.concept          !== undefined) cols.concept            = d.concept;
      if (d.amount           !== undefined) cols.amount             = d.amount;
      if (d.paymentMethod    !== undefined) cols.payment_method     = d.paymentMethod;
      if (d.status           !== undefined) cols.status             = d.status;
      if (d.notes            !== undefined) cols.notes              = d.notes;
      if (d.professionalName !== undefined) cols.professional_name  = d.professionalName;
      if (d.commissionRate   !== undefined) cols.commission_rate    = d.commissionRate;
      if (d.commissionAmount !== undefined) cols.commission_amount  = d.commissionAmount;
      if (d.commissionStatus !== undefined) cols.commission_status  = d.commissionStatus;
      return cols;
    },
    fromDb(r) {
      return {
        id:               r.id,
        patientName:      r.patient_name,
        invoiceNumber:    r.invoice_number,
        date:             r.date,
        concept:          r.concept,
        amount:           r.amount           !== null ? parseFloat(r.amount) : null,
        paymentMethod:    r.payment_method,
        status:           r.status,
        notes:            r.notes,
        professionalName: r.professional_name,
        commissionRate:   r.commission_rate   !== null ? parseFloat(r.commission_rate) : null,
        commissionAmount: r.commission_amount !== null ? parseFloat(r.commission_amount) : null,
        commissionStatus: r.commission_status,
        createdAt:        r.created_at,
        updatedAt:        r.updated_at
      };
    }
  },

  // ── patients ─────────────────────────────────────────────────────────────────
  patients: {
    table: "paciente",
    toDb(d) {
      const cols = {};
      if (d.nombre     !== undefined) cols.nombre     = d.nombre;
      if (d.email      !== undefined) cols.email      = d.email;
      if (d.telefono   !== undefined) cols.telefono   = d.telefono;
      if (d.diagnostic !== undefined) cols.diagnostic = d.diagnostic;
      if (d.allergies  !== undefined) cols.allergies  = JSON.stringify(d.allergies);
      return cols;
    },
    fromDb(r) {
      return {
        id:         r.id,
        nombre:     r.nombre,
        email:      r.email,
        telefono:   r.telefono,
        diagnostic: r.diagnostic ?? null,
        allergies:  r.allergies  ?? [],
        createdAt:  r.created_at,
        updatedAt:  r.updated_at
      };
    }
  },

  // ── appointments ─────────────────────────────────────────────────────────────
  appointments: {
    table: "cita",

    // Optional JOIN query — used instead of plain SELECT * when present
    joinSelect: `
      SELECT
        c.id,
        c.status,
        c.service,
        c.date_time          AS "dateTime",
        c.duration_minutes   AS "durationMinutes",
        c.notes,
        c.google_event_id    AS "googleEventId",
        c.created_at         AS "createdAt",
        c.updated_at         AS "updatedAt",
        p.nombre             AS "patientName",
        pr.nombre            AS "professionalName"
      FROM cita c
      LEFT JOIN paciente    p  ON p.id::text  = c.patient_id
      LEFT JOIN profesional pr ON pr.id::text = c.professional_id
    `,

    toDb(d) {
      const cols = {};
      if (d.status            !== undefined) cols.status              = d.status;
      if (d.service           !== undefined) cols.service             = d.service;
      if (d.dateTime          !== undefined) cols.date_time           = d.dateTime;
      if (d.durationMinutes   !== undefined) cols.duration_minutes    = d.durationMinutes;
      if (d.notes             !== undefined) cols.notes               = d.notes;
      if (d.patientId         !== undefined) cols.patient_id          = d.patientId;
      if (d.professionalId    !== undefined) cols.professional_id     = d.professionalId;
      return cols;
    },

    fromDb(r) {
      return {
        id:               r.id,
        status:           r.status,
        service:          r.service,
        dateTime:         r.dateTime   ?? r.date_time,
        durationMinutes:  r.durationMinutes !== null ? parseInt(r.durationMinutes ?? r.duration_minutes) : null,
        notes:            r.notes,
        googleEventId:    r.googleEventId ?? r.google_event_id,
        patientName:      r.patientName  ?? r.patient_name  ?? null,
        professionalName: r.professionalName ?? r.professional_name ?? null,
        createdAt:        r.createdAt   ?? r.created_at,
        updatedAt:        r.updatedAt   ?? r.updated_at
      };
    }
  },

  // ── clinical-records ─────────────────────────────────────────────────────────
  'clinical-records': {
    table: "ficha_clinica",

    toDb(d) {
      const cols = {};
      if (d.fullName             !== undefined) cols.full_name              = d.fullName;
      if (d.patientId            !== undefined) cols.patient_code           = d.patientId;
      if (d.rut                  !== undefined) cols.rut                    = d.rut;
      if (d.birthDate            !== undefined) cols.birth_date             = d.birthDate;
      if (d.age                  !== undefined) cols.age                    = d.age;
      if (d.gender               !== undefined) cols.gender                 = d.gender;
      if (d.bloodType            !== undefined) cols.blood_type             = d.bloodType;
      if (d.insurance            !== undefined) cols.insurance              = d.insurance;
      if (d.phone                !== undefined) cols.phone                  = d.phone;
      if (d.email                !== undefined) cols.email                  = d.email;
      if (d.address              !== undefined) cols.address                = d.address;
      if (d.emergencyContact     !== undefined) cols.emergency_contact      = d.emergencyContact;
      if (d.doctor               !== undefined) cols.doctor                 = d.doctor;
      if (d.lastVisit            !== undefined) cols.last_visit             = d.lastVisit;
      if (d.status               !== undefined) cols.status                 = d.status;
      if (d.allergies            !== undefined) cols.allergies              = JSON.stringify(d.allergies);
      if (d.contraindications    !== undefined) cols.contraindications      = d.contraindications;
      if (d.alertNotes           !== undefined) cols.alert_notes            = d.alertNotes;
      if (d.bp                   !== undefined) cols.bp                     = d.bp;
      if (d.heartRate            !== undefined) cols.heart_rate             = d.heartRate;
      if (d.temperature          !== undefined) cols.temperature            = d.temperature;
      if (d.o2Saturation         !== undefined) cols.o2_saturation          = d.o2Saturation;
      if (d.weight               !== undefined) cols.weight                 = d.weight;
      if (d.height               !== undefined) cols.height                 = d.height;
      if (d.bmi                  !== undefined) cols.bmi                    = d.bmi;
      if (d.respiratoryRate      !== undefined) cols.respiratory_rate       = d.respiratoryRate;
      if (d.personalHistory      !== undefined) cols.personal_history       = d.personalHistory;
      if (d.familyHistory        !== undefined) cols.family_history         = d.familyHistory;
      if (d.habits               !== undefined) cols.habits                 = d.habits;
      if (d.surgicalHistory      !== undefined) cols.surgical_history       = d.surgicalHistory;
      if (d.plannedInterventions !== undefined) cols.planned_interventions  = d.plannedInterventions;
      if (d.currentMedications   !== undefined) cols.current_medications    = d.currentMedications;
      if (d.chronicConditions    !== undefined) cols.chronic_conditions     = JSON.stringify(d.chronicConditions);
      if (d.diagnosisCode        !== undefined) cols.diagnosis_code         = d.diagnosisCode;
      if (d.diagnosisLabel       !== undefined) cols.diagnosis_label        = d.diagnosisLabel;
      if (d.differentialDx       !== undefined) cols.differential_dx        = d.differentialDx;
      if (d.soapSubjective       !== undefined) cols.soap_subjective        = d.soapSubjective;
      if (d.soapObjective        !== undefined) cols.soap_objective         = d.soapObjective;
      if (d.soapAssessment       !== undefined) cols.soap_assessment        = d.soapAssessment;
      if (d.soapPlan             !== undefined) cols.soap_plan              = d.soapPlan;
      if (d.encounters           !== undefined) cols.encounters             = JSON.stringify(d.encounters);
      return cols;
    },

    fromDb(r) {
      return {
        id:                   r.id,
        fullName:             r.full_name,
        patientId:            r.patient_code,
        rut:                  r.rut,
        birthDate:            r.birth_date,
        age:                  r.age    !== null ? parseInt(r.age)     : null,
        gender:               r.gender,
        bloodType:            r.blood_type,
        insurance:            r.insurance,
        phone:                r.phone,
        email:                r.email,
        address:              r.address,
        emergencyContact:     r.emergency_contact,
        doctor:               r.doctor,
        lastVisit:            r.last_visit,
        status:               r.status,
        allergies:            r.allergies         ?? [],
        contraindications:    r.contraindications ?? '',
        alertNotes:           r.alert_notes       ?? '',
        bp:                   r.bp,
        heartRate:            r.heart_rate        !== null ? parseFloat(r.heart_rate)        : null,
        temperature:          r.temperature       !== null ? parseFloat(r.temperature)       : null,
        o2Saturation:         r.o2_saturation     !== null ? parseFloat(r.o2_saturation)     : null,
        weight:               r.weight            !== null ? parseFloat(r.weight)            : null,
        height:               r.height            !== null ? parseFloat(r.height)            : null,
        bmi:                  r.bmi               !== null ? parseFloat(r.bmi)               : null,
        respiratoryRate:      r.respiratory_rate  !== null ? parseFloat(r.respiratory_rate)  : null,
        personalHistory:      r.personal_history      ?? '',
        familyHistory:        r.family_history        ?? '',
        habits:               r.habits                ?? '',
        surgicalHistory:      r.surgical_history      ?? '',
        plannedInterventions: r.planned_interventions ?? '',
        currentMedications:   r.current_medications   ?? '',
        chronicConditions:    r.chronic_conditions    ?? [],
        diagnosisCode:        r.diagnosis_code        ?? '',
        diagnosisLabel:       r.diagnosis_label       ?? '',
        differentialDx:       r.differential_dx       ?? '',
        soapSubjective:       r.soap_subjective       ?? '',
        soapObjective:        r.soap_objective        ?? '',
        soapAssessment:       r.soap_assessment       ?? '',
        soapPlan:             r.soap_plan             ?? '',
        encounters:           r.encounters            ?? [],
        createdAt:            r.created_at,
        updatedAt:            r.updated_at
      };
    }
  }
};

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event, context) => {
  // Assign a unique trace ID per invocation (Lambda request ID when available)
  _traceId = context?.awsRequestId || `local-${Date.now()}`;

  const method =
    event.requestContext?.http?.method ||
    event.httpMethod ||
    "UNKNOWN";

  log("INFO", "Request received", {
    method,
    path:       event.rawPath || event.path || "",
    sourceIp:   event.requestContext?.http?.sourceIp || event.requestContext?.identity?.sourceIp || "unknown",
    userAgent:  event.requestContext?.http?.userAgent || "unknown",
    hasBody:    !!event.body,
    bodyLength: event.body?.length ?? 0
  });

  // Handle CORS preflight
  if (method === "OPTIONS") {
    log("INFO", "CORS preflight — returning 204");
    return response(204, null);
  }

  // ── JWT verification ──────────────────────────────────────────────────────
  const authHeader =
    event.headers?.["authorization"] ||
    event.headers?.["Authorization"] ||
    "";

  if (!authHeader.startsWith("Bearer ")) {
    log("WARN", "Missing or malformed Authorization header");
    return response(401, { message: "Token de autenticación requerido" });
  }

  let tokenPayload;
  try {
    tokenPayload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    log("INFO", "JWT verified", { sub: tokenPayload.sub, role: tokenPayload.role });
  } catch (err) {
    log("WARN", "JWT verification failed", { error: err.message });
    return response(401, { message: "Token inválido o expirado" });
  }

  // ── Path parsing ──────────────────────────────────────────────────────────
  // Supported patterns:
  //   /api/entities/{entity}        → list / create
  //   /api/entities/{entity}/{id}   → get / update / delete
  const rawPath = event.rawPath || event.path || "";
  const match   = rawPath.match(/\/api\/entities\/([^/]+)(?:\/([^/]+))?/);

  if (!match) {
    log("WARN", "Path did not match expected pattern", { rawPath });
    return response(404, { message: "Ruta no encontrada" });
  }

  const entityKey = match[1];
  const id        = match[2] ?? null;
  const config    = ENTITY_CONFIG[entityKey];

  log("INFO", "Path parsed", { entityKey, id });

  if (!config) {
    log("WARN", "Unknown entity key", { entityKey, available: Object.keys(ENTITY_CONFIG) });
    return response(404, { message: `Entidad '${entityKey}' no existe` });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body = null;
  if (event.body) {
    try {
      body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      log("INFO", "Body parsed", { fields: Object.keys(body) });
    } catch (err) {
      log("ERROR", "Body parse failed", { error: err.message, raw: event.body?.slice(0, 200) });
      return response(400, { message: "Body inválido: se esperaba JSON" });
    }
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────
  let client;
  try {
    log("INFO", "Acquiring DB connection from pool");
    client = await pool.connect();
    log("INFO", "DB connection acquired");

    if (method === "GET" && !id)        return await listEntities(client, config, entityKey);
    if (method === "GET" && id)         return await getEntity(client, config, id, entityKey);
    if (method === "POST" && !id)       return await createEntity(client, config, body, entityKey);
    if (method === "PUT" && id)         return await updateEntity(client, config, id, body, entityKey);
    if (method === "DELETE" && id)      return await deleteEntity(client, config, id, entityKey);

    log("WARN", "Method not allowed", { method });
    return response(405, { message: "Método no permitido" });

  } catch (error) {
    log("ERROR", `Unhandled error in ${method} /api/entities/${entityKey}/${id ?? ""}`, {
      message: error.message,
      code:    error.code,
      stack:   error.stack
    });
    return response(500, { message: "Error interno del servidor", error: error.message });
  } finally {
    if (client) {
      client.release();
      log("INFO", "DB connection released");
    }
  }
};

// ── CRUD operations ───────────────────────────────────────────────────────────

async function listEntities(client, config, entityKey) {
  log("INFO", "listEntities — querying", { table: config.table, hasJoin: !!config.joinSelect });
  let result;
  if (config.joinSelect) {
    result = await client.query(`${config.joinSelect} ORDER BY c.created_at DESC`);
  } else {
    result = await client.query(`SELECT * FROM ${config.table} ORDER BY id DESC`);
  }
  log("INFO", "listEntities — done", { table: config.table, rowCount: result.rowCount });
  return response(200, result.rows.map(config.fromDb));
}

async function getEntity(client, config, id, entityKey) {
  log("INFO", "getEntity — querying", { table: config.table, id, hasJoin: !!config.joinSelect });
  let result;
  if (config.joinSelect) {
    result = await client.query(`${config.joinSelect} WHERE c.id = $1 LIMIT 1`, [id]);
  } else {
    result = await client.query(`SELECT * FROM ${config.table} WHERE id = $1 LIMIT 1`, [id]);
  }
  if (result.rowCount === 0) {
    log("WARN", "getEntity — not found", { table: config.table, id });
    return response(404, { message: "Registro no encontrado" });
  }
  log("INFO", "getEntity — found", { table: config.table, id });
  return response(200, config.fromDb(result.rows[0]));
}

async function createEntity(client, config, data, entityKey) {
  if (!data || typeof data !== "object") {
    log("WARN", "createEntity — missing body", { entityKey });
    return response(400, { message: "Body requerido para crear un registro" });
  }

  const cols = config.toDb(data);
  const keys = Object.keys(cols);
  if (keys.length === 0) {
    log("WARN", "createEntity — no valid fields", { entityKey, receivedKeys: Object.keys(data) });
    return response(400, { message: "Ningún campo válido proporcionado" });
  }

  const colNames  = keys.join(", ");
  const colParams = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values    = keys.map(k => cols[k]);

  log("INFO", "createEntity — inserting", { table: config.table, columns: keys });
  const result = await client.query(
    `INSERT INTO ${config.table} (${colNames}) VALUES (${colParams}) RETURNING *`,
    values
  );
  log("INFO", "createEntity — success", { table: config.table, newId: result.rows[0]?.id });
  return response(201, config.fromDb(result.rows[0]));
}

async function updateEntity(client, config, id, data, entityKey) {
  if (!data || typeof data !== "object") {
    log("WARN", "updateEntity — missing body", { entityKey, id });
    return response(400, { message: "Body requerido para actualizar" });
  }

  const cols = config.toDb(data);
  const keys = Object.keys(cols);
  if (keys.length === 0) {
    log("WARN", "updateEntity — no valid fields", { entityKey, id, receivedKeys: Object.keys(data) });
    return response(400, { message: "Ningún campo válido proporcionado" });
  }

  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values     = [...keys.map(k => cols[k]), id];

  log("INFO", "updateEntity — updating", { table: config.table, id, columns: keys });
  const result = await client.query(
    `UPDATE ${config.table}
     SET ${setClauses}, updated_at = NOW()
     WHERE id = $${keys.length + 1}
     RETURNING *`,
    values
  );

  if (result.rowCount === 0) {
    log("WARN", "updateEntity — not found", { table: config.table, id });
    return response(404, { message: "Registro no encontrado" });
  }
  log("INFO", "updateEntity — success", { table: config.table, id });
  return response(200, config.fromDb(result.rows[0]));
}

async function deleteEntity(client, config, id, entityKey) {
  log("INFO", "deleteEntity — deleting", { table: config.table, id });
  const result = await client.query(
    `DELETE FROM ${config.table} WHERE id = $1 RETURNING id`,
    [id]
  );
  if (result.rowCount === 0) {
    log("WARN", "deleteEntity — not found", { table: config.table, id });
    return response(404, { message: "Registro no encontrado" });
  }
  log("INFO", "deleteEntity — success", { table: config.table, id });
  return response(200, { message: "Registro eliminado", id: parseInt(id) });
}

// ── Helper ────────────────────────────────────────────────────────────────────
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type":                 "application/json",
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
    },
    body: body !== null ? JSON.stringify(body) : ""
  };
}
