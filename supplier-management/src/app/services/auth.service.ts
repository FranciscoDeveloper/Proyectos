import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { LoginCredentials, AuthResponse, AuthState, AuthUser } from '../models/auth.model';
import { EntitySchema } from '../models/entity-schema.model';

// ─── Mock schema definitions (same data as SchemaService) ────────────────────
// Kept inline so they can be composed per-role in the mock backend response.

const SCHEMA_SUPPLIERS: EntitySchema = {
  entity: { key: 'suppliers', singular: 'Proveedor', plural: 'Proveedores', icon: 'users', description: 'Gestión de proveedores y socios comerciales' },
  fields: [
    { name: 'name',          type: 'text',     label: 'Nombre',            required: true,  isTitle: true,    showInList: true,  showInDetail: true,  sortable: true,  filterable: true,  filterType: 'search', minLength: 2, maxLength: 100 },
    { name: 'code',          type: 'text',     label: 'Código',            required: true,  isSubtitle: true, showInList: true,  showInDetail: true,  sortable: true,  pattern: '^[A-Z]{2}-\\d{3,}$', patternMessage: 'Formato: XX-000' },
    { name: 'email',         type: 'email',    label: 'Email',             required: true,                   showInList: false, showInDetail: true },
    { name: 'phone',         type: 'tel',      label: 'Teléfono',          required: true,                   showInList: false, showInDetail: true },
    { name: 'category',      type: 'select',   label: 'Categoría',         required: true,  isBadge: true,    showInList: true,  showInDetail: true,  sortable: true,  filterable: true,  filterType: 'select',
      options: [
        { value: 'technology',    label: 'Tecnología'      },
        { value: 'manufacturing', label: 'Manufactura'     },
        { value: 'logistics',     label: 'Logística'       },
        { value: 'services',      label: 'Servicios'       },
        { value: 'raw-materials', label: 'Materias Primas' },
        { value: 'food-beverage', label: 'Alimentos'       },
        { value: 'healthcare',    label: 'Salud'           },
        { value: 'construction',  label: 'Construcción'    }
      ],
      badgeColors: { technology: '#6366f1', manufacturing: '#f59e0b', logistics: '#3b82f6', services: '#10b981', 'raw-materials': '#8b5cf6', 'food-beverage': '#ec4899', healthcare: '#14b8a6', construction: '#f97316' }
    },
    { name: 'status',        type: 'select',   label: 'Estado',            required: true,  isBadge: true,    showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      options: [{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }, { value: 'pending', label: 'Pendiente' }, { value: 'blacklisted', label: 'Bloqueado' }],
      badgeColors: { active: '#10b981', inactive: '#6b7280', pending: '#f59e0b', blacklisted: '#ef4444' }
    },
    { name: 'country',       type: 'text',     label: 'País',              required: true,                   showInList: true,  showInDetail: true,  sortable: true,  filterable: true,  filterType: 'select' },
    { name: 'city',          type: 'text',     label: 'Ciudad',            required: true,                   showInList: false, showInDetail: true },
    { name: 'address',       type: 'text',     label: 'Dirección',         required: true,                   showInList: false, showInDetail: true },
    { name: 'website',       type: 'url',      label: 'Sitio Web',                                           showInList: false, showInDetail: true },
    { name: 'taxId',         type: 'text',     label: 'ID Fiscal',         required: true,                   showInList: false, showInDetail: true },
    { name: 'contactPerson', type: 'text',     label: 'Contacto',          required: true,                   showInList: true,  showInDetail: true },
    { name: 'rating',        type: 'range',    label: 'Calificación',      required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 1, max: 5, step: 0.1, format: 'stars' },
    { name: 'totalOrders',   type: 'number',   label: 'Total Órdenes',     required: true,                   showInList: false, showInDetail: true,  min: 0 },
    { name: 'totalSpent',    type: 'number',   label: 'Total Gastado',     required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 0, format: 'currency' },
    { name: 'notes',         type: 'textarea', label: 'Notas',                                               showInList: false, showInDetail: true },
    { name: 'tags',          type: 'tags',     label: 'Etiquetas',                                           showInList: false, showInDetail: true }
  ]
};

