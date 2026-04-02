import pg         from "pg";
import bcrypt     from "bcryptjs";
import jwt        from "jsonwebtoken";

const { Pool } = pg;

// ── Conexión al RDS PostgreSQL ────────────────────────────────────────────────
// Pool fuera del handler → se reutiliza entre invocaciones (warm start)
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

// ── Handler principal ─────────────────────────────────────────────────────────
export const handler = async (event) => {
  // Soporta API Gateway HTTP API v2 y REST API v1
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

    // 1. Buscar usuario por email
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

    // 2. Verificar contraseña con BCrypt
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return response(401, { message: "Credenciales inválidas. Verifique su email y contraseña." });
    }

    // 3. Cargar schemas autorizados del usuario
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

    // 4. Armar estructura EntitySchema que consume el frontend Angular
    const schemas = schemasResult.rows.map((s) => ({
      entity: {
        key:        s.schemaKey,
        singular:   s.singular,
        plural:     s.plural,
        icon:       s.icon,
        moduleType: s.moduleType
      },
      fields: []  // el frontend resuelve los fields desde su propio schema
    }));

    // 5. Generar JWT
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 6. Devolver AuthResponse (misma estructura que el mock del frontend)
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
