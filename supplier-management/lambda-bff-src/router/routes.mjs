import { Router }        from "./Router.mjs";
import { ENTITY_CONFIG } from "../config/entities.mjs";
import * as entity       from "../handlers/entityHandlers.mjs";
import * as encounter    from "../handlers/encounterHandlers.mjs";
import * as res          from "../utils/response.mjs";
const router = new Router();

const resolveConfig = (entityKey) => ENTITY_CONFIG[entityKey] ?? null;

const withEntity = (fn) => async (client, [entityKey, ...rest], body) => {
  const config = resolveConfig(entityKey);
  if (!config) return res.notFound(`Entidad '${entityKey}' no existe`);
  return fn(client, config, ...rest, body);
};

// POST /api/send-email ────────────────────────────────────────────────────────
router.add("POST", new RegExp("^/api/send-email$"),
  async (_client, _params, body) => {
    const { to, from, subject, html, text } = body ?? {};
    if (!to || !subject || (!html && !text)) {
      return res.badRequest("Faltan campos: to, subject, html/text");
    }
    try {
      const { SESClient, SendEmailCommand } = await import("@aws-sdk/client-ses");
      const ses      = new SESClient({ region: "sa-east-1" });
      const fromAddr = from || process.env.SES_FROM || "noreply@dairi.cl";
      await ses.send(new SendEmailCommand({
        Source: fromAddr,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: html
            ? { Html: { Data: html, Charset: "UTF-8" } }
            : { Text: { Data: text, Charset: "UTF-8" } }
        }
      }));
      return res.ok({ ok: true, message: "Correo enviado correctamente" });
    } catch (err) {
      return res.serverError("Error al enviar correo", err.message);
    }
  });

// ── PUBLIC BOOKING (sin tokens — usa UUID del profesional directamente) ────────

// GET /api/book — lista de profesionales activos
router.add("GET", new RegExp("^/api/book$"),
  async (client) => {
    const r = await client.query(
      `SELECT id, nombre, especialidad, duracion_consulta, dias_trabajo, videoconsulta
       FROM profesional WHERE activo = true ORDER BY nombre`
    );
    return res.ok(r.rows.map(p => ({
      id:            p.id,
      nombre:        p.nombre,
      especialidad:  p.especialidad,
      duration:      p.duracion_consulta || 45,
      workDays:      p.dias_trabajo      || [1, 2, 3, 4, 5],
      videoconsulta: p.videoconsulta     || false
    })));
  });

// GET /api/book/:id/slots?date=YYYY-MM-DD
router.add("GET", new RegExp("^/api/book/([^/]+)/slots$"),
  async (client, [id], _body, queryParams) => {
    const date = queryParams?.date;
    if (!date) return res.badRequest("Parámetro date requerido");

    const r = await client.query(
      `SELECT id, duracion_consulta FROM profesional WHERE id = $1 AND activo = true`,
      [id]
    );
    if (!r.rows.length) return res.notFound("Profesional no encontrado");
    const prof     = r.rows[0];
    const duration = prof.duracion_consulta || 45;

    const booked = await client.query(
      `SELECT date_time_raw FROM appointment
       WHERE professional_id = $1 AND DATE(date_time) = $2 AND status != 'cancelada'`,
      [prof.id, date]
    );
    const bookedTimes = new Set(booked.rows.map(r => r.date_time_raw));

    const slots = [];
    for (let m = 9 * 60; m + duration <= 18 * 60; m += duration) {
      const slot = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      if (!bookedTimes.has(slot)) slots.push(slot);
    }
    return res.ok(slots);
  });

// GET /api/book/:id — info del profesional
router.add("GET", new RegExp("^/api/book/([^/]+)$"),
  async (client, [id]) => {
    const r = await client.query(
      `SELECT id, nombre, especialidad, duracion_consulta, dias_trabajo, videoconsulta
       FROM profesional WHERE id = $1 AND activo = true`,
      [id]
    );
    if (!r.rows.length) return res.notFound("Profesional no encontrado");
    const p = r.rows[0];
    return res.ok({
      professionalId: p.id,
      doctorName:    p.nombre,
      specialty:     p.especialidad,
      clinicName:    "Dairi Clínica",
      duration:      p.duracion_consulta || 45,
      workDays:      p.dias_trabajo      || [1, 2, 3, 4, 5],
      videoconsulta: p.videoconsulta     || false
    });
  });

