import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
    description: 'Agenda de citas y consultas médicas',
    encounterEntity: 'clinical-records',
    encounterMatchField: 'patientName'
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
    { name: 'patientEmail', type: 'email',    label: 'Email del paciente', required: false,                       showInList: false, showInDetail: true },
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

export const SCHEMA_CLINICAL_RECORDS: EntitySchema = {
  entity: {
    key: 'clinical-records',
    singular: 'Ficha Clínica',
    plural: 'Fichas Clínicas',
    icon: 'clipboard',
    moduleType: 'clinical-record',
    description: 'Fichas clínicas y registros médicos de pacientes'
  },
  fields: [
    // ── Demographics (STABLE — do not change between encounters) ─────────
    { name: 'fullName',       type: 'text',     label: 'Nombre Completo',     required: true,  isTitle: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', sortable: true, isStable: true },
    { name: 'patientId',      type: 'text',     label: 'ID Paciente',         required: true,  isSubtitle: true,  showInList: true,  showInDetail: true,  section: 'demographics', pattern: '^PAC-\\d{5}$', patternMessage: 'Formato: PAC-00000', isStable: true },
    { name: 'rut',            type: 'text',     label: 'RUT',                 required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'birthDate',      type: 'date',     label: 'Fecha de Nacimiento', required: true,                    showInList: false, showInDetail: true,  section: 'demographics', format: 'date', isStable: true },
    { name: 'age',            type: 'number',   label: 'Edad',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, min: 0, max: 150, isStable: true },
    { name: 'gender',         type: 'select',   label: 'Sexo',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select', isStable: true,
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'bloodType',      type: 'select',   label: 'Grupo Sanguíneo',     required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', isStable: true,
      options: [{ value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' }, { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' }, { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' }, { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' }],
      badgeColors: { 'A+': '#ef4444', 'A-': '#f97316', 'B+': '#3b82f6', 'B-': '#6366f1', 'O+': '#10b981', 'O-': '#14b8a6', 'AB+': '#8b5cf6', 'AB-': '#ec4899' }
    },
    { name: 'insurance',      type: 'select',   label: 'Previsión',           required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select', isStable: true,
      options: [
        { value: 'fonasa_a', label: 'FONASA A' }, { value: 'fonasa_b', label: 'FONASA B' },
        { value: 'fonasa_c', label: 'FONASA C' }, { value: 'fonasa_d', label: 'FONASA D' },
        { value: 'isapre',   label: 'ISAPRE'   }, { value: 'particular', label: 'Particular' }
      ],
      badgeColors: { fonasa_a: '#6b7280', fonasa_b: '#3b82f6', fonasa_c: '#10b981', fonasa_d: '#8b5cf6', isapre: '#f59e0b', particular: '#ec4899' }
    },
    { name: 'phone',          type: 'tel',      label: 'Teléfono',            required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'email',          type: 'email',    label: 'Email',               required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'address',        type: 'text',     label: 'Dirección',           required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'emergencyContact', type: 'text',   label: 'Contacto Emergencia', required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'doctor',         type: 'text',     label: 'Médico Tratante',     required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', isStable: true },
    { name: 'lastVisit',      type: 'date',     label: 'Última Consulta',     required: false,                   showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, format: 'date' },
    { name: 'status',         type: 'select',   label: 'Estado',              required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [{ value: 'active', label: 'Activo' }, { value: 'discharged', label: 'Alta' }, { value: 'critical', label: 'Crítico' }, { value: 'scheduled', label: 'Programado' }],
      badgeColors: { active: '#10b981', discharged: '#6b7280', critical: '#ef4444', scheduled: '#3b82f6' }
    },

    // ── Alerts ────────────────────────────────────────────────────────────
    { name: 'allergies',      type: 'tags',     label: 'Alergias',            required: false, isAlert: true,     showInList: false, showInDetail: true,  section: 'alerts', isStable: true },
    { name: 'contraindications', type: 'textarea', label: 'Contraindicaciones', required: false, isAlert: true,  showInList: false, showInDetail: true,  section: 'alerts', isStable: true },
    { name: 'alertNotes',     type: 'textarea', label: 'Notas de Alerta',     required: false, isAlert: true,     showInList: false, showInDetail: true,  section: 'alerts' },

    // ── Vital signs (mutable — change each encounter) ─────────────────────
    { name: 'bp',             type: 'text',     label: 'Presión Arterial',    required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', placeholder: '120/80 mmHg' },
    { name: 'heartRate',      type: 'number',   label: 'Frec. Cardíaca',      required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 20, max: 300, placeholder: 'bpm' },
    { name: 'temperature',    type: 'number',   label: 'Temperatura',         required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 30, max: 45, step: 0.1, placeholder: '°C' },
    { name: 'o2Saturation',   type: 'number',   label: 'Saturación O₂',       required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 50, max: 100, placeholder: '%' },
    { name: 'weight',         type: 'number',   label: 'Peso',                required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 0, max: 500, step: 0.1, placeholder: 'kg' },
    { name: 'height',         type: 'number',   label: 'Talla',               required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 0, max: 250, placeholder: 'cm', isStable: true },
    { name: 'bmi',            type: 'number',   label: 'IMC',                 required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 0, max: 100, step: 0.1, placeholder: 'kg/m²' },
    { name: 'respiratoryRate', type: 'number',  label: 'Frec. Respiratoria',  required: false, isVitalSign: true, showInList: false, showInDetail: true,  section: 'vitals', min: 0, max: 60, placeholder: 'rpm' },

    // ── Medical history (STABLE) ──────────────────────────────────────────
    { name: 'personalHistory',  type: 'textarea', label: 'Antecedentes Personales',  required: false, showInList: false, showInDetail: true, section: 'history', isStable: true },
    { name: 'familyHistory',    type: 'textarea', label: 'Antecedentes Familiares',  required: false, showInList: false, showInDetail: true, section: 'history', isStable: true },
    { name: 'habits',           type: 'textarea', label: 'Hábitos',                  required: false, showInList: false, showInDetail: true, section: 'history', placeholder: 'Tabaco, alcohol, actividad física...', isStable: true },

    // ── Surgical (STABLE) ────────────────────────────────────────────────
    { name: 'surgicalHistory',       type: 'textarea', label: 'Cirugías Previas',              required: false, showInList: false, showInDetail: true, section: 'surgical', isSurgical: true, isStable: true },
    { name: 'plannedInterventions',  type: 'textarea', label: 'Intervenciones Programadas',    required: false, showInList: false, showInDetail: true, section: 'surgical', isSurgical: true, isStable: true, placeholder: 'Procedimientos quirúrgicos planificados o pendientes...' },

    // ── Medications / Diagnosis (mutable) ────────────────────────────────
    { name: 'currentMedications', type: 'textarea', label: 'Medicamentos Actuales',  required: false, showInList: false, showInDetail: true, section: 'medications', placeholder: 'Nombre · dosis · frecuencia', isPrescription: true },
    { name: 'chronicConditions',  type: 'tags',     label: 'Condiciones Crónicas',   required: false, showInList: false, showInDetail: true, section: 'medications', isStable: true },
    { name: 'diagnosisCode',   type: 'text',     label: 'Código CIE-10',       required: false,                   showInList: false, showInDetail: true, section: 'diagnosis', placeholder: 'J06.9', isStable: true },
    { name: 'diagnosisLabel',  type: 'text',     label: 'Diagnóstico',         required: false,                   showInList: false, showInDetail: true, section: 'diagnosis', isStable: true },
    { name: 'differentialDx',  type: 'textarea', label: 'Diagnóstico Diferencial', required: false,               showInList: false, showInDetail: true, section: 'diagnosis', isStable: true },

    // ── SOAP note (mutable — per encounter) ──────────────────────────────
    { name: 'soapSubjective',  type: 'textarea', label: 'Subjetivo (S)',        required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Motivo de consulta y síntomas relatados por el paciente' },
    { name: 'soapObjective',   type: 'textarea', label: 'Objetivo (O)',         required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Hallazgos del examen físico y resultados de laboratorio' },
    { name: 'soapAssessment',  type: 'textarea', label: 'Análisis (A)',         required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Interpretación clínica y diagnóstico de trabajo' },
    { name: 'soapPlan',        type: 'textarea', label: 'Plan (P)',             required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Tratamiento, exámenes solicitados, indicaciones y seguimiento' },

    // ── Encounter history ─────────────────────────────────────────────────
    { name: 'encounters', type: 'object-list', label: 'Historial de Atenciones', required: false, showInList: false, showInDetail: true, section: 'encounters' }
  ]
};

// ─────────────────────────── PSYCH SESSIONS (calendar) ───────────────────────
const SCHEMA_PSYCH_SESSIONS: EntitySchema = {
  entity: {
    key: 'psych-sessions',
    singular: 'Sesión',
    plural: 'Sesiones',
    icon: 'calendar',
    moduleType: 'calendar',
    description: 'Agenda de sesiones terapéuticas'
  },
  fields: [
    { name: 'title',       type: 'text',     label: 'Motivo de sesión',  required: true,  isTitle: true,         showInList: true,  showInDetail: true,  filterable: true, filterType: 'search', minLength: 2 },
    { name: 'patientName', type: 'text',     label: 'Paciente',          required: true,  isSubtitle: true,      showInList: true,  showInDetail: true,  filterable: true, filterType: 'search' },
    { name: 'startDate',   type: 'datetime', label: 'Fecha y hora',      required: true,  isCalendarStart: true, showInList: true,  showInDetail: true,  sortable: true },
    { name: 'endDate',     type: 'datetime', label: 'Fin',               required: false, isCalendarEnd: true,   showInList: false, showInDetail: true },
    { name: 'sessionType', type: 'select',   label: 'Tipo de Sesión',    required: true,  isBadge: true,         showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      options: [
        { value: 'individual', label: 'Individual' },
        { value: 'couple',     label: 'Pareja'     },
        { value: 'family',     label: 'Familiar'   },
        { value: 'group',      label: 'Grupal'     },
        { value: 'evaluation', label: 'Evaluación' }
      ],
      badgeColors: { individual: '#6366f1', couple: '#ec4899', family: '#f59e0b', group: '#3b82f6', evaluation: '#8b5cf6' }
    },
    { name: 'status', type: 'select', label: 'Estado', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
      options: [
        { value: 'scheduled', label: 'Programada' },
        { value: 'completed', label: 'Completada' },
        { value: 'cancelled', label: 'Cancelada'  },
        { value: 'no_show',   label: 'No asistió' }
      ],
      badgeColors: { scheduled: '#3b82f6', completed: '#10b981', cancelled: '#ef4444', no_show: '#f59e0b' }
    },
    { name: 'patientEmail', type: 'email', label: 'Email del paciente', required: false, showInList: false, showInDetail: true },
    { name: 'room',  type: 'text',     label: 'Consulta',  required: false, showInList: true,  showInDetail: true },
    { name: 'notes', type: 'textarea', label: 'Notas',     required: false, showInList: false, showInDetail: true }
  ]
};

// ─────────────────────────── PSYCH RECORDS (clinical-record) ─────────────────
export const SCHEMA_PSYCH_RECORDS: EntitySchema = {
  entity: {
    key: 'psych-records',
    singular: 'Ficha Psicológica',
    plural: 'Fichas Psicológicas',
    icon: 'brain',
    moduleType: 'clinical-record',
    description: 'Fichas psicológicas y registros terapéuticos'
  },
  fields: [
    // ── Demographics ─────────────────────────────────────────────────────
    { name: 'fullName',       type: 'text',   label: 'Nombre Completo',     required: true,  isTitle: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', sortable: true },
    { name: 'patientId',      type: 'text',   label: 'ID Paciente',         required: true,  isSubtitle: true,  showInList: true,  showInDetail: true,  section: 'demographics', pattern: '^PSI-\\d{5}$', patternMessage: 'Formato: PSI-00000' },
    { name: 'rut',            type: 'text',   label: 'RUT',                 required: true,                    showInList: false, showInDetail: true,  section: 'demographics' },
    { name: 'birthDate',      type: 'date',   label: 'Fecha de Nacimiento', required: true,                    showInList: false, showInDetail: true,  section: 'demographics', format: 'date' },
    { name: 'age',            type: 'number', label: 'Edad',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, min: 0, max: 150 },
    { name: 'gender',         type: 'select', label: 'Sexo',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'occupation',     type: 'text',   label: 'Ocupación',           required: false,                   showInList: false, showInDetail: true,  section: 'demographics' },
    { name: 'education',      type: 'select', label: 'Escolaridad',         required: false,                   showInList: false, showInDetail: true,  section: 'demographics',
      options: [{ value: 'basic', label: 'Básica' }, { value: 'secondary', label: 'Media' }, { value: 'technical', label: 'Técnica' }, { value: 'university', label: 'Universitaria' }, { value: 'postgrad', label: 'Postgrado' }]
    },
    { name: 'maritalStatus',  type: 'select', label: 'Estado Civil',        required: false,                   showInList: false, showInDetail: true,  section: 'demographics',
      options: [{ value: 'single', label: 'Soltero/a' }, { value: 'married', label: 'Casado/a' }, { value: 'divorced', label: 'Divorciado/a' }, { value: 'widowed', label: 'Viudo/a' }, { value: 'cohabiting', label: 'Conviviente' }]
    },
    { name: 'insurance',      type: 'select', label: 'Previsión',           required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [
        { value: 'fonasa_a', label: 'FONASA A' }, { value: 'fonasa_b', label: 'FONASA B' },
        { value: 'fonasa_c', label: 'FONASA C' }, { value: 'fonasa_d', label: 'FONASA D' },
        { value: 'isapre',   label: 'ISAPRE'   }, { value: 'particular', label: 'Particular' }
      ],
      badgeColors: { fonasa_a: '#6b7280', fonasa_b: '#3b82f6', fonasa_c: '#10b981', fonasa_d: '#8b5cf6', isapre: '#f59e0b', particular: '#ec4899' }
    },
    { name: 'phone',          type: 'tel',    label: 'Teléfono',            required: true,                    showInList: false, showInDetail: true,  section: 'demographics' },
    { name: 'email',          type: 'email',  label: 'Email',               required: false,                   showInList: false, showInDetail: true,  section: 'demographics' },
    { name: 'address',        type: 'text',   label: 'Dirección',           required: false,                   showInList: false, showInDetail: true,  section: 'demographics' },
    { name: 'emergencyContact', type: 'text', label: 'Contacto Emergencia', required: false,                   showInList: false, showInDetail: true,  section: 'demographics' },
    { name: 'doctor',         type: 'text',   label: 'Psicólogo/a',         required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search' },
    { name: 'lastVisit',      type: 'date',   label: 'Última Sesión',       required: false,                   showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, format: 'date' },
    { name: 'status',         type: 'select', label: 'Estado',              required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [{ value: 'active', label: 'En Terapia' }, { value: 'discharged', label: 'Alta Terapéutica' }, { value: 'critical', label: 'Riesgo' }, { value: 'scheduled', label: 'Evaluación' }],
      badgeColors: { active: '#10b981', discharged: '#6b7280', critical: '#ef4444', scheduled: '#3b82f6' }
    },

    // ── Alerts (risk factors) ────────────────────────────────────────────
    { name: 'allergies',        type: 'tags',     label: 'Factores de Riesgo',   required: false, isAlert: true,  showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'contraindications', type: 'textarea', label: 'Riesgo Suicida',      required: false, isAlert: true,  showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'alertNotes',       type: 'textarea', label: 'Notas de Alerta',      required: false, isAlert: true,  showInList: false, showInDetail: true, section: 'alerts' },

    // ── Mental status exam (vital-sign-style boxes) ──────────────────────
    { name: 'bp',             type: 'text',   label: 'Apariencia',       required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'heartRate',      type: 'text',   label: 'Ánimo',            required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'temperature',    type: 'text',   label: 'Afecto',           required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'o2Saturation',   type: 'text',   label: 'Pensamiento',      required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'weight',         type: 'text',   label: 'Percepción',       required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'height',         type: 'text',   label: 'Cognición',        required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'bmi',            type: 'text',   label: 'Insight',          required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'respiratoryRate', type: 'text',  label: 'Juicio',           required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },

    // ── Psychological assessments (history section) ──────────────────────
    { name: 'personalHistory',  type: 'textarea', label: 'Historia Personal y Familiar', required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'familyHistory',    type: 'textarea', label: 'Dinámica Familiar',            required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'habits',           type: 'textarea', label: 'Instrumentos Aplicados',       required: false, showInList: false, showInDetail: true, section: 'history', placeholder: 'PHQ-9, GAD-7, Beck, MMSE...' },

    // ── Surgical ─────────────────────────────────────────────────────────
    { name: 'surgicalHistory',      type: 'textarea', label: 'Terapias Previas',                 required: false, showInList: false, showInDetail: true, section: 'surgical', isSurgical: true },
    { name: 'plannedInterventions', type: 'textarea', label: 'Intervenciones / Procesos Activos',required: false, showInList: false, showInDetail: true, section: 'surgical', isSurgical: true, placeholder: 'Procedimientos o intervenciones planificadas...' },

    // ── Treatment ────────────────────────────────────────────────────────
    { name: 'currentMedications', type: 'textarea', label: 'Plan Terapéutico',      required: false, showInList: false, showInDetail: true, section: 'medications', placeholder: 'Enfoque, frecuencia, objetivos', isPrescription: true },
    { name: 'chronicConditions',  type: 'tags',     label: 'Diagnósticos Activos',  required: false, showInList: false, showInDetail: true, section: 'medications' },

    // ── Diagnosis (DSM-5) ────────────────────────────────────────────────
    { name: 'diagnosisCode',  type: 'text',     label: 'Código DSM-5/CIE-10',      required: false, showInList: false, showInDetail: true, section: 'diagnosis' },
    { name: 'diagnosisLabel', type: 'text',     label: 'Diagnóstico Principal',     required: false, showInList: false, showInDetail: true, section: 'diagnosis' },
    { name: 'differentialDx', type: 'textarea', label: 'Diagnóstico Diferencial',   required: false, showInList: false, showInDetail: true, section: 'diagnosis' },

    // ── Session notes (SOAP adapted) ─────────────────────────────────────
    { name: 'soapSubjective', type: 'textarea', label: 'Relato del Paciente (S)',   required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Lo que el paciente reporta: emociones, pensamientos, eventos' },
    { name: 'soapObjective',  type: 'textarea', label: 'Observación Clínica (O)',   required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Conducta observada, estado mental, comunicación no verbal' },
    { name: 'soapAssessment', type: 'textarea', label: 'Formulación Clínica (A)',   required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Hipótesis de trabajo, patrones identificados, evolución' },
    { name: 'soapPlan',       type: 'textarea', label: 'Plan Terapéutico (P)',      required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Intervenciones, tareas intersesión, derivaciones' },

    // ── Encounter history ────────────────────────────────────────────────
    { name: 'encounters', type: 'object-list', label: 'Historial de Sesiones', required: false, showInList: false, showInDetail: true, section: 'encounters' }
  ]
};

// ─────────────────────────── DENTAL SESSIONS (calendar) ─────────────────────
const SCHEMA_DENTAL_SESSIONS: EntitySchema = {
  entity: {
    key: 'dental-sessions',
    singular: 'Cita Dental',
    plural: 'Citas Dentales',
    icon: 'tooth',
    moduleType: 'calendar',
    description: 'Agenda de citas odontológicas',
    encounterEntity: 'dental-records',
    encounterMatchField: 'patientName'
  },
  fields: [
    { name: 'title',       type: 'text',     label: 'Procedimiento',     required: true,  isTitle: true,         showInList: true,  showInDetail: true,  filterable: true, filterType: 'search', minLength: 2 },
    { name: 'patientName', type: 'text',     label: 'Paciente',          required: true,  isSubtitle: true,      showInList: true,  showInDetail: true,  filterable: true, filterType: 'search' },
    { name: 'startDate',   type: 'datetime', label: 'Fecha y hora',      required: true,  isCalendarStart: true, showInList: true,  showInDetail: true,  sortable: true },
    { name: 'endDate',     type: 'datetime', label: 'Fin',               required: false, isCalendarEnd: true,   showInList: false, showInDetail: true },
    { name: 'treatmentType', type: 'select', label: 'Tipo de Tratamiento', required: true, isBadge: true,        showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      options: [
        { value: 'checkup',     label: 'Control'          },
        { value: 'cleaning',    label: 'Limpieza'         },
        { value: 'filling',     label: 'Obturación'       },
        { value: 'extraction',  label: 'Extracción'       },
        { value: 'root_canal',  label: 'Endodoncia'       },
        { value: 'orthodontics', label: 'Ortodoncia'      },
        { value: 'implant',     label: 'Implante'         },
        { value: 'whitening',   label: 'Blanqueamiento'   },
        { value: 'surgery',     label: 'Cirugía'          }
      ],
      badgeColors: { checkup: '#10b981', cleaning: '#3b82f6', filling: '#f59e0b', extraction: '#ef4444', root_canal: '#8b5cf6', orthodontics: '#6366f1', implant: '#14b8a6', whitening: '#ec4899', surgery: '#f97316' }
    },
    { name: 'status', type: 'select', label: 'Estado', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
      options: [
        { value: 'scheduled', label: 'Programada' },
        { value: 'completed', label: 'Completada' },
        { value: 'cancelled', label: 'Cancelada'  },
        { value: 'no_show',   label: 'No asistió' }
      ],
      badgeColors: { scheduled: '#3b82f6', completed: '#10b981', cancelled: '#ef4444', no_show: '#f59e0b' }
    },
    { name: 'patientEmail', type: 'email', label: 'Email del paciente', required: false, showInList: false, showInDetail: true },
    { name: 'chair',  type: 'text',     label: 'Sillón',    required: false, showInList: true,  showInDetail: true },
    { name: 'notes',  type: 'textarea', label: 'Notas',     required: false, showInList: false, showInDetail: true }
  ]
};

// ─────────────────────────── DENTAL RECORDS (clinical-record) ────────────────
export const SCHEMA_DENTAL_RECORDS: EntitySchema = {
  entity: {
    key: 'dental-records',
    singular: 'Ficha Dental',
    plural: 'Fichas Dentales',
    icon: 'tooth',
    moduleType: 'clinical-record',
    description: 'Fichas odontológicas y registros de tratamientos'
  },
  fields: [
    // ── Demographics (STABLE) ─────────────────────────────────────────────
    { name: 'fullName',       type: 'text',   label: 'Nombre Completo',     required: true,  isTitle: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', sortable: true, isStable: true },
    { name: 'patientId',      type: 'text',   label: 'ID Paciente',         required: true,  isSubtitle: true,  showInList: true,  showInDetail: true,  section: 'demographics', pattern: '^DEN-\\d{5}$', patternMessage: 'Formato: DEN-00000', isStable: true },
    { name: 'rut',            type: 'text',   label: 'RUT',                 required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'birthDate',      type: 'date',   label: 'Fecha de Nacimiento', required: true,                    showInList: false, showInDetail: true,  section: 'demographics', format: 'date', isStable: true },
    { name: 'age',            type: 'number', label: 'Edad',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, min: 0, max: 150, isStable: true },
    { name: 'gender',         type: 'select', label: 'Sexo',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select', isStable: true,
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'insurance',      type: 'select', label: 'Previsión',           required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select', isStable: true,
      options: [
        { value: 'fonasa_a', label: 'FONASA A' }, { value: 'fonasa_b', label: 'FONASA B' },
        { value: 'fonasa_c', label: 'FONASA C' }, { value: 'fonasa_d', label: 'FONASA D' },
        { value: 'isapre',   label: 'ISAPRE'   }, { value: 'particular', label: 'Particular' }
      ],
      badgeColors: { fonasa_a: '#6b7280', fonasa_b: '#3b82f6', fonasa_c: '#10b981', fonasa_d: '#8b5cf6', isapre: '#f59e0b', particular: '#ec4899' }
    },
    { name: 'phone',          type: 'tel',    label: 'Teléfono',            required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'email',          type: 'email',  label: 'Email',               required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'doctor',         type: 'text',   label: 'Odontólogo/a',        required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', isStable: true },
    { name: 'lastVisit',      type: 'date',   label: 'Última Atención',     required: false,                   showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, format: 'date' },
    { name: 'status',         type: 'select', label: 'Estado',              required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [{ value: 'active', label: 'Activo' }, { value: 'discharged', label: 'Alta' }, { value: 'maintenance', label: 'Mantención' }, { value: 'orthodontic', label: 'Ortodoncia' }],
      badgeColors: { active: '#10b981', discharged: '#6b7280', maintenance: '#3b82f6', orthodontic: '#8b5cf6' }
    },

    // ── Alerts ────────────────────────────────────────────────────────────
    { name: 'allergies',         type: 'tags',     label: 'Alergias',              required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts', isStable: true },
    { name: 'contraindications', type: 'textarea', label: 'Contraindicaciones',    required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts', isStable: true },
    { name: 'alertNotes',        type: 'textarea', label: 'Notas de Alerta',       required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },

    // ── Dental exam boxes (repurpose vital-sign grid) ─────────────────────
    { name: 'bp',            type: 'text',   label: 'Dolor (EVA)',        required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', placeholder: '0-10' },
    { name: 'heartRate',     type: 'text',   label: 'Higiene Oral',       required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', placeholder: 'Buena/Regular/Deficiente' },
    { name: 'temperature',   type: 'text',   label: 'Sangrado al Sondaje', required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', placeholder: 'Sí/No/%' },
    { name: 'o2Saturation',  type: 'text',   label: 'Movilidad Dental',   required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', placeholder: 'Grado 0-3' },
    { name: 'weight',        type: 'text',   label: 'Índice de Placa',    required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', placeholder: '%' },
    { name: 'height',        type: 'text',   label: 'Maloclusión',        required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', placeholder: 'Clase I/II/III', isStable: true },
    { name: 'bmi',           type: 'text',   label: 'Oclusión',           required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', placeholder: 'Normal/Alterada' },
    { name: 'respiratoryRate', type: 'text', label: 'Sensibilidad',       required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', placeholder: 'Térmica/Táctil' },

    // ── Dental anamnesis (STABLE) ─────────────────────────────────────────
    { name: 'personalHistory', type: 'textarea', label: 'Antecedentes Médicos Relevantes', required: false, showInList: false, showInDetail: true, section: 'history', isStable: true },
    { name: 'familyHistory',   type: 'textarea', label: 'Antecedentes Familiares',         required: false, showInList: false, showInDetail: true, section: 'history', isStable: true },
    { name: 'habits',          type: 'textarea', label: 'Hábitos Parafuncionales',         required: false, showInList: false, showInDetail: true, section: 'history', placeholder: 'Bruxismo, onicofagia, succión digital...', isStable: true },

    // ── Surgical / dental procedures ──────────────────────────────────────
    { name: 'surgicalHistory',      type: 'textarea', label: 'Tratamientos Previos',          required: false, showInList: false, showInDetail: true, section: 'surgical', isSurgical: true, isStable: true },
    { name: 'plannedInterventions', type: 'textarea', label: 'Procedimientos Planificados',    required: false, showInList: false, showInDetail: true, section: 'surgical', isSurgical: true, isStable: true, placeholder: 'Cirugías, implantes, ortodoncia planificados...' },

    // ── Current treatment ─────────────────────────────────────────────────
    { name: 'currentMedications', type: 'textarea', label: 'Medicación Actual',       required: false, showInList: false, showInDetail: true, section: 'medications', placeholder: 'Analgésicos, antibióticos, antisépticos...', isPrescription: true },
    { name: 'chronicConditions',  type: 'tags',     label: 'Condiciones Crónicas',    required: false, showInList: false, showInDetail: true, section: 'medications', isStable: true },

    // ── Diagnosis ─────────────────────────────────────────────────────────
    { name: 'diagnosisCode',  type: 'text',     label: 'Código CIE / ICDAS',    required: false, showInList: false, showInDetail: true, section: 'diagnosis', isStable: true },
    { name: 'diagnosisLabel', type: 'text',     label: 'Diagnóstico Principal', required: false, showInList: false, showInDetail: true, section: 'diagnosis', isStable: true },
    { name: 'differentialDx', type: 'textarea', label: 'Plan de Tratamiento',   required: false, showInList: false, showInDetail: true, section: 'diagnosis', isStable: true },

    // ── SOAP for dental procedure ─────────────────────────────────────────
    { name: 'soapSubjective', type: 'textarea', label: 'Motivo de Consulta (S)',   required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Síntomas referidos por el paciente, dolor, sensibilidad' },
    { name: 'soapObjective',  type: 'textarea', label: 'Examen Clínico (O)',        required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Hallazgos clínicos, radiográficos, piezas tratadas' },
    { name: 'soapAssessment', type: 'textarea', label: 'Diagnóstico de Sesión (A)', required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Diagnóstico y estado actual del tratamiento' },
    { name: 'soapPlan',       type: 'textarea', label: 'Procedimiento Realizado (P)', required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Materiales usados, técnica, próxima sesión, indicaciones' },

    // ── Encounter history ─────────────────────────────────────────────────
    { name: 'encounters', type: 'object-list', label: 'Historial de Atenciones', required: false, showInList: false, showInDetail: true, section: 'encounters' }
  ]
};

// ─── Financial schemas ────────────────────────────────────────────────────────

export const SCHEMA_PAYMENTS: EntitySchema = {
  entity: {
    key: 'payments',
    singular: 'Cobro',
    plural: 'Cobros',
    icon: 'dollar-sign',
    description: 'Registro de cobros e ingresos del centro médico',
    disableEdit: true,
    disableDelete: true
  },
  fields: [
    { name: 'patientName',   type: 'text',   label: 'Paciente',          required: true,  isTitle: true,    showInList: true,  showInDetail: true,  filterable: true,  filterType: 'search', sortable: true },
    { name: 'invoiceNumber', type: 'text',   label: 'N° Documento',      required: false, isSubtitle: true, showInList: true,  showInDetail: true },
    { name: 'date',          type: 'date',   label: 'Fecha',             required: true,                   showInList: true,  showInDetail: true,  sortable: true },
    { name: 'concept',       type: 'select', label: 'Concepto',          required: true,  isBadge: true,    showInList: true,  showInDetail: true,  filterable: true,  filterType: 'select',
      options: [
        { value: 'consulta',      label: 'Consulta médica'   },
        { value: 'procedimiento', label: 'Procedimiento'     },
        { value: 'examenes',      label: 'Exámenes'          },
        { value: 'psicologia',    label: 'Psicología'        },
        { value: 'odontologia',   label: 'Odontología'       },
        { value: 'medicamentos',  label: 'Medicamentos'      },
        { value: 'otro',          label: 'Otro'              }
      ],
      badgeColors: { consulta: '#6366f1', procedimiento: '#8b5cf6', examenes: '#3b82f6', psicologia: '#ec4899', odontologia: '#14b8a6', medicamentos: '#10b981', otro: '#6b7280' }
    },
    { name: 'amount',         type: 'number', label: 'Monto (CLP)',      required: true,                   showInList: true,  showInDetail: true,  sortable: true,   min: 0, format: 'currency' },
    { name: 'paymentMethod',  type: 'select', label: 'Medio de pago',    required: true,  isBadge: true,    showInList: true,  showInDetail: true,  filterable: true,  filterType: 'select',
      options: [
        { value: 'efectivo',      label: 'Efectivo'      },
        { value: 'debito',        label: 'Débito'        },
        { value: 'credito',       label: 'Crédito'       },
        { value: 'transferencia', label: 'Transferencia' },
        { value: 'fonasa',        label: 'FONASA'        },
        { value: 'isapre',        label: 'Isapre'        }
      ],
      badgeColors: { efectivo: '#10b981', debito: '#3b82f6', credito: '#6366f1', transferencia: '#8b5cf6', fonasa: '#f59e0b', isapre: '#ec4899' }
    },
    { name: 'status', type: 'select', label: 'Estado', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
      options: [
        { value: 'pagado',   label: 'Pagado'   },
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'anulado',  label: 'Anulado'  }
      ],
      badgeColors: { pagado: '#10b981', pendiente: '#f59e0b', anulado: '#ef4444' }
    },
    { name: 'notes', type: 'textarea', label: 'Observaciones', required: false, showInList: false, showInDetail: true }
  ]
};

export const SCHEMA_EXPENSES: EntitySchema = {
  entity: {
    key: 'expenses',
    singular: 'Gasto',
    plural: 'Gastos',
    icon: 'trending-down',
    description: 'Control de gastos y egresos operacionales'
  },
  fields: [
    { name: 'description',   type: 'text',   label: 'Descripción',       required: true,  isTitle: true,    showInList: true,  showInDetail: true,  filterable: true, filterType: 'search', sortable: true },
    { name: 'supplier',      type: 'text',   label: 'Proveedor / Origen', required: false, isSubtitle: true, showInList: true,  showInDetail: true,  filterable: true, filterType: 'search' },
    { name: 'date',          type: 'date',   label: 'Fecha',             required: true,                   showInList: true,  showInDetail: true,  sortable: true },
    { name: 'category',      type: 'select', label: 'Categoría',         required: true,  isBadge: true,    showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      options: [
        { value: 'insumos',        label: 'Insumos médicos'    },
        { value: 'remuneraciones', label: 'Remuneraciones'     },
        { value: 'arriendo',       label: 'Arriendo'           },
        { value: 'servicios',      label: 'Servicios básicos'  },
        { value: 'equipamiento',   label: 'Equipamiento'       },
        { value: 'marketing',      label: 'Marketing'          },
        { value: 'capacitacion',   label: 'Capacitación'       },
        { value: 'otro',           label: 'Otro'               }
      ],
      badgeColors: { insumos: '#6366f1', remuneraciones: '#ec4899', arriendo: '#f59e0b', servicios: '#3b82f6', equipamiento: '#8b5cf6', marketing: '#10b981', capacitacion: '#14b8a6', otro: '#6b7280' }
    },
    { name: 'amount',        type: 'number', label: 'Monto (CLP)',       required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 0, format: 'currency' },
    { name: 'paymentMethod', type: 'select', label: 'Medio de pago',     required: true,  isBadge: true,    showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      options: [
        { value: 'efectivo',      label: 'Efectivo'      },
        { value: 'transferencia', label: 'Transferencia' },
        { value: 'cheque',        label: 'Cheque'        },
        { value: 'tarjeta',       label: 'Tarjeta'       }
      ],
      badgeColors: { efectivo: '#10b981', transferencia: '#6366f1', cheque: '#f59e0b', tarjeta: '#3b82f6' }
    },
    { name: 'status', type: 'select', label: 'Estado', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
      options: [
        { value: 'pagado',   label: 'Pagado'   },
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'rechazado', label: 'Rechazado' }
      ],
      badgeColors: { pagado: '#10b981', pendiente: '#f59e0b', rechazado: '#ef4444' }
    },
    { name: 'receiptNumber', type: 'text',     label: 'N° Documento',    required: false, showInList: false, showInDetail: true },
    { name: 'notes',         type: 'textarea', label: 'Observaciones',   required: false, showInList: false, showInDetail: true }
  ]
};

// ─── Mock users + their authorized schemas ────────────────────────────────────

export interface MockUser {
  user: AuthUser;
  password: string;
  schemas: EntitySchema[];
}

export const MOCK_USERS: MockUser[] = [
  {
    password: 'admin123',
    user: { id: 1, name: 'Admin General', email: 'admin@empresa.com', role: 'admin', avatar: 'AG' },
    schemas: [SCHEMA_SUPPLIERS, SCHEMA_PRODUCTS, SCHEMA_PATIENTS, SCHEMA_APPOINTMENTS, SCHEMA_CLINICAL_RECORDS, SCHEMA_PAYMENTS, SCHEMA_EXPENSES]
  },
  {
    password: 'compras123',
    user: { id: 2, name: 'Jefe de Compras', email: 'compras@empresa.com', role: 'manager', avatar: 'JC' },
    schemas: [SCHEMA_SUPPLIERS, SCHEMA_PRODUCTS, SCHEMA_PAYMENTS, SCHEMA_EXPENSES]
  },
  {
    password: 'medico123',
    user: { id: 3, name: 'Dra. Morales', email: 'medico@hospital.com', role: 'manager', avatar: 'DM' },
    schemas: [SCHEMA_PATIENTS, SCHEMA_APPOINTMENTS, SCHEMA_CLINICAL_RECORDS, SCHEMA_PAYMENTS]
  },
  {
    password: 'viewer123',
    user: { id: 4, name: 'Auditor', email: 'auditor@empresa.com', role: 'viewer', avatar: 'AU' },
    schemas: [SCHEMA_SUPPLIERS, SCHEMA_PAYMENTS, SCHEMA_EXPENSES]
  },
  {
    password: 'psico123',
    user: { id: 5, name: 'Ps. Carolina Vega', email: 'psicologia@clinica.com', role: 'manager', avatar: 'CV' },
    schemas: [SCHEMA_PSYCH_SESSIONS, SCHEMA_PSYCH_RECORDS]
  },
  {
    password: 'denti123',
    user: { id: 6, name: 'Dr. Ramírez', email: 'odontologia@clinica.com', role: 'manager', avatar: 'DR' },
    schemas: [SCHEMA_DENTAL_SESSIONS, SCHEMA_DENTAL_RECORDS]
  }
];

const SESSION_KEY = 'auth_session';
/**
 * Increment this whenever the schema structure changes so that any cached
 * session in sessionStorage is invalidated and the user must re-login.
 */
const SESSION_VERSION = 8;

// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _state = signal<AuthState>(this.loadFromStorage());
  private http   = inject(HttpClient);

  readonly user    = computed(() => this._state().user);
  readonly token   = computed(() => this._state().token);
  readonly schemas = computed(() => this._state().schemas);
  readonly isAuthenticated = computed(() => this._state().authenticated);

  constructor(private router: Router) {}

  /**
   * POST /api/auth/login — real backend (API Gateway → Lambda → RDS PostgreSQL)
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('https://cwhwahvqr0.execute-api.us-east-1.amazonaws.com/api/auth/login', credentials).pipe(
      catchError(err => throwError(() =>
        new Error(err.error?.message ?? 'Credenciales inválidas. Verifique su email y contraseña.')
      ))
    );
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

}
