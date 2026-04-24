import pg         from "pg";
import bcrypt     from "bcryptjs";
import jwt        from "jsonwebtoken";
import crypto     from "crypto";

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

const JWT_SECRET     = process.env.JWT_SECRET     || "changeme-use-secrets-manager";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// RP (Relying Party) config — override via env in production
const RP_ID     = process.env.WEBAUTHN_RP_ID     || "localhost";
const RP_ORIGIN = process.env.WEBAUTHN_RP_ORIGIN || "http://localhost:4200";
const RP_NAME   = process.env.WEBAUTHN_RP_NAME   || "DataHub Medical";

// Salt used for PRF-based ZK key derivation (same salt every time → deterministic key)
const PRF_ZK_SALT = process.env.WEBAUTHN_PRF_SALT || "dairi-zk-prf-salt-v1";

// ── Handler principal ─────────────────────────────────────────────────────────
export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "UNKNOWN";
  const rawPath = event.rawPath || event.path || "";

  if (method === "OPTIONS") return response(204, null);

  // ── Route dispatch ────────────────────────────────────────────────────────
  if (method === "POST"   && rawPath.endsWith("/login"))                      return handlePasswordLogin(event);
  if (method === "GET"    && rawPath.includes("/auth/config"))                return handleAuthConfig(event);
  if (method === "POST"   && rawPath.endsWith("/webauthn/register/begin"))    return handleRegisterBegin(event);
  if (method === "POST"   && rawPath.endsWith("/webauthn/register/complete")) return handleRegisterComplete(event);
  if (method === "POST"   && rawPath.endsWith("/webauthn/login/begin"))       return handleLoginBegin(event);
  if (method === "POST"   && rawPath.endsWith("/webauthn/login/complete"))    return handleLoginComplete(event);
  if (method === "DELETE" && rawPath.includes("/webauthn/credential/"))       return handleDeleteCredential(event);

  // ── Vendor / superadmin routes ────────────────────────────────────────────
  if (rawPath.includes("/vendor/subscriptions")) return handleVendor(event, rawPath, method);

  return response(404, { message: "Ruta no encontrada" });
};

// ════════════════════════════════════════════════════════════════════════════
// 1. Password login (existing)
// ════════════════════════════════════════════════════════════════════════════
async function handlePasswordLogin(event) {
  let body;
  try { body = parseBody(event); } catch { return response(400, { message: "Body inválido" }); }

  const { email, password } = body || {};
  if (!email || !password) return response(400, { message: "'email' y 'password' son requeridos" });

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT id, name, email, password, role, avatar FROM app_user WHERE email = $1 LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    if (result.rowCount === 0) return response(401, { message: "Credenciales inválidas." });

    const user = result.rows[0];
    if (!await bcrypt.compare(password, user.password)) return response(401, { message: "Credenciales inválidas." });

    return response(200, await buildAuthResponse(client, user));
  } catch (err) {
    console.error("Password login error:", err.message);
    return response(500, { message: "Error interno del servidor" });
  } finally { client?.release(); }
}