// POST /api/book/migrate — agrega columna rut a paciente si no existe
router.add("POST", new RegExp("^/api/book/migrate$"),
  async (client) => {
    await client.query(`ALTER TABLE paciente ADD COLUMN IF NOT EXISTS rut TEXT`);
    return res.ok({ ok: true, message: "rut column ensured on paciente" });
  });

// POST /api/book/:id — crear cita + upsert paciente
router.add("POST", new RegExp("^/api/book/([^/]+)$"),
  async (client, [id], body) => {
    const r = await client.query(
      `SELECT id, nombre, especialidad, duracion_consulta FROM profesional WHERE id = $1 AND activo = true`,
      [id]
    );
    if (!r.rows.length) return res.notFound("Profesional no encontrado");
    const prof = r.rows[0];

    const { date, time, patientName, patientEmail, patientPhone, patientRut, reason, modality, meetLink } = body ?? {};
    if (!date || !time || !patientName || !patientEmail) {
      return res.badRequest("Faltan campos: date, time, patientName, patientEmail");
    }

    const confirmCode = "CIT-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const dateTime    = new Date(`${date}T${time}:00`);

    const ins = await client.query(`
      INSERT INTO appointment (
        id, professional_id, status, service, date_time, date_time_raw,
        duration_minutes, reason, patient_name, patient_email, patient_phone,
        confirm_code, modality, meet_link, created_at, updated_at
      ) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
      RETURNING id
    `, [
      prof.id, "AGENDADA", prof.especialidad, dateTime, time,
      prof.duracion_consulta || 45, reason || "",
      patientName, patientEmail, patientPhone || "",
      confirmCode, modality || "presencial", meetLink || null
    ]);

    // Upsert paciente: si no existe por email, lo crea
    try {
      const existing = await client.query(
        `SELECT id FROM paciente WHERE email = $1 LIMIT 1`, [patientEmail]
      );
      if (!existing.rows.length) {
        await client.query(
          `INSERT INTO paciente (nombre, email, telefono, rut) VALUES ($1,$2,$3,$4)`,
          [patientName, patientEmail, patientPhone || null, patientRut || null]
        );
      }
    } catch (_) { /* upsert best-effort */ }

    return res.ok({
      appointmentId: ins.rows[0].id,
      confirmCode,
      doctorName:   prof.nombre,
      clinicName:   "Dairi Clínica",
      specialty:    prof.especialidad,
      date, time, patientName,
      modality:     modality || "presencial",
      meetLink:     meetLink || null
    });
  });

// PUT /api/book/appointment/:id/meet-link — guardar Meet link
router.add("PUT", new RegExp("^/api/book/appointment/([^/]+)/meet-link$"),
  async (client, [id], body) => {
    const { meetLink } = body ?? {};
    if (!meetLink) return res.badRequest("meetLink requerido");
    await client.query(
      `UPDATE appointment SET meet_link = $1, updated_at = NOW() WHERE id = $2`,
      [meetLink, id]
    );
    return res.ok({ ok: true });
  });

// ── CHAT ──────────────────────────────────────────────────────────────────────

router.add("GET", new RegExp("^/api/chat/users$"),
  async (client) => {
    const r = await client.query(
      `SELECT id, name, email, role, avatar FROM app_user ORDER BY name`
    );
    return res.ok(r.rows.map(u => ({
      id: u.id, name: u.name, email: u.email, role: u.role,
      avatar: u.avatar, online: false, color: "#6366f1"
    })));
  });

