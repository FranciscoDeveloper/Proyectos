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

  categories: {
    table: "category",
    toDb(d) {
      const cols = {};
      if (d.name        !== undefined) cols.name        = d.name;
      if (d.type        !== undefined) cols.type        = d.type;
      if (d.description !== undefined) cols.description = d.description;
      return cols;
    },
    fromDb(r) {
      return {
        id:          r.id,
        name:        r.name,
        type:        r.type        ?? null,
        description: r.description ?? null,
        createdAt:   r.created_at,
        updatedAt:   r.updated_at
      };
    }
  },

  suppliers: {
    table: "supplier",

    joinSelect: `
      SELECT
        c.id,
        c.name,
        c.code,
        c.email,
        c.phone,
        c.status,
        c.country,
        c.city,
        c.address,
        c.website,
        c.tax_id         AS "taxId",
        c.contact_person AS "contactPerson",
        c.rating,
        c.total_orders   AS "totalOrders",
        c.total_spent    AS "totalSpent",
        c.notes,
        c.tags,
        c.category_id    AS "categoryId",
        cat.name         AS "categoryName",
        cat.type         AS "categoryType",
        c.created_at     AS "createdAt",
        c.updated_at     AS "updatedAt"
      FROM supplier c
      LEFT JOIN category cat ON cat.id = c.category_id
    `,

    toDb(d) {
      const cols = {};
      if (d.name          !== undefined) cols.name           = d.name;
      if (d.code          !== undefined) cols.code           = d.code;
      if (d.email         !== undefined) cols.email          = d.email;
      if (d.phone         !== undefined) cols.phone          = d.phone;
      if (d.categoryId    !== undefined) cols.category_id    = d.categoryId;
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
        categoryId:    r.categoryId    ?? r.category_id  ?? null,
        categoryName:  r.categoryName  ?? null,
        categoryType:  r.categoryType  ?? null,
        status:        r.status,
        country:       r.country,
        city:          r.city,
        address:       r.address,
        website:       r.website,
        taxId:         r.taxId        ?? r.tax_id        ?? null,
        contactPerson: r.contactPerson ?? r.contact_person ?? null,
        rating:        r.rating        != null ? parseFloat(r.rating)     : null,
        totalOrders:   r.totalOrders   != null ? parseInt(r.totalOrders)  : (r.total_orders != null ? parseInt(r.total_orders) : null),
        totalSpent:    r.totalSpent    != null ? parseFloat(r.totalSpent) : (r.total_spent  != null ? parseFloat(r.total_spent)  : null),
        notes:         r.notes,
        tags:          r.tags ?? [],
        createdAt:     r.createdAt    ?? r.created_at,
        updatedAt:     r.updatedAt    ?? r.updated_at
      };
    }
  },

  products: {
    table: "product",

    joinSelect: `
      SELECT
        c.id,
        c.name,
        c.sku,
        c.status,
        c.price,
        c.stock,
        c.weight,
        c.description,
        c.tags,
        c.category_id   AS "categoryId",
        cat.name        AS "categoryName",
        c.supplier_id   AS "supplierId",
        sup.name        AS "supplierName",
        c.created_at    AS "createdAt",
        c.updated_at    AS "updatedAt"
      FROM product c
      LEFT JOIN category cat ON cat.id = c.category_id
      LEFT JOIN supplier sup ON sup.id = c.supplier_id
    `,

    toDb(d) {
      const cols = {};
      if (d.name        !== undefined) cols.name        = d.name;
      if (d.sku         !== undefined) cols.sku         = d.sku;
      if (d.categoryId  !== undefined) cols.category_id = d.categoryId;
      if (d.status      !== undefined) cols.status      = d.status;
      if (d.price       !== undefined) cols.price       = d.price;
      if (d.stock       !== undefined) cols.stock       = d.stock;
      if (d.supplierId  !== undefined) cols.supplier_id = d.supplierId;
      if (d.weight      !== undefined) cols.weight      = d.weight;
      if (d.description !== undefined) cols.description = d.description;
      if (d.tags        !== undefined) cols.tags        = JSON.stringify(d.tags);
      return cols;
    },

    fromDb(r) {
      return {
        id:           r.id,
        name:         r.name,
        sku:          r.sku,
        categoryId:   r.categoryId   ?? r.category_id  ?? null,
        categoryName: r.categoryName ?? null,
        supplierId:   r.supplierId   ?? r.supplier_id  ?? null,
        supplierName: r.supplierName ?? null,
        status:       r.status,
        price:        r.price  != null ? parseFloat(r.price)  : null,
        stock:        r.stock  != null ? parseInt(r.stock)    : null,
        weight:       r.weight != null ? parseFloat(r.weight) : null,
        description:  r.description,
        tags:         r.tags ?? [],
        createdAt:    r.createdAt ?? r.created_at,
        updatedAt:    r.updatedAt ?? r.updated_at
      };
    }
  },

  expenses: {
    table: "expense",

    joinSelect: `
      SELECT
        c.id,
        c.description,
        c.date,
        c.amount,
        c.payment_method  AS "paymentMethod",
        c.status,
        c.receipt_number  AS "receiptNumber",
        c.notes,
        c.category_id     AS "categoryId",
        cat.name          AS "categoryName",
        c.supplier_id     AS "supplierId",
        sup.name          AS "supplierName",
        c.created_at      AS "createdAt",
        c.updated_at      AS "updatedAt"
      FROM expense c
      LEFT JOIN category cat ON cat.id  = c.category_id
      LEFT JOIN supplier sup ON sup.id  = c.supplier_id
    `,

    toDb(d) {
      const cols = {};
      if (d.description   !== undefined) cols.description    = d.description;
      if (d.supplierId    !== undefined) cols.supplier_id    = d.supplierId;
      if (d.date          !== undefined) cols.date           = d.date;
      if (d.categoryId    !== undefined) cols.category_id    = d.categoryId;
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
        supplierId:    r.supplierId   ?? r.supplier_id  ?? null,
        supplierName:  r.supplierName ?? null,
        date:          r.date,
        categoryId:    r.categoryId   ?? r.category_id  ?? null,
        categoryName:  r.categoryName ?? null,
        amount:        r.amount       != null ? parseFloat(r.amount) : null,
        paymentMethod: r.paymentMethod ?? r.payment_method ?? null,
        status:        r.status,
        receiptNumber: r.receiptNumber ?? r.receipt_number ?? null,
        notes:         r.notes,
        createdAt:     r.createdAt    ?? r.created_at,
        updatedAt:     r.updatedAt    ?? r.updated_at
      };
    }
  },

  payments: {
    table: "payment",

    joinSelect: `
      SELECT
        c.id,
        c.invoice_number  AS "invoiceNumber",
        c.date,
        c.concept,
        c.amount,
        c.payment_method  AS "paymentMethod",
        c.status,
        c.notes,
        c.commission_rate   AS "commissionRate",
        c.commission_amount AS "commissionAmount",
        c.commission_status AS "commissionStatus",
        c.patient_id        AS "patientId",
        pat.name            AS "patientName",
        c.professional_id   AS "professionalId",
        pro.name            AS "professionalName",
        c.created_at        AS "createdAt",
        c.updated_at        AS "updatedAt"
      FROM payment c
      LEFT JOIN patient      pat ON pat.id = c.patient_id
      LEFT JOIN professional pro ON pro.id = c.professional_id
    `,

    toDb(d) {
      const cols = {};
      if (d.patientId      !== undefined) cols.patient_id      = d.patientId;
      if (d.professionalId !== undefined) cols.professional_id = d.professionalId;
      if (d.invoiceNumber  !== undefined) cols.invoice_number  = d.invoiceNumber;
      if (d.date           !== undefined) cols.date            = d.date;
      if (d.concept        !== undefined) cols.concept         = d.concept;
      if (d.amount         !== undefined) cols.amount          = d.amount;
      if (d.paymentMethod  !== undefined) cols.payment_method  = d.paymentMethod;
      if (d.status         !== undefined) cols.status          = d.status;
      if (d.notes          !== undefined) cols.notes           = d.notes;
      if (d.commissionRate   !== undefined) cols.commission_rate   = d.commissionRate;
      if (d.commissionAmount !== undefined) cols.commission_amount = d.commissionAmount;
      if (d.commissionStatus !== undefined) cols.commission_status = d.commissionStatus;
      return cols;
    },

    fromDb(r) {
      return {
        id:               r.id,
        patientId:        r.patientId        ?? r.patient_id        ?? null,
        patientName:      r.patientName      ?? null,
        professionalId:   r.professionalId   ?? r.professional_id   ?? null,
        professionalName: r.professionalName ?? null,
        invoiceNumber:    r.invoiceNumber    ?? r.invoice_number    ?? null,
        date:             r.date,
        concept:          r.concept,
        amount:           r.amount           != null ? parseFloat(r.amount)           : null,
        paymentMethod:    r.paymentMethod    ?? r.payment_method    ?? null,
        status:           r.status,
        notes:            r.notes,
        commissionRate:   r.commissionRate   != null ? parseFloat(r.commissionRate)   : (r.commission_rate   != null ? parseFloat(r.commission_rate)   : null),
        commissionAmount: r.commissionAmount != null ? parseFloat(r.commissionAmount) : (r.commission_amount != null ? parseFloat(r.commission_amount) : null),
        commissionStatus: r.commissionStatus ?? r.commission_status ?? null,
        createdAt:        r.createdAt        ?? r.created_at,
        updatedAt:        r.updatedAt        ?? r.updated_at
      };
    }
  },

  // ── patients ─────────────────────────────────────────────────────────────────
  patients: {
    table: "patient",
    toDb(d) {
      const cols = {};
      if (d.nombre    !== undefined) cols.name  = d.nombre;
      if (d.email     !== undefined) cols.email = d.email;
      if (d.telefono  !== undefined) cols.phone = d.telefono;
      if (d.rut       !== undefined) cols.rut   = d.rut;
      return cols;
    },
    fromDb(r) {
      return {
        id:         r.id,
        nombre:     r.name,
        email:      r.email,
        telefono:   r.phone,
        rut:        r.rut       ?? null,
        diagnostic: null,
        allergies:  [],
        createdAt:  r.created_at,
        updatedAt:  r.updated_at
      };
    }
  },

  // ── appointments ─────────────────────────────────────────────────────────────
  appointments: {
    table: "appointment",

    joinSelect: `
      SELECT
        c.id,
        c.patient_id       AS "patientId",
        c.professional_id  AS "professionalId",
        c.status,
        c.service,
        c.modality,
        c.datetime         AS "dateTime",
        c.duration_minutes AS "durationMinutes",
        c.reason,
        c.notes,
        c.meet_link        AS "meetLink",
        NULL::text         AS "googleEventId",
        c.confirm_code     AS "confirmCode",
        c.created_at       AS "createdAt",
        c.updated_at       AS "updatedAt",
        p.name             AS "patientName",
        pr.name            AS "professionalName"
      FROM appointment c
      LEFT JOIN patient      p  ON p.id = c.patient_id
      LEFT JOIN professional pr ON pr.id = c.professional_id
    `,

    toDb(d) {
      const cols = {};
      if (d.status           !== undefined) cols.status           = d.status;
      if (d.service          !== undefined) cols.service          = d.service;
      if (d.modality         !== undefined) cols.modality         = d.modality;
      if (d.dateTime         !== undefined) cols.datetime         = d.dateTime;
      if (d.durationMinutes  !== undefined) cols.duration_minutes = d.durationMinutes;
      if (d.reason           !== undefined) cols.reason           = d.reason;
      if (d.notes            !== undefined) cols.notes            = d.notes;
      if (d.meetLink         !== undefined) cols.meet_link        = d.meetLink;
      if (d.patientId        !== undefined) cols.patient_id       = d.patientId;
      if (d.professionalId   !== undefined) cols.professional_id  = d.professionalId;
      return cols;
    },

    fromDb(r) {
      return {
        id:               r.id,
        patientId:        r.patientId       ?? r.patient_id       ?? null,
        professionalId:   r.professionalId  ?? r.professional_id  ?? null,
        status:           r.status,
        service:          r.service,
        modality:         r.modality        ?? null,
        dateTime:         r.dateTime        ?? r.datetime         ?? null,
        durationMinutes:  r.durationMinutes != null ? parseInt(r.durationMinutes ?? r.duration_minutes) : null,
        reason:           r.reason          ?? null,
        notes:            r.notes           ?? null,
        meetLink:         r.meetLink        ?? r.meet_link        ?? null,
        googleEventId:    r.googleEventId   ?? r.google_event_id  ?? null,
        confirmCode:      r.confirmCode     ?? r.confirm_code     ?? null,
        patientName:      r.patientName     ?? null,
        professionalName: r.professionalName ?? null,
        createdAt:        r.createdAt       ?? r.created_at,
        updatedAt:        r.updatedAt       ?? r.updated_at
      };
    }
  },

  // ── lookup: supplier_status ──────────────────────────────────────────────────
  'supplier-statuses': {
    table:       'supplier_status',
    pkCol:       'value',
    orderBy:     'sort_order ASC',
    noTimestamp: true,
    toDb(d) {
      const cols = {};
      if (d.value     !== undefined) cols.value      = d.value;
      if (d.label     !== undefined) cols.label      = d.label;
      if (d.color     !== undefined) cols.color      = d.color;
      if (d.sortOrder !== undefined) cols.sort_order = d.sortOrder;
      return cols;
    },
    fromDb(r) {
      return { id: r.value, value: r.value, label: r.label, color: r.color ?? null, sortOrder: r.sort_order ?? 0 };
    }
  },

  // ── lookup: expense_status ───────────────────────────────────────────────────
  'expense-statuses': {
    table:       'expense_status',
    pkCol:       'value',
    orderBy:     'sort_order ASC',
    noTimestamp: true,
    toDb(d) {
      const cols = {};
      if (d.value     !== undefined) cols.value      = d.value;
      if (d.label     !== undefined) cols.label      = d.label;
      if (d.color     !== undefined) cols.color      = d.color;
      if (d.sortOrder !== undefined) cols.sort_order = d.sortOrder;
      return cols;
    },
    fromDb(r) {
      return { id: r.value, value: r.value, label: r.label, color: r.color ?? null, sortOrder: r.sort_order ?? 0 };
    }
  },

  // ── lookup: expense_payment_method ───────────────────────────────────────────
  'expense-payment-methods': {
    table:       'expense_payment_method',
    pkCol:       'value',
    orderBy:     'sort_order ASC',
    noTimestamp: true,
    toDb(d) {
      const cols = {};
      if (d.value     !== undefined) cols.value      = d.value;
      if (d.label     !== undefined) cols.label      = d.label;
      if (d.color     !== undefined) cols.color      = d.color;
      if (d.sortOrder !== undefined) cols.sort_order = d.sortOrder;
      return cols;
    },
    fromDb(r) {
      return { id: r.value, value: r.value, label: r.label, color: r.color ?? null, sortOrder: r.sort_order ?? 0 };
    }
  },

  // ── lookup: appointment_status ───────────────────────────────────────────────
  'appointment-statuses': {
    table:       'appointment_status',
    pkCol:       'value',
    orderBy:     'sort_order ASC',
    noTimestamp: true,
    toDb(d) {
      const cols = {};
      if (d.value     !== undefined) cols.value      = d.value;
      if (d.label     !== undefined) cols.label      = d.label;
      if (d.color     !== undefined) cols.color      = d.color;
      if (d.sortOrder !== undefined) cols.sort_order = d.sortOrder;
      return cols;
    },
    fromDb(r) {
      return { id: r.value, value: r.value, label: r.label, color: r.color ?? null, sortOrder: r.sort_order ?? 0 };
    }
  },

  // ── lookup: appointment_modality ─────────────────────────────────────────────
  'appointment-modalities': {
    table:       'appointment_modality',
    pkCol:       'value',
    orderBy:     'sort_order ASC',
    noTimestamp: true,
    toDb(d) {
      const cols = {};
      if (d.value     !== undefined) cols.value      = d.value;
      if (d.label     !== undefined) cols.label      = d.label;
      if (d.color     !== undefined) cols.color      = d.color;
      if (d.sortOrder !== undefined) cols.sort_order = d.sortOrder;
      return cols;
    },
    fromDb(r) {
      return { id: r.value, value: r.value, label: r.label, color: r.color ?? null, sortOrder: r.sort_order ?? 0 };
    }
  },

  // ── clinical-records ─────────────────────────────────────────────────────────
  'clinical-records': {
    table: "clinical_record",

    // JOIN with patient to populate demographic fields (fullName, rut, etc.)
    joinSelect: `
      SELECT
        c.id,
        c.patient_id              AS "patientId",
        p.name                    AS "fullName",
        p.rut,
        p.birth_date              AS "birthDate",
        p.gender,
        p.blood_type              AS "bloodType",
        p.phone,
        p.email,
        p.address,
        p.emergency_contact       AS "emergencyContact",
        c.insurance,
        c.allergies,
        c.contraindications,
        c.alert_notes             AS "alertNotes",
        c.personal_history        AS "personalHistory",
        c.family_history          AS "familyHistory",
        c.habits,
        c.surgical_history        AS "surgicalHistory",
        c.planned_interventions   AS "plannedInterventions",
        c.chronic_conditions      AS "chronicConditions",
        c.odontogram,
        c.periodontogram,
        c.bp,
        c.heart_rate              AS "heartRate",
        c.temperature,
        c.o2_saturation           AS "o2Saturation",
        c.weight,
        c.height,
        c.bmi,
        c.respiratory_rate        AS "respiratoryRate",
        c.current_medications     AS "currentMedications",
        c.diagnosis_code          AS "diagnosisCode",
        c.diagnosis_label         AS "diagnosisLabel",
        c.differential_dx         AS "differentialDx",
        c.soap_subjective         AS "soapSubjective",
        c.soap_objective          AS "soapObjective",
        c.soap_assessment         AS "soapAssessment",
        c.soap_plan               AS "soapPlan",
        c.doctor,
        c.last_visit              AS "lastVisit",
        c.status,
        c.created_at              AS "createdAt",
        c.updated_at              AS "updatedAt"
      FROM clinical_record c
      LEFT JOIN patient p ON p.id = c.patient_id
    `,

    toDb(d) {
      const cols = {};
      if (d.patientId            !== undefined) cols.patient_id             = d.patientId;
      if (d.insurance            !== undefined) cols.insurance              = d.insurance;
      if (d.allergies            !== undefined) cols.allergies              = JSON.stringify(d.allergies);
      if (d.contraindications    !== undefined) cols.contraindications      = d.contraindications;
      if (d.alertNotes           !== undefined) cols.alert_notes            = d.alertNotes;
      if (d.personalHistory      !== undefined) cols.personal_history       = d.personalHistory;
      if (d.familyHistory        !== undefined) cols.family_history         = d.familyHistory;
      if (d.habits               !== undefined) cols.habits                 = d.habits;
      if (d.surgicalHistory      !== undefined) cols.surgical_history       = d.surgicalHistory;
      if (d.plannedInterventions !== undefined) cols.planned_interventions  = d.plannedInterventions;
      if (d.chronicConditions    !== undefined) cols.chronic_conditions     = JSON.stringify(d.chronicConditions);
      if (d.odontogram           !== undefined) cols.odontogram             = JSON.stringify(d.odontogram);
      if (d.periodontogram       !== undefined) cols.periodontogram         = JSON.stringify(d.periodontogram);
      if (d.bp                   !== undefined) cols.bp                     = d.bp;
      if (d.heartRate            !== undefined) cols.heart_rate             = d.heartRate;
      if (d.temperature          !== undefined) cols.temperature            = d.temperature;
      if (d.o2Saturation         !== undefined) cols.o2_saturation          = d.o2Saturation;
      if (d.weight               !== undefined) cols.weight                 = d.weight;
      if (d.height               !== undefined) cols.height                 = d.height;
      if (d.bmi                  !== undefined) cols.bmi                    = d.bmi;
      if (d.respiratoryRate      !== undefined) cols.respiratory_rate       = d.respiratoryRate;
      if (d.currentMedications   !== undefined) cols.current_medications    = d.currentMedications;
      if (d.diagnosisCode        !== undefined) cols.diagnosis_code         = d.diagnosisCode;
      if (d.diagnosisLabel       !== undefined) cols.diagnosis_label        = d.diagnosisLabel;
      if (d.differentialDx       !== undefined) cols.differential_dx        = d.differentialDx;
      if (d.soapSubjective       !== undefined) cols.soap_subjective        = d.soapSubjective;
      if (d.soapObjective        !== undefined) cols.soap_objective         = d.soapObjective;
      if (d.soapAssessment       !== undefined) cols.soap_assessment        = d.soapAssessment;
      if (d.soapPlan             !== undefined) cols.soap_plan              = d.soapPlan;
      if (d.doctorName           !== undefined) cols.doctor                 = d.doctorName;
      if (d.lastVisit            !== undefined) cols.last_visit             = d.lastVisit;
      if (d.status               !== undefined) cols.status                 = d.status;
      return cols;
    },

    fromDb(r) {
      // Calculate age from birth_date when available
      let age = null;
      const bd = r.birthDate ?? r.birth_date;
      if (bd) {
        const diff = Date.now() - new Date(bd).getTime();
        age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
      }
      return {
        id:                   r.id,
        patientId:            r.patientId          ?? r.patient_id,
        fullName:             r.fullName            ?? null,
        rut:                  r.rut                ?? null,
        birthDate:            r.birthDate          ?? r.birth_date ?? null,
        age,
        gender:               r.gender             ?? null,
        bloodType:            r.bloodType          ?? r.blood_type ?? null,
        phone:                r.phone              ?? null,
        email:                r.email              ?? null,
        address:              r.address            ?? null,
        emergencyContact:     r.emergencyContact   ?? r.emergency_contact ?? null,
        doctorName:           r.doctor              ?? null,
        lastVisit:            r.lastVisit           ?? r.last_visit      ?? null,
        status:               r.status              ?? null,
        bp:                   r.bp                  ?? null,
        heartRate:            r.heartRate           != null ? parseInt(r.heartRate)           : null,
        temperature:          r.temperature         != null ? parseFloat(r.temperature)       : null,
        o2Saturation:         r.o2Saturation        != null ? parseFloat(r.o2Saturation)      : null,
        weight:               r.weight              != null ? parseFloat(r.weight)            : null,
        height:               r.height              != null ? parseFloat(r.height)            : null,
        bmi:                  r.bmi                 != null ? parseFloat(r.bmi)               : null,
        respiratoryRate:      r.respiratoryRate     != null ? parseInt(r.respiratoryRate)     : null,
        currentMedications:   r.currentMedications  ?? null,
        diagnosisCode:        r.diagnosisCode        ?? null,
        diagnosisLabel:       r.diagnosisLabel       ?? null,
        differentialDx:       r.differentialDx       ?? null,
        soapSubjective:       r.soapSubjective       ?? null,
        soapObjective:        r.soapObjective        ?? null,
        soapAssessment:       r.soapAssessment       ?? null,
        soapPlan:             r.soapPlan             ?? null,
        encounters:           [],
        insurance:            r.insurance            ?? '',
        allergies:            r.allergies            ?? [],
        contraindications:    r.contraindications    ?? '',
        alertNotes:           r.alertNotes           ?? r.alert_notes ?? '',
        personalHistory:      r.personalHistory      ?? r.personal_history      ?? '',
        familyHistory:        r.familyHistory        ?? r.family_history        ?? '',
        habits:               r.habits               ?? '',
        surgicalHistory:      r.surgicalHistory      ?? r.surgical_history      ?? '',
        plannedInterventions: r.plannedInterventions ?? r.planned_interventions ?? '',
        chronicConditions:    r.chronicConditions    ?? r.chronic_conditions    ?? [],
        odontogram:           r.odontogram           ?? null,
        periodontogram:       r.periodontogram       ?? null,
        createdAt:            r.createdAt            ?? r.created_at,
        updatedAt:            r.updatedAt            ?? r.updated_at
      };
    }
  }
};

