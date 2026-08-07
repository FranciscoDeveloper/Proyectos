// Handles /api/professionals/* — perfil profesional creado desde el módulo /onboarding.
//
// Contexto (por qué existe este archivo): el componente /onboarding hacía POST a
// /api/professionals/onboarding con un FormData. Ese endpoint NO existía en ninguna
// Lambda ni en API Gateway, y el catch del componente se tragaba el fallo con el
// comentario "Backend endpoint may not exist yet; proceed anyway", de modo que la UI
// avanzaba al paso 2 como si hubiera guardado. Nada de lo que el profesional escribía
// (nombre, RUT, especialidad, teléfono, duración, videoconsulta, días, foto,
// profesionales extra) se persistía jamás. Este handler implementa el endpoint de
// verdad y le da destino a esos datos en la tabla `professional` (migración 016).
//
// Identidad: SIEMPRE del JWT verificado (tokenPayload.sub / .email). Nunca de un id
// enviado en el body — misma convención que handleDeleteAccount en lambda-auth.
//
// NOTA sobre user_id: profScopeService.resolveProfScope() resuelve el alcance por
// fila con `SELECT ... FROM professional WHERE p.user_id = $1` usando el `sub` del
// token, así que `professional.user_id` DEBE ser exactamente ese `sub` para que el
// aislamiento por profesional funcione. Por eso escribimos user_id = tokenPayload.sub.

import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getLogger } from '../lib/logger.mjs';
import { response }  from '../lib/response.mjs';

// Mismo bucket, región y patrón de pre-signed URL que documentsHandler.mjs
// (patient-docs/). No se crea un bucket nuevo: dairi-medical-documents ya vive en
// us-east-1, la misma región que esta Lambda VPC-attached y su S3 Gateway Endpoint,
// y ya tiene bloqueo público total + bucket policy para el rol de la Lambda.
const s3Client     = new S3Client({ region: process.env.DOCS_BUCKET_REGION || 'us-east-1' });
const DOCS_BUCKET  = process.env.DOCS_BUCKET || 'dairi-medical-documents';
const PHOTO_PREFIX = 'professional-photos';
const LOGO_PREFIX  = 'clinic-logos';

// ── Límite de profesionales por plan ─────────────────────────────────────────
// Antes era una constante plana MAX_EXTRA = 4 para todo el mundo (5 profesionales
// en total). El producto define ahora:
//
//   Starter → 1 profesional en total (0 adicionales)
//   Pro     → 3 profesionales en total (titular + 2 adicionales)
//
// Cómo se distingue el plano server-side: el ÚNICO discriminador de plan que
// existe hoy en el JWT es `accountType`, y sólo las sesiones Starter lo llevan
// (lambda-auth signAgendaSession → accountType:'agenda'). handleLoginDairi firma
// sin accountType, igual que el login legacy contra Postgres. No existe ningún
// campo de plan que separe Pro de Enterprise: ambos se registran por el mismo
// handleRegisterDairi y no hay alta self-serve de Enterprise (la tarjeta de
// precios de Enterprise apunta a "Cotiza aquí"/contacto comercial). Por eso:
// 'agenda' → Starter, cualquier otra cosa que llegue hasta aquí → Pro.
//
// En la práctica el caso 'agenda' es inalcanzable en esta Lambda: index.mjs
// bloquea las cuentas Starter con 403 ANTES de cualquier ruta que toque Postgres
// (sólo pueden hablar con el calendario DynamoDB de agendaHandler). Se deja de
// todos modos como defensa en profundidad: si algún día se abre una ruta
// Postgres a Starter, el límite viaja con el handler y no con el router.
const MAX_EXTRA_BY_PLAN = { agenda: 0 };
const MAX_EXTRA_DEFAULT = 2;   // Pro

/** Adicionales permitidos para el titular de este token. */
function maxExtraFor(tokenPayload) {
  const t = tokenPayload?.accountType;
  return t && Object.hasOwn(MAX_EXTRA_BY_PLAN, t) ? MAX_EXTRA_BY_PLAN[t] : MAX_EXTRA_DEFAULT;
}