// ════════════════════════════════════════════════════════════════════════════
// 2. WebAuthn — Registration begin
//    POST /api/auth/webauthn/register/begin  { email }
//    Returns PublicKeyCredentialCreationOptions
// ════════════════════════════════════════════════════════════════════════════
async function handleRegisterBegin(event) {
  let body;
  try { body = parseBody(event); } catch { return response(400, { message: "Body inválido" }); }

  const token = extractBearerToken(event);
  if (!token) return response(401, { message: "Se requiere autenticación para registrar biometría" });

  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); } catch { return response(401, { message: "Token inválido" }); }

  let client;
  try {
    client = await pool.connect();
    const userResult = await client.query(
      `SELECT id, name, email FROM app_user WHERE id = $1 LIMIT 1`, [payload.sub]
    );
    if (userResult.rowCount === 0) return response(404, { message: "Usuario no encontrado" });
    const user = userResult.rows[0];

    // Generate challenge (32 random bytes)
    const challengeBytes = crypto.randomBytes(32);
    const challengeB64   = b64urlEncode(challengeBytes);

    // Store challenge in DB (TTL 5 min)
    await client.query(
      `INSERT INTO webauthn_challenge (user_id, challenge, purpose, expires_at)
       VALUES ($1, $2, 'register', NOW() + INTERVAL '5 minutes')`,
      [user.id, challengeB64]
    );

    // Existing credential IDs for this user (to exclude from re-registration)
    const credsResult = await client.query(
      `SELECT credential_id FROM webauthn_credential WHERE user_id = $1`, [user.id]
    );
    const excludeCredentials = credsResult.rows.map(r => ({
      type: "public-key",
      id:   r.credential_id,
      transports: ["internal", "usb", "ble", "nfc", "hybrid"]
    }));

    // PRF salt for ZK key derivation
    const prfSalt = b64urlEncode(Buffer.from(PRF_ZK_SALT + ":" + user.email));

    return response(200, {
      challenge: challengeB64,
      rp:        { id: RP_ID, name: RP_NAME },
      user: {
        id:          b64urlEncode(Buffer.from(String(user.id))),
        name:        user.email,
        displayName: user.name
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7  },  // ES256 (ECDSA P-256)
        { type: "public-key", alg: -257 }  // RS256 (RSA PKCS1v15)
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",   // fingerprint / Face ID / Windows Hello
        userVerification:        "required",   // always ask for biometric
        residentKey:             "preferred"   // discoverable credential
      },
      timeout:             60000,
      attestation:         "none",
      excludeCredentials,
      extensions: {
        prf: {
          eval: { first: prfSalt }  // PRF for deterministic ZK key derivation
        }
      }
    });
  } catch (err) {
    console.error("Register begin error:", err.message);
    return response(500, { message: "Error interno del servidor" });
  } finally { client?.release(); }
}

