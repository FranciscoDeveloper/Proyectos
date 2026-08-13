import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { LoginCredentials, AuthResponse, AuthState, AuthUser } from '../models/auth.model';
import { EntitySchema } from '../models/entity-schema.model';
import { CryptoService } from './crypto.service';

// ─── Mock schema definitions (same data as SchemaService) ────────────────────
// Kept inline so they can be composed per-role in the mock backend response.

const SCHEMA_SUPPLIERS: EntitySchema = {
  entity: { key: 'suppliers', singular: 'Proveedor', plural: 'Proveedores', icon: 'users', description: 'Gestión de proveedores y socios comerciales' },
  fields: [
    { name: 'name',          type: 'text',          label: 'Nombre',            required: true,  isTitle: true,    showInList: true,  showInDetail: true,  sortable: true,  filterable: true,  filterType: 'search', minLength: 2, maxLength: 100 },
    { name: 'code',          type: 'text',          label: 'Código',            required: true,  isSubtitle: true, showInList: true,  showInDetail: true,  sortable: true,  pattern: '^[A-Z]{2}-\\d{3,}$', patternMessage: 'Formato: XX-000' },
    { name: 'email',         type: 'email',         label: 'Email',             required: true,                   showInList: false, showInDetail: true },
    { name: 'phone',         type: 'tel',           label: 'Teléfono',          required: true,                   showInList: false, showInDetail: true },
    { name: 'categoryId',    type: 'entity-select', label: 'Categoría',         required: true,                   showInList: false, showInDetail: false,
      relatedEntity: 'categories', relatedLabelField: 'name',
      relatedFilterField: 'type', relatedFilterValue: 'supplier' },
    { name: 'categoryName',  type: 'text',          label: 'Categoría',         isBadge: true,    showInList: true,  showInDetail: true,  displayOnly: true,
      badgeColors: { 'Laboratorio': '#14b8a6', 'Distribuidores': '#6366f1', 'Insumos': '#8b5cf6', 'Servicios': '#10b981' }
    },
    { name: 'status',        type: 'select',        label: 'Estado',            required: true,  isBadge: true,    showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      lookupEntity: 'supplier-statuses',
      options: [{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }, { value: 'blocked', label: 'Bloqueado' }],
      badgeColors: { active: '#10b981', inactive: '#6b7280', blocked: '#ef4444' }
    },
    { name: 'country',       type: 'text',          label: 'País',              required: true,                   showInList: true,  showInDetail: true,  sortable: true,  filterable: true,  filterType: 'select' },
    { name: 'city',          type: 'text',          label: 'Ciudad',            required: true,                   showInList: false, showInDetail: true },
    { name: 'address',       type: 'text',          label: 'Dirección',         required: true,                   showInList: false, showInDetail: true },
    { name: 'website',       type: 'url',           label: 'Sitio Web',                                           showInList: false, showInDetail: true },
    { name: 'taxId',         type: 'text',          label: 'ID Fiscal',         required: true,                   showInList: false, showInDetail: true },
    { name: 'contactPerson', type: 'text',          label: 'Contacto',          required: true,                   showInList: true,  showInDetail: true },
    { name: 'rating',        type: 'range',         label: 'Calificación',      required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 1, max: 5, step: 0.1, format: 'stars' },
    { name: 'totalOrders',   type: 'number',        label: 'Total Órdenes',     required: true,                   showInList: false, showInDetail: true,  min: 0 },
    { name: 'totalSpent',    type: 'number',        label: 'Total Gastado',     required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 0, format: 'currency' },
    { name: 'notes',         type: 'textarea',      label: 'Notas',                                               showInList: false, showInDetail: true },
    { name: 'tags',          type: 'tags',          label: 'Etiquetas',                                           showInList: false, showInDetail: true }
  ]
};

const SCHEMA_PRODUCTS: EntitySchema = {
  entity: { key: 'products', singular: 'Producto', plural: 'Productos', icon: 'package', description: 'Catálogo de productos e inventario' },
  fields: [
    { name: 'name',         type: 'text',          label: 'Nombre del Producto', required: true,  isTitle: true,    showInList: true,  showInDetail: true,  sortable: true,  filterable: true, filterType: 'search', minLength: 2 },
    { name: 'sku',          type: 'text',          label: 'SKU',                 required: true,  isSubtitle: true, showInList: true,  showInDetail: true,  sortable: true,  pattern: '^[A-Z]{3}-\\d{4}$', patternMessage: 'Formato: ABC-0000' },
    { name: 'categoryId',   type: 'entity-select', label: 'Categoría',           required: true,                   showInList: false, showInDetail: false,
      relatedEntity: 'categories', relatedLabelField: 'name',
      relatedFilterField: 'type', relatedFilterValue: 'product' },
    { name: 'categoryName', type: 'text',          label: 'Categoría',           isBadge: true,                    showInList: true,  showInDetail: true,  displayOnly: true },
    { name: 'status',       type: 'select',        label: 'Estado',              required: true,  isBadge: true,    showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      options: [
        { value: 'active',        label: 'Activo'        },
        { value: 'available',     label: 'Disponible'    },
        { value: 'low_stock',     label: 'Stock Bajo'    },
        { value: 'out_of_stock',  label: 'Sin Stock'     },
        { value: 'discontinued',  label: 'Descontinuado' },
        { value: 'inactive',      label: 'Inactivo'      }
      ],
      badgeColors: { active: '#10b981', available: '#10b981', low_stock: '#f59e0b', out_of_stock: '#ef4444', discontinued: '#6b7280', inactive: '#6b7280' }
    },
    { name: 'price',        type: 'number',        label: 'Precio',              required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 0, format: 'currency' },
    { name: 'stock',        type: 'number',        label: 'Stock',               required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 0 },
    { name: 'supplierId',   type: 'entity-select', label: 'Proveedor',           required: false,                  showInList: false, showInDetail: false,
      relatedEntity: 'suppliers', relatedLabelField: 'name' },
    { name: 'supplierName', type: 'text',          label: 'Proveedor',           isSubtitle: false,                showInList: true,  showInDetail: true,  displayOnly: true },
    { name: 'weight',       type: 'number',        label: 'Peso (kg)',                                             showInList: false, showInDetail: true,  min: 0 },
    { name: 'description',  type: 'textarea',      label: 'Descripción',                                          showInList: false, showInDetail: true },
    { name: 'tags',         type: 'tags',          label: 'Etiquetas',                                             showInList: false, showInDetail: true }
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
    { name: 'service',          type: 'text',     label: 'Servicio',         required: true,  isTitle: true,         showInList: true,  showInDetail: true,  filterable: true, filterType: 'search' },
    { name: 'patientName',      type: 'text',     label: 'Paciente',         required: true,  isSubtitle: true,      showInList: true,  showInDetail: true,  filterable: true, filterType: 'search' },
    { name: 'dateTime',         type: 'datetime', label: 'Fecha y hora',     required: true,  isCalendarStart: true, showInList: true,  showInDetail: true,  sortable: true },
    { name: 'durationMinutes',  type: 'number',   label: 'Duración (min)',   required: false,                        showInList: true,  showInDetail: true,  min: 0 },
    { name: 'status',           type: 'select',   label: 'Estado',           required: true,  isBadge: true,         showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      lookupEntity: 'appointment-statuses',
      options: [
        { value: 'scheduled',  label: 'Agendada'    },
        { value: 'confirmed',  label: 'Confirmada'  },
        { value: 'completed',  label: 'Completada'  },
        { value: 'cancelled',  label: 'Cancelada'   },
        { value: 'no_show',    label: 'No asistió'  }
      ],
      badgeColors: { scheduled: '#3b82f6', confirmed: '#8b5cf6', completed: '#10b981', cancelled: '#ef4444', no_show: '#f59e0b' }
    },
    { name: 'modality',         type: 'select',   label: 'Modalidad',        required: false, isBadge: true,         showInList: true,  showInDetail: true,
      lookupEntity: 'appointment-modalities',
      options: [
        { value: 'in_person', label: 'Presencial'    },
        { value: 'video',     label: 'Videoconsulta' },
        { value: 'phone',     label: 'Teléfono'      }
      ],
      badgeColors: { in_person: '#6366f1', video: '#0891b2', phone: '#10b981' }
    },
    { name: 'professionalName', type: 'text',     label: 'Profesional',      required: false,                        showInList: true,  showInDetail: true },
    { name: 'notes',            type: 'textarea', label: 'Notas',            required: false,                        showInList: false, showInDetail: true }
  ]
};

const SCHEMA_PACIENTE: EntitySchema = {
  entity: { key: 'paciente', singular: 'Paciente', plural: 'Pacientes', icon: 'heart', description: 'Registro y seguimiento de pacientes' },
  fields: [
    { name: 'nombre',   type: 'text',  label: 'Nombre',    required: true,  isTitle: true,    showInList: true,  showInDetail: true,  sortable: true,  filterable: true, filterType: 'search', minLength: 2 },
    { name: 'rut',      type: 'text',  label: 'RUT',       required: true,  isSubtitle: true, showInList: true,  showInDetail: true,  filterable: true, filterType: 'search', pattern: '^\\d{1,2}\\.?\\d{3}\\.?\\d{3}-[\\dkK]$', patternMessage: 'Formato: 12.345.678-9' },
    { name: 'email',    type: 'email', label: 'Email',     required: true,                    showInList: true,  showInDetail: true },
    { name: 'telefono', type: 'tel',   label: 'Teléfono',  required: false,                   showInList: true,  showInDetail: true },
    { name: 'birthDate',  type: 'date',  label: 'Fecha de Nacimiento', required: false, showInList: false, showInDetail: true },
    { name: 'gender',     type: 'text',  label: 'Género',              required: false, showInList: false, showInDetail: true },
    { name: 'bloodType',  type: 'text',  label: 'Tipo de Sangre',      required: false, showInList: false, showInDetail: true },
    { name: 'address',    type: 'text',  label: 'Dirección',           required: false, showInList: false, showInDetail: true },
    { name: 'emergencyContact', type: 'text', label: 'Contacto de Emergencia', required: false, showInList: false, showInDetail: true }
  ]
};