router.add("GET", new RegExp("^/api/chat/messages$"),
  async (client, _params, _body, queryParams) => {
    const conversationId = queryParams?.conversationId;
    if (!conversationId) return res.badRequest("conversationId requerido");
    const r = await client.query(
      `SELECT id, conversation_id, sender_id, sender_name, sender_avatar, content, created_at
       FROM chat_message WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId]
    );
    return res.ok(r.rows.map(m => ({
      id: m.id, conversationId: m.conversation_id, senderId: m.sender_id,
      senderName: m.sender_name, senderAvatar: m.sender_avatar,
      content: m.content, timestamp: m.created_at
    })));
  });

router.add("POST", new RegExp("^/api/chat/messages$"),
  async (client, _params, body) => {
    const { conversationId, senderId, senderName, senderAvatar, content } = body ?? {};
    if (!conversationId || !senderId || !content)
      return res.badRequest("conversationId, senderId y content son requeridos");
    const r = await client.query(
      `INSERT INTO chat_message (conversation_id, sender_id, sender_name, sender_avatar, content)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, conversation_id, sender_id, sender_name, sender_avatar, content, created_at`,
      [conversationId, senderId, senderName ?? "", senderAvatar ?? "", content]
    );
    const m = r.rows[0];
    return res.ok({
      id: m.id, conversationId: m.conversation_id, senderId: m.sender_id,
      senderName: m.sender_name, senderAvatar: m.sender_avatar,
      content: m.content, timestamp: m.created_at
    });
  });

// ── ADMIN SETUP (one-shot DB migration + seed) ────────────────────────────────

router.add("POST", new RegExp("^/api/admin/setup$"),
  async (client) => {
    const log = [];
    const run = async (label, sql, params = []) => {
      try { await client.query(sql, params); log.push("OK: " + label); }
      catch (e) { log.push("ERR " + label + ": " + e.message); }
    };

    // ── DDL ────────────────────────────────────────────────────────────────────
    await run("app_schema table", `
      CREATE TABLE IF NOT EXISTS app_schema (
        id        SERIAL PRIMARY KEY,
        schemakey TEXT UNIQUE NOT NULL,
        singular  TEXT,
        plural    TEXT,
        moduletype TEXT,
        icon      TEXT
      )`);

    await run("user_schema table", `
      CREATE TABLE IF NOT EXISTS user_schema (
        user_id   INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        schema_id INTEGER NOT NULL REFERENCES app_schema(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, schema_id)
      )`);

    await run("chat_message table", `
      CREATE TABLE IF NOT EXISTS chat_message (
        id               SERIAL PRIMARY KEY,
        conversation_id  TEXT NOT NULL,
        sender_id        INTEGER,
        sender_name      TEXT,
        sender_avatar    TEXT,
        content          TEXT NOT NULL,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )`);

    await run("psych_session table", `
      CREATE TABLE IF NOT EXISTS psych_session (
        id            SERIAL PRIMARY KEY,
        title         TEXT,
        patient_name  TEXT,
        start_date    TIMESTAMPTZ,
        end_date      TIMESTAMPTZ,
        session_type  TEXT,
        status        TEXT DEFAULT 'scheduled',
        patient_email TEXT,
        room          TEXT,
        notes         TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )`);

    await run("psych_record table", `
      CREATE TABLE IF NOT EXISTS psych_record (
        id                    SERIAL PRIMARY KEY,
        full_name             TEXT,
        patient_id            TEXT UNIQUE,
        rut                   TEXT,
        birth_date            DATE,
        age                   INTEGER,
        gender                TEXT,
        occupation            TEXT,
        education             TEXT,
        marital_status        TEXT,
        insurance             TEXT,
        phone                 TEXT,
        email                 TEXT,
        address               TEXT,
        emergency_contact     TEXT,
        doctor                TEXT,
        last_visit            DATE,
        status                TEXT DEFAULT 'active',
        allergies             JSONB DEFAULT '[]',
        contraindications     TEXT,
        alert_notes           TEXT,
        bp                    TEXT,
        heart_rate            TEXT,
        temperature           TEXT,
        o2_saturation         TEXT,
        weight                TEXT,
        height                TEXT,
        bmi                   TEXT,
        respiratory_rate      TEXT,
        personal_history      TEXT,
        family_history        TEXT,
        habits                TEXT,
        surgical_history      TEXT,
        planned_interventions TEXT,
        current_medications   TEXT,
        chronic_conditions    JSONB DEFAULT '[]',
        diagnosis_code        TEXT,
        diagnosis_label       TEXT,
        differential_dx       TEXT,
        soap_subjective       TEXT,
        soap_objective        TEXT,
        soap_assessment       TEXT,
        soap_plan             TEXT,
        encounters            JSONB DEFAULT '[]',
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW()
      )`);

    await run("dental_session table", `
      CREATE TABLE IF NOT EXISTS dental_session (
        id             SERIAL PRIMARY KEY,
        title          TEXT,
        patient_name   TEXT,
        start_date     TIMESTAMPTZ,
        end_date       TIMESTAMPTZ,
        treatment_type TEXT,
        status         TEXT DEFAULT 'scheduled',
        patient_email  TEXT,
        chair          TEXT,
        notes          TEXT,
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      )`);

    await run("dental_record table", `
      CREATE TABLE IF NOT EXISTS dental_record (
        id                    SERIAL PRIMARY KEY,
        full_name             TEXT,
        patient_id            TEXT UNIQUE,
        rut                   TEXT,
        birth_date            DATE,
        age                   INTEGER,
        gender                TEXT,
        insurance             TEXT,
        phone                 TEXT,
        email                 TEXT,
        doctor                TEXT,
        last_visit            DATE,
        status                TEXT DEFAULT 'active',
        allergies             JSONB DEFAULT '[]',
        contraindications     TEXT,
        alert_notes           TEXT,
        bp                    TEXT,
        heart_rate            TEXT,
        temperature           TEXT,
        o2_saturation         TEXT,
        weight                TEXT,
        height                TEXT,
        bmi                   TEXT,
        respiratory_rate      TEXT,
        personal_history      TEXT,
        family_history        TEXT,
        habits                TEXT,
        surgical_history      TEXT,
        planned_interventions TEXT,
        current_medications   TEXT,
        chronic_conditions    JSONB DEFAULT '[]',
        diagnosis_code        TEXT,
        diagnosis_label       TEXT,
        differential_dx       TEXT,
        soap_subjective       TEXT,
        soap_objective        TEXT,
        soap_assessment       TEXT,
        soap_plan             TEXT,
        encounters            JSONB DEFAULT '[]',
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW()
      )`);

    await run("dental_treatment table", `
      CREATE TABLE IF NOT EXISTS dental_treatment (
        id                    SERIAL PRIMARY KEY,
        full_name             TEXT,
        patient_id            TEXT UNIQUE,
        rut                   TEXT,
        birth_date            DATE,
        age                   INTEGER,
        gender                TEXT,
        insurance             TEXT,
        phone                 TEXT,
        email                 TEXT,
        doctor                TEXT,
        last_visit            DATE,
        status                TEXT DEFAULT 'draft',
        allergies             JSONB DEFAULT '[]',
        contraindications     TEXT,
        alert_notes           TEXT,
        bp                    TEXT,
        heart_rate            TEXT,
        temperature           TEXT,
        o2_saturation         TEXT,
        weight                TEXT,
        height                TEXT,
        bmi                   TEXT,
        respiratory_rate      TEXT,
        personal_history      TEXT,
        family_history        TEXT,
        habits                TEXT,
        surgical_history      TEXT,
        planned_interventions TEXT,
        current_medications   TEXT,
        chronic_conditions    JSONB DEFAULT '[]',
        diagnosis_code        TEXT,
        diagnosis_label       TEXT,
        differential_dx       TEXT,
        soap_subjective       TEXT,
        soap_objective        TEXT,
        soap_assessment       TEXT,
        soap_plan             TEXT,
        encounters            JSONB DEFAULT '[]',
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW()
      )`);

    await run("paciente rut column", `
      ALTER TABLE paciente ADD COLUMN IF NOT EXISTS rut TEXT`);

    // ── SEED: app_user ────────────────────────────────────────────────────────
    const users = [
      [1, 'Admin General',      'admin@empresa.com',       '$2a$10$HUegnU83Aea19LmhIwGho.v9zzONTgC9qRmo.QOh1o8QqPECnrprq', 'admin',   'AG'],
      [2, 'Jefe de Compras',    'compras@empresa.com',     '$2a$10$IWIJkyHAiMVlxvQIvbxZb.hsHbdiPLcQBzhG6hr4/F56IFThmiDKW', 'manager', 'JC'],
      [3, 'Dra. Morales',       'medico@hospital.com',     '$2a$10$BYnEFLyDACpbpSShs6yqeuWeLAYHWjD1dk8e3Ha2ZqZEYnCTzxztK', 'manager', 'DM'],
      [4, 'Auditor',            'auditor@empresa.com',     '$2a$10$dDvTKwkyTE4SMnIKf/XHqO3Oyi/6koujp3bgysTKOQ0XLrPqjCwXy', 'viewer',  'AU'],
      [5, 'Ps. Carolina Vega',  'psicologia@clinica.com',  '$2a$10$P7ataQXqbYKorc9jOL8KKe57jtKkzRi0fZhab1JvqZcMKVs9jXzVC', 'manager', 'CV'],
      [6, 'Dr. Ramírez',        'odontologia@clinica.com', '$2a$10$j5jBICSPQpiNjb3NERE8G.LYnFNWBX4c5hqh2NA4cWCvA6R8/B2Q.', 'manager', 'DR']
    ];
    for (const [id, name, email, hash, role, avatar] of users) {
      await run(`user ${email}`,
        `INSERT INTO app_user (id, name, email, password, role, avatar)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET name=$2, email=$3, password=$4, role=$5, avatar=$6`,
        [id, name, email, hash, role, avatar]);
    }

    // ── SEED: app_schema ──────────────────────────────────────────────────────
    const schemas = [
      ['suppliers',        'Proveedor',       'Proveedores',       'crud',            'users'       ],
      ['products',         'Producto',        'Productos',         'crud',            'package'     ],
      ['paciente',         'Paciente',        'Pacientes',         'list',            'heart'       ],
      ['appointments',     'Cita',            'Citas',             'calendar',        'calendar'    ],
      ['clinical-records', 'Ficha Clínica',   'Fichas Clínicas',   'clinical-record', 'clipboard'   ],
      ['payments',         'Cobro',           'Cobros',            'list',            'dollar-sign' ],
      ['expenses',         'Gasto',           'Gastos',            'crud',            'trending-down'],
      ['psych-sessions',   'Sesión',          'Sesiones',          'calendar',        'calendar'    ],
      ['psych-records',    'Ficha Psicológica','Fichas Psicológicas','clinical-record','brain'       ],
      ['dental-sessions',   'Cita Dental',          'Citas Dentales',       'calendar',        'calendar'  ],
      ['dental-records',    'Ficha Dental',         'Fichas Dentales',      'clinical-record', 'tooth'     ],
      ['dental-treatments', 'Plan de Tratamiento',  'Planes de Tratamiento','clinical-record', 'clipboard' ]
    ];
    for (const [key, singular, plural, moduleType, icon] of schemas) {
      await run(`schema ${key}`,
        `INSERT INTO app_schema (schemakey, singular, plural, moduletype, icon)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (schemakey) DO UPDATE SET singular=$2, plural=$3, moduletype=$4, icon=$5`,
        [key, singular, plural, moduleType, icon]);
    }

    // ── SEED: user_schema associations ────────────────────────────────────────
    // Fetch schema IDs first
    const sRows = await client.query(`SELECT id, schemakey FROM app_schema`);
    const schemaId = Object.fromEntries(sRows.rows.map(r => [r.schemakey, r.id]));

    const associations = [
      // admin → everything
      [1, ['suppliers','products','paciente','appointments','clinical-records','payments','expenses']],
      // compras
      [2, ['suppliers','products','payments','expenses']],
      // medico
      [3, ['paciente','appointments','clinical-records','payments']],
      // auditor
      [4, ['suppliers','payments','expenses']],
      // psicología
      [5, ['psych-sessions','psych-records']],
      // odontología
      [6, ['dental-sessions','dental-records','dental-treatments']]
    ];
    for (const [userId, keys] of associations) {
      for (const key of keys) {
        const sid = schemaId[key];
        if (!sid) continue;
        await run(`user_schema ${userId}→${key}`,
          `INSERT INTO user_schema (user_id, schema_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [userId, sid]);
      }
    }

    // ── SEED: sample psych data ───────────────────────────────────────────────
    await run("psych_session sample 1",
      `INSERT INTO psych_session (title, patient_name, start_date, end_date, session_type, status, patient_email, room, notes)
       VALUES ('Ansiedad generalizada','Ana Pérez','2026-04-28 10:00:00','2026-04-28 11:00:00','individual','scheduled','ana.perez@mail.com','Box 2','Primera sesión de evaluación')
       ON CONFLICT DO NOTHING`);
    await run("psych_session sample 2",
      `INSERT INTO psych_session (title, patient_name, start_date, end_date, session_type, status, patient_email, room, notes)
       VALUES ('Control mensual','Carlos López','2026-04-29 14:00:00','2026-04-29 15:00:00','individual','scheduled','clopez@mail.com','Box 1','Seguimiento tratamiento')
       ON CONFLICT DO NOTHING`);
    await run("psych_record sample 1",
      `INSERT INTO psych_record (full_name, patient_id, rut, birth_date, age, gender, insurance, phone, doctor, status)
       VALUES ('Ana Pérez','PSI-00001','12.345.678-9','1990-05-15',35,'female','isapre','+56912345678','Ps. Carolina Vega','active')
       ON CONFLICT (patient_id) DO NOTHING`);

    // ── SEED: sample dental data ──────────────────────────────────────────────
    await run("dental_session sample 1",
      `INSERT INTO dental_session (title, patient_name, start_date, end_date, treatment_type, status, chair)
       VALUES ('Limpieza dental','Pedro Soto','2026-04-28 09:00:00','2026-04-28 09:30:00','cleaning','scheduled','Sillón 1')
       ON CONFLICT DO NOTHING`);
    await run("dental_session sample 2",
      `INSERT INTO dental_session (title, patient_name, start_date, end_date, treatment_type, status, chair)
       VALUES ('Control ortodoncia','María González','2026-04-29 11:00:00','2026-04-29 11:30:00','orthodontics','scheduled','Sillón 2')
       ON CONFLICT DO NOTHING`);
    await run("dental_record sample 1",
      `INSERT INTO dental_record (full_name, patient_id, rut, birth_date, age, gender, insurance, phone, doctor, status)
       VALUES ('Pedro Soto','DEN-00001','9.876.543-2','1985-03-20',40,'male','fonasa_b','+56987654321','Dr. Ramírez','active')
       ON CONFLICT (patient_id) DO NOTHING`);

    // ── SEED: sample chat ─────────────────────────────────────────────────────
    await run("chat_message welcome",
      `INSERT INTO chat_message (conversation_id, sender_id, sender_name, sender_avatar, content)
       VALUES ('ch-general',1,'Admin General','AG','¡Bienvenidos al chat interno de Dairi Clínica!')
       `);
    await run("chat_message 2",
      `INSERT INTO chat_message (conversation_id, sender_id, sender_name, sender_avatar, content)
       VALUES ('ch-general',3,'Dra. Morales','DM','Buenos días equipo. Hoy hay 5 citas agendadas.')
       `);

    return res.ok({ ok: true, log });
  });