const SCHEMA_PRODUCTS: EntitySchema = {
  entity: { key: 'products', singular: 'Producto', plural: 'Productos', icon: 'package', description: 'Catálogo de productos e inventario' },
  fields: [
    { name: 'name',        type: 'text',     label: 'Nombre del Producto', required: true,  isTitle: true,    showInList: true,  showInDetail: true,  sortable: true,  filterable: true, filterType: 'search', minLength: 2 },
    { name: 'sku',         type: 'text',     label: 'SKU',                 required: true,  isSubtitle: true, showInList: true,  showInDetail: true,  sortable: true,  pattern: '^[A-Z]{3}-\\d{4}$', patternMessage: 'Formato: ABC-0000' },
    { name: 'category',    type: 'select',   label: 'Categoría',           required: true,  isBadge: true,    showInList: true,  showInDetail: true,  sortable: true,  filterable: true, filterType: 'select',
      options: [{ value: 'electronics', label: 'Electrónica' }, { value: 'clothing', label: 'Ropa' }, { value: 'food', label: 'Alimentos' }, { value: 'tools', label: 'Herramientas' }, { value: 'furniture', label: 'Muebles' }, { value: 'books', label: 'Libros' }],
      badgeColors: { electronics: '#6366f1', clothing: '#ec4899', food: '#10b981', tools: '#f59e0b', furniture: '#8b5cf6', books: '#3b82f6' }
    },
    { name: 'status',      type: 'select',   label: 'Estado',              required: true,  isBadge: true,    showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      options: [{ value: 'available', label: 'Disponible' }, { value: 'low_stock', label: 'Stock Bajo' }, { value: 'out_of_stock', label: 'Sin Stock' }, { value: 'discontinued', label: 'Descontinuado' }],
      badgeColors: { available: '#10b981', low_stock: '#f59e0b', out_of_stock: '#ef4444', discontinued: '#6b7280' }
    },
    { name: 'price',       type: 'number',   label: 'Precio',              required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 0, format: 'currency' },
    { name: 'stock',       type: 'number',   label: 'Stock',               required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 0 },
    { name: 'supplier',    type: 'text',     label: 'Proveedor',           required: true,                   showInList: true,  showInDetail: true,  filterable: true, filterType: 'search' },
    { name: 'weight',      type: 'number',   label: 'Peso (kg)',                                             showInList: false, showInDetail: true,  min: 0 },
    { name: 'description', type: 'textarea', label: 'Descripción',                                          showInList: false, showInDetail: true },
    { name: 'tags',        type: 'tags',     label: 'Etiquetas',                                             showInList: false, showInDetail: true }
  ]
};

const SCHEMA_APPOINTMENTS: EntitySchema = {
  entity: {
    key: 'appointments',
    singular: 'Cita',
    plural: 'Citas',
    icon: 'calendar',
    moduleType: 'calendar',
    description: 'Agenda de citas y consultas médicas'
  },
  fields: [
    { name: 'title',       type: 'text',     label: 'Motivo de consulta', required: true,  isTitle: true,        showInList: true,  showInDetail: true,  filterable: true, filterType: 'search', minLength: 2 },
    { name: 'patientName', type: 'text',     label: 'Paciente',           required: true,  isSubtitle: true,     showInList: true,  showInDetail: true,  filterable: true, filterType: 'search' },
    { name: 'startDate',   type: 'datetime', label: 'Fecha y hora',       required: true,  isCalendarStart: true, showInList: true, showInDetail: true,  sortable: true },
    { name: 'endDate',     type: 'datetime', label: 'Fin',                required: false, isCalendarEnd: true,  showInList: false, showInDetail: true },
    { name: 'status',      type: 'select',   label: 'Estado',             required: true,  isBadge: true,        showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      options: [
        { value: 'scheduled',  label: 'Programada'  },
        { value: 'completed',  label: 'Completada'  },
        { value: 'cancelled',  label: 'Cancelada'   },
        { value: 'no_show',    label: 'No asistió'  }
      ],
      badgeColors: { scheduled: '#3b82f6', completed: '#10b981', cancelled: '#ef4444', no_show: '#f59e0b' }
    },
    { name: 'room',        type: 'text',     label: 'Consultorio',        required: false,                       showInList: true,  showInDetail: true },
    { name: 'notes',       type: 'textarea', label: 'Notas',              required: false,                       showInList: false, showInDetail: true }
  ]
};

