const { Pool } = require("pg");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");

// ── Conexión al RDS PostgreSQL ────────────────────────────────────────────────
// La pool se inicializa fuera del handler para reutilizar conexiones
// entre invocaciones en el mismo contenedor Lambda (warm start).
const pool = new Pool({
  host:     process.env.DB_HOST,       // RDS endpoint, ej: mydb.abc123.us-east-1.rds.amazonaws.com
  port:     parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,       // nombre de la base de datos
  user:     process.env.DB_USER,       // usuario RDS
  password: process.env.DB_PASSWORD,   // contraseña RDS
  ssl:      { rejectUnauthorized: false }, // requerido por RDS
  max:      5,                         // máximo de conexiones en pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

const JWT_SECRET      = process.env.JWT_SECRET || "changeme-use-secrets-manager";
const JWT_EXPIRES_IN  = process.env.JWT_EXPIRES_IN || "8h";

// ── Handler principal ─────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // Soporta tanto API Gateway HTTP API (v2) como REST API (v1)
  const method =
    event.requestContext?.http?.method ||   // HTTP API v2
    event.httpMethod ||                      // REST API v1
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

    // 2. Verificar contraseña con BCrypt
    const passwordMatch = await bcrypt.compare(password, user.password);
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
      fields: []  // El frontend carga los fields desde su propia definición;
                  // el backend solo autoriza qué entidades son accesibles.
    }));

    // 5. Generar JWT
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    const token = jwt.sign(
      {
        sub:    user.id,
        email:  user.email,
        role:   user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 6. Respuesta AuthResponse — misma estructura que el mock del frontend
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
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": "*",             // ajustar al dominio en producción
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(body)
  };
}
