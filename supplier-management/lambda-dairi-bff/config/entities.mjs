// ── Entity configuration registry ─────────────────────────────────────────────
// Central config object mapping entity keys to table names, SQL queries, and
// field mappings. Zero logic — pure data/config (Open/Closed Principle: add a
// new entity here and nothing else changes).
//
// Each entity defines:
//   table       – DB table name
//   toDb(d)     – camelCase payload → snake_case columns (for INSERT/UPDATE)
//   fromDb(r)   – snake_case row    → camelCase (for GET responses)
//   joinSelect  – (optional) SELECT with JOINs for enriched reads
//   profFilter  – (optional) per-professional data filtering column
//   skipAuth    – (optional) reference entity read by all modules
//   pkCol       – (optional) primary key column (defaults to id)
//   orderBy     – (optional) default ORDER BY clause
//   noTimestamp – (optional) table has no created_at/updated_at columns

export const ENTITY_CONFIG = {

  // ── Categories ──
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

  // ── Suppliers ──
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

  // ── Products ──
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

  // ── Expenses ──
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

  // ── Payments ──
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

  // ── Patients ──
  patients: {
    table:    "patient",
    skipAuth: true,        // reference entity read by all modules (presupuestos, appointments, etc.)

    // patient has no professional_id column — scope via "has an appointment with me" instead.
    // profScope === null (admin/staff, no professional row) still sees every patient.
    joinSelect: `SELECT c.* FROM patient c`,
    profFilter: { existsIn: { table: 'appointment', patientCol: 'patient_id', profCol: 'professional_id' } },

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

  // ── Appointments ──
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

  // ── Presupuestos ──
  presupuestos: {
    table: "presupuesto",
    profFilter: { idCol: 'c.professional_id' },

    // `numero` is UNIQUE across the whole table, but professionals only ever see their
    // own (profFilter-scoped) rows client-side — a client-computed "next number" based
    // on that scoped view collides with numbers already taken by other professionals.
    // Always regenerate it server-side from the full, unscoped table.
    async beforeInsert(client, cols) {
      const year = new Date().getFullYear();
      const { rows } = await client.query(
        `SELECT numero FROM presupuesto WHERE numero LIKE $1`,
        [`PRES-${year}-%`]
      );
      let max = 0;
      for (const r of rows) {
        const seq = parseInt(String(r.numero).split('-').pop(), 10);
        if (!isNaN(seq) && seq > max) max = seq;
      }
      cols.numero = `PRES-${year}-${String(max + 1).padStart(4, '0')}`;
    },

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

  // ── Lookup: supplier_status ──
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

  // ── Lookup: expense_status ──
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

  // ── Lookup: expense_payment_method ──
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

  // ── Lookup: appointment_status ──
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

  // ── Lookup: appointment_modality ──
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

  // ── Clinical records ──
  'clinical-records': {
    table: "clinical_record",
    profFilter: { idCol: 'c.professional_id' },

    // JOIN with patient to populate demographic fields (fullName, rut, etc.)
    // and with professional to resolve the assigned doctor's name.
    joinSelect: `
      SELECT
        c.id,
        c.patient_id              AS "patientId",
        c.professional_id         AS "professionalId",
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
        c.soap_source             AS "soapSource",
        pr.name                   AS "doctorName",
        c.last_visit              AS "lastVisit",
        c.encounters,
        c.status,
        c.created_at              AS "createdAt",
        c.updated_at              AS "updatedAt"
      FROM clinical_record c
      LEFT JOIN patient      p  ON p.id = c.patient_id
      LEFT JOIN professional pr ON pr.id = c.professional_id
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
      if (d.soapSource           !== undefined) cols.soap_source            = d.soapSource;
      if (d.professionalId       !== undefined) cols.professional_id        = d.professionalId;
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
        professionalId:       r.professionalId     ?? r.professional_id ?? null,
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
        doctorName:           r.doctorName          ?? null,
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
        soapSource:           r.soapSource           ?? r.soap_source          ?? null,
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

  // ── Previsiones (lookup — reads from prevision table) ──
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

  // ── Medicos (lookup — reads from professional table) ──
  medicos: {
    table:    'professional',
    orderBy:  'name ASC',
    skipAuth: true,
    toDb(d)  { return {}; },
    fromDb(r) {
      return { id: r.id, nombre: r.name, specialty: r.specialty ?? null, especialidad: r.specialty ?? null };
    }
  },

  // ── User management (admin — reads/edits app_user, never exposes password) ──
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

// ── Key aliases ───────────────────────────────────────────────────────────────
// Maps incoming entity keys to their canonical ENTITY_CONFIG key. Lets each
// clinical specialty use its own module name while sharing one config.
export const KEY_ALIASES = {
  clinicalRecords:     'clinical-records',
  paciente:            'patients',
  'psych-records':     'clinical-records',
  'dental-records':    'clinical-records',
  'kine-records':      'clinical-records',
  'nutrition-records': 'clinical-records',
  'fono-records':      'clinical-records',
  'ot-records':        'clinical-records',
  'matrona-records':   'clinical-records',
  'tecnomed-records':  'clinical-records',
  'psych-sessions':    'appointments',
  'dental-sessions':   'appointments',
};