// ── Lookup table bootstrap ────────────────────────────────────────────────────
let lookupTablesReady = false;

async function ensureLookupTables(client) {
  if (lookupTablesReady) return;

  await client.query(`
    CREATE TABLE IF NOT EXISTS supplier_status (
      value TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT, sort_order INTEGER DEFAULT 0
    )`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS expense_status (
      value TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT, sort_order INTEGER DEFAULT 0
    )`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS expense_payment_method (
      value TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT, sort_order INTEGER DEFAULT 0
    )`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS appointment_status (
      value TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT, sort_order INTEGER DEFAULT 0
    )`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS appointment_modality (
      value TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT, sort_order INTEGER DEFAULT 0
    )`);

  await client.query(`INSERT INTO supplier_status (value,label,color,sort_order) VALUES
    ('active','Activo','#10b981',1),('inactive','Inactivo','#6b7280',2),('blocked','Bloqueado','#ef4444',3)
    ON CONFLICT DO NOTHING`);
  await client.query(`INSERT INTO expense_status (value,label,color,sort_order) VALUES
    ('pending','Pendiente','#f59e0b',1),('paid','Pagado','#10b981',2),('cancelled','Cancelado','#ef4444',3)
    ON CONFLICT DO NOTHING`);
  await client.query(`INSERT INTO expense_payment_method (value,label,color,sort_order) VALUES
    ('cash','Efectivo','#10b981',1),('card','Tarjeta','#3b82f6',2),
    ('transfer','Transferencia','#6366f1',3),('other','Otro','#6b7280',4)
    ON CONFLICT DO NOTHING`);
  await client.query(`INSERT INTO appointment_status (value,label,color,sort_order) VALUES
    ('scheduled','Agendada','#3b82f6',1),('confirmed','Confirmada','#8b5cf6',2),
    ('completed','Completada','#10b981',3),('cancelled','Cancelada','#ef4444',4),
    ('no_show','No asistió','#f59e0b',5)
    ON CONFLICT DO NOTHING`);
  await client.query(`INSERT INTO appointment_modality (value,label,color,sort_order) VALUES
    ('in_person','Presencial','#6366f1',1),('video','Videoconsulta','#0891b2',2),
    ('phone','Teléfono','#10b981',3)
    ON CONFLICT DO NOTHING`);

  lookupTablesReady = true;
  log("INFO", "Lookup tables ready");
}

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

  // ── Public booking routes → proxy to dairi-book Lambda ───────────────────
  const rawPathEarly = event.rawPath || event.path || "";
  if (rawPathEarly.startsWith("/api/book")) {
    const bookFnUrl = process.env.BOOK_FUNCTION_URL;
    if (!bookFnUrl) return response(503, { message: "Servicio de agenda no configurado" });
    log("INFO", "Book proxy", { method, path: rawPathEarly });
    try {
      const methodEarly = (event.requestContext?.http?.method || event.httpMethod || "GET").toUpperCase();
      const qs      = event.queryStringParameters ?? {};
      const qsStr   = Object.keys(qs).length > 0 ? "?" + new URLSearchParams(qs).toString() : "";
      let bodyFwd   = undefined;
      if (methodEarly !== "GET" && methodEarly !== "OPTIONS" && event.body) {
        bodyFwd = typeof event.body === "string" ? event.body : JSON.stringify(event.body);
      }
      const bookRes  = await fetch(bookFnUrl + rawPathEarly + qsStr, {
        method:  methodEarly,
        headers: { "Content-Type": "application/json" },
        body:    bodyFwd,
      });
      const bookData = await bookRes.json();
      return response(bookRes.status, bookData);
    } catch (err) {
      log("ERROR", "Book proxy error", { message: err.message });
      return response(502, { message: "Error en servicio de agendamiento" });
    }
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
  //   /api/suppliers                → list / create (typed alias for suppliers)
  //   /api/suppliers/{id}           → get / update / delete (typed alias for suppliers)
  const rawPath = event.rawPath || event.path || "";
  const entitiesMatch = rawPath.match(/\/api\/entities\/([^/]+)(?:\/([^/]+))?/);
  const suppliersMatch = rawPath.match(/\/api\/suppliers(?:\/([^/]+))?/);
  let entityKey;
  let id = null;

  if (entitiesMatch) {
    entityKey = entitiesMatch[1];
    id = entitiesMatch[2] ?? null;
  } else if (suppliersMatch) {
    entityKey = 'suppliers';
    id = suppliersMatch[1] ?? null;
  }

  if (!entityKey) {
    log("WARN", "Path did not match expected pattern", { rawPath });
    return response(404, { message: "Ruta no encontrada" });
  }

  // Normalize camelCase/alternate keys sent by the login Lambda
  const KEY_ALIASES = { clinicalRecords: 'clinical-records', paciente: 'patients' };
  const resolvedKey = KEY_ALIASES[entityKey] ?? entityKey;
  const config = ENTITY_CONFIG[resolvedKey];

  log("INFO", "Path parsed", { entityKey, resolvedKey, id });

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
    await ensureLookupTables(client);

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
  const orderBy = config.orderBy ?? (config.joinSelect ? 'c.created_at DESC' : 'id DESC');
  let result;
  if (config.joinSelect) {
    result = await client.query(`${config.joinSelect} ORDER BY ${orderBy}`);
  } else {
    result = await client.query(`SELECT * FROM ${config.table} ORDER BY ${orderBy}`);
  }
  log("INFO", "listEntities — done", { table: config.table, rowCount: result.rowCount });
  return response(200, result.rows.map(config.fromDb));
}