const SCHEMA_PATIENTS: EntitySchema = {
  entity: { key: 'patients', singular: 'Paciente', plural: 'Pacientes', icon: 'heart', description: 'Registro y seguimiento de pacientes' },
  fields: [
    { name: 'fullName',      type: 'text',     label: 'Nombre Completo',   required: true,  isTitle: true,    showInList: true,  showInDetail: true,  sortable: true,  filterable: true, filterType: 'search', minLength: 3 },
    { name: 'patientId',     type: 'text',     label: 'ID Paciente',       required: true,  isSubtitle: true, showInList: true,  showInDetail: true,  sortable: true,  pattern: '^PAC-\\d{5}$', patternMessage: 'Formato: PAC-00000' },
    { name: 'status',        type: 'select',   label: 'Estado',            required: true,  isBadge: true,    showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      options: [{ value: 'active', label: 'Activo' }, { value: 'discharged', label: 'Alta' }, { value: 'critical', label: 'Crítico' }, { value: 'scheduled', label: 'Programado' }],
      badgeColors: { active: '#10b981', discharged: '#6b7280', critical: '#ef4444', scheduled: '#3b82f6' }
    },
    { name: 'age',           type: 'number',   label: 'Edad',              required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 0, max: 150 },
    { name: 'gender',        type: 'select',   label: 'Género',            required: true,                   showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'bloodType',     type: 'select',   label: 'Tipo de Sangre',    required: true,  isBadge: true,    showInList: true,  showInDetail: true,
      options: [{ value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' }, { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' }, { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' }, { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' }],
      badgeColors: { 'A+': '#ef4444', 'A-': '#f97316', 'B+': '#3b82f6', 'B-': '#6366f1', 'O+': '#10b981', 'O-': '#14b8a6', 'AB+': '#8b5cf6', 'AB-': '#ec4899' }
    },
    { name: 'phone',         type: 'tel',      label: 'Teléfono',          required: true,                   showInList: false, showInDetail: true },
    { name: 'email',         type: 'email',    label: 'Email',                                               showInList: false, showInDetail: true },
    { name: 'doctor',        type: 'text',     label: 'Médico Asignado',   required: true,                   showInList: true,  showInDetail: true,  filterable: true, filterType: 'search' },
    { name: 'admissionDate', type: 'date',     label: 'Fecha de Ingreso',  required: true,                   showInList: true,  showInDetail: true,  sortable: true,  format: 'date' },
    { name: 'diagnosis',     type: 'textarea', label: 'Diagnóstico',       required: true,                   showInList: false, showInDetail: true },
    { name: 'allergies',     type: 'tags',     label: 'Alergias',                                            showInList: false, showInDetail: true }
  ]
};

