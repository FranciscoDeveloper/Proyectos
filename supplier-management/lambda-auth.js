import pg     from "pg";
import crypto from "crypto";   // módulo nativo Node.js — no requiere instalación

const { Pool } = pg;

// ── Conexión al RDS PostgreSQL ────────────────────────────────────────────────
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

const JWT_SECRET     = process.env.JWT_SECRET     || "changeme-use-secrets-manager";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// ── JWT HS256 con crypto nativo (reemplaza jsonwebtoken) ──────────────────────
function signJWT(payload, secret, expiresIn) {
  const expiresInSeconds = expiresIn.endsWith("h")
    ? parseInt(expiresIn) * 3600
    : parseInt(expiresIn) * 60;

  const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body    = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds, iat: Math.floor(Date.now() / 1000) }));
  const sig     = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function b64url(str) {
  return Buffer.from(str).toString("base64url");
}

// ── Verificación de contraseña ────────────────────────────────────────────────
// Si las contraseñas están almacenadas como BCrypt hash usa este helper.
// Si están en texto plano (DataLoader sin BcryptUtil) compara directamente.
function verifyPassword(plain, stored) {
  // Detecta BCrypt hash por su prefijo $2a$ / $2b$
  if (stored.startsWith("$2")) {
    // BCrypt necesita bcryptjs — instala el paquete si usas hashes
    throw new Error("BCrypt hash detectado: incluye bcryptjs en node_modules del Lambda");
  }
  // Texto plano: comparación en tiempo constante para evitar timing attacks
  const a = Buffer.from(plain);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── Handler principal ─────────────────────────────────────────────────────────
export const handler = async (event) => {
  // Soporta tanto API Gateway HTTP API (v2) como REST API (v1)
  const method =
    event.requestContext?.http?.method ||
    event.httpMethod ||
    "UNKNOWN";

  if (method !== "POST") {
    return response(405, { message: "Método no permitido" });
  }

  // ── Parsear body ──────────────────────────────────────────────────────────
  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return response(400, { message: "Body inválido: se esperaba JSON" });
  }

  const { email, password } = body || {};

  if (!email || !password) {
    return response(400, { message: "Los campos 'email' y 'password' son requeridos" });
  }

  // ── Consulta a RDS ────────────────────────────────────────────────────────
  let client;
  try {
    client = await pool.connect();

    // 1. Obtener usuario por email
    const userResult = await client.query(
      `SELECT id, name, email, password, role, avatar
       FROM app_user
       WHERE email = $1
       LIMIT 1`,
      [email.toLowerCase().trim()]
    );

    if (userResult.rowCount === 0) {
      return response(401, { message: "Credenciales inválidas. Verifique su email y contraseña." });
    }

    const user = userResult.rows[0];

    // 2. Verificar contraseña
    const passwordMatch = verifyPassword(password, user.password);
    if (!passwordMatch) {
      return response(401, { message: "Credenciales inválidas. Verifique su email y contraseña." });
    }

    // 3. Obtener schemas autorizados para este usuario
    const schemasResult = await client.query(
      `SELECT s.schema_key  AS "schemaKey",
              s.singular,
              s.plural,
              s.icon,
              s.module_type AS "moduleType"
       FROM app_schema s
       INNER JOIN user_schema us ON us.schema_id = s.id
       WHERE us.user_id = $1
       ORDER BY s.id`,
      [user.id]
    );

    // 4. Construir la estructura EntitySchema que espera el frontend
    const schemas = schemasResult.rows.map((s) => ({
      entity: {
        key:        s.schemaKey,
        singular:   s.singular,
        plural:     s.plural,
        icon:       s.icon,
        moduleType: s.moduleType
      },
      fields: []
    }));

    // 5. Generar JWT
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    const token = signJWT(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      JWT_EXPIRES_IN
    );

    // 6. Respuesta AuthResponse
    return response(200, {
      token,
      expiresAt,
      user: {
        id:     user.id,
        name:   user.name,
        email:  user.email,
        role:   user.role,
        avatar: user.avatar
      },
      schemas
    });

  } catch (error) {
    console.error("Error en autenticación:", error);
    return response(500, {
      message: "Error interno del servidor",
      error:   error.message
    });
  } finally {
    if (client) client.release();
  }
};

// ── Helper ────────────────────────────────────────────────────────────────────
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type":                 "application/json",
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(body)
  };
}