async function getEntity(client, config, id, entityKey) {
  log("INFO", "getEntity — querying", { table: config.table, id, hasJoin: !!config.joinSelect });
  const pkCol = config.pkCol ?? 'id';
  let result;
  if (config.joinSelect) {
    result = await client.query(`${config.joinSelect} WHERE c.${pkCol} = $1 LIMIT 1`, [id]);
  } else {
    result = await client.query(`SELECT * FROM ${config.table} WHERE ${pkCol} = $1 LIMIT 1`, [id]);
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

  const pkCol      = config.pkCol ?? 'id';
  const tsClause   = config.noTimestamp ? '' : ', updated_at = NOW()';
  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values     = [...keys.map(k => cols[k]), id];

  log("INFO", "updateEntity — updating", { table: config.table, id, columns: keys });
  const result = await client.query(
    `UPDATE ${config.table}
     SET ${setClauses}${tsClause}
     WHERE ${pkCol} = $${keys.length + 1}
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
  const pkCol  = config.pkCol ?? 'id';
  const result = await client.query(
    `DELETE FROM ${config.table} WHERE ${pkCol} = $1 RETURNING ${pkCol}`,
    [id]
  );
  if (result.rowCount === 0) {
    log("WARN", "deleteEntity — not found", { table: config.table, id });
    return response(404, { message: "Registro no encontrado" });
  }
  log("INFO", "deleteEntity — success", { table: config.table, id });
  return response(200, { message: "Registro eliminado", id });
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