// ════════════════════════════════════════════════════════════════════════════
// 3. WebAuthn — Registration complete
//    POST /api/auth/webauthn/register/complete  { credential, deviceName }
//    Verifies attestation, stores public key
// ════════════════════════════════════════════════════════════════════════════
async function handleRegisterComplete(event) {
  let body;
  try { body = parseBody(event); } catch { return response(400, { message: "Body inválido" }); }

  const token = extractBearerToken(event);
  if (!token) return response(401, { message: "Autenticación requerida" });

  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); } catch { return response(401, { message: "Token inválido" }); }

  const { credential, deviceName } = body || {};
  if (!credential?.id || !credential?.response?.attestationObject || !credential?.response?.clientDataJSON) {
    return response(400, { message: "Credential incompleta" });
  }

  let client;
  try {
    client = await pool.connect();

    // 1. Parse clientDataJSON
    const clientData = JSON.parse(
      Buffer.from(b64urlDecode(credential.response.clientDataJSON)).toString("utf8")
    );

    if (clientData.type !== "webauthn.create") {
      return response(400, { message: "Tipo de operación inválido" });
    }

    // 2. Verify origin
    if (clientData.origin !== RP_ORIGIN) {
      console.warn("Origin mismatch:", clientData.origin, "expected:", RP_ORIGIN);
      return response(400, { message: "Origen inválido" });
    }

    // 3. Fetch and validate challenge (one-time use)
    const challengeRow = await client.query(
      `SELECT id FROM webauthn_challenge
       WHERE user_id = $1
         AND challenge = $2
         AND purpose = 'register'
         AND used = FALSE
         AND expires_at > NOW()
       LIMIT 1`,
      [payload.sub, clientData.challenge]
    );
    if (challengeRow.rowCount === 0) return response(400, { message: "Challenge inválido o expirado" });

    await client.query(`UPDATE webauthn_challenge SET used = TRUE WHERE id = $1`, [challengeRow.rows[0].id]);

    // 4. Parse attestationObject (CBOR) → extract authData
    const attObjBuffer = b64urlDecode(credential.response.attestationObject);
    const authData     = extractAuthData(attObjBuffer);
    if (!authData) return response(400, { message: "attestationObject inválido" });

    // 5. Extract AAGUID, credentialId, publicKey from authData
    const { aaguid, credentialId, cosePublicKey } = parseAuthData(authData);
    if (!credentialId || !cosePublicKey) return response(400, { message: "authData incompleto" });

    // credentialId from attestation must match the credential.id from request
    const credIdB64 = b64urlEncode(credentialId);
    if (credIdB64 !== credential.id) return response(400, { message: "Credential ID mismatch" });

    // 6. Check for duplicate credential
    const dupCheck = await client.query(
      `SELECT id FROM webauthn_credential WHERE credential_id = $1`, [credIdB64]
    );
    if (dupCheck.rowCount > 0) return response(409, { message: "Esta credencial ya está registrada" });

    // 7. Extract PRF salt (if provided by authenticator for ZK)
    const prfSalt = credential.clientExtensionResults?.prf?.enabled
      ? b64urlEncode(Buffer.from(PRF_ZK_SALT + ":" + payload.email))
      : null;

    // 8. Persist credential
    const transports = credential.response.transports || ["internal"];
    await client.query(
      `INSERT INTO webauthn_credential
         (user_id, credential_id, public_key, sign_count, aaguid, device_type, device_name, transports, prf_salt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        payload.sub,
        credIdB64,
        b64urlEncode(cosePublicKey),
        0,
        aaguid || null,
        credential.authenticatorAttachment === "cross-platform" ? "cross-platform" : "platform",
        (deviceName || "Mi dispositivo").substring(0, 200),
        transports,
        prfSalt
      ]
    );

    return response(200, {
      message:     "Biometría registrada correctamente",
      credentialId: credIdB64,
      prfEnabled:  !!prfSalt
    });
  } catch (err) {
    console.error("Register complete error:", err.message, err.stack);
    return response(500, { message: "Error interno del servidor" });
  } finally { client?.release(); }
}

// ════════════════════════════════════════════════════════════════════════════
// 4. WebAuthn — Login begin
//    POST /api/auth/webauthn/login/begin  { email }
//    Returns PublicKeyCredentialRequestOptions
// ════════════════════════════════════════════════════════════════════════════
async function handleLoginBegin(event) {
  let body;
  try { body = parseBody(event); } catch { return response(400, { message: "Body inválido" }); }

  const { email } = body || {};
  if (!email) return response(400, { message: "'email' es requerido" });

  let client;
  try {
    client = await pool.connect();

    const userResult = await client.query(
      `SELECT id, email FROM app_user WHERE email = $1 LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    // Return same response even if user not found (prevent enumeration)
    const userId = userResult.rows[0]?.id ?? null;

    const challengeBytes = crypto.randomBytes(32);
    const challengeB64   = b64urlEncode(challengeBytes);

    if (userId) {
      await client.query(
        `INSERT INTO webauthn_challenge (user_id, challenge, purpose, expires_at)
         VALUES ($1, $2, 'login', NOW() + INTERVAL '5 minutes')`,
        [userId, challengeB64]
      );
    }

    // Load allowed credentials
    let allowCredentials = [];
    if (userId) {
      const credsResult = await client.query(
        `SELECT credential_id, transports, prf_salt
         FROM webauthn_credential WHERE user_id = $1`, [userId]
      );
      allowCredentials = credsResult.rows.map(r => ({
        type:       "public-key",
        id:         r.credential_id,
        transports: r.transports || ["internal"]
      }));

      // PRF salt for ZK key re-derivation on login
      const prfSalt = credsResult.rows.find(r => r.prf_salt)?.prf_salt ?? null;
      if (prfSalt) {
        // Attach prf extension for ZK key derivation
        return response(200, {
          challenge:        challengeB64,
          rpId:             RP_ID,
          allowCredentials,
          userVerification: "required",
          timeout:          60000,
          extensions: { prf: { eval: { first: prfSalt } } }
        });
      }
    }

    return response(200, {
      challenge:        challengeB64,
      rpId:             RP_ID,
      allowCredentials,
      userVerification: "required",
      timeout:          60000
    });
  } catch (err) {
    console.error("Login begin error:", err.message);
    return response(500, { message: "Error interno del servidor" });
  } finally { client?.release(); }
}