const SCHEMA_CLINICAL_RECORDS: EntitySchema = {
  entity: {
    key: 'clinical-records',
    singular: 'Ficha Clínica',
    plural: 'Fichas Clínicas',
    icon: 'clipboard',
    moduleType: 'clinical-record',
    description: 'Fichas clínicas y registros médicos de pacientes'
  },
  fields: [
    // ── Demographics ──────────────────────────────────────────────────────
    { name: 'fullName',       type: 'text',     label: 'Nombre Completo',     required: true,  isTitle: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', sortable: true },
    { name: 'patientId',      type: 'text',     label: 'ID Paciente',         required: true,  isSubtitle: true,  showInList: true,  showInDetail: true,  section: 'demographics', pattern: '^PAC-\\d{5}$', patternMessage: 'Formato: PAC-00000' },
    { name: 'rut',            type: 'text',     label: 'RUT',                 required: true,                    showInList: false, showInDetail: true,  section: 'demographics' },
    { name: 'birthDate',      type: 'date',     label: 'Fecha de Nacimiento', required: true,                    showInList: false, showInDetail: true,  section: 'demographics', format: 'date' },
    { name: 'age',            type: 'number',   label: 'Edad',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, min: 0, max: 150 },
    { name: 'gender',         type: 'select',   label: 'Sexo',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'bloodType',      type: 'select',   label: 'Grupo Sanguíneo',     required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics',
      options: [{ value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' }, { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' }, { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' }, { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' }],
      badgeColors: { 'A+': '#ef4444', 'A-': '#f97316', 'B+': '#3b82f6', 'B-': '#6366f1', 'O+': '#10b981', 'O-': '#14b8a6', 'AB+': '#8b5cf6', 'AB-': '#ec4899' }
    },
    { name: 'insurance',      type: 'select',   label: 'Previsión',           required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [
        { value: 'fonasa_a', label: 'FONASA A' }, { value: 'fonasa_b', label: 'FONASA B' },
        { value: 'fonasa_c', label: 'FONASA C' }, { value: 'fonasa_d', label: 'FONASA D' },
        { value: 'isapre',   label: 'ISAPRE'   }, { value: 'particular', label: 'Particular' }
      ],
      badgeColors: { fonasa_a: '#6b7280', fonasa_b: '#3b82f6', fonasa_c: '#10b981', fonasa_d: '#8b5cf6', isapre: '#f59e0b', particular: '#ec4899' }
    },
    { name: 'phone',          type: 'tel',      label: 'Teléfono',            required: true,                    showInList: false, showInDetail: true,  section: 'demographics' },
    { name: 'email',          type: 'email',    label: 'Email',               required: false,                   showInList: false, showInDetail: true,  section: 'demographics' },
    { name: 'address',        type: 'text',     label: 'Dirección',           required: false,                   showInList: false, showInDetail: true,  section: 'demographics' },
    { name: 'emergencyContact', type: 'text',   label: 'Contacto Emergencia', required: false,                   showInList: false, showInDetail: true,  section: 'demographics' },
    { name: 'doctor',         type: 'text',     label: 'Médico Tratante',     required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search' },
    { name: 'lastVisit',      type: 'date',     label: 'Última Consulta',     required: false,                   showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, format: 'date' },
    { name: 'status',         type: 'select',   label: 'Estado',              required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [{ value: 'active', label: 'Activo' }, { value: 'discharged', label: 'Alta' }, { value: 'critical', label: 'Crítico' }, { value: 'scheduled', label: 'Programado' }],
      badgeColors: { active: '#10b981', discharged: '#6b7280', critical: '#ef4444', scheduled: '#3b82f6' }
    },

    // ── Alerts (allergies + contraindications) ────────────────────────────
    { name: 'allergies',      type: 'tags',     label: 'Alergias',            required: false, isAlert: true,     showInList: false, showInDetail: true,  section: 'alerts' },
    { name: 'contraindications', type: 'textarea', label: 'Contraindicaciones', required: false, isAlert: true,  showInList: false, showInDetail: true,  section: 'alerts' },
    { name: 'alertNotes',     type: 'textarea', label: 'Notas de Alerta',     required: false, isAlert: true,     showInList: false, showInDetail: true,  section: 'alerts' },

    // ── Vital signs ───────────────────────────────────────────────────────
    { name: 'bp',             type: 'text',     label: 'Presión Arterial',    required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', placeholder: '120/80 mmHg' },
    { name: 'heartRate',      type: 'number',   label: 'Frec. Cardíaca',      required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 20, max: 300, placeholder: 'bpm' },
    { name: 'temperature',    type: 'number',   label: 'Temperatura',         required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 30, max: 45, step: 0.1, placeholder: '°C' },
    { name: 'o2Saturation',   type: 'number',   label: 'Saturación O₂',       required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 50, max: 100, placeholder: '%' },
    { name: 'weight',         type: 'number',   label: 'Peso',                required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 0, max: 500, step: 0.1, placeholder: 'kg' },
    { name: 'height',         type: 'number',   label: 'Talla',               required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 0, max: 250, placeholder: 'cm' },
    { name: 'bmi',            type: 'number',   label: 'IMC',                 required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 0, max: 100, step: 0.1, placeholder: 'kg/m²' },
    { name: 'respiratoryRate', type: 'number',  label: 'Frec. Respiratoria',  required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 0, max: 60, placeholder: 'rpm' },

    // ── Medical history ───────────────────────────────────────────────────
    { name: 'personalHistory',  type: 'textarea', label: 'Antecedentes Personales',  required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'familyHistory',    type: 'textarea', label: 'Antecedentes Familiares',  required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'surgicalHistory',  type: 'textarea', label: 'Antecedentes Quirúrgicos', required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'habits',           type: 'textarea', label: 'Hábitos',                  required: false, showInList: false, showInDetail: true, section: 'history', placeholder: 'Tabaco, alcohol, actividad física...' },

    // ── Current medications ───────────────────────────────────────────────
    { name: 'currentMedications', type: 'textarea', label: 'Medicamentos Actuales',  required: false, showInList: false, showInDetail: true, section: 'medications', placeholder: 'Nombre · dosis · frecuencia' },
    { name: 'chronicConditions',  type: 'tags',     label: 'Condiciones Crónicas',   required: false, showInList: false, showInDetail: true, section: 'medications' },

    // ── Diagnosis ─────────────────────────────────────────────────────────
    { name: 'diagnosisCode',   type: 'text',     label: 'Código CIE-10',       required: false,                   showInList: false, showInDetail: true, section: 'diagnosis', placeholder: 'J06.9' },
    { name: 'diagnosisLabel',  type: 'text',     label: 'Diagnóstico',         required: false,                   showInList: false, showInDetail: true, section: 'diagnosis' },
    { name: 'differentialDx',  type: 'textarea', label: 'Diagnóstico Diferencial', required: false,               showInList: false, showInDetail: true, section: 'diagnosis' },

    // ── SOAP note ─────────────────────────────────────────────────────────
    { name: 'soapSubjective',  type: 'textarea', label: 'Subjetivo (S)',        required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Motivo de consulta y síntomas relatados por el paciente' },
    { name: 'soapObjective',   type: 'textarea', label: 'Objetivo (O)',         required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Hallazgos del examen físico y resultados de laboratorio' },
    { name: 'soapAssessment',  type: 'textarea', label: 'Análisis (A)',         required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Interpretación clínica y diagnóstico de trabajo' },
    { name: 'soapPlan',        type: 'textarea', label: 'Plan (P)',             required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Tratamiento, exámenes solicitados, indicaciones y seguimiento' },

    // ── Encounter history (array of visit objects — rendered by clinical-detail) ─
    { name: 'encounters', type: 'object-list', label: 'Historial de Atenciones', required: false, showInList: false, showInDetail: true, section: 'encounters' }
  ]
};

// ─── Mock users + their authorized schemas ────────────────────────────────────

interface MockUser {
  user: AuthUser;
  password: string;
  schemas: EntitySchema[];
}

const MOCK_USERS: MockUser[] = [
  {
    password: 'admin123',
    user: { id: 1, name: 'Admin General', email: 'admin@empresa.com', role: 'admin', avatar: 'AG' },
    schemas: [SCHEMA_SUPPLIERS, SCHEMA_PRODUCTS, SCHEMA_PATIENTS, SCHEMA_APPOINTMENTS, SCHEMA_CLINICAL_RECORDS]
  },
  {
    password: 'compras123',
    user: { id: 2, name: 'Jefe de Compras', email: 'compras@empresa.com', role: 'manager', avatar: 'JC' },
    schemas: [SCHEMA_SUPPLIERS, SCHEMA_PRODUCTS]
  },
  {
    password: 'medico123',
    user: { id: 3, name: 'Dra. Morales', email: 'medico@hospital.com', role: 'manager', avatar: 'DM' },
    schemas: [SCHEMA_PATIENTS, SCHEMA_APPOINTMENTS, SCHEMA_CLINICAL_RECORDS]
  },
  {
    password: 'viewer123',
    user: { id: 4, name: 'Auditor', email: 'auditor@empresa.com', role: 'viewer', avatar: 'AU' },
    schemas: [SCHEMA_SUPPLIERS]
  }
];

const SESSION_KEY = 'auth_session';
/**
 * Increment this whenever the schema structure changes so that any cached
 * session in sessionStorage is invalidated and the user must re-login.
 */
const SESSION_VERSION = 5;

// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _state = signal<AuthState>(this.loadFromStorage());

  readonly user    = computed(() => this._state().user);
  readonly token   = computed(() => this._state().token);
  readonly schemas = computed(() => this._state().schemas);
  readonly isAuthenticated = computed(() => this._state().authenticated);

  constructor(private router: Router) {}

  /**
   * Simulates a POST /api/auth/login call.
   * Returns Observable<AuthResponse> — swap the body for HttpClient in production.
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    const found = MOCK_USERS.find(
      u => u.user.email === credentials.email && u.password === credentials.password
    );

    if (!found) {
      return throwError(() => new Error('Credenciales inválidas. Verifique su email y contraseña.'));
    }

    const response: AuthResponse = {
      token: this.generateToken(found.user),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      user: found.user,
      schemas: found.schemas
    };

    // Synchronous mock response — no async scheduler, no Zone.js dependency.
    // In production replace of(response) with HttpClient.post<AuthResponse>('/api/auth/login', credentials)
    return of(response);
  }

  /**
   * Stores the auth response from the backend and updates the reactive state.
   */
  handleAuthResponse(response: AuthResponse): void {
    const state: AuthState = {
      authenticated: true,
      token: response.token,
      user: response.user,
      schemas: response.schemas
    };
    this._state.set(state);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...state, _v: SESSION_VERSION }));
    } catch { /* storage unavailable (private mode, quota exceeded) */ }
  }

  logout(): void {
    this._state.set({ authenticated: false, token: null, user: null, schemas: [] });
    sessionStorage.removeItem(SESSION_KEY);
    this.router.navigate(['/login']);
  }

  /** Returns the authorized entity schemas — the backend decides what the user can see */
  getAuthorizedSchemas(): EntitySchema[] {
    return this._state().schemas;
  }

  /** Check if user has access to a specific entity key */
  canAccessEntity(key: string): boolean {
    return this._state().schemas.some(s => s.entity.key === key);
  }

  private loadFromStorage(): AuthState {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthState & { _v?: number };
        // Stale session from a previous deploy → force re-login so new schemas apply
        if (parsed._v !== SESSION_VERSION) {
          sessionStorage.removeItem(SESSION_KEY);
          return { authenticated: false, token: null, user: null, schemas: [] };
        }
        return parsed;
      }
    } catch { /* ignore */ }
    return { authenticated: false, token: null, user: null, schemas: [] };
  }

  private generateToken(user: AuthUser): string {
    const payload = btoa(JSON.stringify({ sub: user.id, email: user.email, role: user.role, iat: Date.now() }));
    return `mock.${payload}.signature`;
  }
}