// ── ENTITY CRUD ───────────────────────────────────────────────────────────────

router.add("POST", new RegExp("^/api/entities/([^/]+)/([^/]+)/encounters$"),
  async (client, [entityKey, entityId], body) => encounter.createEncounter(client, entityKey, entityId, body));

router.add("GET", new RegExp("^/api/entities/([^/]+)/([^/]+)/encounters$"),
  async (client, [entityKey, entityId]) => encounter.listEncounters(client, entityKey, entityId));

router.add("GET",    new RegExp("^/api/entities/([^/]+)/([^/]+)$"), withEntity((client, config, id)        => entity.getEntity(client, config, id)));
router.add("PUT",    new RegExp("^/api/entities/([^/]+)/([^/]+)$"), withEntity((client, config, id, body)  => entity.updateEntity(client, config, id, body)));
router.add("DELETE", new RegExp("^/api/entities/([^/]+)/([^/]+)$"), withEntity((client, config, id)        => entity.deleteEntity(client, config, id)));

router.add("GET",  new RegExp("^/api/entities/([^/]+)$"), withEntity((client, config) => entity.listEntities(client, config)));
router.add("POST", new RegExp("^/api/entities/([^/]+)$"), withEntity((client, config, body) => entity.createEntity(client, config, body)));

const S = ENTITY_CONFIG.suppliers;
router.add("GET",    new RegExp("^/api/suppliers$"),          async (client)             => entity.listEntities(client, S));
router.add("POST",   new RegExp("^/api/suppliers$"),          async (client, _, body)    => entity.createEntity(client, S, body));
router.add("PUT",    new RegExp("^/api/suppliers/([^/]+)$"),  async (client, [id], body) => entity.updateEntity(client, S, id, body));
router.add("DELETE", new RegExp("^/api/suppliers/([^/]+)$"),  async (client, [id])       => entity.deleteEntity(client, S, id));

export default router;