// ════════════════════════════════════════════════════════════════════════════
// 5. WebAuthn — Login complete
//    POST /api/auth/webauthn/login/complete  { email, credential }
//    Verifies assertion, returns JWT
// ════════════════════════════════════════════════════════════════════════════
async function handleLoginComplete(event) {
  let body;
  try { body = parseBody(event); } catch { return response(400, { message: "Body inválido" }); }

  const { email, credential } = body || {};
  if (!email || !credential?.id || !credential?.response?.authenticatorData ||
      !credential?.response?.clientDataJSON || !credential?.response?.signature) {
    return response(400, { message: "Datos de autenticación incompletos" });
  }

  let client;
  try {
    client = await pool.connect();

    // 1. Find user
    const userResult = await client.query(
      `SELECT id, name, email, role, avatar FROM app_user WHERE email = $1 LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    if (userResult.rowCount === 0) return response(401, { message: "Autenticación fallida" });
    const user = userResult.rows[0];

    // 2. Find stored credential
    const credResult = await client.query(
      `SELECT id, credential_id, public_key, sign_count
       FROM webauthn_credential
       WHERE user_id = $1 AND credential_id = $2 LIMIT 1`,
      [user.id, credential.id]
    );
    if (credResult.rowCount === 0) return response(401, { message: "Credencial biométrica no reconocida" });
    const storedCred = credResult.rows[0];

    // 3. Parse clientDataJSON
    const clientData = JSON.parse(
      Buffer.from(b64urlDecode(credential.response.clientDataJSON)).toString("utf8")
    );
    if (clientData.type !== "webauthn.get") return response(400, { message: "Tipo de operación inválido" });
    if (clientData.origin !== RP_ORIGIN)    return response(400, { message: "Origen inválido" });

    // 4. Validate challenge
    const challengeRow = await client.query(
      `SELECT id FROM webauthn_challenge
       WHERE user_id = $1
         AND challenge = $2
         AND purpose = 'login'
         AND used = FALSE
         AND expires_at > NOW()
       LIMIT 1`,
      [user.id, clientData.challenge]
    );
    if (challengeRow.rowCount === 0) return response(400, { message: "Challenge inválido o expirado" });
    await client.query(`UPDATE webauthn_challenge SET used = TRUE WHERE id = $1`, [challengeRow.rows[0].id]);

    // 5. Parse authenticatorData
    const authDataBuffer = b64urlDecode(credential.response.authenticatorData);
    const authDataView   = new DataView(authDataBuffer.buffer, authDataBuffer.byteOffset);

    // Verify rpId hash
    const expectedRpIdHash = crypto.createHash("sha256").update(RP_ID).digest();
    const actualRpIdHash   = authDataBuffer.slice(0, 32);
    if (!expectedRpIdHash.equals(actualRpIdHash)) {
      return response(400, { message: "RP ID hash inválido" });
    }

    // Verify user presence flag (bit 0) and user verification flag (bit 2)
    const flags = authDataBuffer[32];
    if (!(flags & 0x01)) return response(400, { message: "User Presence no confirmado" });
    if (!(flags & 0x04)) return response(400, { message: "User Verification no confirmado" });

    // Extract sign count
    const signCount = authDataView.getUint32(33, false);

    // 6. Verify signature
    const clientDataHash = crypto.createHash("sha256")
      .update(b64urlDecode(credential.response.clientDataJSON)).digest();
    const signedData = Buffer.concat([authDataBuffer, clientDataHash]);
    const signature  = b64urlDecode(credential.response.signature);
    const publicKey  = b64urlDecode(storedCred.public_key);

    const valid = await verifySignature(publicKey, signedData, signature);
    if (!valid) return response(401, { message: "Firma biométrica inválida" });

    // 7. Clone detection — sign count must be >= stored
    if (signCount > 0 && signCount <= storedCred.sign_count) {
      console.error("CLONE DETECTED for credential", storedCred.id, "stored:", storedCred.sign_count, "got:", signCount);
      return response(401, { message: "Autenticador posiblemente clonado. Contacte al administrador." });
    }

    // 8. Update sign count and last_used_at
    await client.query(
      `UPDATE webauthn_credential SET sign_count = $1, last_used_at = NOW() WHERE id = $2`,
      [signCount, storedCred.id]
    );

    // 9. Issue JWT
    return response(200, await buildAuthResponse(client, user));

  } catch (err) {
    console.error("Login complete error:", err.message, err.stack);
    return response(500, { message: "Error interno del servidor" });
  } finally { client?.release(); }
}

// ════════════════════════════════════════════════════════════════════════════
// 6. Delete credential
//    DELETE /api/auth/webauthn/credential/:credentialId
// ════════════════════════════════════════════════════════════════════════════
async function handleDeleteCredential(event) {
  const token = extractBearerToken(event);
  if (!token) return response(401, { message: "Autenticación requerida" });

  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); } catch { return response(401, { message: "Token inválido" }); }

  const rawPath    = event.rawPath || event.path || "";
  const credId = decodeURIComponent(rawPath.split("/webauthn/credential/")[1] || "");
  if (!credId) return response(400, { message: "credentialId requerido" });

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `DELETE FROM webauthn_credential WHERE credential_id = $1 AND user_id = $2 RETURNING id`,
      [credId, payload.sub]
    );
    if (result.rowCount === 0) return response(404, { message: "Credencial no encontrada" });
    return response(200, { message: "Credencial eliminada" });
  } catch (err) {
    console.error("Delete credential error:", err.message);
    return response(500, { message: "Error interno del servidor" });
  } finally { client?.release(); }
}

// ════════════════════════════════════════════════════════════════════════════
// Auth config — public endpoint used by login page
//   GET /api/auth/config?email=<email>
//   Returns { biometricEnabled } for the user's subscription
// ════════════════════════════════════════════════════════════════════════════
async function handleAuthConfig(event) {
  const email = (event.queryStringParameters?.email || "").toLowerCase().trim();
  if (!email) return response(400, { message: "'email' es requerido" });

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT
         COALESCE(s.biometric_auth, sp.biometric_auth) AS biometric_auth,
         s.active AS sub_active
       FROM app_user u
       LEFT JOIN subscription s   ON s.id = u.subscription_id
       LEFT JOIN subscription_plan sp ON sp.id = s.plan_id
       WHERE u.email = $1
       LIMIT 1`,
      [email]
    );
    if (result.rowCount === 0) {
      // Don't reveal whether the user exists — return disabled
      return response(200, { biometricEnabled: false });
    }
    const row = result.rows[0];
    const biometricEnabled = row.sub_active !== false && row.biometric_auth === true;
    return response(200, { biometricEnabled });
  } catch (err) {
    console.error("Auth config error:", err.message);
    return response(500, { message: "Error interno del servidor" });
  } finally { client?.release(); }
}

