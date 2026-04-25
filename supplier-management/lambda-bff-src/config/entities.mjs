export const ENTITY_CONFIG = {

  // ─── Tablas creadas para dairi ────────────────────────────────────────────

  suppliers: {
    table: "supplier",
    toDb(d) {
      const cols = {};
      if (d.name          !== undefined) cols.name           = d.name;
      if (d.code          !== undefined) cols.code           = d.code;
      if (d.email         !== undefined) cols.email          = d.email;
      if (d.phone         !== undefined) cols.phone          = d.phone;
      if (d.category      !== undefined) cols.category       = d.category;
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
        category:      r.category,
        status:        r.status,
        country:       r.country,
        city:          r.city,
        address:       r.address,
        website:       r.website,
        taxId:         r.tax_id,
        contactPerson: r.contact_person,
        rating:        r.rating        !== null ? parseFloat(r.rating)       : null,
        totalOrders:   r.total_orders  !== null ? parseInt(r.total_orders)   : null,
        totalSpent:    r.total_spent   !== null ? parseFloat(r.total_spent)  : null,
        notes:         r.notes,
        tags:          r.tags ?? [],
        createdAt:     r.created_at,
        updatedAt:     r.updated_at
      };
    }
  },

  products: {
    table: "product",
    toDb(d) {
      const cols = {};
      if (d.name        !== undefined) cols.name        = d.name;
      if (d.sku         !== undefined) cols.sku         = d.sku;
      if (d.category    !== undefined) cols.category    = d.category;
      if (d.status      !== undefined) cols.status      = d.status;
      if (d.price       !== undefined) cols.price       = d.price;
      if (d.stock       !== undefined) cols.stock       = d.stock;
      if (d.supplier    !== undefined) cols.supplier    = d.supplier;
      if (d.weight      !== undefined) cols.weight      = d.weight;
      if (d.description !== undefined) cols.description = d.description;
      if (d.tags        !== undefined) cols.tags        = JSON.stringify(d.tags);
      return cols;
    },
    fromDb(r) {
      return {
        id:          r.id,
        name:        r.name,
        sku:         r.sku,
        category:    r.category,
        status:      r.status,
        price:       r.price  !== null ? parseFloat(r.price)  : null,
        stock:       r.stock  !== null ? parseInt(r.stock)    : null,
        supplier:    r.supplier,
        weight:      r.weight !== null ? parseFloat(r.weight) : null,
        description: r.description,
        tags:        r.tags ?? [],
        createdAt:   r.created_at,
        updatedAt:   r.updated_at
      };
    }
  },

  expenses: {
    table: "expense",
    toDb(d) {
      const cols = {};
      if (d.description   !== undefined) cols.description    = d.description;
      if (d.supplier      !== undefined) cols.supplier       = d.supplier;
      if (d.date          !== undefined) cols.date           = d.date;
      if (d.category      !== undefined) cols.category       = d.category;
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
        supplier:      r.supplier,
        date:          r.date,
        category:      r.category,
        amount:        r.amount !== null ? parseFloat(r.amount) : null,
        paymentMethod: r.payment_method,
        status:        r.status,
        receiptNumber: r.receipt_number,
        notes:         r.notes,
        createdAt:     r.created_at,
        updatedAt:     r.updated_at
      };
    }
  },

  // ─── Tablas pre-existentes ────────────────────────────────────────────────

  paciente: {
    table: "paciente",
    hasUpdatedAt: false,
    toDb(d) {
      const cols = {};
      if (d.nombre     !== undefined) cols.nombre     = d.nombre;
      if (d.email      !== undefined) cols.email      = d.email;
      if (d.telefono   !== undefined) cols.telefono   = d.telefono;
      if (d.rut        !== undefined) cols.rut        = d.rut;
      if (d.allergies  !== undefined) cols.allergies  = d.allergies;
      if (d.diagnostic !== undefined) cols.diagnostic = d.diagnostic;
      return cols;
    },
    fromDb(r) {
      return {
        id:         r.id,
        nombre:     r.nombre,
        email:      r.email,
        telefono:   r.telefono,
        rut:        r.rut        ?? null,
        allergies:  r.allergies,
        diagnostic: r.diagnostic,
        createdAt:  r.created_at
      };
    }
  },

  profesionales: {
    table: "profesional",
    hasUpdatedAt: false,
    toDb(d) {
      const cols = {};
      if (d.nombre           !== undefined) cols.nombre              = d.nombre;
      if (d.email            !== undefined) cols.email               = d.email;
      if (d.especialidad     !== undefined) cols.especialidad         = d.especialidad;
      if (d.activo           !== undefined) cols.activo              = d.activo;
      if (d.googleCalendarId !== undefined) cols.google_calendar_id  = d.googleCalendarId;
      if (d.videoconsulta    !== undefined) cols.videoconsulta       = d.videoconsulta;
      if (d.duracionConsulta !== undefined) cols.duracion_consulta   = d.duracionConsulta;
      if (d.diasTrabajo      !== undefined) cols.dias_trabajo        = d.diasTrabajo;
      return cols;
    },
    fromDb(r) {
      return {
        id:               r.id,
        nombre:           r.nombre,
        email:            r.email,
        especialidad:     r.especialidad,
        activo:           r.activo,
        googleCalendarId: r.google_calendar_id,
        videoconsulta:    r.videoconsulta     ?? false,
        duracionConsulta: r.duracion_consulta !== null ? parseInt(r.duracion_consulta) : 45,
        diasTrabajo:      r.dias_trabajo      ?? [1, 2, 3, 4, 5],
        bookingToken:     r.booking_token,
        createdAt:        r.created_at
      };
    }
  },

  appointments: {
    table: "appointment",
    baseQuery: `
      SELECT a.*,
        COALESCE(p.nombre, a.patient_name)   AS resolved_patient_name,
        pr.nombre                             AS professional_name
      FROM appointment a
      LEFT JOIN paciente    p  ON p.id  = a.patient_id
      LEFT JOIN profesional pr ON pr.id = a.professional_id
    `,
    toDb(d) {
      const cols = {};
      if (d.status           !== undefined) cols.status            = d.status;
      if (d.service          !== undefined) cols.service           = d.service;
      if (d.dateTime         !== undefined) cols.date_time         = d.dateTime;
      if (d.previousDateTime !== undefined) cols.previous_date_time = d.previousDateTime;
      if (d.dateTimeRaw      !== undefined) cols.date_time_raw     = d.dateTimeRaw;
      if (d.durationMinutes  !== undefined) cols.duration_minutes  = d.durationMinutes;
      if (d.notes            !== undefined) cols.notes             = d.notes;
      if (d.googleEventId    !== undefined) cols.google_event_id   = d.googleEventId;
      if (d.patientId        !== undefined) cols.patient_id        = d.patientId;
      if (d.professionalId   !== undefined) cols.professional_id   = d.professionalId;
      if (d.modality         !== undefined) cols.modality          = d.modality;
      if (d.meetLink         !== undefined) cols.meet_link         = d.meetLink;
      if (d.patientName      !== undefined) cols.patient_name      = d.patientName;
      if (d.patientEmail     !== undefined) cols.patient_email     = d.patientEmail;
      if (d.patientPhone     !== undefined) cols.patient_phone     = d.patientPhone;
      if (d.reason           !== undefined) cols.reason            = d.reason;
      if (d.confirmCode      !== undefined) cols.confirm_code      = d.confirmCode;
      return cols;
    },
    fromDb(r) {
      return {
        id:               r.id,
        status:           r.status,
        service:          r.service,
        dateTime:         r.date_time,
        previousDateTime: r.previous_date_time,
        dateTimeRaw:      r.date_time_raw,
        durationMinutes:  r.duration_minutes !== null ? parseInt(r.duration_minutes) : null,
        notes:            r.notes,
        googleEventId:    r.google_event_id,
        patientId:        r.patient_id,
        patientName:      r.resolved_patient_name ?? r.patient_name ?? null,
        professionalId:   r.professional_id,
        professionalName: r.professional_name,
        modality:         r.modality          ?? "presencial",
        meetLink:         r.meet_link         ?? null,
        patientEmail:     r.patient_email     ?? null,
        patientPhone:     r.patient_phone     ?? null,
        reason:           r.reason            ?? null,
        confirmCode:      r.confirm_code      ?? null,
        createdAt:        r.created_at,
        updatedAt:        r.updated_at
      };
    }
  },

  historialClinico: {
    table: "historial_clinico",
    hasUpdatedAt: false,
    toDb(d) {
      const cols = {};
      if (d.pacienteId              !== undefined) cols.paciente_id               = d.pacienteId;
      if (d.soapSubjetivo           !== undefined) cols.soap_subjetivo            = d.soapSubjetivo;
      if (d.soapObjetivo            !== undefined) cols.soap_objetivo             = d.soapObjetivo;
      if (d.soapAnalisis            !== undefined) cols.soap_analisis             = d.soapAnalisis;
      if (d.soapPlan                !== undefined) cols.soap_plan                 = d.soapPlan;
      if (d.codigoDiagnostico       !== undefined) cols.codigo_diagnostico        = d.codigoDiagnostico;
      if (d.descripcionDiagnostico  !== undefined) cols.descripcion_diagnostico   = d.descripcionDiagnostico;
      if (d.diagnosticoDiferencial  !== undefined) cols.diagnostico_diferencial   = d.diagnosticoDiferencial;
      if (d.medicacionActual        !== undefined) cols.medicacion_actual         = d.medicacionActual;
      if (d.peso                    !== undefined) cols.peso                      = d.peso;
      if (d.talla                   !== undefined) cols.talla                     = d.talla;
      if (d.imc                     !== undefined) cols.imc                       = d.imc;
      if (d.temperatura             !== undefined) cols.temperatura               = d.temperatura;
      if (d.presionSistolica        !== undefined) cols.presion_sistolica         = d.presionSistolica;
      if (d.presionDiastolica       !== undefined) cols.presion_diastolica        = d.presionDiastolica;
      if (d.frecuenciaCardiaca      !== undefined) cols.frecuencia_cardiaca       = d.frecuenciaCardiaca;
      if (d.frecuenciaRespiratoria  !== undefined) cols.frecuencia_respiratoria   = d.frecuenciaRespiratoria;
      if (d.saturacionO2            !== undefined) cols.saturacion_o2             = d.saturacionO2;
      return cols;
    },
    fromDb(r) {
      return {
        id:                      r.id,
        pacienteId:              r.paciente_id,
        soapSubjetivo:           r.soap_subjetivo,
        soapObjetivo:            r.soap_objetivo,
        soapAnalisis:            r.soap_analisis,
        soapPlan:                r.soap_plan,
        codigoDiagnostico:       r.codigo_diagnostico,
        descripcionDiagnostico:  r.descripcion_diagnostico,
        diagnosticoDiferencial:  r.diagnostico_diferencial,
        medicacionActual:        r.medicacion_actual,
        peso:                    r.peso                   !== null ? parseFloat(r.peso)                   : null,
        talla:                   r.talla                  !== null ? parseFloat(r.talla)                  : null,
        imc:                     r.imc                    !== null ? parseFloat(r.imc)                    : null,
        temperatura:             r.temperatura            !== null ? parseFloat(r.temperatura)            : null,
        presionSistolica:        r.presion_sistolica      !== null ? parseInt(r.presion_sistolica)        : null,
        presionDiastolica:       r.presion_diastolica     !== null ? parseInt(r.presion_diastolica)       : null,
        frecuenciaCardiaca:      r.frecuencia_cardiaca    !== null ? parseInt(r.frecuencia_cardiaca)      : null,
        frecuenciaRespiratoria:  r.frecuencia_respiratoria !== null ? parseInt(r.frecuencia_respiratoria) : null,
        saturacionO2:            r.saturacion_o2          !== null ? parseInt(r.saturacion_o2)            : null,
        createdAt:               r.created_at
      };
    }
  },

  appUsers: {
    table: "app_user",
    hasUpdatedAt: false,
    toDb(d) {
      const cols = {};
      if (d.name     !== undefined) cols.name     = d.name;
      if (d.email    !== undefined) cols.email    = d.email;
      if (d.password !== undefined) cols.password = d.password;
      if (d.role     !== undefined) cols.role     = d.role;
      if (d.avatar   !== undefined) cols.avatar   = d.avatar;
      return cols;
    },
    fromDb(r) {
      return {
        id:     r.id,
        name:   r.name,
        email:  r.email,
        role:   r.role,
        avatar: r.avatar
        // password omitido intencionalmente
      };
    }
  },

  "clinical-records": {
    table: "ficha_clinica",
    baseQuery: `
      SELECT fc.*,
        p.nombre  AS patient_name,
        pr.nombre AS doctor_name
      FROM ficha_clinica fc
      LEFT JOIN paciente    p  ON p.id  = fc.patient_code
      LEFT JOIN profesional pr ON pr.id = fc.doctor
    `,
    toDb(d) {
      const cols = {};
      if (d.fullName             !== undefined) cols.full_name             = d.fullName;
      if (d.patientId            !== undefined) cols.patient_code          = d.patientId;
      if (d.rut                  !== undefined) cols.rut                   = d.rut;
      if (d.birthDate            !== undefined) cols.birth_date            = d.birthDate;
      if (d.age                  !== undefined) cols.age                   = d.age;
      if (d.gender               !== undefined) cols.gender                = d.gender;
      if (d.bloodType            !== undefined) cols.blood_type            = d.bloodType;
      if (d.insurance            !== undefined) cols.insurance             = d.insurance;
      if (d.phone                !== undefined) cols.phone                 = d.phone;
      if (d.email                !== undefined) cols.email                 = d.email;
      if (d.address              !== undefined) cols.address               = d.address;
      if (d.emergencyContact     !== undefined) cols.emergency_contact     = d.emergencyContact;
      if (d.status               !== undefined) cols.status                = d.status;
      if (d.doctor               !== undefined) cols.doctor                = d.doctor;
      if (d.allergies            !== undefined) cols.allergies             = JSON.stringify(d.allergies);
      if (d.contraindications    !== undefined) cols.contraindications     = d.contraindications;
      if (d.alertNotes           !== undefined) cols.alert_notes           = d.alertNotes;
      if (d.bp                   !== undefined) cols.bp                    = d.bp;
      if (d.heartRate            !== undefined) cols.heart_rate            = d.heartRate;
      if (d.temperature          !== undefined) cols.temperature           = d.temperature;
      if (d.o2Saturation         !== undefined) cols.o2_saturation         = d.o2Saturation;
      if (d.weight               !== undefined) cols.weight                = d.weight;
      if (d.height               !== undefined) cols.height                = d.height;
      if (d.bmi                  !== undefined) cols.bmi                   = d.bmi;
      if (d.respiratoryRate      !== undefined) cols.respiratory_rate      = d.respiratoryRate;
      if (d.personalHistory      !== undefined) cols.personal_history      = d.personalHistory;
      if (d.familyHistory        !== undefined) cols.family_history        = d.familyHistory;
      if (d.habits               !== undefined) cols.habits                = d.habits;
      if (d.surgicalHistory      !== undefined) cols.surgical_history      = d.surgicalHistory;
      if (d.plannedInterventions !== undefined) cols.planned_interventions = d.plannedInterventions;
      if (d.currentMedications   !== undefined) cols.current_medications   = d.currentMedications;
      if (d.chronicConditions    !== undefined) cols.chronic_conditions    = JSON.stringify(d.chronicConditions);
      if (d.diagnosisCode        !== undefined) cols.diagnosis_code        = d.diagnosisCode;
      if (d.diagnosisLabel       !== undefined) cols.diagnosis_label       = d.diagnosisLabel;
      if (d.differentialDx       !== undefined) cols.differential_dx       = d.differentialDx;
      if (d.soapSubjective       !== undefined) cols.soap_subjective       = d.soapSubjective;
      if (d.soapObjective        !== undefined) cols.soap_objective        = d.soapObjective;
      if (d.soapAssessment       !== undefined) cols.soap_assessment       = d.soapAssessment;
      if (d.soapPlan             !== undefined) cols.soap_plan             = d.soapPlan;
      if (d.encounters           !== undefined) cols.encounters            = JSON.stringify(d.encounters);
      if (d.lastVisit            !== undefined) cols.last_visit            = d.lastVisit;
      return cols;
    },
    fromDb(r) {
      return {
        id:                   r.id,
        fullName:             r.full_name,
        patientId:            r.patient_code,
        patientName:          r.patient_name,
        rut:                  r.rut,
        birthDate:            r.birth_date,
        age:                  r.age,
        gender:               r.gender,
        bloodType:            r.blood_type,
        insurance:            r.insurance,
        phone:                r.phone,
        email:                r.email,
        address:              r.address               ?? null,
        emergencyContact:     r.emergency_contact     ?? null,
        status:               r.status,
        doctor:               r.doctor,
        doctorName:           r.doctor_name,
        lastVisit:            r.last_visit,
        allergies:            r.allergies             ?? [],
        contraindications:    r.contraindications     ?? null,
        alertNotes:           r.alert_notes           ?? null,
        bp:                   r.bp,
        heartRate:            r.heart_rate            !== null ? parseInt(r.heart_rate)          : null,
        temperature:          r.temperature           !== null ? parseFloat(r.temperature)       : null,
        o2Saturation:         r.o2_saturation         !== null ? parseFloat(r.o2_saturation)     : null,
        weight:               r.weight                !== null ? parseFloat(r.weight)            : null,
        height:               r.height                !== null ? parseFloat(r.height)            : null,
        bmi:                  r.bmi                   !== null ? parseFloat(r.bmi)               : null,
        respiratoryRate:      r.respiratory_rate      !== null ? parseFloat(r.respiratory_rate)  : null,
        personalHistory:      r.personal_history      ?? null,
        familyHistory:        r.family_history        ?? null,
        habits:               r.habits                ?? null,
        surgicalHistory:      r.surgical_history      ?? null,
        plannedInterventions: r.planned_interventions ?? null,
        currentMedications:   r.current_medications   ?? null,
        chronicConditions:    r.chronic_conditions    ?? [],
        diagnosisCode:        r.diagnosis_code        ?? null,
        diagnosisLabel:       r.diagnosis_label       ?? null,
        differentialDx:       r.differential_dx       ?? null,
        soapSubjective:       r.soap_subjective       ?? null,
        soapObjective:        r.soap_objective        ?? null,
        soapAssessment:       r.soap_assessment       ?? null,
        soapPlan:             r.soap_plan             ?? null,
        encounters:           r.encounters            ?? [],
        createdAt:            r.created_at,
        updatedAt:            r.updated_at
      };
    }
  },
  payments: {
    table: "payment",
    toDb(d) {
      const cols = {};
      if (d.patientName       !== undefined) cols.patient_name       = d.patientName;
      if (d.invoiceNumber     !== undefined) cols.invoice_number     = d.invoiceNumber;
      if (d.date              !== undefined) cols.date               = d.date;
      if (d.concept           !== undefined) cols.concept            = d.concept;
      if (d.amount            !== undefined) cols.amount             = d.amount;
      if (d.paymentMethod     !== undefined) cols.payment_method     = d.paymentMethod;
      if (d.status            !== undefined) cols.status             = d.status;
      if (d.notes             !== undefined) cols.notes              = d.notes;
      if (d.professionalName  !== undefined) cols.professional_name  = d.professionalName;
      if (d.commissionRate    !== undefined) cols.commission_rate    = d.commissionRate;
      if (d.commissionAmount  !== undefined) cols.commission_amount  = d.commissionAmount;
      if (d.commissionStatus  !== undefined) cols.commission_status  = d.commissionStatus;
      return cols;
    },
    fromDb(r) {
      return {
        id:               r.id,
        patientName:      r.patient_name,
        invoiceNumber:    r.invoice_number,
        date:             r.date,
        concept:          r.concept,
        amount:           r.amount           !== null ? parseFloat(r.amount)           : null,
        paymentMethod:    r.payment_method,
        status:           r.status,
        notes:            r.notes,
        professionalName: r.professional_name ?? null,
        commissionRate:   r.commission_rate   !== null ? parseFloat(r.commission_rate)  : null,
        commissionAmount: r.commission_amount !== null ? parseFloat(r.commission_amount): null,
        commissionStatus: r.commission_status ?? null,
        createdAt:        r.created_at,
        updatedAt:        r.updated_at
      };
    }
  },

  "psych-sessions": {
    table: "psych_session",
    toDb(d) {
      const cols = {};
      if (d.title        !== undefined) cols.title         = d.title;
      if (d.patientName  !== undefined) cols.patient_name  = d.patientName;
      if (d.startDate    !== undefined) cols.start_date    = d.startDate;
      if (d.endDate      !== undefined) cols.end_date      = d.endDate;
      if (d.sessionType  !== undefined) cols.session_type  = d.sessionType;
      if (d.status       !== undefined) cols.status        = d.status;
      if (d.patientEmail !== undefined) cols.patient_email = d.patientEmail;
      if (d.room         !== undefined) cols.room          = d.room;
      if (d.notes        !== undefined) cols.notes         = d.notes;
      return cols;
    },
    fromDb(r) {
      return {
        id: r.id, title: r.title, patientName: r.patient_name,
        startDate: r.start_date, endDate: r.end_date ?? null,
        sessionType: r.session_type, status: r.status,
        patientEmail: r.patient_email ?? null, room: r.room ?? null,
        notes: r.notes ?? null, createdAt: r.created_at, updatedAt: r.updated_at
      };
    }
  },

  "psych-records": {
    table: "psych_record",
    toDb(d) {
      const cols = {};
      if (d.fullName             !== undefined) cols.full_name             = d.fullName;
      if (d.patientId            !== undefined) cols.patient_id            = d.patientId;
      if (d.rut                  !== undefined) cols.rut                   = d.rut;
      if (d.birthDate            !== undefined) cols.birth_date            = d.birthDate;
      if (d.age                  !== undefined) cols.age                   = d.age;
      if (d.gender               !== undefined) cols.gender                = d.gender;
      if (d.occupation           !== undefined) cols.occupation            = d.occupation;
      if (d.education            !== undefined) cols.education             = d.education;
      if (d.maritalStatus        !== undefined) cols.marital_status        = d.maritalStatus;
      if (d.insurance            !== undefined) cols.insurance             = d.insurance;
      if (d.phone                !== undefined) cols.phone                 = d.phone;
      if (d.email                !== undefined) cols.email                 = d.email;
      if (d.address              !== undefined) cols.address               = d.address;
      if (d.emergencyContact     !== undefined) cols.emergency_contact     = d.emergencyContact;
      if (d.doctor               !== undefined) cols.doctor                = d.doctor;
      if (d.lastVisit            !== undefined) cols.last_visit            = d.lastVisit;
      if (d.status               !== undefined) cols.status                = d.status;
      if (d.allergies            !== undefined) cols.allergies             = JSON.stringify(d.allergies);
      if (d.contraindications    !== undefined) cols.contraindications     = d.contraindications;
      if (d.alertNotes           !== undefined) cols.alert_notes           = d.alertNotes;
      if (d.bp                   !== undefined) cols.bp                    = d.bp;
      if (d.heartRate            !== undefined) cols.heart_rate            = d.heartRate;
      if (d.temperature          !== undefined) cols.temperature           = d.temperature;
      if (d.o2Saturation         !== undefined) cols.o2_saturation         = d.o2Saturation;
      if (d.weight               !== undefined) cols.weight                = d.weight;
      if (d.height               !== undefined) cols.height                = d.height;
      if (d.bmi                  !== undefined) cols.bmi                   = d.bmi;
      if (d.respiratoryRate      !== undefined) cols.respiratory_rate      = d.respiratoryRate;
      if (d.personalHistory      !== undefined) cols.personal_history      = d.personalHistory;
      if (d.familyHistory        !== undefined) cols.family_history        = d.familyHistory;
      if (d.habits               !== undefined) cols.habits                = d.habits;
      if (d.surgicalHistory      !== undefined) cols.surgical_history      = d.surgicalHistory;
      if (d.plannedInterventions !== undefined) cols.planned_interventions = d.plannedInterventions;
      if (d.currentMedications   !== undefined) cols.current_medications   = d.currentMedications;
      if (d.chronicConditions    !== undefined) cols.chronic_conditions    = JSON.stringify(d.chronicConditions);
      if (d.diagnosisCode        !== undefined) cols.diagnosis_code        = d.diagnosisCode;
      if (d.diagnosisLabel       !== undefined) cols.diagnosis_label       = d.diagnosisLabel;
      if (d.differentialDx       !== undefined) cols.differential_dx       = d.differentialDx;
      if (d.soapSubjective       !== undefined) cols.soap_subjective       = d.soapSubjective;
      if (d.soapObjective        !== undefined) cols.soap_objective        = d.soapObjective;
      if (d.soapAssessment       !== undefined) cols.soap_assessment       = d.soapAssessment;
      if (d.soapPlan             !== undefined) cols.soap_plan             = d.soapPlan;
      if (d.encounters           !== undefined) cols.encounters            = JSON.stringify(d.encounters);
      return cols;
    },
    fromDb(r) {
      return {
        id: r.id, fullName: r.full_name, patientId: r.patient_id, rut: r.rut,
        birthDate: r.birth_date, age: r.age, gender: r.gender,
        occupation: r.occupation ?? null, education: r.education ?? null,
        maritalStatus: r.marital_status ?? null, insurance: r.insurance,
        phone: r.phone, email: r.email ?? null, address: r.address ?? null,
        emergencyContact: r.emergency_contact ?? null, doctor: r.doctor,
        lastVisit: r.last_visit ?? null, status: r.status,
        allergies: r.allergies ?? [], contraindications: r.contraindications ?? null,
        alertNotes: r.alert_notes ?? null,
        bp: r.bp ?? null, heartRate: r.heart_rate ?? null, temperature: r.temperature ?? null,
        o2Saturation: r.o2_saturation ?? null, weight: r.weight ?? null,
        height: r.height ?? null, bmi: r.bmi ?? null, respiratoryRate: r.respiratory_rate ?? null,
        personalHistory: r.personal_history ?? null, familyHistory: r.family_history ?? null,
        habits: r.habits ?? null, surgicalHistory: r.surgical_history ?? null,
        plannedInterventions: r.planned_interventions ?? null,
        currentMedications: r.current_medications ?? null,
        chronicConditions: r.chronic_conditions ?? [],
        diagnosisCode: r.diagnosis_code ?? null, diagnosisLabel: r.diagnosis_label ?? null,
        differentialDx: r.differential_dx ?? null,
        soapSubjective: r.soap_subjective ?? null, soapObjective: r.soap_objective ?? null,
        soapAssessment: r.soap_assessment ?? null, soapPlan: r.soap_plan ?? null,
        encounters: r.encounters ?? [],
        createdAt: r.created_at, updatedAt: r.updated_at
      };
    }
  },

  "dental-sessions": {
    table: "dental_session",
    toDb(d) {
      const cols = {};
      if (d.title         !== undefined) cols.title          = d.title;
      if (d.patientName   !== undefined) cols.patient_name   = d.patientName;
      if (d.startDate     !== undefined) cols.start_date     = d.startDate;
      if (d.endDate       !== undefined) cols.end_date       = d.endDate;
      if (d.treatmentType !== undefined) cols.treatment_type = d.treatmentType;
      if (d.status        !== undefined) cols.status         = d.status;
      if (d.patientEmail  !== undefined) cols.patient_email  = d.patientEmail;
      if (d.chair         !== undefined) cols.chair          = d.chair;
      if (d.notes         !== undefined) cols.notes          = d.notes;
      return cols;
    },
    fromDb(r) {
      return {
        id: r.id, title: r.title, patientName: r.patient_name,
        startDate: r.start_date, endDate: r.end_date ?? null,
        treatmentType: r.treatment_type, status: r.status,
        patientEmail: r.patient_email ?? null, chair: r.chair ?? null,
        notes: r.notes ?? null, createdAt: r.created_at, updatedAt: r.updated_at
      };
    }
  },

  "dental-records": {
    table: "dental_record",
    toDb(d) {
      const cols = {};
      if (d.fullName             !== undefined) cols.full_name             = d.fullName;
      if (d.patientId            !== undefined) cols.patient_id            = d.patientId;
      if (d.rut                  !== undefined) cols.rut                   = d.rut;
      if (d.birthDate            !== undefined) cols.birth_date            = d.birthDate;
      if (d.age                  !== undefined) cols.age                   = d.age;
      if (d.gender               !== undefined) cols.gender                = d.gender;
      if (d.insurance            !== undefined) cols.insurance             = d.insurance;
      if (d.phone                !== undefined) cols.phone                 = d.phone;
      if (d.email                !== undefined) cols.email                 = d.email;
      if (d.doctor               !== undefined) cols.doctor                = d.doctor;
      if (d.lastVisit            !== undefined) cols.last_visit            = d.lastVisit;
      if (d.status               !== undefined) cols.status                = d.status;
      if (d.allergies            !== undefined) cols.allergies             = JSON.stringify(d.allergies);
      if (d.contraindications    !== undefined) cols.contraindications     = d.contraindications;
      if (d.alertNotes           !== undefined) cols.alert_notes           = d.alertNotes;
      if (d.bp                   !== undefined) cols.bp                    = d.bp;
      if (d.heartRate            !== undefined) cols.heart_rate            = d.heartRate;
      if (d.temperature          !== undefined) cols.temperature           = d.temperature;
      if (d.o2Saturation         !== undefined) cols.o2_saturation         = d.o2Saturation;
      if (d.weight               !== undefined) cols.weight                = d.weight;
      if (d.height               !== undefined) cols.height                = d.height;
      if (d.bmi                  !== undefined) cols.bmi                   = d.bmi;
      if (d.respiratoryRate      !== undefined) cols.respiratory_rate      = d.respiratoryRate;
      if (d.personalHistory      !== undefined) cols.personal_history      = d.personalHistory;
      if (d.familyHistory        !== undefined) cols.family_history        = d.familyHistory;
      if (d.habits               !== undefined) cols.habits                = d.habits;
      if (d.surgicalHistory      !== undefined) cols.surgical_history      = d.surgicalHistory;
      if (d.plannedInterventions !== undefined) cols.planned_interventions = d.plannedInterventions;
      if (d.currentMedications   !== undefined) cols.current_medications   = d.currentMedications;
      if (d.chronicConditions    !== undefined) cols.chronic_conditions    = JSON.stringify(d.chronicConditions);
      if (d.diagnosisCode        !== undefined) cols.diagnosis_code        = d.diagnosisCode;
      if (d.diagnosisLabel       !== undefined) cols.diagnosis_label       = d.diagnosisLabel;
      if (d.differentialDx       !== undefined) cols.differential_dx       = d.differentialDx;
      if (d.soapSubjective       !== undefined) cols.soap_subjective       = d.soapSubjective;
      if (d.soapObjective        !== undefined) cols.soap_objective        = d.soapObjective;
      if (d.soapAssessment       !== undefined) cols.soap_assessment       = d.soapAssessment;
      if (d.soapPlan             !== undefined) cols.soap_plan             = d.soapPlan;
      if (d.encounters           !== undefined) cols.encounters            = JSON.stringify(d.encounters);
      return cols;
    },
    fromDb(r) {
      return {
        id: r.id, fullName: r.full_name, patientId: r.patient_id, rut: r.rut,
        birthDate: r.birth_date, age: r.age, gender: r.gender, insurance: r.insurance,
        phone: r.phone, email: r.email ?? null, doctor: r.doctor,
        lastVisit: r.last_visit ?? null, status: r.status,
        allergies: r.allergies ?? [], contraindications: r.contraindications ?? null,
        alertNotes: r.alert_notes ?? null,
        bp: r.bp ?? null, heartRate: r.heart_rate ?? null, temperature: r.temperature ?? null,
        o2Saturation: r.o2_saturation ?? null, weight: r.weight ?? null,
        height: r.height ?? null, bmi: r.bmi ?? null, respiratoryRate: r.respiratory_rate ?? null,
        personalHistory: r.personal_history ?? null, familyHistory: r.family_history ?? null,
        habits: r.habits ?? null, surgicalHistory: r.surgical_history ?? null,
        plannedInterventions: r.planned_interventions ?? null,
        currentMedications: r.current_medications ?? null,
        chronicConditions: r.chronic_conditions ?? [],
        diagnosisCode: r.diagnosis_code ?? null, diagnosisLabel: r.diagnosis_label ?? null,
        differentialDx: r.differential_dx ?? null,
        soapSubjective: r.soap_subjective ?? null, soapObjective: r.soap_objective ?? null,
        soapAssessment: r.soap_assessment ?? null, soapPlan: r.soap_plan ?? null,
        encounters: r.encounters ?? [],
        createdAt: r.created_at, updatedAt: r.updated_at
      };
    }
  },

  appSchemas: {
    table: "app_schema",
    hasUpdatedAt: false,
    toDb(d) {
      const cols = {};
      if (d.schemaKey  !== undefined) cols.schemakey  = d.schemaKey;
      if (d.singular   !== undefined) cols.singular   = d.singular;
      if (d.plural     !== undefined) cols.plural     = d.plural;
      if (d.moduleType !== undefined) cols.moduletype = d.moduleType;
      if (d.icon       !== undefined) cols.icon       = d.icon;
      return cols;
    },
    fromDb(r) {
      return {
        id:         r.id,
        schemaKey:  r.schemakey,
        singular:   r.singular,
        plural:     r.plural,
        moduleType: r.moduletype,
        icon:       r.icon
      };
    }
  },

};