const MIN_PRICE        = 1;
const MAX_PRICE        = 9_999_999;   // CLP; la columna es NUMERIC(10,2)
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Validación de RUT chileno (módulo 11). Se valida en servidor: el checkeo del
 *  cliente es UX, no una garantía — el endpoint es alcanzable sin pasar por la SPA. */
function isValidRut(rut) {
  const clean = String(rut ?? '').replace(/[.\-\s]/g, '').toUpperCase();
  if (clean.length < 2 || !/^\d+[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv   = clean.slice(-1);
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const rem      = sum % 11;
  const expected = rem === 0 ? '0' : rem === 1 ? 'K' : String(11 - rem);
  return dv === expected;
}

/** Normaliza el RUT a la forma canónica sin puntos y con guion (12345678-9). */
function normalizeRut(rut) {
  const clean = String(rut ?? '').replace(/[.\-\s]/g, '').toUpperCase();
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

/** Precio: acepta number o string numérico. Devuelve entero CLP, o null si viene
 *  vacío (un profesional sin precio fijado debe caer al default de lambda-book,
 *  no romper la reserva), o undefined si es inválido. */
function parsePrice(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  const int = Math.round(n);
  if (int < MIN_PRICE || int > MAX_PRICE) return undefined;
  return int;
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    return null;
  }
}

/**
 * Rutas /api/professionals/*. Devuelve null cuando el path no corresponde.
 *
 * @param {string} rawPath
 * @param {string} method
 * @param {object} event
 * @param {object} tokenPayload  Payload JWT ya verificado ({ sub, email, role }).
 * @param {import('pg').PoolClient} client
 */
export async function handleProfessionals(rawPath, method, event, tokenPayload, client) {
  if (!rawPath.startsWith('/api/professionals/')) return null;

  const log    = getLogger();
  const userId = tokenPayload.sub;

  // ── GET /api/professionals/specialties → catálogo canónico ─────────────────
  // Sustituye el array ESPECIALIDADES de 24 items hardcodeado en el componente de
  // onboarding, que no coincidía ni con este catálogo ni con el selector del
  // registro Pro. Una sola fuente de verdad para toda la app.
  if (rawPath === '/api/professionals/specialties') {
    if (method !== 'GET') return response(405, { message: 'Método no permitido' });
    const { rows } = await client.query(
      'SELECT value, label FROM professional_specialty ORDER BY sort_order, label'
    );
    return response(200, rows);
  }

  // ── POST /api/professionals/photo-upload-url → pre-signed PUT ──────────────
  // Mismo patrón que documentsHandler: el backend firma una URL, el cliente sube
  // el archivo directo a S3 y después manda el `key` en el POST de onboarding.
  // No se hace parsing de multipart/form-data en ninguna Lambda de este repo.
  if (rawPath === '/api/professionals/photo-upload-url') {
    if (method !== 'POST') return response(405, { message: 'Método no permitido' });

    const body = parseBody(event);
    if (body === null) return response(400, { message: 'Body inválido' });

    const contentType = String(body.contentType ?? '').toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(contentType)) {
      return response(400, { message: 'Formato de imagen no permitido. Usa JPG, PNG o WEBP.' });
    }

    // `kind` distingue la foto de un profesional del logo de la clínica. Se
    // reutiliza este endpoint en vez de crear uno nuevo porque el mecanismo es
    // idéntico (firmar un PUT); lo único que cambia es el prefijo de la key, y
    // así el cliente tiene un solo camino de subida que mantener.
    const isLogo = String(body.kind ?? '').toLowerCase() === 'logo';
    const prefix = isLogo ? LOGO_PREFIX : PHOTO_PREFIX;

    // La key la genera el servidor. Nunca se usa un nombre de archivo del cliente:
    // evita path traversal y que una cuenta escriba en el prefijo de otra.
    const key = `${prefix}/${userId}/${randomUUID()}.${MIME_EXT[contentType]}`;
    const url = await getSignedUrl(
      s3Client,
      new PutObjectCommand({ Bucket: DOCS_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 300 }
    );
    return response(200, { url, key });
  }

  // ── GET /api/professionals/clinic-logo → URL firmada del logo de la cuenta ──
  // El bucket tiene bloqueo público total, así que la key guardada no es
  // directamente utilizable como src: hay que firmarla en cada lectura. Mismo
  // patrón exacto que documentsHandler.mjs (GetObjectCommand + 300s).
  //
  // Devuelve siempre 200: `key: null` significa "esta cuenta no tiene logo" y el
  // cliente cae al texto "Dairi Clínica" de siempre. Un 404 obligaría a cada
  // llamador a distinguir "sin logo" de "falló la petición", y ambos casos deben
  // degradar al mismo fallback.
  if (rawPath === '/api/professionals/clinic-logo') {
    if (method !== 'GET') return response(405, { message: 'Método no permitido' });

    const { rows } = await client.query(
      'SELECT clinic_logo_key FROM user_config WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    const key = rows[0]?.clinic_logo_key ?? null;
    if (!key) return response(200, { key: null, url: null });

    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: DOCS_BUCKET, Key: key }),
      { expiresIn: 300 }
    );
    return response(200, { key, url });
  }

  // ── POST /api/professionals/onboarding ─────────────────────────────────────
  if (rawPath === '/api/professionals/onboarding') {
    if (method !== 'POST') return response(405, { message: 'Método no permitido' });

    const body = parseBody(event);
    if (body === null) return response(400, { message: 'Body inválido' });

    // ── Validación del titular ───────────────────────────────────────────────
    const errors = {};
    const nombre = String(body.nombre ?? '').trim();
    if (nombre.length < 2) errors.nombre = 'El nombre es requerido (mínimo 2 caracteres)';

    const rut = String(body.rut ?? '').trim();
    if (!rut) errors.rut = 'El RUT es requerido';
    else if (!isValidRut(rut)) errors.rut = 'RUT inválido';

    const especialidad = String(body.especialidad ?? '').trim();
    if (!especialidad) errors.especialidad = 'Selecciona una especialidad';

    const price = parsePrice(body.consultationPrice);
    if (price === undefined) {
      errors.consultationPrice = `El precio debe ser un número entre ${MIN_PRICE} y ${MAX_PRICE}`;
    }

    const duracionRaw = body.duracion ?? body.consultationDuration;
    const duracion    = duracionRaw == null || duracionRaw === '' ? 45 : Number(duracionRaw);
    if (!Number.isFinite(duracion) || duracion < 5 || duracion > 480) {
      errors.duracion = 'La duración debe estar entre 5 y 480 minutos';
    }

    let dias = body.diasDisponibles ?? body.workingDays ?? [];
    if (!Array.isArray(dias)) dias = [];
    dias = [...new Set(dias.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))];

    // Límite por plan (ver maxExtraFor). El chequeo del cliente es UX: este
    // endpoint es alcanzable con un curl y un token válido, así que el límite
    // real se aplica acá.
    const maxExtra  = maxExtraFor(tokenPayload);
    const extrasRaw = Array.isArray(body.extraProfessionals) ? body.extraProfessionals : [];
    if (extrasRaw.length > maxExtra) {
      errors.extraProfessionals = maxExtra === 0
        ? 'Tu plan incluye 1 profesional. Para agregar más profesionales necesitas actualizar tu plan.'
        : `Tu plan permite ${maxExtra + 1} profesionales en total (${maxExtra} adicionales).`;
    }

    // La especialidad debe existir en el catálogo canónico.
    if (especialidad) {
      const { rows: specRows } = await client.query(
        'SELECT 1 FROM professional_specialty WHERE value = $1 LIMIT 1',
        [especialidad]
      );
      if (specRows.length === 0) errors.especialidad = 'Especialidad no válida';
    }

    // ── Validación de los extra ──────────────────────────────────────────────
    const extras = [];
    const extraErrors = [];
    for (const [i, raw] of extrasRaw.slice(0, maxExtra).entries()) {
      const e = {};
      const eNombre = String(raw?.nombre ?? '').trim();
      const eRut    = String(raw?.rut ?? '').trim();
      const eEsp    = String(raw?.especialidad ?? '').trim();
      const ePrice  = parsePrice(raw?.consultationPrice);

      if (eNombre.length < 2) e.nombre = 'Nombre requerido';
      if (!eRut) e.rut = 'RUT requerido';
      else if (!isValidRut(eRut)) e.rut = 'RUT inválido';
      if (!eEsp) e.especialidad = 'Especialidad requerida';
      if (ePrice === undefined) e.consultationPrice = 'Precio inválido';

      if (eEsp) {
        const { rows } = await client.query(
          'SELECT 1 FROM professional_specialty WHERE value = $1 LIMIT 1', [eEsp]
        );
        if (rows.length === 0) e.especialidad = 'Especialidad no válida';
      }

      if (Object.keys(e).length > 0) extraErrors[i] = e;
      extras.push({
        nombre: eNombre,
        rut: eRut ? normalizeRut(eRut) : '',
        especialidad: eEsp,
        telefono: String(raw?.telefono ?? '').trim() || null,
        consultationPrice: ePrice ?? null,
        photoKey: raw?.photoKey ? String(raw.photoKey) : null
      });
    }

    if (Object.keys(errors).length > 0 || extraErrors.length > 0) {
      log.warn('Onboarding validation failed', { sub: userId, errors, extraErrors });
      return response(400, { message: 'Revisa los datos ingresados', errors, extraErrors });
    }

    // Dos profesionales de la misma cuenta no pueden compartir RUT.
    const allRuts = [normalizeRut(rut), ...extras.map(e => e.rut)];
    if (new Set(allRuts).size !== allRuts.length) {
      return response(400, { message: 'Hay RUTs repetidos entre los profesionales' });
    }

    const telefono = String(body.telefono ?? '').trim() || null;
    const photoKey = body.photoKey ? String(body.photoKey) : null;

    // Logo de la clínica: opcional y de alcance CUENTA (una clínica, un membrete),
    // por eso va a user_config y no a `professional` — ver migración 017.
    const clinicLogoKey = body.clinicLogoKey ? String(body.clinicLogoKey) : null;

    // user_config.user_id tiene FK a app_user(id); `professional` no tiene FK
    // ninguna. Las cuentas Pro nacen en DynamoDB (handleRegisterDairi) con un id
    // de contador propio y NO obtienen fila en app_user hasta que un admin las
    // aprovisiona a mano — de ahí el mensaje de activación "en unas horas
    // habilitaremos su cuenta". Sin este chequeo, esa cuenta escribía las filas
    // de `professional` y después reventaba con violación de FK al llegar al
    // upsert de user_config, haciendo ROLLBACK de todo y devolviendo un 500
    // opaco. Se comprueba antes de abrir la transacción para poder explicar el
    // motivo real.
    const { rows: userRows } = await client.query(
      'SELECT 1 FROM app_user WHERE id = $1 LIMIT 1', [userId]
    );
    if (userRows.length === 0) {
      log.warn('Onboarding attempted by account without app_user row', { sub: userId });
      return response(409, {
        message: 'Tu cuenta aún no está habilitada. Te avisaremos en cuanto esté lista.'
      });
    }

    try {
      await client.query('BEGIN');

      // ── Titular: upsert por user_id ────────────────────────────────────────
      // photo_key usa COALESCE para no borrar una foto ya subida cuando el cliente
      // reenvía el formulario sin adjuntar una nueva.
      const primary = await client.query(
        `INSERT INTO professional
           (user_id, owner_user_id, name, rut, specialty, phone, email,
            consultation_duration, video_consultation, working_days,
            consultation_price, photo_key, active)
         VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, true)
         ON CONFLICT (user_id) DO UPDATE SET
           owner_user_id         = EXCLUDED.owner_user_id,
           name                  = EXCLUDED.name,
           rut                   = EXCLUDED.rut,
           specialty             = EXCLUDED.specialty,
           phone                 = EXCLUDED.phone,
           email                 = COALESCE(professional.email, EXCLUDED.email),
           consultation_duration = EXCLUDED.consultation_duration,
           video_consultation    = EXCLUDED.video_consultation,
           working_days          = EXCLUDED.working_days,
           consultation_price    = EXCLUDED.consultation_price,
           photo_key             = COALESCE(EXCLUDED.photo_key, professional.photo_key),
           active                = true
         RETURNING id, consultation_price`,
        [
          userId, nombre, normalizeRut(rut), especialidad, telefono,
          tokenPayload.email ?? null, Math.round(duracion),
          body.videoconsulta === true || body.videoConsultation === true,
          JSON.stringify(dias), price, photoKey
        ]
      );
      const professionalId = primary.rows[0].id;

      // ── Extra: filas propias con user_id NULL + owner_user_id = cuenta ─────
      // No pueden compartir el user_id del titular (ver migración 016: romperían
      // resolveProfScope y el LEFT JOIN del login). Se emparejan por RUT dentro de
      // la cuenta para que reenviar el formulario actualice en vez de duplicar.
      const extraIds = [];
      for (const e of extras) {
        const existing = await client.query(
          `SELECT id FROM professional
            WHERE owner_user_id = $1 AND user_id IS NULL AND rut = $2 LIMIT 1`,
          [userId, e.rut]
        );

        if (existing.rowCount > 0) {
          const r = await client.query(
            `UPDATE professional
                SET name = $2, specialty = $3, phone = $4,
                    consultation_price = $5,
                    photo_key = COALESCE($6, photo_key),
                    consultation_duration = $7,
                    active = true
              WHERE id = $1
              RETURNING id`,
            [existing.rows[0].id, e.nombre, e.especialidad, e.telefono,
             e.consultationPrice, e.photoKey, Math.round(duracion)]
          );
          extraIds.push(r.rows[0].id);
        } else {
          const r = await client.query(
            `INSERT INTO professional
               (user_id, owner_user_id, name, rut, specialty, phone,
                consultation_duration, video_consultation, working_days,
                consultation_price, photo_key, active)
             VALUES (NULL, $1, $2, $3, $4, $5, $6, false, $7::jsonb, $8, $9, true)
             RETURNING id`,
            [userId, e.nombre, e.rut, e.especialidad, e.telefono,
             Math.round(duracion), JSON.stringify(dias), e.consultationPrice, e.photoKey]
          );
          extraIds.push(r.rows[0].id);
        }
      }

      // Extra que ya no vienen en la lista: se desactivan, NO se borran.
      // `professional` es referenciada por appointment, clinical_record, payment y
      // professional_rating; un DELETE rompería el historial clínico.
      const deactivated = await client.query(
        `UPDATE professional
            SET active = false
          WHERE owner_user_id = $1 AND user_id IS NULL
            AND NOT (id = ANY($2::int[]))
            AND active = true
          RETURNING id`,
        [userId, extraIds]
      );

      // ── Onboarding completado (server-side) ────────────────────────────────
      // Antes esto vivía sólo en localStorage, así que limpiar el navegador o
      // entrar desde otro dispositivo re-disparaba el onboarding.
      // clinic_logo_key usa COALESCE igual que photo_key: reenviar el formulario
      // sin adjuntar un logo nuevo NO debe borrar el que ya estaba guardado.
      await client.query(
        `INSERT INTO user_config (user_id, zk_enabled, onboarding_completed_at, clinic_logo_key, updated_at)
         VALUES ($1, false, NOW(), $2, NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET onboarding_completed_at = COALESCE(user_config.onboarding_completed_at, NOW()),
               clinic_logo_key         = COALESCE(EXCLUDED.clinic_logo_key, user_config.clinic_logo_key),
               updated_at = NOW()`,
        [userId, clinicLogoKey]
      );

      await client.query('COMMIT');

      log.info('Onboarding saved', {
        sub: userId, professionalId, extras: extraIds.length,
        deactivated: deactivated.rowCount, price,
        maxExtra, hasLogo: clinicLogoKey != null
      });

      return response(200, {
        professionalId,
        maxExtraProfessionals: maxExtra,
        clinicLogoKey,
        // pg devuelve NUMERIC como string; se normaliza a number para el cliente.
        consultationPrice: primary.rows[0].consultation_price == null
          ? null : Number(primary.rows[0].consultation_price),
        extraProfessionalIds: extraIds,
        deactivatedExtras: deactivated.rowCount,
        onboardingCompleted: true
      });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* la conexión pudo caerse */ }
      log.error('Onboarding save error', { message: err.message, code: err.code, sub: userId });
      return response(500, { message: 'No se pudo guardar tu perfil profesional', error: err.message });
    }
  }

  return null;
}