export const SCHEMA_CLINICAL_RECORDS: EntitySchema = {
  entity: {
    key: 'clinical-records',
    singular: 'Paciente',
    plural: 'Pacientes',
    icon: 'clipboard',
    moduleType: 'clinical-record',
    description: 'Fichas clínicas y registros médicos de pacientes',
    disableCreate: true,
    disableCreateHint: 'La ficha inicial se crea automáticamente al agendar una cita en el módulo de Citas.'
  },
  fields: [
    // ── Selector de paciente registrado (solo en creación) ────────────────
    { name: 'patientId', type: 'entity-select', label: 'Paciente registrado', required: true,
      showInList: false, showInDetail: false, section: 'demographics', isStable: true,
      relatedEntity: 'patients', relatedLabelField: 'nombre',
      linkedFields: [
        { from: 'nombre', to: 'fullName' },
        { from: 'name',   to: 'fullName' },
        { from: 'rut',    to: 'rut'      }
      ]
    },
    // ── Identificación (auto-llenado desde selector de paciente — oculto en formulario) ──
    { name: 'fullName',  type: 'text',   label: 'Nombre Completo', required: true,  isTitle: true,    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', sortable: true, isStable: true, hideInForm: true },
    { name: 'rut',       type: 'text',   label: 'RUT',             required: true,  isSubtitle: true, showInList: true,  showInDetail: true,  section: 'demographics', isStable: true, pattern: '^\\d{1,2}\\.?\\d{3}\\.?\\d{3}-[\\dkK]$', patternMessage: 'Formato: 12.345.678-9', hideInForm: true },
    { name: 'age',       type: 'number', label: 'Edad',            required: false, displayOnly: true, showInList: true, showInDetail: true,  section: 'demographics', sortable: true, min: 0, max: 150, isStable: true },
    { name: 'gender',    type: 'select', label: 'Sexo',            required: false, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, hideInForm: true,
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    // ── Datos personales del paciente ─────────────────────────────────────
    { name: 'birthDate',        type: 'date',   label: 'Fecha de Nacimiento', required: false, showInList: false, showInDetail: true, section: 'demographics', format: 'date', isStable: true },
    { name: 'profession',       type: 'text',   label: 'Profesión',           required: false, showInList: false, showInDetail: true, section: 'demographics', isStable: true, hideInEncounterMode: true },
    { name: 'bloodType',        type: 'select', label: 'Grupo Sanguíneo',     required: false, isBadge: true, showInList: true, showInDetail: true, section: 'demographics', isStable: true, hideInForm: true,
      options: [{ value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' }, { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' }, { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' }, { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' }],
      badgeColors: { 'A+': '#ef4444', 'A-': '#f97316', 'B+': '#3b82f6', 'B-': '#6366f1', 'O+': '#10b981', 'O-': '#14b8a6', 'AB+': '#8b5cf6', 'AB-': '#ec4899' }
    },
    { name: 'insurance',        type: 'select', label: 'Previsión',           required: false, lookupEntity: 'previsiones', lookupValueField: 'nombre', lookupLabelField: 'nombre', showInList: true, showInDetail: true, section: 'demographics', isStable: true },
    { name: 'phone',            type: 'tel',    label: 'Teléfono',            required: false, showInList: false, showInDetail: true, section: 'demographics', hideInEncounterMode: true, hideInForm: true },
    { name: 'email',            type: 'email',  label: 'Email',               required: false, showInList: false, showInDetail: true, section: 'demographics', hideInEncounterMode: true, hideInForm: true },
    { name: 'address',          type: 'text',   label: 'Dirección',           required: false, showInList: false, showInDetail: true, section: 'demographics', hideInEncounterMode: true, hideInForm: true },
    { name: 'emergencyContact', type: 'text',   label: 'Contacto Emergencia', required: false, showInList: false, showInDetail: true, section: 'demographics', hideInEncounterMode: true, hideInForm: true },
    // ── Campos administrativos (solo en detalle, no en formulario) ────────
    { name: 'status',     type: 'select', label: 'Estado',        required: false, isBadge: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', hideInEncounterMode: true, hideInForm: true,
      options: [{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }],
      badgeColors: { active: '#10b981', inactive: '#6b7280' }
    },
    { name: 'doctorName', type: 'select', label: 'Médico Tratante', required: false, lookupEntity: 'medicos', lookupValueField: 'nombre', lookupLabelField: 'nombre', showInList: true, showInDetail: true, section: 'demographics', hideInEncounterMode: true, hideInForm: true },
    { name: 'lastVisit',  type: 'date',   label: 'Última Visita',   required: false, showInList: true, showInDetail: true, section: 'demographics', sortable: true, format: 'date', hideInEncounterMode: true, hideInForm: true },

    // ── Alertas (se editan en la atención, no en la ficha) ───────────────────
    { name: 'allergies',          type: 'tags',     label: 'Alergias',              required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts', hideInForm: true },
    { name: 'contraindications',  type: 'textarea', label: 'Contraindicaciones',    required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts', hideInForm: true },
    { name: 'alertNotes',         type: 'textarea', label: 'Notas de Alerta',       required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts', hideInForm: true },

    // ── Signos vitales (contexto de atención médica) ──────────────────────
    { name: 'bp',              type: 'text',   label: 'Presión Arterial',   required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', hideInForm: true,
      pattern: '^\\s*([6-9]\\d|1\\d\\d|2[0-5]\\d|260)\\s*\\/\\s*([3-9]\\d|1[0-5]\\d|160)\\s*$',
      patternMessage: 'Formato sistólica/diastólica, ej. 120/80 (sistólica 60–260, diastólica 30–160).' },
    { name: 'heartRate',       type: 'number', label: 'Frec. Cardíaca',     required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', min: 0, max: 300, hideInForm: true },
    { name: 'temperature',     type: 'number', label: 'Temperatura',        required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', min: 30, max: 45,  hideInForm: true },
    { name: 'o2Saturation',    type: 'number', label: 'Saturación O₂',     required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', min: 0, max: 100,  hideInForm: true },
    { name: 'weight',          type: 'number', label: 'Peso (kg)',          required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', min: 0,            hideInForm: true },
    { name: 'height',          type: 'number', label: 'Talla (cm)',         required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', min: 0,            hideInForm: true },
    { name: 'bmi',             type: 'number', label: 'IMC',                required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', min: 0,            hideInForm: true },
    { name: 'respiratoryRate', type: 'number', label: 'Frec. Respiratoria', required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals', min: 0, max: 60,   hideInForm: true },

    // ── Antecedentes (contexto de atención médica) ────────────────────────
    { name: 'personalHistory',  type: 'textarea', label: 'Antecedentes Personales', required: false, showInList: false, showInDetail: true, section: 'history', hideInForm: true },
    { name: 'familyHistory',    type: 'textarea', label: 'Antecedentes Familiares', required: false, showInList: false, showInDetail: true, section: 'history', hideInForm: true },
    { name: 'habits',           type: 'textarea', label: 'Hábitos',                 required: false, showInList: false, showInDetail: true, section: 'history', hideInForm: true },

    // ── Intervenciones quirúrgicas (contexto de atención médica) ─────────
    { name: 'surgicalHistory',      type: 'textarea', label: 'Antecedentes Quirúrgicos',   required: false, showInList: false, showInDetail: true, section: 'surgical', hideInForm: true },
    { name: 'plannedInterventions', type: 'textarea', label: 'Intervenciones Programadas', required: false, showInList: false, showInDetail: true, section: 'surgical', hideInForm: true },

    // ── Medicación (contexto de atención médica) ──────────────────────────
    { name: 'currentMedications', type: 'textarea', label: 'Medicación Actual',    required: false, showInList: false, showInDetail: true, section: 'medications', isPrescription: true, hideInForm: true },
    { name: 'chronicConditions',  type: 'tags',     label: 'Condiciones Crónicas', required: false, showInList: false, showInDetail: true, section: 'medications', hideInForm: true },

    // ── Diagnóstico (contexto de atención médica) ─────────────────────────
    { name: 'diagnosisCode',  type: 'text',     label: 'Código CIE-10',           required: false, showInList: false, showInDetail: true, section: 'diagnosis', hideInEncounterMode: true, hideInForm: true },
    { name: 'diagnosisLabel', type: 'text',     label: 'Diagnóstico Principal',   required: false, showInList: false, showInDetail: true, section: 'diagnosis', hideInForm: true },
    { name: 'differentialDx', type: 'textarea', label: 'Diagnóstico Diferencial', required: false, showInList: false, showInDetail: true, section: 'diagnosis', hideInForm: true },

    // ── Nota SOAP (contexto de atención médica) ───────────────────────────
    { name: 'soapSubjective', type: 'textarea', label: 'Subjetivo (S)', required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapObjective',  type: 'textarea', label: 'Objetivo (O)',  required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapAssessment', type: 'textarea', label: 'Análisis (A)',  required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapPlan',       type: 'textarea', label: 'Plan (P)',      required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },

    // ── Historial de atenciones ───────────────────────────────────────────
    { name: 'encounters', type: 'object-list', label: 'Historial de Atenciones', required: false, showInList: false, showInDetail: true, section: 'encounters' }
  ]
};

// ─────────────────────────── PSYCH SESSIONS (calendar) ───────────────────────
// Definida abajo con la fábrica `specialtyCalendarSchema`, junto a las otras
// agendas de especialidad — ver la sección "Agendas por especialidad".

// ─────────────────────────── PSYCH RECORDS (clinical-record) ─────────────────
export const SCHEMA_PSYCH_RECORDS: EntitySchema = {
  entity: {
    key: 'psych-records',
    singular: 'Ficha Psicológica',
    plural: 'Fichas Psicológicas',
    icon: 'brain',
    moduleType: 'clinical-record',
    description: 'Fichas psicológicas y registros terapéuticos',
    disableCreate: true,
    disableCreateHint: 'La ficha inicial se crea automáticamente al agendar una cita en el módulo de Citas.'
  },
  fields: [
    // ── Demographics ─────────────────────────────────────────────────────
    { name: 'fullName',       type: 'text',   label: 'Nombre Completo',     required: true,  isTitle: true,     showInList: true,  showInDetail: true,  section: 'demographics', isStable: true, filterable: true, filterType: 'search', sortable: true },
    { name: 'patientId',      type: 'text',   label: 'ID Paciente',         required: false, isSubtitle: true,  showInList: true,  showInDetail: true,  section: 'demographics', isStable: true, pattern: '^PSI-\\d{5}$', patternMessage: 'Formato: PSI-00000', isAutoGenerated: true },
    { name: 'rut',            type: 'text',   label: 'RUT',                 required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'birthDate',      type: 'date',   label: 'Fecha de Nacimiento', required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true, format: 'date' },
    { name: 'age',            type: 'number', label: 'Edad',                required: false, displayOnly: true,  showInList: true,  showInDetail: true,  section: 'demographics', isStable: true, sortable: true, min: 0, max: 150 },
    { name: 'gender',         type: 'select', label: 'Sexo',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', isStable: true, filterable: true, filterType: 'select',
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'occupation',     type: 'text',   label: 'Ocupación',           required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'education',      type: 'select', label: 'Escolaridad',         required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true,
      options: [{ value: 'basic', label: 'Básica' }, { value: 'secondary', label: 'Media' }, { value: 'technical', label: 'Técnica' }, { value: 'university', label: 'Universitaria' }, { value: 'postgrad', label: 'Postgrado' }]
    },
    { name: 'maritalStatus',  type: 'select', label: 'Estado Civil',        required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true,
      options: [{ value: 'single', label: 'Soltero/a' }, { value: 'married', label: 'Casado/a' }, { value: 'divorced', label: 'Divorciado/a' }, { value: 'widowed', label: 'Viudo/a' }, { value: 'cohabiting', label: 'Conviviente' }]
    },
    { name: 'insurance', type: 'select', label: 'Previsión', required: true, showInList: true, showInDetail: true, section: 'demographics', isStable: true, filterable: true, filterType: 'select', lookupEntity: 'previsiones', lookupValueField: 'nombre', lookupLabelField: 'nombre' },
    { name: 'phone',          type: 'tel',    label: 'Teléfono',            required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'email',          type: 'email',  label: 'Email',               required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'address',        type: 'text',   label: 'Dirección',           required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'emergencyContact', type: 'text', label: 'Contacto Emergencia', required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    // La ficha psicológica pertenece siempre al psicólogo autenticado: nunca se
    // elige a mano. Antes esto era un <select> obligatorio sobre `medicos`, así que
    // el dueño de la ficha terminaba siendo quien enviara el cliente y, al ser
    // `required`, el formulario siempre mandaba `professionalId` — con eso el
    // auto-estampado del BFF (`createEntity`, que sólo rellena la columna cuando el
    // body NO la trae) no llegaba a dispararse nunca. Ahora es sólo lectura y se
    // muestra `doctorName`, el nombre que ya resuelve el JOIN del BFF — mismo patrón
    // que `professionalName` en las agendas de especialidad. La asignación real la
    // hace el servidor (ver OWNER_LOCKED_KEYS en crudService.mjs).
    { name: 'doctorName', type: 'text', label: 'Psicólogo/a', required: false, displayOnly: true, showInList: true, showInDetail: true, section: 'demographics', isStable: true },
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
    // Sin campo `diagnosisCode`: la ficha psicológica no codifica el diagnóstico.
    // La columna `clinical_record.diagnosis_code` sigue existiendo y el resto de las
    // especialidades la siguen usando; aquí simplemente no se pide ni se muestra.
    { name: 'diagnosisLabel', type: 'text',     label: 'Diagnóstico Principal',     required: false, showInList: false, showInDetail: true, section: 'diagnosis' },
    { name: 'differentialDx', type: 'textarea', label: 'Diagnóstico Diferencial',   required: false, showInList: false, showInDetail: true, section: 'diagnosis' },

    // ── Session notes (SOAP adapted) ─────────────────────────────────────
    { name: 'soapSubjective', type: 'textarea', label: 'Relato del Paciente (S)',   required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Lo que el paciente reporta: emociones, pensamientos, eventos', hideInForm: true },
    { name: 'soapObjective',  type: 'textarea', label: 'Observación Clínica (O)',   required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Conducta observada, estado mental, comunicación no verbal', hideInForm: true },
    { name: 'soapAssessment', type: 'textarea', label: 'Formulación Clínica (A)',   required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Hipótesis de trabajo, patrones identificados, evolución', hideInForm: true },
    { name: 'soapPlan',       type: 'textarea', label: 'Plan Terapéutico (P)',      required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Intervenciones, tareas intersesión, derivaciones', hideInForm: true },

    // ── Encounter history ────────────────────────────────────────────────
    { name: 'encounters', type: 'object-list', label: 'Historial de Sesiones', required: false, showInList: false, showInDetail: true, section: 'encounters' }
  ]
};

// ─────────────────────────── DENTAL SESSIONS (calendar) ─────────────────────
// Definida abajo con la fábrica `specialtyCalendarSchema`, junto a las otras
// agendas de especialidad — ver la sección "Agendas por especialidad".

// ─────────────────────────── DENTAL RECORDS (clinical-record) ────────────────
export const SCHEMA_DENTAL_RECORDS: EntitySchema = {
  entity: {
    key: 'dental-records',
    singular: 'Ficha Dental',
    plural: 'Fichas Dentales',
    icon: 'tooth',
    moduleType: 'clinical-record',
    description: 'Fichas odontológicas y registros de tratamientos',
    disableCreate: true,
    disableCreateHint: 'La ficha inicial se crea automáticamente al agendar una cita en el módulo de Citas.'
  },
  fields: [
    // ── Demographics (STABLE) ─────────────────────────────────────────────
    { name: 'fullName',       type: 'text',   label: 'Nombre Completo',     required: true,  isTitle: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', sortable: true, isStable: true },
    { name: 'patientId',      type: 'text',   label: 'ID Paciente',         required: false, isSubtitle: true,  showInList: true,  showInDetail: true,  section: 'demographics', pattern: '^DEN-\\d{5}$', patternMessage: 'Formato: DEN-00000', isStable: true, isAutoGenerated: true },
    { name: 'rut',            type: 'text',   label: 'RUT',                 required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'birthDate',      type: 'date',   label: 'Fecha de Nacimiento', required: true,                    showInList: false, showInDetail: true,  section: 'demographics', format: 'date', isStable: true },
    { name: 'age',            type: 'number', label: 'Edad',                required: false, displayOnly: true,  showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, min: 0, max: 150, isStable: true },
    { name: 'gender',         type: 'select', label: 'Sexo',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select', isStable: true,
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'insurance', type: 'select', label: 'Previsión', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'previsiones', lookupValueField: 'nombre', lookupLabelField: 'nombre' },
    { name: 'phone',          type: 'tel',    label: 'Teléfono',            required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'email',          type: 'email',  label: 'Email',               required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'professionalId', type: 'select', label: 'Odontólogo/a', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'medicos', lookupValueField: 'id', lookupLabelField: 'nombre' },
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
    { name: 'diagnosisCode',  type: 'text',     label: 'Código CIE / ICDAS',    required: false, showInList: false, showInDetail: true, section: 'diagnosis', isStable: true, hideInEncounterMode: true },
    { name: 'diagnosisLabel', type: 'text',     label: 'Diagnóstico Principal', required: false, showInList: false, showInDetail: true, section: 'diagnosis', isStable: true },
    { name: 'differentialDx', type: 'textarea', label: 'Plan de Tratamiento',   required: false, showInList: false, showInDetail: true, section: 'diagnosis', isStable: true },

    // ── SOAP for dental procedure ─────────────────────────────────────────
    { name: 'soapSubjective', type: 'textarea', label: 'Motivo de Consulta (S)',   required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Síntomas referidos por el paciente, dolor, sensibilidad', hideInForm: true },
    { name: 'soapObjective',  type: 'textarea', label: 'Examen Clínico (O)',        required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Hallazgos clínicos, radiográficos, piezas tratadas', hideInForm: true },
    { name: 'soapAssessment', type: 'textarea', label: 'Diagnóstico de Sesión (A)', required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Diagnóstico y estado actual del tratamiento', hideInForm: true },
    { name: 'soapPlan',       type: 'textarea', label: 'Procedimiento Realizado (P)', required: false, showInList: false, showInDetail: true, section: 'soap', placeholder: 'Materiales usados, técnica, próxima sesión, indicaciones', hideInForm: true },

    // ── Encounter history ─────────────────────────────────────────────────
    { name: 'encounters', type: 'object-list', label: 'Historial de Atenciones', required: false, showInList: false, showInDetail: true, section: 'encounters' },

    // ── Odontograma interactivo ───────────────────────────────────────────
    { name: 'odontogram',     type: 'dental-chart',     label: 'Odontograma',     required: false, showInList: false, showInDetail: true, section: 'dental-charts' },

    // ── Periodontograma ───────────────────────────────────────────────────
    { name: 'periodontogram', type: 'periodontal-chart', label: 'Periodontograma', required: false, showInList: false, showInDetail: true, section: 'dental-charts' }
  ]
};

// ─── Presupuestos schema ──────────────────────────────────────────────────────

export const SCHEMA_PRESUPUESTOS: EntitySchema = {
  entity: {
    key: 'presupuestos',
    singular: 'Presupuesto',
    plural: 'Presupuestos',
    icon: 'file-text',
    description: 'Cotizaciones y presupuestos para pacientes',
    moduleType: 'presupuestos'
  },
  fields: []
};

// ─────────────────────────── KINE RECORDS (clinical-record) ─────────────────
export const SCHEMA_KINE_RECORDS: EntitySchema = {
  entity: {
    key: 'kine-records',
    singular: 'Ficha Kinésica',
    plural: 'Fichas Kinésicas',
    icon: 'clipboard',
    moduleType: 'clinical-record',
    description: 'Fichas kinésicas y registros de rehabilitación física',
    disableCreate: true,
    disableCreateHint: 'La ficha inicial se crea automáticamente al agendar una cita en el módulo de Citas.'
  },
  fields: [
    // ── Demographics (STABLE) ─────────────────────────────────────────────
    { name: 'fullName',       type: 'text',   label: 'Nombre Completo',     required: true,  isTitle: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', sortable: true, isStable: true },
    { name: 'patientId',      type: 'text',   label: 'ID Paciente',         required: false, isSubtitle: true,  showInList: true,  showInDetail: true,  section: 'demographics', pattern: '^KIN-\\d{5}$', patternMessage: 'Formato: KIN-00000', isStable: true, isAutoGenerated: true },
    { name: 'rut',            type: 'text',   label: 'RUT',                 required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'birthDate',      type: 'date',   label: 'Fecha de Nacimiento', required: true,                    showInList: false, showInDetail: true,  section: 'demographics', format: 'date', isStable: true },
    { name: 'age',            type: 'number', label: 'Edad',                required: false, displayOnly: true,  showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, min: 0, max: 150, isStable: true },
    { name: 'gender',         type: 'select', label: 'Sexo',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select', isStable: true,
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'insurance', type: 'select', label: 'Previsión', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'previsiones', lookupValueField: 'nombre', lookupLabelField: 'nombre' },
    { name: 'phone',          type: 'tel',    label: 'Teléfono',            required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'email',          type: 'email',  label: 'Email',               required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'address',        type: 'text',   label: 'Dirección',           required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'emergencyContact', type: 'text', label: 'Contacto Emergencia', required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'professionalId', type: 'select', label: 'Kinesiólogo/a', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'medicos', lookupValueField: 'id', lookupLabelField: 'nombre' },
    { name: 'lastVisit',      type: 'date',   label: 'Última Sesión',       required: false,                   showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, format: 'date' },
    { name: 'status',         type: 'select', label: 'Estado',              required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [{ value: 'active', label: 'En Tratamiento' }, { value: 'discharged', label: 'Alta Kinésica' }, { value: 'scheduled', label: 'Evaluación' }],
      badgeColors: { active: '#10b981', discharged: '#6b7280', scheduled: '#3b82f6' }
    },

    // ── Alerts ────────────────────────────────────────────────────────────
    { name: 'allergies',         type: 'tags',     label: 'Alergias',              required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'contraindications', type: 'textarea', label: 'Contraindicaciones',    required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'alertNotes',        type: 'textarea', label: 'Notas de Alerta',       required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },

    // ── Functional assessment boxes (vital-sign grid) ─────────────────────
    { name: 'bp',             type: 'text',   label: 'Dolor (EVA 0-10)',       required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'heartRate',      type: 'text',   label: 'Fuerza Muscular',        required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'temperature',    type: 'text',   label: 'Amplitud Articular',     required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'o2Saturation',   type: 'text',   label: 'Balance / Coordinación', required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'weight',         type: 'text',   label: 'Postura',                required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'height',         type: 'text',   label: 'Marcha',                 required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'bmi',            type: 'text',   label: 'Funcionalidad Global',   required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'respiratoryRate', type: 'text',  label: 'Capacidad Aeróbica',     required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },

    // ── History ───────────────────────────────────────────────────────────
    { name: 'personalHistory',  type: 'textarea', label: 'Motivo de Consulta / Anamnesis', required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'familyHistory',    type: 'textarea', label: 'Antecedentes de Salud',          required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'habits',           type: 'textarea', label: 'Actividad Física y Ocupación',   required: false, showInList: false, showInDetail: true, section: 'history' },

    // ── Surgical / Interventions ──────────────────────────────────────────
    { name: 'surgicalHistory',      type: 'textarea', label: 'Intervenciones Previas', required: false, showInList: false, showInDetail: true, section: 'surgical' },
    { name: 'plannedInterventions', type: 'textarea', label: 'Plan Kinésico',          required: false, showInList: false, showInDetail: true, section: 'surgical' },

    // ── Medications / Prescriptions ───────────────────────────────────────
    { name: 'currentMedications', type: 'textarea', label: 'Prescripción Médica / Indicaciones', required: false, showInList: false, showInDetail: true, section: 'medications', isPrescription: true },
    { name: 'chronicConditions',  type: 'tags',     label: 'Diagnósticos Asociados',             required: false, showInList: false, showInDetail: true, section: 'medications' },

    // ── Diagnosis ─────────────────────────────────────────────────────────
    { name: 'diagnosisCode',  type: 'text',     label: 'Código CIE-10',           required: false, showInList: false, showInDetail: true, section: 'diagnosis', hideInEncounterMode: true },
    { name: 'diagnosisLabel', type: 'text',     label: 'Diagnóstico Kinésico',    required: false, showInList: false, showInDetail: true, section: 'diagnosis' },
    { name: 'differentialDx', type: 'textarea', label: 'Objetivos Terapéuticos',  required: false, showInList: false, showInDetail: true, section: 'diagnosis' },

    // ── SOAP ──────────────────────────────────────────────────────────────
    { name: 'soapSubjective', type: 'textarea', label: 'Motivo y Síntomas (S)',      required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapObjective',  type: 'textarea', label: 'Evaluación Funcional (O)',   required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapAssessment', type: 'textarea', label: 'Diagnóstico Kinésico (A)',   required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapPlan',       type: 'textarea', label: 'Ejercicios e Indicaciones (P)', required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },

    // ── Encounter history ─────────────────────────────────────────────────
    { name: 'encounters', type: 'object-list', label: 'Historial de Sesiones Kinésicas', required: false, showInList: false, showInDetail: true, section: 'encounters' }
  ]
};

// ─────────────────────────── NUTRITION RECORDS (clinical-record) ──────────────
export const SCHEMA_NUTRITION_RECORDS: EntitySchema = {
  entity: {
    key: 'nutrition-records',
    singular: 'Ficha Nutricional',
    plural: 'Fichas Nutricionales',
    icon: 'clipboard',
    moduleType: 'clinical-record',
    description: 'Fichas nutricionales y seguimiento alimentario',
    disableCreate: true,
    disableCreateHint: 'La ficha inicial se crea automáticamente al agendar una cita en el módulo de Citas.'
  },
  fields: [
    // ── Demographics (STABLE) ─────────────────────────────────────────────
    { name: 'fullName',       type: 'text',   label: 'Nombre Completo',     required: true,  isTitle: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', sortable: true, isStable: true },
    { name: 'patientId',      type: 'text',   label: 'ID Paciente',         required: false, isSubtitle: true,  showInList: true,  showInDetail: true,  section: 'demographics', pattern: '^NUT-\\d{5}$', patternMessage: 'Formato: NUT-00000', isStable: true, isAutoGenerated: true },
    { name: 'rut',            type: 'text',   label: 'RUT',                 required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'birthDate',      type: 'date',   label: 'Fecha de Nacimiento', required: true,                    showInList: false, showInDetail: true,  section: 'demographics', format: 'date', isStable: true },
    { name: 'age',            type: 'number', label: 'Edad',                required: false, displayOnly: true,  showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, min: 0, max: 150, isStable: true },
    { name: 'gender',         type: 'select', label: 'Sexo',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select', isStable: true,
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'insurance', type: 'select', label: 'Previsión', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'previsiones', lookupValueField: 'nombre', lookupLabelField: 'nombre' },
    { name: 'phone',          type: 'tel',    label: 'Teléfono',            required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'email',          type: 'email',  label: 'Email',               required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'address',        type: 'text',   label: 'Dirección',           required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'emergencyContact', type: 'text', label: 'Contacto Emergencia', required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'professionalId', type: 'select', label: 'Nutricionista', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'medicos', lookupValueField: 'id', lookupLabelField: 'nombre' },
    { name: 'lastVisit',      type: 'date',   label: 'Último Control',      required: false,                   showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, format: 'date' },
    { name: 'status',         type: 'select', label: 'Estado',              required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [{ value: 'active', label: 'Activo' }, { value: 'discharged', label: 'Alta' }, { value: 'maintenance', label: 'Mantenimiento' }],
      badgeColors: { active: '#10b981', discharged: '#6b7280', maintenance: '#3b82f6' }
    },

    // ── Alerts ────────────────────────────────────────────────────────────
    { name: 'allergies',         type: 'tags',     label: 'Alergias e Intolerancias', required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'contraindications', type: 'textarea', label: 'Restricciones Alimentarias', required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'alertNotes',        type: 'textarea', label: 'Notas de Alerta',           required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },

    // ── Anthropometric boxes (vital-sign grid) ────────────────────────────
    { name: 'bp',             type: 'text',   label: 'Cintura (cm)',            required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'heartRate',      type: 'text',   label: 'Cadera (cm)',             required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'temperature',    type: 'text',   label: 'Circunferencia Braquial', required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'o2Saturation',   type: 'text',   label: 'Masa Grasa (%)',          required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'weight',         type: 'text',   label: 'Peso (kg)',               required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'height',         type: 'text',   label: 'Talla (cm)',              required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'bmi',            type: 'text',   label: 'IMC',                     required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'respiratoryRate', type: 'text',  label: 'Agua Corporal (%)',       required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },

    // ── History ───────────────────────────────────────────────────────────
    { name: 'personalHistory',  type: 'textarea', label: 'Hábitos Alimentarios',             required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'familyHistory',    type: 'textarea', label: 'Antecedentes Familiares de Salud', required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'habits',           type: 'textarea', label: 'Actividad Física y Estilo de Vida', required: false, showInList: false, showInDetail: true, section: 'history' },

    // ── Surgical / Interventions ──────────────────────────────────────────
    { name: 'surgicalHistory',      type: 'textarea', label: 'Cirugías o Patologías Relevantes', required: false, showInList: false, showInDetail: true, section: 'surgical' },
    { name: 'plannedInterventions', type: 'textarea', label: 'Metas Nutricionales',              required: false, showInList: false, showInDetail: true, section: 'surgical' },

    // ── Medications / Plan ────────────────────────────────────────────────
    { name: 'currentMedications', type: 'textarea', label: 'Plan Alimentario',         required: false, showInList: false, showInDetail: true, section: 'medications', isPrescription: true },
    { name: 'chronicConditions',  type: 'tags',     label: 'Diagnósticos Nutricionales', required: false, showInList: false, showInDetail: true, section: 'medications' },

    // ── Diagnosis ─────────────────────────────────────────────────────────
    { name: 'diagnosisCode',  type: 'text',     label: 'CIE-10',                         required: false, showInList: false, showInDetail: true, section: 'diagnosis', hideInEncounterMode: true },
    { name: 'diagnosisLabel', type: 'text',     label: 'Estado Nutricional',             required: false, showInList: false, showInDetail: true, section: 'diagnosis' },
    { name: 'differentialDx', type: 'textarea', label: 'Equivalentes y Recomendaciones', required: false, showInList: false, showInDetail: true, section: 'diagnosis' },

    // ── SOAP ──────────────────────────────────────────────────────────────
    { name: 'soapSubjective', type: 'textarea', label: 'Anamnesis Alimentaria (S)',              required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapObjective',  type: 'textarea', label: 'Evaluación Antropométrica y Dietaria (O)', required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapAssessment', type: 'textarea', label: 'Diagnóstico Nutricional (A)',            required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapPlan',       type: 'textarea', label: 'Plan y Recomendaciones (P)',             required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },

    // ── Encounter history ─────────────────────────────────────────────────
    { name: 'encounters', type: 'object-list', label: 'Historial de Controles Nutricionales', required: false, showInList: false, showInDetail: true, section: 'encounters' }
  ]
};

// ─────────────────────────── FONO RECORDS (clinical-record) ──────────────────
export const SCHEMA_FONO_RECORDS: EntitySchema = {
  entity: {
    key: 'fono-records',
    singular: 'Ficha Fonoaudiológica',
    plural: 'Fichas Fonoaudiológicas',
    icon: 'clipboard',
    moduleType: 'clinical-record',
    description: 'Fichas fonoaudiológicas y registros de terapia del lenguaje',
    disableCreate: true,
    disableCreateHint: 'La ficha inicial se crea automáticamente al agendar una cita en el módulo de Citas.'
  },
  fields: [
    // ── Demographics (STABLE) ─────────────────────────────────────────────
    { name: 'fullName',       type: 'text',   label: 'Nombre Completo',     required: true,  isTitle: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', sortable: true, isStable: true },
    { name: 'patientId',      type: 'text',   label: 'ID Paciente',         required: false, isSubtitle: true,  showInList: true,  showInDetail: true,  section: 'demographics', pattern: '^FNO-\\d{5}$', patternMessage: 'Formato: FNO-00000', isStable: true, isAutoGenerated: true },
    { name: 'rut',            type: 'text',   label: 'RUT',                 required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'birthDate',      type: 'date',   label: 'Fecha de Nacimiento', required: true,                    showInList: false, showInDetail: true,  section: 'demographics', format: 'date', isStable: true },
    { name: 'age',            type: 'number', label: 'Edad',                required: false, displayOnly: true,  showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, min: 0, max: 150, isStable: true },
    { name: 'gender',         type: 'select', label: 'Sexo',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select', isStable: true,
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'insurance', type: 'select', label: 'Previsión', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'previsiones', lookupValueField: 'nombre', lookupLabelField: 'nombre' },
    { name: 'phone',          type: 'tel',    label: 'Teléfono',            required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'email',          type: 'email',  label: 'Email',               required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'address',        type: 'text',   label: 'Dirección',           required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'emergencyContact', type: 'text', label: 'Contacto Emergencia', required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'professionalId', type: 'select', label: 'Fonoaudiólogo/a', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'medicos', lookupValueField: 'id', lookupLabelField: 'nombre' },
    { name: 'lastVisit',      type: 'date',   label: 'Última Sesión',       required: false,                   showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, format: 'date' },
    { name: 'status',         type: 'select', label: 'Estado',              required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [{ value: 'active', label: 'En Terapia' }, { value: 'discharged', label: 'Alta' }, { value: 'scheduled', label: 'Evaluación' }],
      badgeColors: { active: '#10b981', discharged: '#6b7280', scheduled: '#3b82f6' }
    },

    // ── Alerts ────────────────────────────────────────────────────────────
    { name: 'allergies',         type: 'tags',     label: 'Factores de Riesgo',    required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'contraindications', type: 'textarea', label: 'Contraindicaciones',    required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'alertNotes',        type: 'textarea', label: 'Notas de Alerta',       required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },

    // ── Communication domain boxes (vital-sign grid) ──────────────────────
    { name: 'bp',             type: 'text',   label: 'Lenguaje',       required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'heartRate',      type: 'text',   label: 'Habla',          required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'temperature',    type: 'text',   label: 'Voz',            required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'o2Saturation',   type: 'text',   label: 'Audición',       required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'weight',         type: 'text',   label: 'Deglución',      required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'height',         type: 'text',   label: 'Lectoescritura', required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'bmi',            type: 'text',   label: 'Cognición',      required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'respiratoryRate', type: 'text',  label: 'Respiración',    required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },

    // ── History ───────────────────────────────────────────────────────────
    { name: 'personalHistory',  type: 'textarea', label: 'Anamnesis / Motivo de Consulta', required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'familyHistory',    type: 'textarea', label: 'Antecedentes Familiares',        required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'habits',           type: 'textarea', label: 'Instrumentos Aplicados',         required: false, showInList: false, showInDetail: true, section: 'history' },

    // ── Surgical / Interventions ──────────────────────────────────────────
    { name: 'surgicalHistory',      type: 'textarea', label: 'Intervenciones Previas',                  required: false, showInList: false, showInDetail: true, section: 'surgical' },
    { name: 'plannedInterventions', type: 'textarea', label: 'Plan de Intervención Fonoaudiológica',   required: false, showInList: false, showInDetail: true, section: 'surgical' },

    // ── Medications / Indications ─────────────────────────────────────────
    { name: 'currentMedications', type: 'textarea', label: 'Indicaciones y Ejercicios', required: false, showInList: false, showInDetail: true, section: 'medications', isPrescription: true },
    { name: 'chronicConditions',  type: 'tags',     label: 'Diagnósticos Asociados',   required: false, showInList: false, showInDetail: true, section: 'medications' },

    // ── Diagnosis ─────────────────────────────────────────────────────────
    { name: 'diagnosisCode',  type: 'text',     label: 'CIE-10',                       required: false, showInList: false, showInDetail: true, section: 'diagnosis', hideInEncounterMode: true },
    { name: 'diagnosisLabel', type: 'text',     label: 'Diagnóstico Fonoaudiológico',  required: false, showInList: false, showInDetail: true, section: 'diagnosis' },
    { name: 'differentialDx', type: 'textarea', label: 'Objetivos Terapéuticos',       required: false, showInList: false, showInDetail: true, section: 'diagnosis' },

    // ── SOAP ──────────────────────────────────────────────────────────────
    { name: 'soapSubjective', type: 'textarea', label: 'Relato del Paciente / Familia (S)', required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapObjective',  type: 'textarea', label: 'Evaluación Fonoaudiológica (O)',    required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapAssessment', type: 'textarea', label: 'Diagnóstico y Evolución (A)',       required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapPlan',       type: 'textarea', label: 'Plan de Intervención (P)',          required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },

    // ── Encounter history ─────────────────────────────────────────────────
    { name: 'encounters', type: 'object-list', label: 'Historial de Sesiones', required: false, showInList: false, showInDetail: true, section: 'encounters' }
  ]
};

// ─────────────────────────── OT RECORDS (clinical-record) ────────────────────
export const SCHEMA_OT_RECORDS: EntitySchema = {
  entity: {
    key: 'ot-records',
    singular: 'Ficha T.O.',
    plural: 'Fichas T.O.',
    icon: 'clipboard',
    moduleType: 'clinical-record',
    description: 'Fichas de terapia ocupacional y registros funcionales',
    disableCreate: true,
    disableCreateHint: 'La ficha inicial se crea automáticamente al agendar una cita en el módulo de Citas.'
  },
  fields: [
    // ── Demographics (STABLE) ─────────────────────────────────────────────
    { name: 'fullName',       type: 'text',   label: 'Nombre Completo',     required: true,  isTitle: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', sortable: true, isStable: true },
    { name: 'patientId',      type: 'text',   label: 'ID Paciente',         required: false, isSubtitle: true,  showInList: true,  showInDetail: true,  section: 'demographics', pattern: '^TO-\\d{5}$', patternMessage: 'Formato: TO-00000', isStable: true, isAutoGenerated: true },
    { name: 'rut',            type: 'text',   label: 'RUT',                 required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'birthDate',      type: 'date',   label: 'Fecha de Nacimiento', required: true,                    showInList: false, showInDetail: true,  section: 'demographics', format: 'date', isStable: true },
    { name: 'age',            type: 'number', label: 'Edad',                required: false, displayOnly: true,  showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, min: 0, max: 150, isStable: true },
    { name: 'gender',         type: 'select', label: 'Sexo',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select', isStable: true,
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'insurance', type: 'select', label: 'Previsión', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'previsiones', lookupValueField: 'nombre', lookupLabelField: 'nombre' },
    { name: 'phone',          type: 'tel',    label: 'Teléfono',            required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'email',          type: 'email',  label: 'Email',               required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'address',        type: 'text',   label: 'Dirección',           required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'emergencyContact', type: 'text', label: 'Contacto Emergencia', required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'professionalId', type: 'select', label: 'Terapeuta Ocupacional', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'medicos', lookupValueField: 'id', lookupLabelField: 'nombre' },
    { name: 'lastVisit',      type: 'date',   label: 'Última Sesión',       required: false,                   showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, format: 'date' },
    { name: 'status',         type: 'select', label: 'Estado',              required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [{ value: 'active', label: 'En Terapia' }, { value: 'discharged', label: 'Alta' }, { value: 'maintenance', label: 'Seguimiento' }],
      badgeColors: { active: '#10b981', discharged: '#6b7280', maintenance: '#3b82f6' }
    },

    // ── Alerts ────────────────────────────────────────────────────────────
    { name: 'allergies',         type: 'tags',     label: 'Factores de Riesgo',    required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'contraindications', type: 'textarea', label: 'Contraindicaciones',    required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'alertNotes',        type: 'textarea', label: 'Notas de Alerta',       required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },

    // ── Functional area boxes (vital-sign grid) ───────────────────────────
    { name: 'bp',             type: 'text',   label: 'AVD Básicas',           required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'heartRate',      type: 'text',   label: 'AVD Instrumentales',    required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'temperature',    type: 'text',   label: 'Trabajo / Productividad', required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'o2Saturation',   type: 'text',   label: 'Juego / Ocio',          required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'weight',         type: 'text',   label: 'Función Motora',        required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'height',         type: 'text',   label: 'Función Cognitiva',     required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'bmi',            type: 'text',   label: 'Función Sensorial',     required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'respiratoryRate', type: 'text',  label: 'Participación Social',  required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },

    // ── History ───────────────────────────────────────────────────────────
    { name: 'personalHistory',  type: 'textarea', label: 'Anamnesis / Historia Ocupacional', required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'familyHistory',    type: 'textarea', label: 'Contexto Familiar y Social',      required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'habits',           type: 'textarea', label: 'Instrumentos de Evaluación',      required: false, showInList: false, showInDetail: true, section: 'history' },

    // ── Surgical / Plan ───────────────────────────────────────────────────
    { name: 'surgicalHistory',      type: 'textarea', label: 'Intervenciones Previas',         required: false, showInList: false, showInDetail: true, section: 'surgical' },
    { name: 'plannedInterventions', type: 'textarea', label: 'Objetivos y Plan Terapéutico',   required: false, showInList: false, showInDetail: true, section: 'surgical' },

    // ── Medications / Indications ─────────────────────────────────────────
    { name: 'currentMedications', type: 'textarea', label: 'Indicaciones Ocupacionales', required: false, showInList: false, showInDetail: true, section: 'medications', isPrescription: true },
    { name: 'chronicConditions',  type: 'tags',     label: 'Diagnósticos Asociados',    required: false, showInList: false, showInDetail: true, section: 'medications' },

    // ── Diagnosis ─────────────────────────────────────────────────────────
    { name: 'diagnosisCode',  type: 'text',     label: 'CIE-10',                    required: false, showInList: false, showInDetail: true, section: 'diagnosis', hideInEncounterMode: true },
    { name: 'diagnosisLabel', type: 'text',     label: 'Diagnóstico Ocupacional',   required: false, showInList: false, showInDetail: true, section: 'diagnosis' },
    { name: 'differentialDx', type: 'textarea', label: 'Metas de Intervención',     required: false, showInList: false, showInDetail: true, section: 'diagnosis' },

    // ── SOAP ──────────────────────────────────────────────────────────────
    { name: 'soapSubjective', type: 'textarea', label: 'Relato del Paciente (S)',              required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapObjective',  type: 'textarea', label: 'Evaluación Funcional Ocupacional (O)', required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapAssessment', type: 'textarea', label: 'Diagnóstico Ocupacional (A)',          required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapPlan',       type: 'textarea', label: 'Plan de Intervención T.O. (P)',        required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },

    // ── Encounter history ─────────────────────────────────────────────────
    { name: 'encounters', type: 'object-list', label: 'Historial de Sesiones T.O.', required: false, showInList: false, showInDetail: true, section: 'encounters' }
  ]
};

// ─────────────────────────── MATRONA RECORDS (clinical-record) ───────────────
export const SCHEMA_MATRONA_RECORDS: EntitySchema = {
  entity: {
    key: 'matrona-records',
    singular: 'Ficha Obstétrica',
    plural: 'Fichas Obstétricas',
    icon: 'clipboard',
    moduleType: 'clinical-record',
    description: 'Fichas obstétricas y registros ginecológicos',
    disableCreate: true,
    disableCreateHint: 'La ficha inicial se crea automáticamente al agendar una cita en el módulo de Citas.'
  },
  fields: [
    // ── Demographics (STABLE) ─────────────────────────────────────────────
    { name: 'fullName',       type: 'text',   label: 'Nombre Completo',     required: true,  isTitle: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', sortable: true, isStable: true },
    { name: 'patientId',      type: 'text',   label: 'ID Paciente',         required: false, isSubtitle: true,  showInList: true,  showInDetail: true,  section: 'demographics', pattern: '^MAT-\\d{5}$', patternMessage: 'Formato: MAT-00000', isStable: true, isAutoGenerated: true },
    { name: 'rut',            type: 'text',   label: 'RUT',                 required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'birthDate',      type: 'date',   label: 'Fecha de Nacimiento', required: true,                    showInList: false, showInDetail: true,  section: 'demographics', format: 'date', isStable: true },
    { name: 'age',            type: 'number', label: 'Edad',                required: false, displayOnly: true,  showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, min: 0, max: 150, isStable: true },
    { name: 'gender',         type: 'select', label: 'Sexo',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select', isStable: true,
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'insurance', type: 'select', label: 'Previsión', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'previsiones', lookupValueField: 'nombre', lookupLabelField: 'nombre' },
    { name: 'phone',          type: 'tel',    label: 'Teléfono',            required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'email',          type: 'email',  label: 'Email',               required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'address',        type: 'text',   label: 'Dirección',           required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'emergencyContact', type: 'text', label: 'Contacto Emergencia', required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'professionalId', type: 'select', label: 'Matrona/Matrón', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'medicos', lookupValueField: 'id', lookupLabelField: 'nombre' },
    { name: 'lastVisit',      type: 'date',   label: 'Último Control',      required: false,                   showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, format: 'date' },
    { name: 'status',         type: 'select', label: 'Estado',              required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [{ value: 'active', label: 'Activo' }, { value: 'pregnancy', label: 'Embarazo' }, { value: 'postpartum', label: 'Puerperio' }, { value: 'gynecological', label: 'Ginecológico' }],
      badgeColors: { active: '#10b981', pregnancy: '#ec4899', postpartum: '#8b5cf6', gynecological: '#3b82f6' }
    },

    // ── Alerts ────────────────────────────────────────────────────────────
    { name: 'allergies',         type: 'tags',     label: 'Alergias',           required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'contraindications', type: 'textarea', label: 'Contraindicaciones', required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'alertNotes',        type: 'textarea', label: 'Notas de Alerta',    required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },

    // ── Obstetric parameters (vital-sign grid) ────────────────────────────
    { name: 'bp',             type: 'text',   label: 'Presión Arterial',  required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals',
      pattern: '^\\s*([6-9]\\d|1\\d\\d|2[0-5]\\d|260)\\s*\\/\\s*([3-9]\\d|1[0-5]\\d|160)\\s*$',
      patternMessage: 'Formato sistólica/diastólica, ej. 120/80 (sistólica 60–260, diastólica 30–160).' },
    { name: 'heartRate',      type: 'text',   label: 'Frec. Cardíaca',    required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'temperature',    type: 'text',   label: 'Temperatura (°C)',  required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'o2Saturation',   type: 'text',   label: 'Saturación O₂',    required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'weight',         type: 'text',   label: 'Peso (kg)',         required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'height',         type: 'text',   label: 'Talla (cm)',        required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'bmi',            type: 'text',   label: 'IMC',               required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'respiratoryRate', type: 'text',  label: 'FCF (lat/min)',     required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },

    // ── History ───────────────────────────────────────────────────────────
    { name: 'personalHistory',  type: 'textarea', label: 'Antecedentes Gíneco-Obstétricos', required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'familyHistory',    type: 'textarea', label: 'Antecedentes Familiares',         required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'habits',           type: 'textarea', label: 'Hábitos y Estilo de Vida',        required: false, showInList: false, showInDetail: true, section: 'history' },

    // ── Surgical / Plan ───────────────────────────────────────────────────
    { name: 'surgicalHistory',      type: 'textarea', label: 'Procedimientos Previos',              required: false, showInList: false, showInDetail: true, section: 'surgical' },
    { name: 'plannedInterventions', type: 'textarea', label: 'Plan de Control y Seguimiento',       required: false, showInList: false, showInDetail: true, section: 'surgical' },

    // ── Medications ───────────────────────────────────────────────────────
    { name: 'currentMedications', type: 'textarea', label: 'Prescripción / Indicaciones', required: false, showInList: false, showInDetail: true, section: 'medications', isPrescription: true },
    { name: 'chronicConditions',  type: 'tags',     label: 'Diagnósticos Activos',       required: false, showInList: false, showInDetail: true, section: 'medications' },

    // ── Diagnosis ─────────────────────────────────────────────────────────
    { name: 'diagnosisCode',  type: 'text',     label: 'CIE-10',                                 required: false, showInList: false, showInDetail: true, section: 'diagnosis', hideInEncounterMode: true },
    { name: 'diagnosisLabel', type: 'text',     label: 'Diagnóstico Obstétrico / Ginecológico',  required: false, showInList: false, showInDetail: true, section: 'diagnosis' },
    { name: 'differentialDx', type: 'textarea', label: 'Plan de Tratamiento',                    required: false, showInList: false, showInDetail: true, section: 'diagnosis' },

    // ── SOAP ──────────────────────────────────────────────────────────────
    { name: 'soapSubjective', type: 'textarea', label: 'Motivo de Consulta (S)',          required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapObjective',  type: 'textarea', label: 'Control y Examen Clínico (O)',    required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapAssessment', type: 'textarea', label: 'Diagnóstico (A)',                 required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapPlan',       type: 'textarea', label: 'Procedimientos e Indicaciones (P)', required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },

    // ── Encounter history ─────────────────────────────────────────────────
    { name: 'encounters', type: 'object-list', label: 'Historial de Controles', required: false, showInList: false, showInDetail: true, section: 'encounters' }
  ]
};

// ─────────────────────────── TECNOMED RECORDS (clinical-record) ───────────────
export const SCHEMA_TECNOMED_RECORDS: EntitySchema = {
  entity: {
    key: 'tecnomed-records',
    singular: 'Ficha Tecnomédica',
    plural: 'Fichas Tecnomédicas',
    icon: 'clipboard',
    moduleType: 'clinical-record',
    description: 'Fichas tecnomédicas y registros de exámenes de laboratorio',
    disableCreate: true,
    disableCreateHint: 'La ficha inicial se crea automáticamente al agendar una cita en el módulo de Citas.'
  },
  fields: [
    // ── Demographics (STABLE) ─────────────────────────────────────────────
    { name: 'fullName',       type: 'text',   label: 'Nombre Completo',     required: true,  isTitle: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'search', sortable: true, isStable: true },
    { name: 'patientId',      type: 'text',   label: 'ID Paciente',         required: false, isSubtitle: true,  showInList: true,  showInDetail: true,  section: 'demographics', pattern: '^TM-\\d{5}$', patternMessage: 'Formato: TM-00000', isStable: true, isAutoGenerated: true },
    { name: 'rut',            type: 'text',   label: 'RUT',                 required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'birthDate',      type: 'date',   label: 'Fecha de Nacimiento', required: true,                    showInList: false, showInDetail: true,  section: 'demographics', format: 'date', isStable: true },
    { name: 'age',            type: 'number', label: 'Edad',                required: false, displayOnly: true,  showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, min: 0, max: 150, isStable: true },
    { name: 'gender',         type: 'select', label: 'Sexo',                required: true,                    showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select', isStable: true,
      options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }, { value: 'other', label: 'Otro' }]
    },
    { name: 'insurance', type: 'select', label: 'Previsión', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'previsiones', lookupValueField: 'nombre', lookupLabelField: 'nombre' },
    { name: 'phone',          type: 'tel',    label: 'Teléfono',            required: true,                    showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'email',          type: 'email',  label: 'Email',               required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'address',        type: 'text',   label: 'Dirección',           required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'emergencyContact', type: 'text', label: 'Contacto Emergencia', required: false,                   showInList: false, showInDetail: true,  section: 'demographics', isStable: true },
    { name: 'professionalId', type: 'select', label: 'Tecnólogo Médico', required: true, showInList: true, showInDetail: true, section: 'demographics', filterable: true, filterType: 'select', isStable: true, lookupEntity: 'medicos', lookupValueField: 'id', lookupLabelField: 'nombre' },
    { name: 'lastVisit',      type: 'date',   label: 'Último Examen',       required: false,                   showInList: true,  showInDetail: true,  section: 'demographics', sortable: true, format: 'date' },
    { name: 'status',         type: 'select', label: 'Estado',              required: true,  isBadge: true,     showInList: true,  showInDetail: true,  section: 'demographics', filterable: true, filterType: 'select',
      options: [{ value: 'active', label: 'Activo' }, { value: 'completed', label: 'Completado' }, { value: 'pending', label: 'Pendiente' }],
      badgeColors: { active: '#10b981', completed: '#6b7280', pending: '#f59e0b' }
    },

    // ── Alerts ────────────────────────────────────────────────────────────
    { name: 'allergies',         type: 'tags',     label: 'Alergias',           required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'contraindications', type: 'textarea', label: 'Contraindicaciones', required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },
    { name: 'alertNotes',        type: 'textarea', label: 'Notas de Alerta',    required: false, isAlert: true, showInList: false, showInDetail: true, section: 'alerts' },

    // ── Lab parameter boxes (vital-sign grid) ─────────────────────────────
    { name: 'bp',             type: 'text',   label: 'Glucosa (mg/dL)',       required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'heartRate',      type: 'text',   label: 'Hemoglobina (g/dL)',    required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'temperature',    type: 'text',   label: 'Hematocrito (%)',       required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'o2Saturation',   type: 'text',   label: 'Leucocitos (/µL)',      required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'weight',         type: 'text',   label: 'Plaquetas (/µL)',       required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'height',         type: 'text',   label: 'Colesterol (mg/dL)',    required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'bmi',            type: 'text',   label: 'Triglicéridos (mg/dL)', required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },
    { name: 'respiratoryRate', type: 'text',  label: 'Creatinina (mg/dL)',    required: false, isVitalSign: true, showInList: false, showInDetail: true, section: 'vitals' },

    // ── History ───────────────────────────────────────────────────────────
    { name: 'personalHistory',  type: 'textarea', label: 'Antecedentes Relevantes',       required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'familyHistory',    type: 'textarea', label: 'Antecedentes Familiares',       required: false, showInList: false, showInDetail: true, section: 'history' },
    { name: 'habits',           type: 'textarea', label: 'Contexto Clínico del Examen',   required: false, showInList: false, showInDetail: true, section: 'history' },

    // ── Surgical / Programmed exams ───────────────────────────────────────
    { name: 'surgicalHistory',      type: 'textarea', label: 'Procedimientos Previos Relacionados', required: false, showInList: false, showInDetail: true, section: 'surgical' },
    { name: 'plannedInterventions', type: 'textarea', label: 'Exámenes Programados',                required: false, showInList: false, showInDetail: true, section: 'surgical' },

    // ── Report / Informe ──────────────────────────────────────────────────
    { name: 'currentMedications', type: 'textarea', label: 'Informe de Examen',        required: false, showInList: false, showInDetail: true, section: 'medications', isPrescription: true },
    { name: 'chronicConditions',  type: 'tags',     label: 'Diagnósticos de Referencia', required: false, showInList: false, showInDetail: true, section: 'medications' },

    // ── Diagnosis ─────────────────────────────────────────────────────────
    { name: 'diagnosisCode',  type: 'text',     label: 'CIE-10 / Código',         required: false, showInList: false, showInDetail: true, section: 'diagnosis', hideInEncounterMode: true },
    { name: 'diagnosisLabel', type: 'text',     label: 'Hallazgo Principal',      required: false, showInList: false, showInDetail: true, section: 'diagnosis' },
    { name: 'differentialDx', type: 'textarea', label: 'Observaciones Adicionales', required: false, showInList: false, showInDetail: true, section: 'diagnosis' },

    // ── SOAP ──────────────────────────────────────────────────────────────
    { name: 'soapSubjective', type: 'textarea', label: 'Solicitud Médica y Contexto (S)', required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapObjective',  type: 'textarea', label: 'Resultados del Examen (O)',       required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapAssessment', type: 'textarea', label: 'Interpretación (A)',              required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },
    { name: 'soapPlan',       type: 'textarea', label: 'Informe y Recomendaciones (P)',   required: false, showInList: false, showInDetail: true, section: 'soap', hideInForm: true },

    // ── Encounter history ─────────────────────────────────────────────────
    { name: 'encounters', type: 'object-list', label: 'Historial de Exámenes', required: false, showInList: false, showInDetail: true, section: 'encounters' }
  ]
};

// ─── Agendas por especialidad (calendar) ──────────────────────────────────────
//
// Las 6 especialidades que no tenían agenda propia (kinesiología, nutrición,
// fonoaudiología, terapia ocupacional, matrona, tecnología médica) caían en la
// agenda genérica `appointments`, cuyo `encounterEntity` es `clinical-records`
// (ficha de medicina general). El atajo "Agregar Antecedente" desde el detalle
// de una cita las mandaba al formulario equivocado.
//
// Cada agenda propia es un alias más de la tabla `appointment` en el BFF (ver
// KEY_ALIASES en lambda-dairi-bff/config/entities.mjs), así que los campos son
// exactamente los de `appointments` — lo único que cambia es la metadata de la
// entidad: etiquetas, y sobre todo `encounterEntity`, que apunta a la ficha de
// la especialidad. Se construyen con una fábrica para que no puedan divergir
// campo a campo del contrato que el BFF realmente persiste (service/dateTime/
// durationMinutes/status/modality/notes + patientName/professionalName de join).
//
// Icono: todas usan `calendar`. El sidebar (shell.component.html) sólo dibuja un
// set fijo de iconos y cae a un icono genérico de lista para cualquier otro
// valor, así que un icono "más expresivo" por especialidad se vería peor, no
// mejor. `dental-sessions` usa `tooth` porque ese sí existe en el set.
function specialtyCalendarSchema(meta: {
  key: string; singular: string; plural: string; description: string; encounterEntity: string;
  /** Sólo para las agendas que ya tenían un icono propio en el set del sidebar. */
  icon?: string;
  /** Etiqueta del campo `service` (el título de la cita) cuando la especialidad
   *  le da un nombre propio — p.ej. "Procedimiento" en odontología. */
  serviceLabel?: string;
}): EntitySchema {
  return {
    entity: {
      key: meta.key,
      singular: meta.singular,
      plural: meta.plural,
      icon: meta.icon ?? 'calendar',
      moduleType: 'calendar',
      description: meta.description,
      encounterEntity: meta.encounterEntity,
      encounterMatchField: 'patientName'
    },
    fields: [
      { name: 'service',          type: 'text',     label: meta.serviceLabel ?? 'Servicio', required: true,  isTitle: true,         showInList: true,  showInDetail: true,  filterable: true, filterType: 'search' },
      // `appointment.patient_id` es NOT NULL y es la única forma de decir de quién
      // es la cita: `patientName` viene del JOIN con `patient` y toDb lo descarta.
      // Con `patientName` como campo escribible el formulario de "Nueva cita"
      // siempre respondía 500 (null value in column "patient_id"). El paciente se
      // elige de la lista real y `patientName` queda como lectura para la agenda.
      { name: 'patientId',        type: 'select',   label: 'Paciente',         required: true,  showInList: false, showInDetail: false,
        lookupEntity: 'patients', lookupValueField: 'id', lookupLabelField: 'nombre' },
      { name: 'patientName',      type: 'text',     label: 'Paciente',         required: false, isSubtitle: true,      showInList: true,  showInDetail: true,  filterable: true, filterType: 'search', displayOnly: true },
      { name: 'dateTime',         type: 'datetime', label: 'Fecha y hora',     required: true,  isCalendarStart: true, showInList: true,  showInDetail: true,  sortable: true },
      { name: 'durationMinutes',  type: 'number',   label: 'Duración (min)',   required: false,                        showInList: true,  showInDetail: true,  min: 0 },
      { name: 'status',           type: 'select',   label: 'Estado',           required: true,  isBadge: true,         showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
        lookupEntity: 'appointment-statuses',
        options: [
          { value: 'scheduled',  label: 'Agendada'    },
          { value: 'confirmed',  label: 'Confirmada'  },
          { value: 'completed',  label: 'Completada'  },
          { value: 'cancelled',  label: 'Cancelada'   },
          { value: 'no_show',    label: 'No asistió'  }
        ],
        badgeColors: { scheduled: '#3b82f6', confirmed: '#8b5cf6', completed: '#10b981', cancelled: '#ef4444', no_show: '#f59e0b' }
      },
      { name: 'modality',         type: 'select',   label: 'Modalidad',        required: false, isBadge: true,         showInList: true,  showInDetail: true,
        lookupEntity: 'appointment-modalities',
        options: [
          { value: 'in_person', label: 'Presencial'    },
          { value: 'video',     label: 'Videoconsulta' },
          { value: 'phone',     label: 'Teléfono'      }
        ],
        badgeColors: { in_person: '#6366f1', video: '#0891b2', phone: '#10b981' }
      },
      // También resuelto por JOIN (professional.name). createEntity estampa el
      // professional_id del profesional autenticado, así que tampoco se escribe.
      { name: 'professionalName', type: 'text',     label: 'Profesional',      required: false,                        showInList: true,  showInDetail: true, displayOnly: true },
      { name: 'notes',            type: 'textarea', label: 'Notas',            required: false,                        showInList: false, showInDetail: true }
    ]
  };
}

// psych-sessions y dental-sessions existían desde antes que la fábrica, con
// campos heredados de los datos de demo (`title`, `startDate`, `endDate`,
// `sessionType`/`treatmentType`, `room`/`chair`, `patientEmail`) que la tabla
// `appointment` nunca tuvo. Mientras estuvieron duplicadas inline con
// `fields: []` en ENTITY_CATALOG eso no se notaba; al registrarlas de verdad
// pasaron a ser el contrato real del calendario y del formulario, y ninguno de
// esos campos viaja de ida ni de vuelta (ver `appointments.toDb/fromDb` en
// lambda-dairi-bff/config/entities.mjs). Ahora salen de la misma fábrica que
// las otras seis, así que no pueden volver a divergir.
export const SCHEMA_PSYCH_SESSIONS: EntitySchema = specialtyCalendarSchema({
  key: 'psych-sessions',
  singular: 'Sesión',
  plural: 'Sesiones',
  description: 'Agenda de sesiones terapéuticas',
  encounterEntity: 'psych-records',
  serviceLabel: 'Motivo de sesión'
});

export const SCHEMA_DENTAL_SESSIONS: EntitySchema = specialtyCalendarSchema({
  key: 'dental-sessions',
  singular: 'Cita Dental',
  plural: 'Citas Dentales',
  description: 'Agenda de citas odontológicas',
  encounterEntity: 'dental-records',
  icon: 'tooth',
  serviceLabel: 'Procedimiento'
});

export const SCHEMA_KINE_SESSIONS: EntitySchema = specialtyCalendarSchema({
  key: 'kine-sessions',
  singular: 'Sesión Kinésica',
  plural: 'Sesiones Kinésicas',
  description: 'Agenda de sesiones kinésicas y rehabilitación',
  encounterEntity: 'kine-records'
});

export const SCHEMA_NUTRITION_SESSIONS: EntitySchema = specialtyCalendarSchema({
  key: 'nutrition-sessions',
  singular: 'Consulta Nutricional',
  plural: 'Consultas Nutricionales',
  description: 'Agenda de consultas nutricionales',
  encounterEntity: 'nutrition-records'
});

export const SCHEMA_FONO_SESSIONS: EntitySchema = specialtyCalendarSchema({
  key: 'fono-sessions',
  singular: 'Sesión Fonoaudiológica',
  plural: 'Sesiones Fonoaudiológicas',
  description: 'Agenda de sesiones fonoaudiológicas',
  encounterEntity: 'fono-records'
});

export const SCHEMA_OT_SESSIONS: EntitySchema = specialtyCalendarSchema({
  key: 'ot-sessions',
  singular: 'Sesión T.O.',
  plural: 'Sesiones T.O.',
  description: 'Agenda de sesiones de terapia ocupacional',
  encounterEntity: 'ot-records'
});

export const SCHEMA_MATRONA_SESSIONS: EntitySchema = specialtyCalendarSchema({
  key: 'matrona-sessions',
  singular: 'Consulta Obstétrica',
  plural: 'Consultas Obstétricas',
  description: 'Agenda de consultas obstétricas y ginecológicas',
  encounterEntity: 'matrona-records'
});

export const SCHEMA_TECNOMED_SESSIONS: EntitySchema = specialtyCalendarSchema({
  key: 'tecnomed-sessions',
  singular: 'Examen',
  plural: 'Exámenes',
  description: 'Agenda de exámenes y procedimientos tecnomédicos',
  encounterEntity: 'tecnomed-records'
});

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
    { name: 'notes', type: 'textarea', label: 'Observaciones', required: false, showInList: false, showInDetail: true },
    // ── Comisión profesional ──────────────────────────────────────────────────
    { name: 'professionalName',  type: 'text',   label: 'Profesional',      required: false, showInList: false, showInDetail: true },
    { name: 'commissionRate',    type: 'number', label: 'Comisión (%)',      required: false, showInList: false, showInDetail: true, min: 0, max: 100 },
    { name: 'commissionAmount',  type: 'number', label: 'Monto Comisión',   required: false, showInList: false, showInDetail: true, min: 0, format: 'currency' },
    { name: 'commissionStatus',  type: 'select', label: 'Estado Comisión',  required: false, isBadge: true,    showInList: false, showInDetail: true,
      options: [
        { value: 'pendiente',  label: 'Pendiente'  },
        { value: 'pagada',     label: 'Pagada'     },
        { value: 'no_aplica',  label: 'No aplica'  }
      ],
      badgeColors: { pendiente: '#f59e0b', pagada: '#10b981', no_aplica: '#6b7280' }
    }
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
    { name: 'description',  type: 'text',          label: 'Descripción',        required: true,  isTitle: true,    showInList: true,  showInDetail: true,  filterable: true, filterType: 'search', sortable: true },
    { name: 'supplierId',   type: 'entity-select', label: 'Proveedor',          required: false,                  showInList: false, showInDetail: false,
      relatedEntity: 'suppliers', relatedLabelField: 'name' },
    { name: 'supplierName', type: 'text',          label: 'Proveedor / Origen', isSubtitle: true, showInList: true,  showInDetail: true,  displayOnly: true },
    { name: 'date',         type: 'date',          label: 'Fecha',              required: true,                   showInList: true,  showInDetail: true,  sortable: true },
    { name: 'categoryId',   type: 'entity-select', label: 'Categoría',          required: true,                   showInList: false, showInDetail: false,
      relatedEntity: 'categories', relatedLabelField: 'name',
      relatedFilterField: 'type', relatedFilterValue: 'expense' },
    { name: 'categoryName', type: 'text',          label: 'Categoría',          isBadge: true,    showInList: true,  showInDetail: true,  displayOnly: true,
      badgeColors: { 'Arriendo': '#f59e0b', 'Servicios Básicos': '#3b82f6', 'Insumos': '#6366f1', 'Equipamiento': '#8b5cf6' }
    },
    { name: 'amount',        type: 'number', label: 'Monto (CLP)',      required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 0, format: 'currency' },
    { name: 'paymentMethod', type: 'select', label: 'Medio de pago',    required: true,  isBadge: true,    showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
      lookupEntity: 'expense-payment-methods',
      options: [
        { value: 'cash',     label: 'Efectivo'      },
        { value: 'transfer', label: 'Transferencia' },
        { value: 'card',     label: 'Tarjeta'       },
        { value: 'other',    label: 'Otro'          }
      ],
      badgeColors: { cash: '#10b981', transfer: '#6366f1', card: '#3b82f6', other: '#6b7280' }
    },
    { name: 'status', type: 'select', label: 'Estado', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
      lookupEntity: 'expense-statuses',
      options: [
        { value: 'pending',   label: 'Pendiente' },
        { value: 'paid',      label: 'Pagado'    },
        { value: 'cancelled', label: 'Cancelado' }
      ],
      badgeColors: { pending: '#f59e0b', paid: '#10b981', cancelled: '#ef4444' }
    },
    { name: 'receiptNumber', type: 'text',     label: 'N° Documento',   required: false, showInList: false, showInDetail: true },
    { name: 'notes',         type: 'textarea', label: 'Observaciones',  required: false, showInList: false, showInDetail: true }
  ]
};


const SESSION_KEY  = 'auth_session';
const REFRESH_KEY  = 'dairi_refresh';
/**
 * Increment this whenever the schema structure changes so that any cached
 * session is invalidated and the user must re-login.
 */
const SESSION_VERSION = 17;

/**
 * Where the session lives.
 *
 * On the web this stays sessionStorage: the session dies with the tab, which is
 * the safer default on a shared or public computer.
 *
 * In the Capacitor app that behaviour is wrong. Android destroys backgrounded
 * WebView processes routinely to reclaim memory, and sessionStorage goes with
 * them — so leaving the app to take a phone call was enough to log the user out.
 * The refresh token (7-day, strictly more powerful than the 2h access token) is
 * already persisted to localStorage on this same device, so keeping the session
 * alongside it does not widen the exposure; it only stops the app throwing users
 * back to the login screen for no reason. There is no startup silent-refresh
 * path to fall back on — refreshAccessToken() only runs when a 401 comes back
 * from a request an unauthenticated app never makes.
 */
function sessionStore(): Storage {
  return Capacitor.isNativePlatform() ? localStorage : sessionStorage;
}

// ─────────────────────────────────────────────────────────────────────────────

/** Shape returned by DELETE /api/auth/account (see lambda-auth handleDeleteAccount). */
export interface DeleteAccountResponse {
  message: string;
  alreadyDeleted?: boolean;
  deleted?:    { account: string | null; refreshTokens: number; moduleGrants?: boolean; encryptionSettings?: boolean };
  anonymized?: { appUser?: number; professionals?: number; professionalIds?: number[] };
  retained?:   { note?: string; clinicalRecords?: string };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _state  = signal<AuthState>(this.loadFromStorage());
  private http    = inject(HttpClient);
  private cryptoSvc = inject(CryptoService);

  readonly user    = computed(() => this._state().user);
  readonly token   = computed(() => this._state().token);
  readonly schemas = computed(() => this._state().schemas);
  readonly isAuthenticated = computed(() => this._state().authenticated);
  readonly zkEnabled    = computed(() => this._state().zkEnabled ?? false);
  readonly isSuperAdmin = computed(() => this._state().user?.role === 'superadmin');
  readonly isAdmin      = computed(() => {
    const role = this._state().user?.role;
    return role === 'admin' || role === 'superadmin';
  });
  readonly hasTeamChat = computed(() =>
    this._state().schemas.some(s => s.entity.key === 'user-management') || this.isSuperAdmin()
  );
  /**
   * Plan Starter (cuenta "agenda"): vive 100% en DynamoDB y el BFF la bloquea
   * fuera del calendario. Es el único plan que el backend marca explícitamente
   * — Pro/Enterprise no llevan `accountType`, así que la ausencia del campo
   * significa Pro. Ver AuthUser.accountType.
   */
  readonly isStarterPlan = computed(() =>
    this._state().user?.accountType === 'agenda'
  );

  /**
   * Profesionales que el plan permite en total, y adicionales sobre el titular.
   *   Starter → 1 en total (0 adicionales)
   *   Pro     → 3 en total (titular + 2 adicionales)
   * El servidor aplica el mismo límite en POST /api/professionals/onboarding
   * (`maxExtraFor`); esto es sólo la cara visible.
   */
  readonly maxExtraProfessionals = computed(() => this.isStarterPlan() ? 0 : 2);
  readonly maxProfessionals      = computed(() => this.maxExtraProfessionals() + 1);

  readonly isProfessionalView = computed(() =>
    this._state().user?.professionalId != null
  );
  readonly myProfessionalId = computed(() =>
    this._state().user?.professionalId ?? null
  );

  constructor(private router: Router) {
    // Restore ZK state from session after all field initializers have run
    const state = this._state();
    if (state.authenticated) {
      this.cryptoSvc.setZkEnabled(state.zkEnabled ?? false);
    }
  }

  /**
   * POST /api/auth/login — real backend (API Gateway → Lambda → RDS PostgreSQL)
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', credentials).pipe(
      catchError(err => throwError(() =>
        new Error(err.error?.message ?? 'Credenciales inválidas. Verifique su email y contraseña.')
      ))
    );
  }

  /**
   * POST /api/auth/google — validates Google ID token server-side and returns the same
   * AuthResponse format as /api/auth/login (token + user + authorized schemas).
   *
   * The backend should verify the idToken using Google's tokeninfo endpoint or
   * the google-auth-library, then look up or provision the user and return the session.
   */
  loginWithGoogle(idToken: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/google', { idToken }).pipe(
      catchError(err => throwError(() =>
        new Error(err.error?.message ?? 'No se pudo iniciar sesión con Google. Intenta de nuevo.')
      ))
    );
  }

  /**
   * Stores the auth response from the backend and updates the reactive state.
   * Also persists the refresh token to localStorage for cross-tab persistence.
   */
  handleAuthResponse(response: AuthResponse): void {
    const state: AuthState = {
      authenticated: true,
      token: response.token,
      user: response.user,
      schemas: response.schemas,
      zkEnabled: response.zkEnabled ?? false,
    };
    this._state.set(state);
    this.cryptoSvc.setZkEnabled(state.zkEnabled ?? false);
    try {
      sessionStore().setItem(SESSION_KEY, JSON.stringify({ ...state, _v: SESSION_VERSION }));
    } catch { /* storage unavailable (private mode, quota exceeded) */ }
    if (response.refreshToken) {
      this.saveRefreshToken(response.refreshToken);
    }
  }

  /** Updates the ZK encryption flag in session and CryptoService (called after onboarding). */
  updateZkEnabled(enabled: boolean): void {
    this._state.update(s => ({ ...s, zkEnabled: enabled }));
    this.cryptoSvc.setZkEnabled(enabled);
    try {
      sessionStore().setItem(SESSION_KEY, JSON.stringify({ ...this._state(), _v: SESSION_VERSION }));
    } catch { /* storage unavailable */ }
  }

  logout(): void {
    const refreshToken = this.loadRefreshToken();
    if (refreshToken) {
      // Fire-and-forget — revoke server-side without blocking navigation
      this.http.post('/api/auth/logout', { refreshToken }).subscribe({ error: () => {} });
    }
    this._state.set({ authenticated: false, token: null, user: null, schemas: [] });
    sessionStore().removeItem(SESSION_KEY);
    this.clearRefreshToken();
    this.cryptoSvc.clearKey();
    this.router.navigate(['/login']);
  }

  /**
   * DELETE /api/auth/account — permanent, irreversible account deletion.
   *
   * Required by Apple App Review 5.1.1(v) and Google Play's data-deletion policy
   * (see MOBILE_STORE_PUBLISHING.md §0.3). The backend identifies the account
   * from the JWT alone — no id is sent — and re-verifies the password, so a
   * stolen access token is not by itself enough to destroy an account.
   *
   * The account's login identity is destroyed; the clinical records the
   * professional created are retained, and their `professional` row is
   * anonymized in place so those records stay internally consistent.
   */
  deleteAccount(password: string): Observable<DeleteAccountResponse> {
    return this.http.request<DeleteAccountResponse>('DELETE', '/api/auth/account', {
      body: { password }
    }).pipe(
      catchError(err => throwError(() =>
        new Error(err.error?.message ?? 'No se pudo eliminar la cuenta. Vuelve a intentarlo.')
      ))
    );
  }

  /**
   * Drops all local session state without calling /api/auth/logout and without
   * navigating anywhere. Used after account deletion: the server-side session is
   * already gone, so a logout call would be a guaranteed 401, and the caller
   * needs to choose its own destination (the deletion acknowledgment) rather
   * than being bounced to /login.
   */
  clearLocalSession(): void {
    this._state.set({ authenticated: false, token: null, user: null, schemas: [] });
    try { sessionStore().removeItem(SESSION_KEY); } catch { /* storage unavailable */ }
    this.clearRefreshToken();
    this.cryptoSvc.clearKey();
  }

  /**
   * Uses the stored refresh token to obtain a new access token.
   * Called by the token-refresh interceptor on 401 responses.
   */
  refreshAccessToken(): Observable<void> {
    const refreshToken = this.loadRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }
    return this.http.post<AuthResponse>('/api/auth/refresh', { refreshToken }).pipe(
      tap(res => this.handleAuthResponse(res)),
      map(() => undefined),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  /** Returns the authorized entity schemas — the backend decides what the user can see */
  getAuthorizedSchemas(): EntitySchema[] {
    return this._state().schemas;
  }

  /** Check if user has access to a specific entity key */
  canAccessEntity(key: string): boolean {
    return this._state().schemas.some(s => s.entity.key === key);
  }

  private loadRefreshToken(): string | null {
    try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
  }

  private saveRefreshToken(raw: string): void {
    try { localStorage.setItem(REFRESH_KEY, raw); } catch { /* quota exceeded */ }
  }

  private clearRefreshToken(): void {
    try { localStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ }
  }

  private loadFromStorage(): AuthState {
    try {
      const raw = sessionStore().getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthState & { _v?: number };
        // Stale session from a previous deploy → force re-login so new schemas apply
        if (parsed._v !== SESSION_VERSION) {
          sessionStore().removeItem(SESSION_KEY);
          return { authenticated: false, token: null, user: null, schemas: [] };
        }
        return parsed;
      }
    } catch { /* ignore */ }
    return { authenticated: false, token: null, user: null, schemas: [] };
  }

}
