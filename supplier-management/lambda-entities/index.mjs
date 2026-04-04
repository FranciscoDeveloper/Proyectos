import pg  from "pg";
import jwt from "jsonwebtoken";

const { Pool } = pg;

// ── DB pool ───────────────────────────────────────────────────────────────────
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
  }
};

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  const method =
    event.requestContext?.http?.method ||
    event.httpMethod ||
    "UNKNOWN";

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return response(204, null);
  }

  // ── JWT verification ──────────────────────────────────────────────────────
  const authHeader =
    event.headers?.["authorization"] ||
    event.headers?.["Authorization"] ||
    "";

  if (!authHeader.startsWith("Bearer ")) {
    return response(401, { message: "Token de autenticación requerido" });
  }

  let tokenPayload;
  try {
    tokenPayload = jwt.verify(authHeader.slice(7), JWT_SECRET);
  } catch {
    return response(401, { message: "Token inválido o expirado" });
  }

  // ── Path parsing ──────────────────────────────────────────────────────────
  // Supported patterns:
  //   /api/entities/{entity}        → list / create
  //   /api/entities/{entity}/{id}   → get / update / delete
  const rawPath = event.rawPath || event.path || "";
  const match   = rawPath.match(/\/api\/entities\/([^/]+)(?:\/([^/]+))?/);

  if (!match) {
    return response(404, { message: "Ruta no encontrada" });
  }

  const entityKey = match[1];
  const id        = match[2] ?? null;
  const config    = ENTITY_CONFIG[entityKey];

  if (!config) {
    return response(404, { message: `Entidad '${entityKey}' no existe` });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body = null;
  if (event.body) {
    try {
      body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch {
      return response(400, { message: "Body inválido: se esperaba JSON" });
    }
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────
  let client;
  try {
    client = await pool.connect();

    if (method === "GET" && !id)        return await listEntities(client, config);
    if (method === "GET" && id)         return await getEntity(client, config, id);
    if (method === "POST" && !id)       return await createEntity(client, config, body);
    if (method === "PUT" && id)         return await updateEntity(client, config, id, body);
    if (method === "DELETE" && id)      return await deleteEntity(client, config, id);

    return response(405, { message: "Método no permitido" });

  } catch (error) {
    console.error(`Error en ${method} /api/entities/${entityKey}/${id ?? ""}:`, error);
    return response(500, { message: "Error interno del servidor", error: error.message });
  } finally {
    if (client) client.release();
  }
};

// ── CRUD operations ───────────────────────────────────────────────────────────

async function listEntities(client, config) {
  const result = await client.query(
    `SELECT * FROM ${config.table} ORDER BY id DESC`
  );
  return response(200, result.rows.map(config.fromDb));
}

async function getEntity(client, config, id) {
  const result = await client.query(
    `SELECT * FROM ${config.table} WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (result.rowCount === 0) {
    return response(404, { message: "Registro no encontrado" });
  }
  return response(200, config.fromDb(result.rows[0]));
}

async function createEntity(client, config, data) {
  if (!data || typeof data !== "object") {
    return response(400, { message: "Body requerido para crear un registro" });
  }

  const cols = config.toDb(data);
  const keys = Object.keys(cols);
  if (keys.length === 0) {
    return response(400, { message: "Ningún campo válido proporcionado" });
  }

  const colNames   = keys.join(", ");
  const colParams  = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values     = keys.map(k => cols[k]);

  const result = await client.query(
    `INSERT INTO ${config.table} (${colNames}) VALUES (${colParams}) RETURNING *`,
    values
  );
  return response(201, config.fromDb(result.rows[0]));
}

async function updateEntity(client, config, id, data) {
  if (!data || typeof data !== "object") {
    return response(400, { message: "Body requerido para actualizar" });
  }

  const cols = config.toDb(data);
  const keys = Object.keys(cols);
  if (keys.length === 0) {
    return response(400, { message: "Ningún campo válido proporcionado" });
  }

  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values     = [...keys.map(k => cols[k]), id];

  const result = await client.query(
    `UPDATE ${config.table}
     SET ${setClauses}, updated_at = NOW()
     WHERE id = $${keys.length + 1}
     RETURNING *`,
    values
  );

  if (result.rowCount === 0) {
    return response(404, { message: "Registro no encontrado" });
  }
  return response(200, config.fromDb(result.rows[0]));
}

async function deleteEntity(client, config, id) {
  const result = await client.query(
    `DELETE FROM ${config.table} WHERE id = $1 RETURNING id`,
    [id]
  );
  if (result.rowCount === 0) {
    return response(404, { message: "Registro no encontrado" });
  }
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
