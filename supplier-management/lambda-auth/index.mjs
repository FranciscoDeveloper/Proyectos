import pg     from "pg";
import bcrypt from "bcryptjs";
import jwt    from "jsonwebtoken";
import crypto from "crypto";
// Email is delegated to the frontend via /api/send-email (non-VPC path)

// ── TOTP helpers (RFC 6238 / RFC 4226 — no external deps) ─────────────────────

function base32Decode(encoded) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned  = encoded.toUpperCase().replace(/=+$/, "");
  let bits = 0, value = 0;
  const output = [];
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bits -= 8; output.push((value >> bits) & 0xff); }
  }
  return Buffer.from(output);
}

function base32Encode(buf) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, out = "";
  for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { bits -= 5; out += alphabet[(value >> bits) & 0x1f]; } }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 0x1f];
  return out;
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function computeTotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac  = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code   = ((hmac[offset] & 0x7f) << 24 | hmac[offset+1] << 16 | hmac[offset+2] << 8 | hmac[offset+3]) % 1_000_000;
  return String(code).padStart(6, "0");
}

function verifyTotp(secret, token, window = 1) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (computeTotp(secret, counter + i) === token) return true;
  }
  return false;
}

function totpKeyUri(email, issuer, secret) {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

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
const JWT_EXPIRES_IN       = process.env.JWT_EXPIRES_IN       || "2h";
const REFRESH_EXPIRES_DAYS = parseInt(process.env.REFRESH_EXPIRES_DAYS || "7", 10);

function generateRawToken() {
  return crypto.randomBytes(48).toString("base64url");
}
function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
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
      ADD COLUMN IF NOT EXISTS email_verified    BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS activation_token  TEXT,
      ADD COLUMN IF NOT EXISTS mfa_enabled       BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS mfa_secret        TEXT,
      ADD COLUMN IF NOT EXISTS mfa_recovery_codes JSONB
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS refresh_token (
      id          BIGSERIAL    PRIMARY KEY,
      user_id     BIGINT       NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      token_hash  TEXT         NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ  NOT NULL,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      revoked_at  TIMESTAMPTZ
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_rt_user   ON refresh_token(user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_rt_lookup ON refresh_token(token_hash) WHERE revoked_at IS NULL`);
  schemaReady = true;
}

// ── REFRESH ───────────────────────────────────────────────────────────────────
async function handleRefresh(body) {
  const rawToken = body?.refreshToken;
  if (!rawToken) return response(400, { message: "refreshToken requerido" });

  const tokenHash = hashToken(rawToken);
  let client;
  try {
    client = await pool.connect();
    await ensureColumns(client);

    const result = await client.query(
      `SELECT rt.id, rt.user_id,
              u.email, u.role
       FROM   refresh_token rt
       JOIN   app_user u ON u.id = rt.user_id
       WHERE  rt.token_hash = $1
         AND  rt.expires_at > NOW()
         AND  rt.revoked_at IS NULL
       LIMIT 1`,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      return response(401, { message: "Sesión expirada. Por favor inicia sesión nuevamente." });
    }

    const row = result.rows[0];

    // Rotation: revoke old token, issue new one
    const newRaw    = generateRawToken();
    const newHash   = hashToken(newRaw);
    const newExpiry = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86_400_000);

    await client.query(`UPDATE refresh_token SET revoked_at = NOW() WHERE id = $1`, [row.id]);
    await client.query(
      `INSERT INTO refresh_token (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [row.user_id, newHash, newExpiry]
    );

    const token = jwt.sign(
      { sub: row.user_id, email: row.email, role: row.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return response(200, {
      token,
      refreshToken: newRaw,
      expiresAt: new Date(Date.now() + JWT_EXPIRES_IN_MS).toISOString(),
    });
  } catch (err) {
    console.error("Refresh error:", err);
    return response(500, { message: "Error interno del servidor" });
  } finally {
    client?.release();
  }
}

// ── LOGOUT ────────────────────────────────────────────────────────────────────
async function handleLogout(body) {
  const rawToken = body?.refreshToken;
  if (!rawToken) return response(200, { message: "Sesión cerrada" });

  const tokenHash = hashToken(rawToken);
  let client;
  try {
    client = await pool.connect();
    await client.query(
      `UPDATE refresh_token SET revoked_at = NOW()
       WHERE  token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );
    return response(200, { message: "Sesión cerrada correctamente" });
  } catch (err) {
    console.error("Logout error:", err);
    return response(500, { message: "Error interno del servidor" });
  } finally {
    client?.release();
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  const method  = (event.requestContext?.http?.method || event.httpMethod || "GET").toUpperCase();
  const rawPath = (event.rawPath || event.path || "/");

  if (method === "OPTIONS") return response(204, {});

  // ── Admin routes (GET + PUT, require superadmin JWT) ─────────────────────
  if (rawPath.startsWith("/api/admin/")) {
    const authHeader = event.headers?.["authorization"] || event.headers?.["Authorization"] || "";
    if (!authHeader.startsWith("Bearer "))
      return response(401, { message: "Token de autenticación requerido" });
    let tokenPayload;
    try { tokenPayload = jwt.verify(authHeader.slice(7), JWT_SECRET); }
    catch { return response(401, { message: "Token inválido o expirado" }); }
    if (tokenPayload.role !== "superadmin" && tokenPayload.role !== "admin")
      return response(403, { message: "Acceso restringido a administradores del sistema" });

    let body = null;
    if (event.body) {
      try { body = typeof event.body === "string" ? JSON.parse(event.body) : event.body; }
      catch { return response(400, { message: "Body inválido" }); }
    }
    return handleAdminRequest(rawPath, method, body);
  }

  if (method !== "POST")    return response(405, { message: "Método no permitido" });

  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : (event.body ?? {});
  } catch {
    return response(400, { message: "Body inválido: se esperaba JSON" });
  }

  if (rawPath.endsWith("/register"))       return handleRegister(body);
  if (rawPath.endsWith("/activate"))       return handleActivate(body);
  if (rawPath.endsWith("/refresh"))        return handleRefresh(body);
  if (rawPath.endsWith("/logout"))         return handleLogout(body);
  if (rawPath.endsWith("/mfa-verify"))     return handleMfaVerify(body);
  if (rawPath.endsWith("/mfa/setup"))      return handleMfaSetup(event.headers);
  if (rawPath.endsWith("/mfa/confirm"))    return handleMfaConfirm(body, event.headers);
  if (rawPath.endsWith("/mfa/disable"))    return handleMfaDisable(body, event.headers);
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
              u.mfa_enabled,
              COALESCE(uc.zk_enabled, false) AS zk_enabled,
              p.id   AS professional_id,
              p.name AS professional_name
       FROM app_user u
       LEFT JOIN user_config  uc ON uc.user_id = u.id
       LEFT JOIN professional p  ON p.user_id  = u.id
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

    // ── MFA challenge ──────────────────────────────────────────────────────────
    if (user.mfa_enabled) {
      const challengeToken = jwt.sign(
        { sub: user.id, mfaChallenge: true },
        JWT_SECRET,
        { expiresIn: "5m" }
      );
      return response(200, { requiresMfa: true, challengeToken });
    }

    const schemasResult = user.role === 'superadmin'
      ? await client.query(
          `SELECT schema_key AS "schemaKey", singular, plural, icon, module_type AS "moduleType"
           FROM app_schema ORDER BY id`
        )
      : await client.query(
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

    const rawRefreshToken  = generateRawToken();
    const refreshHash      = hashToken(rawRefreshToken);
    const refreshExpiry    = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86_400_000);
    await client.query(
      `INSERT INTO refresh_token (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, refreshHash, refreshExpiry]
    );

    return response(200, {
      token,
      refreshToken: rawRefreshToken,
      expiresAt: new Date(Date.now() + JWT_EXPIRES_IN_MS).toISOString(),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar,
              professionalId: user.professional_id ?? null, professionalName: user.professional_name ?? null },
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

    // Assign default modules for new users (keys must match app_schema.schema_key in DB)
    await client.query(
      `INSERT INTO user_schema (user_id, schema_id)
       SELECT $1, s.id FROM app_schema s
       WHERE s.schema_key = ANY($2::text[])`,
      [userId, ['clinicalRecords', 'appointments', 'reports']]
    );

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

// ── MFA: verify challenge (step 2 of login) ───────────────────────────────────
async function handleMfaVerify(body) {
  const { challengeToken, totpCode } = body ?? {};
  if (!challengeToken || !totpCode)
    return response(400, { message: "challengeToken y totpCode son requeridos" });

  let payload;
  try {
    payload = jwt.verify(challengeToken, JWT_SECRET);
  } catch {
    return response(401, { message: "El código de verificación ha expirado. Inicia sesión de nuevo." });
  }
  if (!payload.mfaChallenge)
    return response(401, { message: "Token inválido." });

  let client;
  try {
    client = await pool.connect();
    await ensureColumns(client);

    const r = await client.query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar, u.mfa_secret, u.mfa_recovery_codes,
              COALESCE(uc.zk_enabled, false) AS zk_enabled,
              p.id AS professional_id, p.name AS professional_name
       FROM app_user u
       LEFT JOIN user_config  uc ON uc.user_id = u.id
       LEFT JOIN professional p  ON p.user_id  = u.id
       WHERE u.id = $1 AND u.mfa_enabled = true LIMIT 1`,
      [payload.sub]
    );
    if (r.rowCount === 0)
      return response(401, { message: "Usuario no encontrado o MFA no activo." });

    const user = r.rows[0];

    // Check TOTP first
    const codeClean = String(totpCode).replace(/\s/g, "");
    let valid = false;

    if (/^\d{6}$/.test(codeClean)) {
      valid = verifyTotp(user.mfa_secret, codeClean);
    }

    // Check recovery code if TOTP failed
    if (!valid && user.mfa_recovery_codes?.length) {
      for (let i = 0; i < user.mfa_recovery_codes.length; i++) {
        const match = await bcrypt.compare(codeClean.toUpperCase(), user.mfa_recovery_codes[i]);
        if (match) {
          // Burn the used recovery code
          const remaining = [...user.mfa_recovery_codes];
          remaining.splice(i, 1);
          await client.query(
            `UPDATE app_user SET mfa_recovery_codes = $1 WHERE id = $2`,
            [JSON.stringify(remaining), user.id]
          );
          valid = true;
          break;
        }
      }
    }

    if (!valid)
      return response(401, { message: "Código incorrecto. Inténtalo de nuevo." });

    // Issue full session
    const schemasResult = user.role === 'superadmin'
      ? await client.query(`SELECT schema_key AS "schemaKey", singular, plural, icon, module_type AS "moduleType" FROM app_schema ORDER BY id`)
      : await client.query(
          `SELECT s.schema_key AS "schemaKey", s.singular, s.plural, s.icon, s.module_type AS "moduleType"
           FROM app_schema s INNER JOIN user_schema us ON us.schema_id = s.id
           WHERE us.user_id = $1 ORDER BY s.id`,
          [user.id]
        );

    const schemas = schemasResult.rows.map(s => ({
      entity: { key: s.schemaKey, singular: s.singular, plural: s.plural, icon: s.icon, moduleType: s.moduleType },
      fields: []
    }));

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const rawRefresh = generateRawToken();
    const refreshExpiry = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86_400_000);
    await client.query(
      `INSERT INTO refresh_token (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, hashToken(rawRefresh), refreshExpiry]
    );

    return response(200, {
      token,
      refreshToken: rawRefresh,
      expiresAt: new Date(Date.now() + JWT_EXPIRES_IN_MS).toISOString(),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar,
              professionalId: user.professional_id ?? null, professionalName: user.professional_name ?? null },
      zkEnabled: user.zk_enabled,
      schemas,
    });
  } catch (err) {
    console.error("MFA verify error:", err);
    return response(500, { message: "Error interno del servidor" });
  } finally {
    client?.release();
  }
}

// ── MFA: generate setup secret (requires valid access token) ──────────────────
async function handleMfaSetup(headers) {
  const userId = requireAuth(headers);
  if (!userId) return response(401, { message: "Token de autenticación requerido" });

  const secret   = generateTotpSecret();
  let client;
  try {
    client = await pool.connect();
    await ensureColumns(client);

    const r = await client.query(`SELECT email, mfa_enabled FROM app_user WHERE id = $1`, [userId]);
    if (r.rowCount === 0) return response(404, { message: "Usuario no encontrado" });
    if (r.rows[0].mfa_enabled)
      return response(409, { message: "MFA ya está activo. Desactívalo primero." });

    // Store pending secret (not yet confirmed)
    await client.query(`UPDATE app_user SET mfa_secret = $1 WHERE id = $2`, [secret, userId]);

    const otpAuthUri = totpKeyUri(r.rows[0].email, "Dairi", secret);
    return response(200, { secret, otpAuthUri });
  } catch (err) {
    console.error("MFA setup error:", err);
    return response(500, { message: "Error interno del servidor" });
  } finally {
    client?.release();
  }
}

// ── MFA: confirm first TOTP code and activate MFA ─────────────────────────────
async function handleMfaConfirm(body, headers) {
  const userId = requireAuth(headers);
  if (!userId) return response(401, { message: "Token de autenticación requerido" });

  const { totpCode } = body ?? {};
  if (!totpCode) return response(400, { message: "totpCode requerido" });

  let client;
  try {
    client = await pool.connect();
    await ensureColumns(client);

    const r = await client.query(
      `SELECT mfa_secret, mfa_enabled FROM app_user WHERE id = $1`, [userId]
    );
    if (r.rowCount === 0) return response(404, { message: "Usuario no encontrado" });
    if (r.rows[0].mfa_enabled) return response(409, { message: "MFA ya está activo" });
    if (!r.rows[0].mfa_secret) return response(400, { message: "Primero genera el secreto con /mfa/setup" });

    const valid = verifyTotp(r.rows[0].mfa_secret, String(totpCode).trim());
    if (!valid) return response(401, { message: "Código incorrecto. Escanea el QR de nuevo e intenta." });

    // Generate 8 recovery codes
    const rawCodes    = Array.from({ length: 8 }, () => {
      const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
      return raw.slice(0, 4) + "-" + raw.slice(4, 8) + "-" + raw.slice(8, 12);
    });
    const hashedCodes = await Promise.all(rawCodes.map(c => bcrypt.hash(c, 10)));

    await client.query(
      `UPDATE app_user SET mfa_enabled = true, mfa_recovery_codes = $1 WHERE id = $2`,
      [JSON.stringify(hashedCodes), userId]
    );

    return response(200, {
      message:       "MFA activado correctamente",
      recoveryCodes: rawCodes, // shown once — user must save them
    });
  } catch (err) {
    console.error("MFA confirm error:", err);
    return response(500, { message: "Error interno del servidor" });
  } finally {
    client?.release();
  }
}

// ── MFA: disable (requires current password) ──────────────────────────────────
async function handleMfaDisable(body, headers) {
  const userId = requireAuth(headers);
  if (!userId) return response(401, { message: "Token de autenticación requerido" });

  const { password } = body ?? {};
  if (!password) return response(400, { message: "password requerido para desactivar MFA" });

  let client;
  try {
    client = await pool.connect();
    await ensureColumns(client);

    const r = await client.query(`SELECT password, mfa_enabled FROM app_user WHERE id = $1`, [userId]);
    if (r.rowCount === 0) return response(404, { message: "Usuario no encontrado" });
    if (!r.rows[0].mfa_enabled) return response(400, { message: "MFA no está activo" });

    const match = await bcrypt.compare(password, r.rows[0].password);
    if (!match) return response(401, { message: "Contraseña incorrecta" });

    await client.query(
      `UPDATE app_user SET mfa_enabled = false, mfa_secret = NULL, mfa_recovery_codes = NULL WHERE id = $1`,
      [userId]
    );

    return response(200, { message: "MFA desactivado correctamente" });
  } catch (err) {
    console.error("MFA disable error:", err);
    return response(500, { message: "Error interno del servidor" });
  } finally {
    client?.release();
  }
}

// ── Auth helper: extract userId from Bearer JWT ───────────────────────────────
function requireAuth(headers) {
  const authHeader = headers?.["authorization"] || headers?.["Authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    return payload.sub ? Number(payload.sub) : null;
  } catch {
    return null;
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

// ── Admin: gestión de usuarios (solo superadmin) ──────────────────────────────
async function handleAdminRequest(rawPath, method, body) {
  // GET /api/admin/users — list all users with their assigned schemas
  if (rawPath.endsWith("/admin/users") && method === "GET") {
    let client;
    try {
      client = await pool.connect();
      await ensureColumns(client);
      const result = await client.query(`
        SELECT
          u.id, u.name, u.email, u.role, u.avatar,
          u.email_verified AS "emailVerified",
          COALESCE(u.created_at::text, NULL) AS "createdAt",
          COALESCE(
            json_agg(s.schema_key ORDER BY s.id) FILTER (WHERE s.id IS NOT NULL),
            '[]'
          ) AS schemas
        FROM app_user u
        LEFT JOIN user_schema us ON us.user_id = u.id
        LEFT JOIN app_schema  s  ON s.id = us.schema_id
        GROUP BY u.id
        ORDER BY u.id
      `);
      return response(200, result.rows);
    } catch (err) {
      console.error("Admin list users error:", err);
      return response(500, { message: "Error interno del servidor" });
    } finally { client?.release(); }
  }

  // /api/admin/users/:id/:action
  const match = rawPath.match(/\/admin\/users\/(\d+)\/(status|password|schemas)$/);
  if (!match) return response(404, { message: "Ruta no encontrada" });
  const userId = parseInt(match[1], 10);
  const action = match[2];

  // PUT /api/admin/users/:id/status → { active: true|false }
  if (action === "status" && method === "PUT") {
    if (typeof body?.active !== "boolean")
      return response(400, { message: "Campo 'active' requerido (boolean)" });
    let client;
    try {
      client = await pool.connect();
      const r = await client.query(
        `UPDATE app_user SET email_verified = $1 WHERE id = $2
         RETURNING id, email, email_verified AS "emailVerified"`,
        [body.active, userId]
      );
      if (r.rowCount === 0) return response(404, { message: "Usuario no encontrado" });
      return response(200, r.rows[0]);
    } catch (err) {
      console.error("Admin status error:", err);
      return response(500, { message: "Error interno del servidor" });
    } finally { client?.release(); }
  }

  // PUT /api/admin/users/:id/password → { password: "..." }
  if (action === "password" && method === "PUT") {
    const newPass = body?.password;
    if (!newPass || newPass.length < 8)
      return response(400, { message: "La contraseña debe tener al menos 8 caracteres" });
    const hash = await bcrypt.hash(newPass, 12);
    let client;
    try {
      client = await pool.connect();
      const r = await client.query(
        `UPDATE app_user SET password = $1 WHERE id = $2 RETURNING id, email`,
        [hash, userId]
      );
      if (r.rowCount === 0) return response(404, { message: "Usuario no encontrado" });
      return response(200, { message: "Contraseña actualizada", id: r.rows[0].id });
    } catch (err) {
      console.error("Admin password error:", err);
      return response(500, { message: "Error interno del servidor" });
    } finally { client?.release(); }
  }

  // PUT /api/admin/users/:id/schemas → { schemaKeys: ["clinicalRecords", ...] }
  if (action === "schemas" && method === "PUT") {
    const keys = body?.schemaKeys;
    if (!Array.isArray(keys)) return response(400, { message: "Campo 'schemaKeys' requerido (array)" });
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      await client.query(`DELETE FROM user_schema WHERE user_id = $1`, [userId]);
      if (keys.length > 0) {
        await client.query(
          `INSERT INTO user_schema (user_id, schema_id)
           SELECT $1, s.id FROM app_schema s WHERE s.schema_key = ANY($2::text[])`,
          [userId, keys]
        );
      }
      await client.query("COMMIT");
      const updated = await client.query(
        `SELECT s.schema_key FROM user_schema us
         JOIN app_schema s ON s.id = us.schema_id
         WHERE us.user_id = $1 ORDER BY s.id`,
        [userId]
      );
      return response(200, { id: userId, schemas: updated.rows.map(r => r.schema_key) });
    } catch (err) {
      console.error("Admin schemas error:", err);
      try { client?.query("ROLLBACK"); } catch {}
      return response(500, { message: "Error interno del servidor" });
    } finally { client?.release(); }
  }

  return response(405, { message: "Método no permitido" });
}

// ── Helper ────────────────────────────────────────────────────────────────────
function response(statusCode, body) {
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
