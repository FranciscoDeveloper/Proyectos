import pg     from "pg";
import bcrypt from "bcryptjs";
import jwt    from "jsonwebtoken";
// Email is delegated to the frontend via /api/send-email (non-VPC path)

const { Pool } = pg;

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

if (!process.env.JWT_SECRET) {
  console.error(JSON.stringify({ level: "ERROR", msg: "JWT_SECRET env var is not set — refusing to start" }));
  process.exit(1);
}
const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const APP_URL        = process.env.APP_URL        || "https://dairi.cl";

// Parses a JWT duration string (e.g. "8h", "30m", "7d") into milliseconds.
function parseDurationMs(str) {
  const match = String(str).match(/^(\d+)([smhd])$/);
  if (!match) return 8 * 60 * 60 * 1000; // fallback: 8 h
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const factors = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * factors[unit];
}
const JWT_EXPIRES_IN_MS = parseDurationMs(JWT_EXPIRES_IN);

// ── Idempotent schema migration ───────────────────────────────────────────────
let schemaReady = false;
async function ensureColumns(client) {
  if (schemaReady) return;
  await client.query(`
    ALTER TABLE app_user
      ADD COLUMN IF NOT EXISTS email_verified  BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS activation_token TEXT
  `);
  schemaReady = true;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  const method  = (event.requestContext?.http?.method || event.httpMethod || "GET").toUpperCase();
  const rawPath = (event.rawPath || event.path || "/");

  if (method === "OPTIONS") return response(204, {});
  if (method !== "POST")    return response(405, { message: "Método no permitido" });

  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : (event.body ?? {});
  } catch {
    return response(400, { message: "Body inválido: se esperaba JSON" });
  }

  if (rawPath.endsWith("/register")) return handleRegister(body);
  if (rawPath.endsWith("/activate")) return handleActivate(body);
  return handleLogin(body);
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
async function handleLogin(body) {
  const { email, password } = body ?? {};
  if (!email || !password)
    return response(400, { message: "Los campos 'email' y 'password' son requeridos" });

  let client;
  try {
    client = await pool.connect();
    await ensureColumns(client);

    const userResult = await client.query(
      `SELECT u.id, u.name, u.email, u.password, u.role, u.avatar, u.email_verified,
              COALESCE(uc.zk_enabled, false) AS zk_enabled
       FROM app_user u
       LEFT JOIN user_config uc ON uc.user_id = u.id
       WHERE u.email = $1 LIMIT 1`,
      [email.toLowerCase().trim()]
    );

    if (userResult.rowCount === 0)
      return response(401, { message: "Credenciales inválidas. Verifique su email y contraseña." });

    const user = userResult.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch)
      return response(401, { message: "Credenciales inválidas. Verifique su email y contraseña." });

    if (!user.email_verified)
      return response(403, { message: "Debes activar tu cuenta. Revisa tu correo y haz clic en el enlace de activación." });

    const schemasResult = await client.query(
      `SELECT s.schema_key AS "schemaKey", s.singular, s.plural, s.icon, s.module_type AS "moduleType"
       FROM app_schema s
       INNER JOIN user_schema us ON us.schema_id = s.id
       WHERE us.user_id = $1 ORDER BY s.id`,
      [user.id]
    );

    const schemas = schemasResult.rows.map((s) => ({
      entity: { key: s.schemaKey, singular: s.singular, plural: s.plural, icon: s.icon, moduleType: s.moduleType },
      fields: []
    }));

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return response(200, {
      token,
      expiresAt: new Date(Date.now() + JWT_EXPIRES_IN_MS).toISOString(),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
      zkEnabled: user.zk_enabled,
      schemas,
    });
  } catch (err) {
    console.error("Login error:", err);
    return response(500, { message: "Error interno del servidor" });
  } finally {
    client?.release();
  }
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
async function handleRegister(body) {
  const { nombre, apellidos, email, telefono, password } = body ?? {};

  if (!nombre || !apellidos || !email || !password)
    return response(400, { message: "Faltan campos obligatorios: nombre, apellidos, email, password" });

  if (password.length < 8)
    return response(400, { message: "La contraseña debe tener al menos 8 caracteres" });

  const emailNorm = email.toLowerCase().trim();

  let client;
  try {
    client = await pool.connect();
    await ensureColumns(client);

    const existing = await client.query(
      "SELECT id FROM app_user WHERE email = $1 LIMIT 1",
      [emailNorm]
    );
    if (existing.rowCount > 0)
      return response(409, { message: "Ya existe una cuenta con ese correo electrónico." });

    const hash   = await bcrypt.hash(password, 12);
    const name   = `${nombre.trim()} ${apellidos.trim()}`;
    const avatar = (nombre[0] + apellidos[0]).toUpperCase();

    const insertResult = await client.query(
      `INSERT INTO app_user (name, email, password, role, avatar, email_verified)
       VALUES ($1, $2, $3, 'admin', $4, false)
       RETURNING id`,
      [name, emailNorm, hash, avatar]
    );
    const userId = insertResult.rows[0].id;

    // JWT activation token válido 24h
    const activationToken = jwt.sign(
      { sub: userId, email: emailNorm, type: "activation" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    await client.query(
      "UPDATE app_user SET activation_token = $1 WHERE id = $2",
      [activationToken, userId]
    );

    const activationUrl = `${APP_URL}/#/activate?token=${encodeURIComponent(activationToken)}`;

    // Build email content — frontend sends it via /api/send-email (internet-accessible)
    const emailContent = buildActivationEmail({ name, email: emailNorm, activationUrl });

    return response(201, {
      message:      "Cuenta creada. Activa tu cuenta usando el enlace de activación.",
      emailSent:    false,
      activationUrl,
      emailPayload: emailContent,   // frontend uses this to call /api/send-email
    });
  } catch (err) {
    console.error("Register error:", err);
    return response(500, { message: "Error interno del servidor" });
  } finally {
    client?.release();
  }
}

// ── ACTIVATE ──────────────────────────────────────────────────────────────────
async function handleActivate(body) {
  const { token } = body ?? {};
  if (!token) return response(400, { message: "Token requerido" });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return response(400, { message: "El enlace de activación es inválido o ha expirado." });
  }

  if (payload.type !== "activation")
    return response(400, { message: "Token inválido." });

  let client;
  try {
    client = await pool.connect();
    await ensureColumns(client);

    const result = await client.query(
      `UPDATE app_user
       SET email_verified = true, activation_token = NULL
       WHERE id = $1 AND activation_token = $2 AND email_verified = false
       RETURNING id, name, email, role, avatar`,
      [payload.sub, token]
    );

    if (result.rowCount === 0)
      return response(400, { message: "El enlace ya fue utilizado o es inválido." });

    return response(200, { message: "Cuenta activada exitosamente. Ya puedes iniciar sesión." });
  } catch (err) {
    console.error("Activate error:", err);
    return response(500, { message: "Error interno del servidor" });
  } finally {
    client?.release();
  }
}

// ── SES email ─────────────────────────────────────────────────────────────────
function buildActivationEmail({ name, email, activationUrl }) {
  const firstName = name.split(" ")[0];

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1.5px solid #bae6fd;overflow:hidden;max-width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9,#06b6d4);padding:28px 40px;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:900;letter-spacing:-1px;">Dairi<span style="color:#bae6fd;">.</span></h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Plataforma clínica inteligente</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <h2 style="margin:0 0 12px;color:#0c2d48;font-size:20px;font-weight:800;">Hola, ${firstName} 👋</h2>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.7;">
              Tu cuenta en <strong>Dairi</strong> está casi lista. Solo necesitas activarla haciendo clic en el botón de abajo.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:#0ea5e9;border-radius:10px;">
                  <a href="${activationUrl}"
                     style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.2px;">
                    Activar mi cuenta →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;line-height:1.6;">
              Este enlace es válido por <strong>24 horas</strong>. Si no creaste esta cuenta, puedes ignorar este mensaje.
            </p>
            <p style="margin:12px 0 0;color:#cbd5e1;font-size:12px;word-break:break-all;">
              O copia este enlace en tu navegador:<br>${activationUrl}
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #e0f2fe;padding:18px 40px;background:#f8fafc;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">© ${new Date().getFullYear()} Dairi · Plataforma clínica inteligente</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hola ${firstName},\n\nActiva tu cuenta Dairi haciendo clic en este enlace:\n${activationUrl}\n\nEl enlace es válido por 24 horas.\n\n— Equipo Dairi`;

  return { to: email, subject: "Activa tu cuenta Dairi", html, text };
}

// ── Helper ────────────────────────────────────────────────────────────────────
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type":                 "application/json",
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}