// ════════════════════════════════════════════════════════════════════════════
// Vendor / Superadmin — subscription management
//   All routes require role = 'superadmin' in JWT
//
//   GET    /api/vendor/subscriptions            → list
//   POST   /api/vendor/subscriptions            → create
//   GET    /api/vendor/subscriptions/:id        → get one
//   PUT    /api/vendor/subscriptions/:id        → update (includes biometric toggle)
//   DELETE /api/vendor/subscriptions/:id        → delete
//   GET    /api/vendor/subscriptions/:id/users  → list users of subscription
//   GET    /api/vendor/plans                    → list available plans
// ════════════════════════════════════════════════════════════════════════════
async function handleVendor(event, rawPath, method) {
  const token = extractBearerToken(event);
  if (!token) return response(401, { message: "Autenticación requerida" });

  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); }
  catch { return response(401, { message: "Token inválido" }); }

  if (payload.role !== "superadmin") {
    return response(403, { message: "Acceso denegado — se requiere rol superadmin" });
  }

  // Parse path segments after /vendor/
  // e.g. /api/vendor/subscriptions/5/users  → segments = ['subscriptions','5','users']
  const vendorBase = rawPath.split("/vendor/")[1] || "";
  const segments   = vendorBase.split("/").filter(Boolean);

  let client;
  try {
    client = await pool.connect();

    // GET /api/vendor/plans
    if (segments[0] === "plans" && method === "GET") {
      const r = await client.query(`SELECT id, code, label, biometric_auth, max_users FROM subscription_plan ORDER BY id`);
      return response(200, r.rows.map(p => ({
        id: p.id, code: p.code, label: p.label,
        biometricAuth: p.biometric_auth, maxUsers: p.max_users
      })));
    }

    // GET /api/vendor/subscriptions/:id/users
    if (segments[0] === "subscriptions" && segments[2] === "users" && method === "GET") {
      const subId = parseInt(segments[1]);
      const r = await client.query(
        `SELECT id, name, email, role, avatar, created_at
         FROM app_user WHERE subscription_id = $1 ORDER BY name`,
        [subId]
      );
      return response(200, r.rows.map(u => ({
        id: u.id, name: u.name, email: u.email, role: u.role,
        avatar: u.avatar, createdAt: u.created_at
      })));
    }

    // GET /api/vendor/subscriptions
    if (segments[0] === "subscriptions" && !segments[1] && method === "GET") {
      const r = await client.query(
        `SELECT s.id, s.name, s.active, s.contact_email, s.created_at, s.updated_at,
                sp.code AS plan_code, sp.label AS plan_label,
                COALESCE(s.biometric_auth, sp.biometric_auth) AS biometric_auth,
                s.biometric_auth AS biometric_override,
                (SELECT COUNT(*) FROM app_user u WHERE u.subscription_id = s.id) AS user_count
         FROM subscription s
         JOIN subscription_plan sp ON sp.id = s.plan_id
         ORDER BY s.id DESC`
      );
      return response(200, r.rows.map(mapSubscription));
    }

    // GET /api/vendor/subscriptions/:id
    if (segments[0] === "subscriptions" && segments[1] && !segments[2] && method === "GET") {
      const subId = parseInt(segments[1]);
      const r = await client.query(
        `SELECT s.id, s.name, s.active, s.contact_email, s.created_at, s.updated_at,
                sp.code AS plan_code, sp.label AS plan_label,
                COALESCE(s.biometric_auth, sp.biometric_auth) AS biometric_auth,
                s.biometric_auth AS biometric_override,
                (SELECT COUNT(*) FROM app_user u WHERE u.subscription_id = s.id) AS user_count
         FROM subscription s
         JOIN subscription_plan sp ON sp.id = s.plan_id
         WHERE s.id = $1`,
        [subId]
      );
      if (r.rowCount === 0) return response(404, { message: "Suscripción no encontrada" });
      return response(200, mapSubscription(r.rows[0]));
    }

    // POST /api/vendor/subscriptions
    if (segments[0] === "subscriptions" && !segments[1] && method === "POST") {
      let body;
      try { body = parseBody(event); } catch { return response(400, { message: "Body inválido" }); }
      const { name, planCode, contactEmail, biometricAuth } = body || {};
      if (!name || !planCode) return response(400, { message: "'name' y 'planCode' son requeridos" });

      const planResult = await client.query(
        `SELECT id FROM subscription_plan WHERE code = $1`, [planCode]
      );
      if (planResult.rowCount === 0) return response(400, { message: `Plan '${planCode}' no existe` });

      const r = await client.query(
        `INSERT INTO subscription (name, plan_id, biometric_auth, contact_email)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [name.trim(), planResult.rows[0].id,
         biometricAuth === true ? true : biometricAuth === false ? false : null,
         contactEmail || null]
      );
      return response(201, { id: r.rows[0].id, message: "Suscripción creada" });
    }

    // PUT /api/vendor/subscriptions/:id
    if (segments[0] === "subscriptions" && segments[1] && !segments[2] && method === "PUT") {
      let body;
      try { body = parseBody(event); } catch { return response(400, { message: "Body inválido" }); }
      const subId = parseInt(segments[1]);
      const { name, planCode, contactEmail, biometricAuth, active } = body || {};

      const sets = [];
      const vals = [];
      let i = 1;

      if (name          !== undefined) { sets.push(`name = $${i++}`);           vals.push(name.trim()); }
      if (contactEmail  !== undefined) { sets.push(`contact_email = $${i++}`);  vals.push(contactEmail || null); }
      if (active        !== undefined) { sets.push(`active = $${i++}`);         vals.push(!!active); }
      // biometricAuth: true/false = override; null = inherit from plan
      if (biometricAuth !== undefined) {
        sets.push(`biometric_auth = $${i++}`);
        vals.push(biometricAuth === null ? null : !!biometricAuth);
      }
      if (planCode !== undefined) {
        const planRes = await client.query(`SELECT id FROM subscription_plan WHERE code = $1`, [planCode]);
        if (planRes.rowCount === 0) return response(400, { message: `Plan '${planCode}' no existe` });
        sets.push(`plan_id = $${i++}`); vals.push(planRes.rows[0].id);
      }
      if (sets.length === 0) return response(400, { message: "Sin campos para actualizar" });

      sets.push(`updated_at = NOW()`);
      vals.push(subId);

      const r = await client.query(
        `UPDATE subscription SET ${sets.join(", ")} WHERE id = $${i} RETURNING id`, vals
      );
      if (r.rowCount === 0) return response(404, { message: "Suscripción no encontrada" });
      return response(200, { message: "Suscripción actualizada" });
    }

    // DELETE /api/vendor/subscriptions/:id
    if (segments[0] === "subscriptions" && segments[1] && !segments[2] && method === "DELETE") {
      const subId = parseInt(segments[1]);
      const usersCheck = await client.query(
        `SELECT COUNT(*) AS cnt FROM app_user WHERE subscription_id = $1`, [subId]
      );
      if (parseInt(usersCheck.rows[0].cnt) > 0) {
        return response(409, { message: "No se puede eliminar: la suscripción tiene usuarios activos" });
      }
      const r = await client.query(`DELETE FROM subscription WHERE id = $1 RETURNING id`, [subId]);
      if (r.rowCount === 0) return response(404, { message: "Suscripción no encontrada" });
      return response(200, { message: "Suscripción eliminada" });
    }

    return response(404, { message: "Ruta no encontrada" });
  } catch (err) {
    console.error("Vendor handler error:", err.message, err.stack);
    return response(500, { message: "Error interno del servidor" });
  } finally { client?.release(); }
}

function mapSubscription(r) {
  return {
    id:                r.id,
    name:              r.name,
    active:            r.active,
    contactEmail:      r.contact_email,
    planCode:          r.plan_code,
    planLabel:         r.plan_label,
    biometricAuth:     r.biometric_auth,     // effective value (override ?? plan default)
    biometricOverride: r.biometric_override, // explicit override (null = inherit from plan)
    userCount:         parseInt(r.user_count),
    createdAt:         r.created_at,
    updatedAt:         r.updated_at
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Shared helpers
// ════════════════════════════════════════════════════════════════════════════

async function buildAuthResponse(client, user) {
  const schemasResult = await client.query(
    `SELECT s.schema_key AS "schemaKey", s.singular, s.plural, s.icon, s.module_type AS "moduleType"
     FROM app_schema s
     INNER JOIN user_schema us ON us.schema_id = s.id
     WHERE us.user_id = $1
     ORDER BY s.id`,
    [user.id]
  );
  const schemas = schemasResult.rows.map(s => ({
    entity: { key: s.schemaKey, singular: s.singular, plural: s.plural, icon: s.icon, moduleType: s.moduleType },
    fields: []
  }));
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const token     = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return { token, expiresAt, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }, schemas };
}

/** Verify ES256 (ECDSA P-256) or RS256 (RSA) signature from COSE public key */
async function verifySignature(coseKeyBytes, data, signature) {
  try {
    // Parse COSE key (minimal CBOR for kty=2 EC2 or kty=3 RSA)
    const { kty, alg, crv, x, y, n, e } = parseCoseKey(coseKeyBytes);

    if (kty === 2) {
      // EC2 (P-256), alg = -7 (ES256)
      const keyData = { kty: "EC", crv: "P-256", x: b64urlEncode(x), y: b64urlEncode(y) };
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        "jwk", keyData, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
      );
      return await globalThis.crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" }, cryptoKey, signature, data
      );
    } else if (kty === 3) {
      // RSA, alg = -257 (RS256)
      const keyData = { kty: "RSA", alg: "RS256", n: b64urlEncode(n), e: b64urlEncode(e) };
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        "jwk", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
      );
      return await globalThis.crypto.subtle.verify(
        { name: "RSASSA-PKCS1-v1_5" }, cryptoKey, signature, data
      );
    }
    return false;
  } catch (err) {
    console.error("Signature verification error:", err.message);
    return false;
  }
}

/**
 * Minimal CBOR decoder for COSE keys (map with small integer keys).
 * Handles byte strings (major type 2) and integers (major type 0/1).
 * Sufficient for ES256 and RS256 COSE keys from WebAuthn authenticators.
 */
function parseCoseKey(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 0;

  function readByte()  { return buf[pos++]; }
  function readUint16(){ const v = view.getUint16(pos, false); pos += 2; return v; }
  function readUint32(){ const v = view.getUint32(pos, false); pos += 4; return v; }

  function readItem() {
    const initial = readByte();
    const major   = initial >> 5;
    const info    = initial & 0x1f;

    let len = info;
    if (info === 24) len = readByte();
    else if (info === 25) len = readUint16();
    else if (info === 26) len = readUint32();

    if (major === 0) return len;               // uint
    if (major === 1) return -(1 + len);        // negative int
    if (major === 2) { const b = buf.slice(pos, pos + len); pos += len; return b; }  // byte string
    if (major === 3) { const b = buf.slice(pos, pos + len); pos += len; return Buffer.from(b).toString("utf8"); } // text
    if (major === 5) {                         // map
      const map = {};
      for (let i = 0; i < len; i++) { const k = readItem(); map[k] = readItem(); }
      return map;
    }
    if (major === 4) {                         // array
      const arr = [];
      for (let i = 0; i < len; i++) arr.push(readItem());
      return arr;
    }
    return null;
  }

  const map = readItem();
  return {
    kty: map[1],
    alg: map[3],
    crv: map[-1],
    x:   map[-2],
    y:   map[-3],
    n:   map[-1],  // RSA modulus also at key -1
    e:   map[-2],  // RSA exponent also at key -2
  };
}

/**
 * Extract authData from a CBOR-encoded attestationObject.
 * attestationObject = { fmt: text, attStmt: map, authData: bytes }
 */
function extractAuthData(attObjBuf) {
  try {
    // Quick CBOR parse: find authData bytes
    const buf  = Buffer.isBuffer(attObjBuf) ? attObjBuf : Buffer.from(attObjBuf);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let pos    = 0;

    function readByte()   { return buf[pos++]; }
    function readUint16() { const v = view.getUint16(pos, false); pos += 2; return v; }
    function readUint32() { const v = view.getUint32(pos, false); pos += 4; return v; }

    function readItem() {
      const initial = readByte();
      const major   = initial >> 5;
      const info    = initial & 0x1f;
      let len       = info;
      if (info === 24) len = readByte();
      else if (info === 25) len = readUint16();
      else if (info === 26) len = readUint32();

      if (major === 0) return { type: "uint", value: len };
      if (major === 1) return { type: "int",  value: -(1 + len) };
      if (major === 2) { const b = buf.slice(pos, pos + len); pos += len; return { type: "bytes", value: b }; }
      if (major === 3) { const b = buf.slice(pos, pos + len); pos += len; return { type: "text", value: Buffer.from(b).toString("utf8") }; }
      if (major === 5) {
        const map = {};
        for (let i = 0; i < len; i++) {
          const k = readItem(); const v = readItem();
          map[k.value] = v;
        }
        return { type: "map", value: map };
      }
      return { type: "unknown", value: null };
    }

    const root = readItem();
    if (root.type !== "map") return null;
    const authData = root.value["authData"];
    return authData?.type === "bytes" ? authData.value : null;
  } catch {
    return null;
  }
}

/**
 * Parse WebAuthn authenticatorData binary structure.
 * Layout: rpIdHash(32) | flags(1) | signCount(4) | [aaguid(16) | credIdLen(2) | credId(?) | cosePublicKey(?)]
 */
function parseAuthData(authData) {
  if (!authData || authData.length < 37) return {};

  const flags = authData[32];
  const hasAttestedData = (flags & 0x40) !== 0;

  if (!hasAttestedData || authData.length < 55) {
    return { aaguid: null, credentialId: null, cosePublicKey: null };
  }

  const aaguidRaw = authData.slice(37, 53);
  const aaguid    = [
    aaguidRaw.slice(0, 4), aaguidRaw.slice(4, 6), aaguidRaw.slice(6, 8),
    aaguidRaw.slice(8, 10), aaguidRaw.slice(10, 16)
  ].map(b => b.toString("hex")).join("-");

  const credIdLen    = (authData[53] << 8) | authData[54];
  const credentialId = authData.slice(55, 55 + credIdLen);
  const cosePublicKey= authData.slice(55 + credIdLen);

  return { aaguid, credentialId, cosePublicKey };
}

// ── Encoding helpers ──────────────────────────────────────────────────────────

function b64urlEncode(buf) {
  return Buffer.from(buf).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad    = padded.length % 4;
  return Buffer.from(pad ? padded + "=".repeat(4 - pad) : padded, "base64");
}

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

function extractBearerToken(event) {
  const auth = event.headers?.["authorization"] || event.headers?.["Authorization"] || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

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
