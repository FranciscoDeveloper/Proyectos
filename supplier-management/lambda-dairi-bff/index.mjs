import pg      from "pg";
import jwt     from "jsonwebtoken";
import bcrypt  from "bcryptjs";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient, PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

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

if (!process.env.JWT_SECRET) {
  log("ERROR", "JWT_SECRET env var is not set — refusing to start");
  process.exit(1);
}
const JWT_SECRET   = process.env.JWT_SECRET;
const APP_URL      = process.env.APP_URL      || "https://dairi.cl";
const EMAIL_LAMBDA = process.env.EMAIL_LAMBDA || "send-email";

const lambdaClient   = new LambdaClient({ region: process.env.AWS_REGION || "us-east-1" });
const s3Client       = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const dynamoClient   = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const bedrockClient  = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1" });
const HELPDESK_TABLE = process.env.HELPDESK_TABLE || "dairi-helpdesk";
const DOCS_BUCKET    = process.env.DOCS_BUCKET || "friquelme-firstpage";
const DOCS_PREFIX    = "patient-docs";

// ── Helpdesk rate limiter (in-memory, persists across warm invocations) ───────
// Limits: 5 messages per user per 5 minutes per Lambda instance.
// Multiple concurrent instances each apply the limit independently,
// which is acceptable for a low-volume support chat.
const _hdRateMap          = new Map(); // userId → { count, windowStart }
const HD_RATE_WINDOW_MS   = 5 * 60_000; // 5 minutes
const HD_RATE_LIMIT       = 5;           // max messages per window

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
    profFilter: { idCol: 'c.professional_id' },

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
    table:    "patient",
    skipAuth: true,        // reference entity read by all modules (presupuestos, appointments, etc.)
    toDb(d) {
      const cols = {};
      // Accept both camelCase (API) and legacy Spanish keys
      if (d.name             !== undefined) cols.name              = d.name;
      if (d.nombre           !== undefined) cols.name              = d.nombre;
      if (d.fullName         !== undefined) cols.name              = d.fullName;
      if (d.email            !== undefined) cols.email             = d.email;
      if (d.phone            !== undefined) cols.phone             = d.phone;
      if (d.telefono         !== undefined) cols.phone             = d.telefono;
      if (d.rut              !== undefined) cols.rut               = d.rut;
      if (d.birthDate        !== undefined) cols.birth_date        = d.birthDate;
      if (d.gender           !== undefined) cols.gender            = d.gender;
      if (d.bloodType        !== undefined) cols.blood_type        = d.bloodType;
      if (d.address          !== undefined) cols.address           = d.address;
      if (d.emergencyContact !== undefined) cols.emergency_contact = d.emergencyContact;
      return cols;
    },
    fromDb(r) {
      return {
        id:               r.id,
        name:             r.name             ?? null,
        nombre:           r.name             ?? null,
        email:            r.email            ?? null,
        phone:            r.phone            ?? null,
        telefono:         r.phone            ?? null,
        rut:              r.rut              ?? null,
        birthDate:        r.birth_date       ?? null,
        gender:           r.gender           ?? null,
        bloodType:        r.blood_type       ?? null,
        address:          r.address          ?? null,
        emergencyContact: r.emergency_contact ?? null,
        createdAt:        r.created_at,
        updatedAt:        r.updated_at
      };
    }
  },

  // ── appointments ─────────────────────────────────────────────────────────────
  appointments: {
    table: "appointment",
    profFilter: { idCol: 'c.professional_id' },

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

  // ── presupuestos ─────────────────────────────────────────────────────────────
  presupuestos: {
    table: "presupuesto",
    profFilter: { idCol: 'c.professional_id' },

    joinSelect: `
      SELECT
        c.id,
        c.numero,
        c.patient_id                              AS "patientId",
        c.professional_id                         AS "professionalId",
        COALESCE(pat.name,  c.patient_name)       AS "patientName",
        COALESCE(pat.rut,   c.patient_rut)        AS "patientRut",
        COALESCE(pat.phone, c.patient_phone)      AS "patientPhone",
        COALESCE(pat.email, c.patient_email)      AS "patientEmail",
        c.doctor_name         AS "doctorName",
        c.specialty,
        c.fecha_emision       AS "fechaEmision",
        c.fecha_vencimiento   AS "fechaVencimiento",
        c.prevision,
        c.coverage_percent    AS "coveragePercent",
        c.discount_global     AS "discountGlobal",
        c.items,
        c.notes,
        c.status,
        c.created_at          AS "createdAt",
        c.updated_at          AS "updatedAt"
      FROM presupuesto c
      LEFT JOIN patient pat ON pat.id = c.patient_id
    `,

    toDb(d) {
      const cols = {};
      if (d.numero            !== undefined) cols.numero             = d.numero;
      if (d.patientId         !== undefined) cols.patient_id         = d.patientId      || null;
      if (d.professionalId    !== undefined) cols.professional_id    = d.professionalId || null;
      if (d.patientName       !== undefined) cols.patient_name       = d.patientName;
      if (d.patientRut        !== undefined) cols.patient_rut        = d.patientRut;
      if (d.patientPhone      !== undefined) cols.patient_phone      = d.patientPhone;
      if (d.patientEmail      !== undefined) cols.patient_email      = d.patientEmail;
      if (d.doctorName        !== undefined) cols.doctor_name        = d.doctorName;
      if (d.specialty         !== undefined) cols.specialty          = d.specialty;
      if (d.fechaEmision      !== undefined) cols.fecha_emision      = d.fechaEmision;
      if (d.fechaVencimiento  !== undefined) cols.fecha_vencimiento  = d.fechaVencimiento;
      if (d.prevision         !== undefined) cols.prevision          = d.prevision;
      if (d.coveragePercent   !== undefined) cols.coverage_percent   = d.coveragePercent;
      if (d.discountGlobal    !== undefined) cols.discount_global    = d.discountGlobal;
      if (d.items             !== undefined) cols.items              = JSON.stringify(d.items);
      if (d.notes             !== undefined) cols.notes              = d.notes;
      if (d.status            !== undefined) cols.status             = d.status;
      return cols;
    },

    fromDb(r) {
      return {
        id:               r.id,
        numero:           r.numero,
        patientId:        r.patientId        ?? r.patient_id        ?? null,
        professionalId:   r.professionalId   ?? r.professional_id   ?? null,
        patientName:      r.patientName      ?? r.patient_name      ?? null,
        patientRut:       r.patientRut       ?? r.patient_rut       ?? null,
        patientPhone:     r.patientPhone     ?? r.patient_phone     ?? null,
        patientEmail:     r.patientEmail     ?? r.patient_email     ?? null,
        doctorName:       r.doctorName       ?? r.doctor_name       ?? null,
        specialty:        r.specialty        ?? null,
        fechaEmision:     r.fechaEmision     ?? r.fecha_emision     ?? null,
        fechaVencimiento: r.fechaVencimiento ?? r.fecha_vencimiento ?? null,
        prevision:        r.prevision        ?? 'particular',
        coveragePercent:  r.coveragePercent  != null ? parseFloat(r.coveragePercent)  : (r.coverage_percent  != null ? parseFloat(r.coverage_percent)  : 0),
        discountGlobal:   r.discountGlobal   != null ? parseFloat(r.discountGlobal)   : (r.discount_global   != null ? parseFloat(r.discount_global)   : 0),
        items:            r.items            ?? [],
        notes:            r.notes            ?? null,
        status:           r.status           ?? 'draft',
        createdAt:        r.createdAt        ?? r.created_at,
        updatedAt:        r.updatedAt        ?? r.updated_at
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
    profFilter: { nameCol: 'c.doctor' },

    // JOIN with patient to populate demographic fields (fullName, rut, etc.)
    joinSelect: `
      SELECT
        c.id,
        c.patient_id              AS "patientId",
        p.name                    AS "fullName",
        p.rut,
        COALESCE(c.birth_date, p.birth_date) AS "birthDate",
        p.gender,
        p.blood_type              AS "bloodType",
        p.phone,
        p.email,
        p.address,
        p.emergency_contact       AS "emergencyContact",
        c.insurance,
        c.profession,
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
        c.encounters,
        c.status,
        c.created_at              AS "createdAt",
        c.updated_at              AS "updatedAt"
      FROM clinical_record c
      LEFT JOIN patient p ON p.id = c.patient_id
    `,

    toDb(d) {
      const cols = {};
      if (d.patientId            !== undefined) cols.patient_id             = d.patientId;
      if (d.birthDate            !== undefined) cols.birth_date             = d.birthDate || null;
      if (d.insurance            !== undefined) cols.insurance              = d.insurance;
      if (d.profession           !== undefined) cols.profession             = d.profession;
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
      if (d.encounters           !== undefined) cols.encounters             = JSON.stringify(d.encounters);
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
        profession:           r.profession          ?? null,
        bp:                   r.bp                  ?? null,
        heartRate:            (r.heartRate      ?? r.heart_rate)       != null ? parseInt(r.heartRate      ?? r.heart_rate)       : null,
        temperature:          (r.temperature)                           != null ? parseFloat(r.temperature)                        : null,
        o2Saturation:         (r.o2Saturation   ?? r.o2_saturation)    != null ? parseFloat(r.o2Saturation ?? r.o2_saturation)    : null,
        weight:               (r.weight)                                != null ? parseFloat(r.weight)                             : null,
        height:               (r.height)                                != null ? parseFloat(r.height)                             : null,
        bmi:                  (r.bmi)                                   != null ? parseFloat(r.bmi)                                : null,
        respiratoryRate:      (r.respiratoryRate ?? r.respiratory_rate) != null ? parseInt(r.respiratoryRate ?? r.respiratory_rate) : null,
        currentMedications:   r.currentMedications  ?? r.current_medications  ?? null,
        diagnosisCode:        r.diagnosisCode        ?? r.diagnosis_code       ?? null,
        diagnosisLabel:       r.diagnosisLabel       ?? r.diagnosis_label      ?? null,
        differentialDx:       r.differentialDx       ?? r.differential_dx      ?? null,
        soapSubjective:       r.soapSubjective       ?? r.soap_subjective      ?? null,
        soapObjective:        r.soapObjective        ?? r.soap_objective       ?? null,
        soapAssessment:       r.soapAssessment       ?? r.soap_assessment      ?? null,
        soapPlan:             r.soapPlan             ?? r.soap_plan            ?? null,
        encounters:           Array.isArray(r.encounters) ? r.encounters : (r.encounters ? JSON.parse(r.encounters) : []),
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
  },

  // ── previsiones (lookup — reads from prevision table) ────────────────────────
  previsiones: {
    table:       'prevision',
    orderBy:     'sort_order ASC, nombre ASC',
    noTimestamp: true,
    skipAuth:    true,
    toDb(d) {
      const cols = {};
      if (d.nombre    !== undefined) cols.nombre      = d.nombre;
      if (d.sortOrder !== undefined) cols.sort_order  = d.sortOrder;
      return cols;
    },
    fromDb(r) {
      return { id: r.id, nombre: r.nombre, sortOrder: r.sort_order ?? 0 };
    }
  },

  // ── medicos (lookup — reads from professional table) ─────────────────────────
  medicos: {
    table:    'professional',
    orderBy:  'name ASC',
    skipAuth: true,
    toDb(d)  { return {}; },
    fromDb(r) {
      return { id: r.id, nombre: r.name };
    }
  },

  // ── user-management (admin — reads/edits app_user, never exposes password) ────
  'user-management': {
    table:   'app_user',
    orderBy: 'id ASC',
    toDb(d) {
      const cols = {};
      if (d.name          !== undefined) cols.name           = d.name;
      if (d.email         !== undefined) cols.email          = d.email;
      if (d.role          !== undefined) cols.role           = d.role;
      if (d.avatar        !== undefined) cols.avatar         = d.avatar;
      if (d.emailVerified !== undefined) cols.email_verified = d.emailVerified;
      return cols;
    },
    fromDb(r) {
      return {
        id:            r.id,
        name:          r.name,
        email:         r.email,
        role:          r.role,
        avatar:        r.avatar   ?? null,
        emailVerified: r.email_verified,
        createdAt:     r.created_at
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

  // Prevision table — source of truth for insurance/previsión options
  await client.query(`
    CREATE TABLE IF NOT EXISTS prevision (
      id         SERIAL PRIMARY KEY,
      nombre     TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    )`);
  await client.query(`INSERT INTO prevision (nombre, sort_order) VALUES
    ('FONASA A',1),('FONASA B',2),('FONASA C',3),('FONASA D',4),
    ('ISAPRE',5),('Particular',6),('Sin Previsión',7),('CAPREDENA',8),('DIPRECA',9)
    ON CONFLICT DO NOTHING`);

  // Entity tables that the BFF references but are not auto-created elsewhere

  // patient: master registry; FK target for clinical_record, appointment, presupuesto, payment
  await client.query(`
    CREATE TABLE IF NOT EXISTS patient (
      id                SERIAL PRIMARY KEY,
      name              TEXT,
      rut               TEXT,
      birth_date        DATE,
      gender            TEXT,
      email             TEXT,
      phone             TEXT,
      address           TEXT,
      blood_type        TEXT,
      emergency_contact TEXT,
      notes             TEXT,
      prevision_id      INTEGER,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS professional (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      specialty  TEXT,
      rut        TEXT,
      email      TEXT,
      phone      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS product (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      sku         TEXT,
      status      TEXT DEFAULT 'active',
      price       NUMERIC(12,2),
      stock       INTEGER DEFAULT 0,
      weight      NUMERIC(8,3),
      description TEXT,
      tags        JSONB DEFAULT '[]',
      category_id INTEGER REFERENCES category(id),
      supplier_id INTEGER REFERENCES supplier(id),
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS presupuesto (
      id               SERIAL PRIMARY KEY,
      numero           TEXT,
      patient_id       INTEGER REFERENCES patient(id),
      professional_id  INTEGER REFERENCES professional(id),
      patient_name     TEXT,
      patient_rut      TEXT,
      patient_phone    TEXT,
      patient_email    TEXT,
      doctor_name      TEXT,
      specialty        TEXT,
      fecha_emision    DATE,
      fecha_vencimiento DATE,
      prevision        TEXT DEFAULT 'particular',
      coverage_percent NUMERIC(5,2) DEFAULT 0,
      discount_global  NUMERIC(5,2) DEFAULT 0,
      items            JSONB DEFAULT '[]',
      notes            TEXT,
      status           TEXT DEFAULT 'draft',
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS payment (
      id                SERIAL PRIMARY KEY,
      invoice_number    TEXT,
      date              DATE,
      concept           TEXT,
      amount            NUMERIC(12,2),
      payment_method    TEXT,
      status            TEXT DEFAULT 'pending',
      notes             TEXT,
      commission_rate   NUMERIC(5,2),
      commission_amount NUMERIC(12,2),
      commission_status TEXT,
      patient_id        INTEGER REFERENCES patient(id),
      professional_id   INTEGER REFERENCES professional(id),
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_config (
      user_id    INTEGER PRIMARY KEY REFERENCES app_user(id),
      zk_enabled BOOLEAN DEFAULT false,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

  await client.query(`
    INSERT INTO app_schema (schema_key, singular, plural, module_type, icon)
    VALUES ('user-management', 'Usuario', 'Gestion de Usuarios', 'admin', 'shield')
    ON CONFLICT DO NOTHING`);

  // Add columns to clinical_record if they don't exist yet
  await client.query(`ALTER TABLE clinical_record ADD COLUMN IF NOT EXISTS profession   TEXT`);
  await client.query(`ALTER TABLE clinical_record ADD COLUMN IF NOT EXISTS birth_date   DATE`);

  lookupTablesReady = true;
  log("INFO", "Lookup tables ready");
}

// ── User config ───────────────────────────────────────────────────────────────
async function handleUserConfig(userId, body) {
  const zkEnabled = typeof body?.zkEnabled === "boolean" ? body.zkEnabled : false;
  let client;
  try {
    client = await pool.connect();
    await client.query(
      `INSERT INTO user_config (user_id, zk_enabled, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET zk_enabled = EXCLUDED.zk_enabled, updated_at = NOW()`,
      [userId, zkEnabled]
    );
    return response(200, { zkEnabled });
  } catch (err) {
    log("ERROR", "handleUserConfig error", { message: err.message });
    return response(500, { message: "Error interno del servidor" });
  } finally {
    client?.release();
  }
}

// ── Activation email builder ──────────────────────────────────────────────────
function buildActivationEmail({ name, email, activationUrl }) {
  const firstName = name.split(" ")[0];
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1.5px solid #bae6fd;overflow:hidden;max-width:100%;">
<tr><td style="background:linear-gradient(135deg,#0ea5e9,#06b6d4);padding:28px 40px;">
<h1 style="margin:0;color:#fff;font-size:26px;font-weight:900;">Dairi<span style="color:#bae6fd;">.</span></h1>
</td></tr>
<tr><td style="padding:36px 40px;">
<h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Hola, ${firstName}</h2>
<p style="margin:0 0 24px;color:#475569;font-size:15px;">Tu cuenta en Dairi está lista. Actívala haciendo clic en el siguiente botón:</p>
<div style="text-align:center;margin:32px 0;">
<a href="${activationUrl}" style="background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">Activar cuenta</a>
</div>
<p style="margin:24px 0 0;color:#94a3b8;font-size:13px;">Este enlace expira en 24 horas. Si no creaste esta cuenta, puedes ignorar este mensaje.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { to: email, subject: "Activa tu cuenta en Dairi", html };
}

// ── Request authorization ─────────────────────────────────────────────────────
// 1. Verifies the user has the requested schema assigned in user_schema.
// 2. Blocks write operations (POST/PUT/DELETE) for viewer role.
// aliasKey: the original (un-resolved) entity key if different from entityKey,
// so both 'clinical-records' and 'clinicalRecords' match the same app_schema row.
async function authorizeRequest(client, userId, role, entityKey, method, aliasKey = null) {
  // admin and superadmin have access to all modules — skip per-module schema check
  if (role !== 'admin' && role !== 'superadmin') {
    const { rows } = await client.query(
      `SELECT 1
       FROM   user_schema us
       JOIN   app_schema  s ON s.id = us.schema_id
       WHERE  us.user_id   = $1
         AND  (s.schema_key = $2 OR ($3::text IS NOT NULL AND s.schema_key = $3))
       LIMIT  1`,
      [userId, entityKey, aliasKey]
    );

    if (rows.length === 0) {
      log("WARN", "Schema access denied", { userId, entityKey });
      return { allowed: false, status: 403, message: "No tienes acceso a este módulo" };
    }
  }

  const WRITE_METHODS = new Set(["POST", "PUT", "DELETE"]);
  if (role === "viewer" && WRITE_METHODS.has(method)) {
    log("WARN", "Write access denied — viewer role", { userId, entityKey, method });
    return { allowed: false, status: 403, message: "Tu rol solo permite consultar registros" };
  }

  return { allowed: true };
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

  const rawPath = rawPathEarly;

  // ── POST /api/helpdesk/message ────────────────────────────────────────────
  if (rawPath === "/api/helpdesk/message" && method === "POST") {
    let hdBody = null;
    if (event.body) {
      try { hdBody = typeof event.body === "string" ? JSON.parse(event.body) : event.body; }
      catch { return response(400, { message: "Body inválido" }); }
    }
    const content  = String(hdBody?.content  ?? "").trim().slice(0, 500);
    const userName = String(hdBody?.userName ?? tokenPayload.email ?? "").trim();
    const userId   = String(hdBody?.userId   ?? tokenPayload.sub   ?? "0");

    // Rate limit: max HD_RATE_LIMIT messages per HD_RATE_WINDOW_MS per user
    const now      = Date.now();
    const rateData = _hdRateMap.get(userId) ?? { count: 0, windowStart: now };
    if (now - rateData.windowStart > HD_RATE_WINDOW_MS) {
      rateData.count = 0;
      rateData.windowStart = now;
    }
    if (rateData.count >= HD_RATE_LIMIT) {
      const waitSec = Math.ceil((HD_RATE_WINDOW_MS - (now - rateData.windowStart)) / 1000);
      log("WARN", "Helpdesk rate limit exceeded", { userId, count: rateData.count });
      return response(429, { message: `Demasiados mensajes. Intenta nuevamente en ${waitSec} segundos.` });
    }
    rateData.count++;
    _hdRateMap.set(userId, rateData);
    if (!content) return response(400, { message: "El mensaje no puede estar vacío" });

    const ticketId  = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    try {
      await dynamoClient.send(new PutItemCommand({
        TableName: HELPDESK_TABLE,
        Item: marshall({
          ticketId,
          userId,
          timestamp,
          userEmail: tokenPayload.email ?? "",
          userName,
          content,
          status: "open",
          source: "dairi-helpdesk"
        }, { removeUndefinedValues: true })
      }));
      log("INFO", "Helpdesk message persisted", { ticketId, userId });
    } catch (err) {
      log("ERROR", "Failed to persist helpdesk message to DynamoDB", { message: err.message, ticketId });
    }
    return response(200, { ticketId, timestamp, message: "Mensaje recibido" });
  }

  // ── Chat routes /api/chat/* ───────────────────────────────────────────────
  if (rawPath === "/api/chat/users" && method === "GET") {
    const COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, name, email, role FROM app_user WHERE email_verified = true ORDER BY id`
      );
      return response(200, rows.map(r => ({
        id:     r.id,
        name:   r.name || r.email.split("@")[0],
        avatar: (r.name || r.email).charAt(0).toUpperCase(),
        role:   r.role  || "user",
        online: false,
        color:  COLORS[r.id % COLORS.length]
      })));
    } finally { client.release(); }
  }

  if (rawPath === "/api/chat/messages" && method === "GET") {
    const convId = event.queryStringParameters?.conversationId;
    if (!convId) return response(400, { message: "conversationId requerido" });
    try {
      const result = await dynamoClient.send(new ScanCommand({
        TableName:                 HELPDESK_TABLE,
        FilterExpression:          "conversationId = :cid AND #src = :src",
        ExpressionAttributeNames:  { "#src": "source" },
        ExpressionAttributeValues: marshall({ ":cid": convId, ":src": "dairi-chat" }),
        Limit:                     500
      }));
      const items = (result.Items ?? [])
        .map(item => unmarshall(item))
        .sort((a, b) => a.timestamp < b.timestamp ? -1 : 1)
        .slice(-200);
      return response(200, items.map(r => ({
        id:             r.ticketId,
        conversationId: r.conversationId,
        senderId:       Number(r.senderId) || 0,
        senderName:     r.senderName   ?? "",
        senderAvatar:   r.senderAvatar ?? "",
        content:        r.content,
        timestamp:      r.timestamp
      })));
    } catch (err) {
      log("ERROR", "DynamoDB Scan chat messages failed", { message: err.message });
      return response(200, []); // return empty rather than error so chat still opens
    }
  }

  if (rawPath === "/api/chat/messages" && method === "POST") {
    let chatBody = null;
    if (event.body) {
      try { chatBody = typeof event.body === "string" ? JSON.parse(event.body) : event.body; }
      catch { return response(400, { message: "Body inválido" }); }
    }
    const { conversationId, senderId, senderName, senderAvatar, content } = chatBody ?? {};
    if (!conversationId || !content) return response(400, { message: "conversationId y content son requeridos" });
    const ticketId  = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    try {
      await dynamoClient.send(new PutItemCommand({
        TableName: HELPDESK_TABLE,
        Item: marshall({
          ticketId,
          conversationId,
          senderId:     String(senderId ?? tokenPayload.sub ?? "0"),
          senderName:   senderName   ?? "",
          senderAvatar: senderAvatar ?? "",
          content,
          timestamp,
          source:  "dairi-chat",
          status:  "delivered"
        }, { removeUndefinedValues: true })
      }));
      return response(201, {
        id:             ticketId,
        conversationId,
        senderId:       Number(senderId ?? tokenPayload.sub ?? 0),
        senderName:     senderName   ?? "",
        senderAvatar:   senderAvatar ?? "",
        content,
        timestamp
      });
    } catch (err) {
      log("ERROR", "DynamoDB PutItem chat message failed", { message: err.message });
      return response(500, { message: "Error al guardar el mensaje" });
    }
  }

  // ── PATCH /api/user/config ────────────────────────────────────────────────
  if (rawPath === "/api/user/config") {
    if (method !== "PATCH") return response(405, { message: "Método no permitido" });
    let cfgBody = null;
    if (event.body) {
      try { cfgBody = typeof event.body === "string" ? JSON.parse(event.body) : event.body; }
      catch { return response(400, { message: "Body inválido" }); }
    }
    return handleUserConfig(tokenPayload.sub, cfgBody);
  }

  // ── AI Clinical Summary /api/clinical-summary/{recordId} ─────────────────
  const clinicalSummaryMatch = rawPath.match(/^\/api\/clinical-summary\/(\d+)$/);
  if (clinicalSummaryMatch && method === "GET") {
    const recordId = parseInt(clinicalSummaryMatch[1], 10);
    const sumClient = await pool.connect();
    try {
      const { rows } = await sumClient.query(`
        SELECT
          p.name                              AS full_name,
          p.gender,
          COALESCE(c.birth_date, p.birth_date) AS birth_date,
          c.insurance,
          c.allergies,
          c.contraindications,
          c.chronic_conditions,
          c.current_medications,
          c.diagnosis_code,
          c.diagnosis_label,
          c.soap_subjective,
          c.soap_objective,
          c.soap_assessment,
          c.soap_plan,
          c.encounters
        FROM clinical_record c
        LEFT JOIN patient p ON p.id = c.patient_id
        WHERE c.id = $1
      `, [recordId]);

      if (!rows.length) return response(404, { message: "Registro no encontrado" });
      const r = rows[0];

      let age = null;
      if (r.birth_date) {
        const diff = Date.now() - new Date(r.birth_date).getTime();
        age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
      }

      const parts = [
        `Paciente: ${r.full_name ?? "Sin nombre"}`,
        age        ? `Edad: ${age} años`                      : null,
        r.gender   ? `Sexo: ${r.gender}`                      : null,
        r.insurance ? `Previsión: ${r.insurance}`             : null,
        (Array.isArray(r.allergies) && r.allergies.length)
          ? `Alergias: ${r.allergies.join(", ")}`             : null,
        r.contraindications  ? `Contraindicaciones: ${r.contraindications}`   : null,
        r.chronic_conditions ? `Condiciones crónicas: ${r.chronic_conditions}` : null,
        r.current_medications ? `Medicamentos actuales: ${r.current_medications}` : null,
        r.diagnosis_code
          ? `Diagnóstico: ${r.diagnosis_code}${r.diagnosis_label ? ` — ${r.diagnosis_label}` : ""}`
          : null,
        `\nNota SOAP:`,
        r.soap_subjective ? `Subjetivo: ${r.soap_subjective}` : null,
        r.soap_objective  ? `Objetivo: ${r.soap_objective}`   : null,
        r.soap_assessment ? `Evaluación: ${r.soap_assessment}` : null,
        r.soap_plan       ? `Plan: ${r.soap_plan}`            : null,
      ].filter(Boolean).join("\n");

      const encounters = Array.isArray(r.encounters) ? r.encounters : [];
      const encLines = encounters
        .slice()
        .sort((a, b) =>
          (String(b.encounterDate ?? b.date ?? "")).localeCompare(String(a.encounterDate ?? a.date ?? ""))
        )
        .slice(0, 5)
        .map((e, i) => {
          const date = e.encounterDate ?? e.lastVisit ?? e.date ?? "Sin fecha";
          const dx   = e.diagnosisCode ?? e.diagnosisLabel ?? e.diagnosis ?? "";
          return `${i + 1}. ${date}${dx ? `: ${dx}` : ""}`;
        });

      const prompt =
        `Eres un asistente médico clínico. Redacta en español un párrafo de resumen narrativo para el siguiente registro de paciente.\n` +
        `El resumen debe ser claro, conciso, clínicamente relevante y en tercera persona. Máximo 4 oraciones. Sin listas ni viñetas.\n\n` +
        parts +
        (encLines.length ? `\n\nÚltimas atenciones:\n${encLines.join("\n")}` : "") +
        `\n\nEscribe SOLO el párrafo narrativo, sin encabezados adicionales.`;

      const bedrockRes = await bedrockClient.send(new ConverseCommand({
        modelId: "anthropic.claude-3-haiku-20240307-v1:0",
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 300, temperature: 0.3 }
      }));

      const summary = bedrockRes.output?.message?.content?.[0]?.text?.trim()
        ?? "No se pudo generar el resumen.";
      log("INFO", "Clinical summary generated", { recordId, chars: summary.length });
      return response(200, { summary, generatedAt: new Date().toISOString() });

    } catch (err) {
      log("ERROR", "clinical-summary Bedrock error", { message: err.message, recordId });
      return response(500, { message: "No se pudo generar el resumen de IA", error: err.message });
    } finally {
      sumClient.release();
    }
  }

  // ── Documents routes /api/documents/{recordId} ───────────────────────────
  const docsMatch = rawPath.match(/^\/api\/documents\/(\d+)(\/(.+))?$/);
  if (docsMatch) {
    const recordId = docsMatch[1];
    const subPath  = docsMatch[3] ?? null;   // e.g. "Hemograma.pdf/url" or "Hemograma.pdf"
    const prefix   = `${DOCS_PREFIX}/${recordId}/`;

    // GET /api/documents/{recordId} → list documents
    if (method === "GET" && !subPath) {
      const cmd = new ListObjectsV2Command({ Bucket: DOCS_BUCKET, Prefix: prefix });
      const res = await s3Client.send(cmd);
      const files = (res.Contents ?? [])
        .filter(obj => obj.Key !== prefix)
        .map(obj => {
          const rawName = obj.Key.replace(prefix, '');
          // Decode display name: underscores back to spaces
          const displayName = rawName.replace(/_/g, ' ').replace(/\.pdf$/, '') + '.pdf';
          return {
            key:          obj.Key,
            name:         displayName,
            size:         obj.Size,
            lastModified: obj.LastModified,
          };
        });
      return response(200, files);
    }

    // GET /api/documents/{recordId}/{encodedKey}/url → pre-signed download URL
    if (method === "GET" && subPath && subPath.endsWith("/url")) {
      const fileKey = decodeURIComponent(subPath.slice(0, -4)); // strip "/url"
      const fullKey = `${DOCS_PREFIX}/${recordId}/${fileKey}`;
      const cmd  = new GetObjectCommand({ Bucket: DOCS_BUCKET, Key: fullKey });
      const url  = await getSignedUrl(s3Client, cmd, { expiresIn: 300 });
      return response(200, { url });
    }

    // GET /api/documents/{recordId}/{encodedKey}/upload-url → pre-signed PUT URL
    if (method === "GET" && subPath && subPath.endsWith("/upload-url")) {
      const fileKey = decodeURIComponent(subPath.slice(0, -11)); // strip "/upload-url"
      const fullKey = `${DOCS_PREFIX}/${recordId}/${fileKey}`;
      const cmd  = new PutObjectCommand({ Bucket: DOCS_BUCKET, Key: fullKey, ContentType: "application/pdf" });
      const url  = await getSignedUrl(s3Client, cmd, { expiresIn: 300 });
      return response(200, { url, key: fullKey });
    }

    // DELETE /api/documents/{recordId}/{encodedKey} → delete document
    if (method === "DELETE" && subPath) {
      const fileKey = decodeURIComponent(subPath);
      const fullKey = `${DOCS_PREFIX}/${recordId}/${fileKey}`;
      await s3Client.send(new DeleteObjectCommand({ Bucket: DOCS_BUCKET, Key: fullKey }));
      return response(200, { deleted: fullKey });
    }

    return response(405, { message: "Método no permitido en /api/documents" });
  }

  // ── Admin: user management ────────────────────────────────────────────────
  if (rawPath.startsWith("/api/admin/")) {
    if (tokenPayload.role !== "admin" && tokenPayload.role !== "superadmin") {
      return response(403, { message: "Acceso denegado" });
    }
    let body = null;
    if (event.body) {
      try { body = typeof event.body === "string" ? JSON.parse(event.body) : event.body; }
      catch { return response(400, { message: "Body inválido" }); }
    }
    let adminClient;
    try {
      adminClient = await pool.connect();

      // GET /api/admin/users → all users with schemas
      if (rawPath === "/api/admin/users" && method === "GET") {
        const { rows } = await adminClient.query(`
          SELECT
            u.id, u.name, u.email, u.role, u.avatar,
            u.email_verified, u.created_at,
            COALESCE(
              json_agg(s.schema_key ORDER BY s.schema_key)
              FILTER (WHERE s.schema_key IS NOT NULL), '[]'
            ) AS schemas
          FROM app_user u
          LEFT JOIN user_schema us ON us.user_id = u.id
          LEFT JOIN app_schema  s  ON s.id = us.schema_id
          GROUP BY u.id
          ORDER BY u.id ASC
        `);
        return response(200, rows.map(r => ({
          id:            r.id,
          name:          r.name,
          email:         r.email,
          role:          r.role,
          avatar:        r.avatar ?? null,
          emailVerified: r.email_verified,
          createdAt:     r.created_at,
          schemas:       r.schemas ?? []
        })));
      }

      // PUT /api/admin/users/:id/status → activate (resend email) or deactivate
      const statusMatch = rawPath.match(/^\/api\/admin\/users\/(\d+)\/status$/);
      if (statusMatch && method === "PUT") {
        const userId = parseInt(statusMatch[1], 10);
        const { active } = body ?? {};

        if (active) {
          const { rows } = await adminClient.query(
            "SELECT id, name, email FROM app_user WHERE id = $1", [userId]
          );
          if (!rows.length) return response(404, { message: "Usuario no encontrado" });
          const user = rows[0];

          const activationToken = jwt.sign(
            { sub: user.id, email: user.email, type: "activation" },
            JWT_SECRET,
            { expiresIn: "24h" }
          );
          await adminClient.query(
            "UPDATE app_user SET activation_token = $1 WHERE id = $2",
            [activationToken, userId]
          );

          const activationUrl = `${APP_URL}/#/activate?token=${encodeURIComponent(activationToken)}`;
          const emailPayload  = buildActivationEmail({ name: user.name, email: user.email, activationUrl });

          return response(200, {
            message:      "Email de activación generado",
            emailPayload,
            activationUrl
          });
        } else {
          await adminClient.query(
            "UPDATE app_user SET email_verified = false, activation_token = NULL WHERE id = $1",
            [userId]
          );
          return response(200, { message: "Usuario desactivado" });
        }
      }

      // PUT /api/admin/users/:id/schemas → replace user schemas
      const schemasMatch = rawPath.match(/^\/api\/admin\/users\/(\d+)\/schemas$/);
      if (schemasMatch && method === "PUT") {
        const userId    = parseInt(schemasMatch[1], 10);
        const { schemaKeys = [] } = body ?? {};

        await adminClient.query("DELETE FROM user_schema WHERE user_id = $1", [userId]);
        if (schemaKeys.length > 0) {
          await adminClient.query(
            `INSERT INTO user_schema (user_id, schema_id)
             SELECT $1, s.id FROM app_schema s WHERE s.schema_key = ANY($2::text[])`,
            [userId, schemaKeys]
          );
        }
        const { rows } = await adminClient.query(
          `SELECT s.schema_key FROM user_schema us
           JOIN app_schema s ON s.id = us.schema_id
           WHERE us.user_id = $1`,
          [userId]
        );
        return response(200, { schemas: rows.map(r => r.schema_key) });
      }

      // PUT /api/admin/users/:id/password → change password
      const passwordMatch = rawPath.match(/^\/api\/admin\/users\/(\d+)\/password$/);
      if (passwordMatch && method === "PUT") {
        const userId     = parseInt(passwordMatch[1], 10);
        const { password } = body ?? {};
        if (!password || password.length < 8)
          return response(400, { message: "La contraseña debe tener al menos 8 caracteres" });
        const hash = await bcrypt.hash(password, 10);
        await adminClient.query(
          "UPDATE app_user SET password_hash = $1 WHERE id = $2", [hash, userId]
        );
        return response(200, { message: "Contraseña actualizada" });
      }

      return response(404, { message: "Ruta de administración no encontrada" });
    } finally {
      if (adminClient) adminClient.release();
    }
  }

  // ── Path parsing ──────────────────────────────────────────────────────────
  // Supported patterns:
  //   /api/entities/{entity}        → list / create
  //   /api/entities/{entity}/{id}   → get / update / delete
  //   /api/suppliers                → list / create (typed alias for suppliers)
  //   /api/suppliers/{id}           → get / update / delete (typed alias for suppliers)
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

  // Normalize camelCase/alternate keys sent by the login Lambda.
  // All clinical specialty types share the clinical_record table.
  // Calendar specialty types share the appointment table.
  const KEY_ALIASES = {
    clinicalRecords:   'clinical-records',
    paciente:          'patients',
    'psych-records':   'clinical-records',
    'dental-records':  'clinical-records',
    'kine-records':    'clinical-records',
    'nutrition-records': 'clinical-records',
    'fono-records':    'clinical-records',
    'ot-records':      'clinical-records',
    'matrona-records': 'clinical-records',
    'tecnomed-records':'clinical-records',
    'psych-sessions':  'appointments',
    'dental-sessions': 'appointments',
  };
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

    // ── Authorization: schema access + role write permissions ─────────────────
    // skipAuth entities (previsiones, medicos) are shared lookups — any authenticated user can read them
    if (!config.skipAuth) {
      // Accept both the resolved key and any alias that maps to it, so that
      // 'clinical-records' and 'clinicalRecords' both match the same app_schema row.
      const reverseAlias = Object.entries(KEY_ALIASES).find(([, v]) => v === resolvedKey)?.[0] ?? null;
      const aliasKey = entityKey !== resolvedKey ? entityKey : reverseAlias;
      const authz = await authorizeRequest(client, tokenPayload.sub, tokenPayload.role, resolvedKey, method, aliasKey);
      if (!authz.allowed) return response(authz.status, { message: authz.message });
    }

    // ── Special action: POST /api/entities/presupuestos/{id}/send ──────────────
    if (resolvedKey === "presupuestos" && rawPath.endsWith("/send") && method === "POST") {
      return await sendPresupuestoEmail(client, id, body);
    }

    // ── Special action: POST /api/entities/{clinicalKey}/{id}/encounters ────────
    if (rawPath.endsWith("/encounters") && method === "POST" && id) {
      return await appendEncounter(client, config, id, body);
    }

    // ── Resolve professional scope (determines per-professional data filtering) ──
    let profScope = null;
    {
      const { rows } = await client.query(
        `SELECT p.id AS prof_id, p.name AS prof_name
         FROM professional p WHERE p.user_id = $1 LIMIT 1`,
        [tokenPayload.sub]
      );
      if (rows.length) {
        profScope = { professionalId: rows[0].prof_id, professionalName: rows[0].prof_name };
        log("INFO", "profScope resolved", profScope);
      }
    }

    if (method === "GET" && !id)        return await listEntities(client, config, entityKey, profScope);
    if (method === "GET" && id)         return await getEntity(client, config, id, entityKey, profScope);
    if (method === "POST" && !id)       return await createEntity(client, config, body, entityKey, profScope);
    if (method === "PUT" && id)         return await updateEntity(client, config, id, body, entityKey, profScope);
    if (method === "DELETE" && id)      return await deleteEntity(client, config, id, entityKey, profScope);

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

/**
 * Build a WHERE clause that restricts rows to the authenticated professional.
 * Uses idCol (FK) when available, nameCol (text match) as fallback.
 * Returns { clause: string, params: any[] } — clause already contains AND/WHERE prefix.
 */
function buildProfWhere(config, profScope, existingParamCount = 0) {
  if (!profScope || !config.profFilter) return { clause: '', params: [] };
  const f = config.profFilter;
  const params = [];
  const conditions = [];

  if (f.idCol && profScope.professionalId != null) {
    params.push(profScope.professionalId);
    conditions.push(`${f.idCol} = $${existingParamCount + params.length}`);
  }
  if (f.nameCol && profScope.professionalName) {
    params.push(profScope.professionalName);
    conditions.push(`${f.nameCol} = $${existingParamCount + params.length}`);
  }

  if (conditions.length === 0) return { clause: ' WHERE (1=0)', params: [] };
  return { clause: ` WHERE (${conditions.join(' OR ')})`, params };
}

async function listEntities(client, config, entityKey, profScope) {
  log("INFO", "listEntities — querying", { table: config.table, hasJoin: !!config.joinSelect });
  const orderBy = config.orderBy ?? (config.joinSelect ? 'c.created_at DESC' : 'id DESC');
  let result;
  if (config.joinSelect) {
    const { clause, params } = buildProfWhere(config, profScope);
    result = await client.query(`${config.joinSelect}${clause} ORDER BY ${orderBy}`, params);
  } else {
    result = await client.query(`SELECT * FROM ${config.table} ORDER BY ${orderBy}`);
  }
  log("INFO", "listEntities — done", { table: config.table, rowCount: result.rowCount });
  return response(200, result.rows.map(config.fromDb));
}

async function getEntity(client, config, id, entityKey, profScope) {
  log("INFO", "getEntity — querying", { table: config.table, id, hasJoin: !!config.joinSelect });
  const pkCol = config.pkCol ?? 'id';
  let result;
  if (config.joinSelect) {
    const { clause, params } = buildProfWhere(config, profScope, 1);
    const andOrWhere = clause ? clause.replace(' WHERE ', ' AND ') : '';
    result = await client.query(
      `${config.joinSelect} WHERE c.${pkCol} = $1${andOrWhere} LIMIT 1`,
      [id, ...params]
    );
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

async function createEntity(client, config, data, entityKey, profScope) {
  if (!data || typeof data !== "object") {
    log("WARN", "createEntity — missing body", { entityKey });
    return response(400, { message: "Body requerido para crear un registro" });
  }

  const cols = config.toDb(data);

  // Auto-stamp professional identity so records are always linked to the creator
  if (profScope && config.profFilter) {
    const f = config.profFilter;
    if (f.idCol && profScope.professionalId != null) {
      const col = f.idCol.replace(/^\w+\./, '');     // strip alias 'c.' → 'professional_id'
      if (!(col in cols)) cols[col] = profScope.professionalId;
    } else if (f.nameCol && profScope.professionalName) {
      const col = f.nameCol.replace(/^\w+\./, '');   // strip alias 'c.' → 'doctor'
      if (!(col in cols)) cols[col] = profScope.professionalName;
    }
  }

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
  // Re-fetch with JOIN so patient demographics are included in the response
  if (config.joinSelect && result.rows[0]?.id) {
    const pkCol = config.pkCol ?? 'id';
    const full  = await client.query(`${config.joinSelect} WHERE c.${pkCol} = $1 LIMIT 1`, [result.rows[0].id]);
    if (full.rowCount > 0) return response(201, config.fromDb(full.rows[0]));
  }
  return response(201, config.fromDb(result.rows[0]));
}

async function updateEntity(client, config, id, data, entityKey, profScope) {
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

  // Build ownership check for professionals
  let ownerClause = '';
  let ownerParams = [];
  if (profScope && config.profFilter) {
    const f = config.profFilter;
    if (f.idCol && profScope.professionalId != null) {
      const col = f.idCol.replace(/^\w+\./, '');
      ownerParams.push(profScope.professionalId);
      ownerClause = ` AND ${col} = $${keys.length + 1 + ownerParams.length}`;
    } else if (f.nameCol && profScope.professionalName) {
      const col = f.nameCol.replace(/^\w+\./, '');
      ownerParams.push(profScope.professionalName);
      ownerClause = ` AND ${col} = $${keys.length + 1 + ownerParams.length}`;
    }
  }
  const values = [...keys.map(k => cols[k]), id, ...ownerParams];

  log("INFO", "updateEntity — updating", { table: config.table, id, columns: keys });
  const result = await client.query(
    `UPDATE ${config.table}
     SET ${setClauses}${tsClause}
     WHERE ${pkCol} = $${keys.length + 1}${ownerClause}
     RETURNING *`,
    values
  );

  if (result.rowCount === 0) {
    log("WARN", "updateEntity — not found", { table: config.table, id });
    return response(404, { message: "Registro no encontrado" });
  }
  log("INFO", "updateEntity — success", { table: config.table, id });
  // Re-fetch with JOIN so patient demographics are not lost in the response
  if (config.joinSelect) {
    const pkCol = config.pkCol ?? 'id';
    const full  = await client.query(`${config.joinSelect} WHERE c.${pkCol} = $1 LIMIT 1`, [id]);
    if (full.rowCount > 0) return response(200, config.fromDb(full.rows[0]));
  }
  return response(200, config.fromDb(result.rows[0]));
}

async function appendEncounter(client, config, id, encounter) {
  if (!encounter || typeof encounter !== "object") {
    return response(400, { message: "Body requerido para registrar atención" });
  }

  const pkCol = config.pkCol ?? "id";

  // Fetch current record to get existing encounters
  const current = await client.query(
    `SELECT encounters FROM ${config.table} WHERE ${pkCol} = $1`,
    [id]
  );
  if (current.rowCount === 0) {
    return response(404, { message: "Ficha clínica no encontrada" });
  }

  const raw = current.rows[0].encounters;
  const existing = Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : []);

  const newEncounter = { ...encounter, encounterDate: encounter.encounterDate ?? new Date().toISOString() };
  const updated = [newEncounter, ...existing];

  // Also update flat clinical columns (soap_*, vitals, diagnosis) from the encounter payload
  const flatCols   = config.toDb ? config.toDb(encounter) : {};
  const flatKeys   = Object.keys(flatCols);
  const flatSet    = flatKeys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  const flatValues = flatKeys.map(k => flatCols[k]);

  const result = await client.query(
    `UPDATE ${config.table}
     SET encounters = $1, last_visit = NOW(), updated_at = NOW()${flatSet ? ', ' + flatSet : ''}
     WHERE ${pkCol} = $2
     RETURNING *`,
    [JSON.stringify(updated), id, ...flatValues]
  );

  log("INFO", "appendEncounter — success", { table: config.table, id, totalEncounters: updated.length, flatUpdated: flatKeys });

  // Re-fetch with JOIN so patient demographics are included in the response
  if (config.joinSelect) {
    const full = await client.query(`${config.joinSelect} WHERE c.${pkCol} = $1 LIMIT 1`, [id]);
    if (full.rowCount > 0) return response(201, config.fromDb(full.rows[0]));
  }
  return response(201, config.fromDb(result.rows[0]));
}

async function deleteEntity(client, config, id, entityKey, profScope) {
  log("INFO", "deleteEntity — deleting", { table: config.table, id });
  const pkCol = config.pkCol ?? 'id';

  // Build ownership check for professionals
  let ownerClause = '';
  let ownerParams = [];
  if (profScope && config.profFilter) {
    const f = config.profFilter;
    if (f.idCol && profScope.professionalId != null) {
      const col = f.idCol.replace(/^\w+\./, '');
      ownerParams.push(profScope.professionalId);
      ownerClause = ` AND ${col} = $2`;
    } else if (f.nameCol && profScope.professionalName) {
      const col = f.nameCol.replace(/^\w+\./, '');
      ownerParams.push(profScope.professionalName);
      ownerClause = ` AND ${col} = $2`;
    }
  }

  const result = await client.query(
    `DELETE FROM ${config.table} WHERE ${pkCol} = $1${ownerClause} RETURNING ${pkCol}`,
    [id, ...ownerParams]
  );
  if (result.rowCount === 0) {
    log("WARN", "deleteEntity — not found", { table: config.table, id });
    return response(404, { message: "Registro no encontrado" });
  }
  log("INFO", "deleteEntity — success", { table: config.table, id });
  return response(200, { message: "Registro eliminado", id });
}

// ── Presupuesto email ─────────────────────────────────────────────────────────

async function sendPresupuestoEmail(client, id, body) {
  const { to, mode = "completo", message = "" } = body ?? {};

  if (!to || !to.includes("@"))
    return response(400, { message: "Email destinatario inválido" });

  if (!id)
    return response(400, { message: "ID de presupuesto requerido" });

  // Fetch presupuesto from DB
  const result = await client.query(
    `SELECT * FROM presupuesto WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (result.rowCount === 0)
    return response(404, { message: "Presupuesto no encontrado" });

  const p = ENTITY_CONFIG.presupuestos.fromDb(result.rows[0]);

  // Build email content based on mode
  const subject = `Presupuesto ${p.numero} — Dairi`;
  const html    = buildPresupuestoHtml(p, mode, message);
  const text    = buildPresupuestoText(p, mode, message);

  // Update status to 'sent' if currently 'draft' (before returning payload)
  const newStatus = p.status === "draft" ? "sent" : p.status;
  if (p.status === "draft") {
    await client.query(
      `UPDATE presupuesto SET status = 'sent', updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  // Return email payload for the frontend to deliver via /api/send-email
  // (dairi-bff is in VPC and cannot call Lambda/SES directly)
  log("INFO", "Presupuesto email payload built", { presupuestoId: id, to, mode });
  return response(200, {
    message:      "Presupuesto listo para envío.",
    emailSent:    false,
    newStatus,
    emailPayload: { to, subject, html, text },
  });
}

function clp(n) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(Math.round(n || 0));
}

function calcPresupuestoTotals(p) {
  const subtotal    = (p.items || []).reduce((s, i) => s + (i.subtotal || 0), 0);
  const discount    = subtotal * ((p.discountGlobal || 0) / 100);
  const total       = subtotal - discount;
  const covered     = total * ((p.coveragePercent || 0) / 100);
  const patientPays = total - covered;
  return { subtotal, discount, total, covered, patientPays };
}

function previsionLabel(v) {
  return { particular: "Particular", fonasa: "FONASA", isapre: "Isapre", capredena: "CAPREDENA" }[v] ?? v;
}

function buildPresupuestoHtml(p, mode, customMessage) {
  const t = calcPresupuestoTotals(p);
  const firstName = (p.patientName || "Paciente").split(" ")[0];
  const appUrl    = APP_URL;

  const headerStyle = `background:linear-gradient(135deg,#0ea5e9,#06b6d4);padding:28px 40px;`;
  const bodyStyle   = `padding:32px 40px;`;

  const greeting = customMessage
    ? `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">${customMessage.replace(/\n/g, "<br>")}</p>`
    : `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">
        Estimado/a <strong>${firstName}</strong>, le enviamos el presupuesto <strong>${p.numero}</strong>
        preparado por <strong>${p.doctorName}</strong>${p.specialty ? ` (${p.specialty})` : ""}.
       </p>`;

  let contentHtml = "";

  if (mode === "completo") {
    // Full detail: items table + totals
    const itemRows = (p.items || []).map(i => `
      <tr>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0;">${i.description}</td>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0;text-align:center;">${i.quantity}</td>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0;text-align:right;">${clp(i.unitPrice)}</td>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0;text-align:center;">${i.discountPct > 0 ? i.discountPct + "%" : "—"}</td>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0;text-align:right;font-weight:600;">${clp(i.subtotal)}</td>
      </tr>`).join("");

    contentHtml = `
      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:13px;margin-bottom:16px;">
        <thead>
          <tr style="background:#f0f9ff;">
            <th style="padding:8px 10px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.4px;">Descripción</th>
            <th style="padding:8px 10px;text-align:center;color:#64748b;font-size:11px;text-transform:uppercase;">Cant.</th>
            <th style="padding:8px 10px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;">P. Unit.</th>
            <th style="padding:8px 10px;text-align:center;color:#64748b;font-size:11px;text-transform:uppercase;">Dto.</th>
            <th style="padding:8px 10px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      ${buildTotalsHtml(t, p)}`;
  } else if (mode === "total") {
    // Only total amount
    contentHtml = `
      <table cellpadding="0" cellspacing="0" style="margin:20px auto;border:1.5px solid #bae6fd;border-radius:10px;overflow:hidden;min-width:260px;">
        <tr style="background:#0ea5e9;">
          <td style="padding:14px 28px;color:#fff;font-size:14px;font-weight:700;text-align:center;">Total del Presupuesto</td>
        </tr>
        <tr>
          <td style="padding:18px 28px;font-size:26px;font-weight:900;color:#0c2d48;text-align:center;background:#f0f9ff;">${clp(t.total)}</td>
        </tr>
        ${t.covered > 0 ? `<tr><td style="padding:10px 28px;font-size:13px;color:#15803d;text-align:center;background:#dcfce7;">Pago estimado paciente (${previsionLabel(p.prevision)} ${p.coveragePercent}%): <strong>${clp(t.patientPays)}</strong></td></tr>` : ""}
      </table>`;
  } else {
    // Minimal — no amounts
    contentHtml = `
      <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;padding:20px 24px;text-align:center;margin:16px 0;">
        <p style="margin:0;color:#0c2d48;font-size:15px;">Su presupuesto está listo.</p>
        <p style="margin:8px 0 0;color:#64748b;font-size:13px;">Para consultar los detalles, contáctenos directamente.</p>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1.5px solid #bae6fd;overflow:hidden;max-width:100%;">
        <tr>
          <td style="${headerStyle}">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:900;letter-spacing:-1px;">Dairi<span style="color:#bae6fd;">.</span></h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Plataforma clínica inteligente</p>
          </td>
        </tr>
        <tr>
          <td style="${bodyStyle}">
            <div style="display:inline-block;background:#dbeafe;color:#1d4ed8;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;margin-bottom:16px;">
              Presupuesto ${p.numero}
            </div>
            <h2 style="margin:0 0 16px;color:#0c2d48;font-size:20px;font-weight:800;">Hola, ${firstName} 👋</h2>
            ${greeting}
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:20px;font-size:13px;color:#475569;">
              <strong style="color:#0c2d48;">Profesional:</strong> ${p.doctorName}${p.specialty ? ` · ${p.specialty}` : ""}<br>
              <strong style="color:#0c2d48;">Previsión:</strong> ${previsionLabel(p.prevision)}<br>
              <strong style="color:#0c2d48;">Fecha emisión:</strong> ${p.fechaEmision}<br>
              <strong style="color:#0c2d48;">Válido hasta:</strong> <span style="color:#c2410c;">${p.fechaVencimiento}</span>
            </div>
            ${contentHtml}
            ${p.notes ? `<p style="margin:16px 0 0;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:12px;"><strong>Observaciones:</strong> ${p.notes}</p>` : ""}
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #e0f2fe;padding:18px 40px;background:#f8fafc;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              Este presupuesto fue generado en <a href="${appUrl}" style="color:#0ea5e9;">Dairi</a> — Plataforma clínica inteligente.
              Para consultas, responde este email o contáctanos directamente.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildTotalsHtml(t, p) {
  const rows = [];
  if (p.discountGlobal > 0) {
    rows.push(`<tr><td style="padding:7px 12px;color:#64748b;">Subtotal</td><td style="padding:7px 12px;text-align:right;">${clp(t.subtotal)}</td></tr>`);
    rows.push(`<tr><td style="padding:7px 12px;color:#f59e0b;">Descuento global (${p.discountGlobal}%)</td><td style="padding:7px 12px;text-align:right;color:#f59e0b;">-${clp(t.discount)}</td></tr>`);
  }
  rows.push(`<tr style="background:#f0f9ff;"><td style="padding:10px 12px;font-weight:800;color:#0c2d48;font-size:15px;">Total</td><td style="padding:10px 12px;text-align:right;font-weight:800;color:#0c2d48;font-size:15px;">${clp(t.total)}</td></tr>`);
  if (t.covered > 0) {
    rows.push(`<tr><td style="padding:7px 12px;color:#3b82f6;">${previsionLabel(p.prevision)} (${p.coveragePercent}%)</td><td style="padding:7px 12px;text-align:right;color:#3b82f6;">-${clp(t.covered)}</td></tr>`);
    rows.push(`<tr style="background:#dcfce7;"><td style="padding:10px 12px;font-weight:800;color:#15803d;">Pago Paciente</td><td style="padding:10px 12px;text-align:right;font-weight:800;color:#15803d;">${clp(t.patientPays)}</td></tr>`);
  }
  return `<table cellpadding="0" cellspacing="0" style="margin-left:auto;min-width:280px;border:1.5px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;margin-bottom:8px;">${rows.join("")}</table>`;
}

function buildPresupuestoText(p, mode, customMessage) {
  const t = calcPresupuestoTotals(p);
  const lines = [
    `Presupuesto ${p.numero} — Dairi`,
    ``,
    customMessage || `Estimado/a ${p.patientName}, le enviamos su presupuesto ${p.numero}.`,
    ``,
    `Profesional: ${p.doctorName}${p.specialty ? ` (${p.specialty})` : ""}`,
    `Previsión: ${previsionLabel(p.prevision)}`,
    `Emisión: ${p.fechaEmision}  |  Válido hasta: ${p.fechaVencimiento}`,
    ``
  ];
  if (mode === "completo") {
    lines.push("--- Ítems del Presupuesto ---");
    (p.items || []).forEach(i => {
      lines.push(`${i.description} × ${i.quantity} = ${clp(i.subtotal)}${i.discountPct > 0 ? ` (${i.discountPct}% dcto.)` : ""}`);
    });
    lines.push("");
    if (p.discountGlobal > 0) lines.push(`Subtotal: ${clp(t.subtotal)}  |  Descuento global (${p.discountGlobal}%): -${clp(t.discount)}`);
    lines.push(`TOTAL: ${clp(t.total)}`);
    if (t.covered > 0) {
      lines.push(`${previsionLabel(p.prevision)} cubre (${p.coveragePercent}%): -${clp(t.covered)}`);
      lines.push(`PAGO PACIENTE: ${clp(t.patientPays)}`);
    }
  } else if (mode === "total") {
    lines.push(`Total del presupuesto: ${clp(t.total)}`);
    if (t.covered > 0) lines.push(`Pago estimado paciente: ${clp(t.patientPays)}`);
  } else {
    lines.push("Su presupuesto está listo. Contáctenos para más detalles.");
  }
  if (p.notes) { lines.push(""); lines.push(`Observaciones: ${p.notes}`); }
  lines.push(""); lines.push(`— Equipo Dairi | ${APP_URL}`);
  return lines.join("\n");
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
