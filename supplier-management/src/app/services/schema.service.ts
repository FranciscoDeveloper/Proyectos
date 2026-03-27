import { Injectable, inject } from '@angular/core';
import { EntityMeta, EntityPayload, EntitySchema } from '../models/entity-schema.model';
import { AuthService } from './auth.service';

/**
 * Provides entity schemas to the rest of the app.
 *
 * After login, the schemas come from AuthService (which received them from the
 * backend auth response). This means the frontend only renders what the backend
 * authorized for the current user.
 *
 * The static `catalog` still holds the seed data (mock rows), but the available
 * schemas and navigation are controlled by the auth response.
 */
@Injectable({ providedIn: 'root' })
export class SchemaService {
  private auth = inject(AuthService);

  private readonly catalog: Record<string, EntityPayload> = {

    // ─────────────────────────── CITAS ───────────────────────────
    appointments: {
      schema: {
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
              { value: 'scheduled', label: 'Programada' },
              { value: 'completed', label: 'Completada'  },
              { value: 'cancelled', label: 'Cancelada'   },
              { value: 'no_show',   label: 'No asistió'  }
            ],
            badgeColors: { scheduled: '#3b82f6', completed: '#10b981', cancelled: '#ef4444', no_show: '#f59e0b' }
          },
          { name: 'patientEmail', type: 'email', label: 'Email del paciente', required: false, showInList: false, showInDetail: true },
          { name: 'room',  type: 'text',     label: 'Consultorio', required: false, showInList: true,  showInDetail: true  },
          { name: 'notes', type: 'textarea', label: 'Notas',       required: false, showInList: false, showInDetail: true  }
        ]
      },
      data: [
        // ── Semana 1 (2–6 mar) ──────────────────────────────────────────────
        { id: 1,  title: 'Control de hipertensión',           patientName: 'María González López',    patientEmail: 'maria.g@email.com',   startDate: '2026-03-03T09:00', endDate: '2026-03-03T09:45', status: 'completed', room: 'Consultorio 1', notes: 'Ajuste de dosis antihipertensiva.',          createdAt: '2026-02-20', updatedAt: '2026-03-03' },
        { id: 2,  title: 'Revisión post-operatoria',          patientName: 'Carlos Fernández Torres', patientEmail: 'carlos.f@email.com',  startDate: '2026-03-03T09:45', endDate: '2026-03-03T10:30', status: 'completed', room: 'Consultorio 1', notes: 'Evolución favorable tras stent coronario.',   createdAt: '2026-02-22', updatedAt: '2026-03-03' },
        { id: 3,  title: 'Consulta cardiología',              patientName: 'Ana Martínez Soto',       patientEmail: 'ana.m@email.com',     startDate: '2026-03-05T10:30', endDate: '2026-03-05T11:15', status: 'completed', room: 'Consultorio 2', notes: 'ECG en rango normal.',                        createdAt: '2026-02-25', updatedAt: '2026-03-05' },
        // ── Semana 2 (9–13 mar) ─────────────────────────────────────────────
        { id: 4,  title: 'Seguimiento diabetes',              patientName: 'Sofia Ruiz Castillo',     patientEmail: 'sofia.r@email.com',   startDate: '2026-03-10T09:00', endDate: '2026-03-10T09:45', status: 'completed', room: 'Consultorio 3', notes: 'HbA1c 6.8%. Dosis estable.',                  createdAt: '2026-03-01', updatedAt: '2026-03-10' },
        { id: 5,  title: 'Control respiratorio',              patientName: 'Isabel Díaz Vega',        patientEmail: 'isabel.d@email.com',  startDate: '2026-03-10T09:45', endDate: '2026-03-10T10:30', status: 'completed', room: 'Consultorio 1', notes: 'Espirometría mejorada vs mes anterior.',       createdAt: '2026-03-05', updatedAt: '2026-03-10' },
        { id: 6,  title: 'Revisión postquirúrgica rodilla',   patientName: 'Ana Martínez Soto',       patientEmail: 'ana.m@email.com',     startDate: '2026-03-12T14:00', endDate: '2026-03-12T14:45', status: 'no_show',   room: 'Consultorio 2', notes: 'Paciente no se presentó. Reprogramar.',      createdAt: '2026-03-05', updatedAt: '2026-03-12' },
        // ── Semana 3 (16–20 mar) ────────────────────────────────────────────
        { id: 7,  title: 'Primera consulta',                  patientName: 'Sofia Ruiz Castillo',     patientEmail: 'sofia.r@email.com',   startDate: '2026-03-17T09:00', endDate: '2026-03-17T09:45', status: 'completed', room: 'Consultorio 1', notes: 'Derivado por médico de cabecera.',             createdAt: '2026-03-10', updatedAt: '2026-03-17' },
        { id: 8,  title: 'Control cardiológico',              patientName: 'Carlos Fernández Torres', patientEmail: 'carlos.f@email.com',  startDate: '2026-03-17T10:30', endDate: '2026-03-17T11:15', status: 'cancelled', room: 'Consultorio 3', notes: 'Cancelada por el paciente.',                  createdAt: '2026-03-12', updatedAt: '2026-03-17' },
        { id: 9,  title: 'Ajuste de tratamiento',             patientName: 'Carlos Fernández Torres', patientEmail: 'carlos.f@email.com',  startDate: '2026-03-19T09:00', endDate: '2026-03-19T09:45', status: 'completed', room: 'Consultorio 2', notes: 'Reducción dosis anticoagulante.',              createdAt: '2026-03-15', updatedAt: '2026-03-19' },
        { id: 10, title: 'Evaluación neurológica',            patientName: 'Isabel Díaz Vega',        patientEmail: 'isabel.d@email.com',  startDate: '2026-03-19T14:00', endDate: '2026-03-19T14:45', status: 'completed', room: 'Consultorio 1', notes: 'Sin nuevos episodios. Control en 3 meses.',   createdAt: '2026-03-10', updatedAt: '2026-03-19' },
        // ── Semana 4 (23–27 mar — semana actual, hoy jue 26) ────────────────
        { id: 11, title: 'Control mensual',                   patientName: 'María González López',    patientEmail: 'maria.g@email.com',   startDate: '2026-03-24T09:00', endDate: '2026-03-24T09:45', status: 'completed', room: 'Consultorio 1', notes: 'Presión arterial estabilizada 120/80.',        createdAt: '2026-03-17', updatedAt: '2026-03-24' },
        { id: 12, title: 'Revisión de exámenes',              patientName: 'Luis Hernández Pérez',    patientEmail: 'luis.h@email.com',    startDate: '2026-03-24T10:30', endDate: '2026-03-24T11:15', status: 'completed', room: 'Consultorio 2', notes: 'Resultados de lab normales.',                  createdAt: '2026-03-20', updatedAt: '2026-03-24' },
        { id: 13, title: 'Seguimiento postquirúrgico',        patientName: 'Luis Hernández Pérez',    patientEmail: 'luis.h@email.com',    startDate: '2026-03-26T09:00', endDate: '2026-03-26T09:45', status: 'scheduled', room: 'Consultorio 1', notes: 'Seguimiento a 4 meses de la operación.',      createdAt: '2026-03-20', updatedAt: '2026-03-20' },
        { id: 14, title: 'Control diabetes',                  patientName: 'Sofia Ruiz Castillo',     patientEmail: 'sofia.r@email.com',   startDate: '2026-03-26T10:30', endDate: '2026-03-26T11:15', status: 'scheduled', room: 'Consultorio 3', notes: 'Control mensual glucemia.',                    createdAt: '2026-03-21', updatedAt: '2026-03-21' },
        { id: 15, title: 'Consulta urgencia — dolor torácico', patientName: 'Carlos Fernández Torres', patientEmail: 'carlos.f@email.com', startDate: '2026-03-27T09:00', endDate: '2026-03-27T09:45', status: 'scheduled', room: 'Consultorio 2', notes: 'Derivación por dolor torácico recurrente.', createdAt: '2026-03-25', updatedAt: '2026-03-25' },
        { id: 16, title: 'Control postquirúrgico rodilla',    patientName: 'Ana Martínez Soto',       patientEmail: 'ana.m@email.com',     startDate: '2026-03-27T14:00', endDate: '2026-03-27T14:45', status: 'scheduled', room: 'Consultorio 2', notes: 'Reprogramada de id-6.',                        createdAt: '2026-03-25', updatedAt: '2026-03-25' },
        // ── Semana 5 (30 mar – 3 abr) ───────────────────────────────────────
        { id: 17, title: 'Revisión eco-cardiograma',     patientName: 'Ana Martínez Soto',  patientEmail: 'ana.m@email.com',    startDate: '2026-03-31T14:00', endDate: '2026-03-31T14:45', status: 'scheduled', room: 'Consultorio 1', notes: 'Seguimiento post cirugía de rodilla.',  createdAt: '2026-03-20', updatedAt: '2026-03-20' },
        { id: 18, title: 'Control respiratorio trim.',   patientName: 'Isabel Díaz Vega',   patientEmail: 'isabel.d@email.com', startDate: '2026-04-07T09:00', endDate: '2026-04-07T09:45', status: 'scheduled', room: 'Consultorio 1', notes: 'Revisión trimestral EPOC.',             createdAt: '2026-03-22', updatedAt: '2026-03-22' }
      ]
    },

    // ─────────────────────────── PROVEEDORES ───────────────────────────
    suppliers: {
      schema: {
        entity: {
          key: 'suppliers',
          singular: 'Proveedor',
          plural: 'Proveedores',
          icon: 'users',
          description: 'Gestión de proveedores y socios comerciales'
        },
        fields: [
          { name: 'name',          type: 'text',   label: 'Nombre',            required: true,  isTitle: true,    showInList: true,  showInDetail: true,  sortable: true, filterable: true, filterType: 'search', minLength: 2, maxLength: 100 },
          { name: 'code',          type: 'text',   label: 'Código',            required: true,  isSubtitle: true, showInList: true,  showInDetail: true,  sortable: true, pattern: '^[A-Z]{2}-\\d{3,}$', patternMessage: 'Formato: XX-000' },
          { name: 'email',         type: 'email',  label: 'Email',             required: true,                   showInList: false, showInDetail: true  },
          { name: 'phone',         type: 'tel',    label: 'Teléfono',          required: true,                   showInList: false, showInDetail: true  },
          { name: 'category',      type: 'select', label: 'Categoría',         required: true,  isBadge: true,    showInList: true,  showInDetail: true,  sortable: true, filterable: true, filterType: 'select',
            options: [
              { value: 'technology',    label: 'Tecnología'     },
              { value: 'manufacturing', label: 'Manufactura'    },
              { value: 'logistics',     label: 'Logística'      },
              { value: 'services',      label: 'Servicios'      },
              { value: 'raw-materials', label: 'Materias Primas'},
              { value: 'food-beverage', label: 'Alimentos'      },
              { value: 'healthcare',    label: 'Salud'          },
              { value: 'construction',  label: 'Construcción'   }
            ],
            badgeColors: {
              'technology':    '#6366f1',
              'manufacturing': '#f59e0b',
              'logistics':     '#3b82f6',
              'services':      '#10b981',
              'raw-materials': '#8b5cf6',
              'food-beverage': '#ec4899',
              'healthcare':    '#14b8a6',
              'construction':  '#f97316'
            }
          },
          { name: 'status',        type: 'select', label: 'Estado',            required: true,  isBadge: true,    showInList: true,  showInDetail: true,  sortable: true, filterable: true, filterType: 'select',
            options: [
              { value: 'active',      label: 'Activo'       },
              { value: 'inactive',    label: 'Inactivo'     },
              { value: 'pending',     label: 'Pendiente'    },
              { value: 'blacklisted', label: 'Bloqueado'    }
            ],
            badgeColors: { 'active': '#10b981', 'inactive': '#6b7280', 'pending': '#f59e0b', 'blacklisted': '#ef4444' }
          },
          { name: 'country',       type: 'text',   label: 'País',              required: true,                   showInList: true,  showInDetail: true,  sortable: true, filterable: true, filterType: 'select' },
          { name: 'city',          type: 'text',   label: 'Ciudad',            required: true,                   showInList: false, showInDetail: true  },
          { name: 'address',       type: 'text',   label: 'Dirección',         required: true,                   showInList: false, showInDetail: true  },
          { name: 'website',       type: 'url',    label: 'Sitio Web',                                           showInList: false, showInDetail: true  },
          { name: 'taxId',         type: 'text',   label: 'ID Fiscal',         required: true,                   showInList: false, showInDetail: true  },
          { name: 'contactPerson', type: 'text',   label: 'Contacto',          required: true,                   showInList: true,  showInDetail: true  },
          { name: 'rating',        type: 'range',  label: 'Calificación',      required: true,                   showInList: true,  showInDetail: true,  sortable: true, min: 1, max: 5, step: 0.1, format: 'stars' },
          { name: 'totalOrders',   type: 'number', label: 'Total Órdenes',     required: true,                   showInList: false, showInDetail: true,  min: 0 },
          { name: 'totalSpent',    type: 'number', label: 'Total Gastado',     required: true,                   showInList: true,  showInDetail: true,  sortable: true, min: 0, format: 'currency' },
          { name: 'notes',         type: 'textarea', label: 'Notas',                                             showInList: false, showInDetail: true  },
          { name: 'tags',          type: 'tags',   label: 'Etiquetas',                                           showInList: false, showInDetail: true  }
        ]
      },
      data: [
        { id: 1, name: 'TechCorp Solutions',     code: 'TC-001', email: 'contact@techcorp.com',      phone: '+1 (555) 234-5678', category: 'technology',    status: 'active',      country: 'Estados Unidos', city: 'San Francisco', address: '123 Silicon Valley Blvd', website: 'https://techcorp.com',          taxId: 'US-123456789',             contactPerson: 'Alice Johnson',  rating: 4.8, totalOrders: 245, totalSpent: 1250000, createdAt: '2022-01-15', updatedAt: '2024-11-10', tags: ['IT', 'cloud', 'enterprise'],      notes: 'Socio tecnológico premium.' },
        { id: 2, name: 'Global Logistics Co',    code: 'GL-002', email: 'ops@globallogistics.com',   phone: '+44 20 7946 0958',  category: 'logistics',     status: 'active',      country: 'Reino Unido',    city: 'Londres',       address: '45 Freight Lane EC1A 1BB',    website: 'https://globallogistics.co.uk', taxId: 'GB-987654321',             contactPerson: 'James Wilson',   rating: 4.5, totalOrders: 512, totalSpent: 890000,  createdAt: '2021-06-20', updatedAt: '2024-12-01', tags: ['shipping', 'warehousing'],        notes: 'Cobertura logística global.' },
        { id: 3, name: 'PrimeMateriales SA',     code: 'PM-003', email: 'ventas@primematerials.es',  phone: '+34 91 234 5678',   category: 'raw-materials', status: 'active',      country: 'España',         city: 'Madrid',        address: 'Av. Industria 78, 28001',     website: null,                            taxId: 'ES-B12345678',             contactPerson: 'Carlos Ruiz',    rating: 4.2, totalOrders: 178, totalSpent: 650000,  createdAt: '2022-03-10', updatedAt: '2024-10-15', tags: ['metals', 'polymers'],             notes: 'Certificado ISO 9001.' },
        { id: 4, name: 'FoodBev International',  code: 'FB-004', email: 'supply@foodbev.int',        phone: '+49 30 12345678',   category: 'food-beverage', status: 'pending',     country: 'Alemania',       city: 'Berlín',        address: 'Industriestraße 55, 10115',   website: 'https://foodbev.int',           taxId: 'DE-234567890',             contactPerson: 'Monika Braun',   rating: 3.9, totalOrders: 45,  totalSpent: 120000,  createdAt: '2024-08-01', updatedAt: '2024-12-10', tags: ['organic', 'HACCP'],               notes: 'Nuevo proveedor en evaluación.' },
        { id: 5, name: 'BuildRight Construcción',code: 'BR-005', email: 'info@buildright.mx',        phone: '+52 55 9876 5432',  category: 'construction',  status: 'inactive',    country: 'México',         city: 'CDMX',          address: 'Blvd. Insurgentes 1200',      website: null,                            taxId: 'MX-RFC123456',             contactPerson: 'Roberto Méndez', rating: 3.5, totalOrders: 32,  totalSpent: 430000,  createdAt: '2020-11-05', updatedAt: '2024-07-20', tags: ['construction', 'cement'],         notes: 'Contrato pausado.' },
        { id: 6, name: 'HealthPlus Supplies',    code: 'HP-006', email: 'procurement@healthplus.ca', phone: '+1 416 555 0199',   category: 'healthcare',    status: 'active',      country: 'Canadá',         city: 'Toronto',       address: '789 Medical Drive, ON M5H',   website: 'https://healthplus.ca',         taxId: 'CA-BN123456789',           contactPerson: 'Sarah Mitchell', rating: 4.9, totalOrders: 390, totalSpent: 2100000, createdAt: '2019-05-12', updatedAt: '2024-12-15', tags: ['FDA-approved', 'medical'],        notes: 'Socio crítico en salud.' },
        { id: 7, name: 'ManufacturePro Asia',    code: 'MA-007', email: 'b2b@manufacturepro.cn',     phone: '+86 21 5555 8888',  category: 'manufacturing', status: 'blacklisted', country: 'China',          city: 'Shanghái',      address: '88 Factory Road, Pudong',     website: null,                            taxId: 'CN-91310000MA1FL1A12',     contactPerson: 'Wei Zhang',      rating: 2.1, totalOrders: 12,  totalSpent: 75000,   createdAt: '2023-02-28', updatedAt: '2024-09-05', tags: ['components'],                     notes: 'BLOQUEADO: Fallos repetidos de calidad.' },
        { id: 8, name: 'ProServices Group',      code: 'PS-008', email: 'hello@proservices.com.au',  phone: '+61 2 9876 5432',   category: 'services',      status: 'active',      country: 'Australia',      city: 'Sídney',        address: '321 Business Park, NSW 2000', website: 'https://proservices.com.au',    taxId: 'AU-ABN12345678',           contactPerson: 'Emma Thompson',  rating: 4.6, totalOrders: 156, totalSpent: 540000,  createdAt: '2021-09-18', updatedAt: '2024-11-30', tags: ['consulting', 'SLA'],              notes: 'Excelente cumplimiento de SLA.' }
      ]
    },

    // ─────────────────────────── PRODUCTOS ───────────────────────────
    products: {
      schema: {
        entity: {
          key: 'products',
          singular: 'Producto',
          plural: 'Productos',
          icon: 'package',
          description: 'Catálogo de productos e inventario'
        },
        fields: [
          { name: 'name',        type: 'text',     label: 'Nombre del Producto', required: true,  isTitle: true,    showInList: true,  showInDetail: true,  sortable: true,  filterable: true, filterType: 'search', minLength: 2 },
          { name: 'sku',         type: 'text',     label: 'SKU',                 required: true,  isSubtitle: true, showInList: true,  showInDetail: true,  sortable: true,  pattern: '^[A-Z]{3}-\\d{4}$', patternMessage: 'Formato: ABC-0000' },
          { name: 'category',    type: 'select',   label: 'Categoría',           required: true,  isBadge: true,    showInList: true,  showInDetail: true,  sortable: true,  filterable: true, filterType: 'select',
            options: [
              { value: 'electronics',  label: 'Electrónica'  },
              { value: 'clothing',     label: 'Ropa'         },
              { value: 'food',         label: 'Alimentos'    },
              { value: 'tools',        label: 'Herramientas' },
              { value: 'furniture',    label: 'Muebles'      },
              { value: 'books',        label: 'Libros'       }
            ],
            badgeColors: { 'electronics': '#6366f1', 'clothing': '#ec4899', 'food': '#10b981', 'tools': '#f59e0b', 'furniture': '#8b5cf6', 'books': '#3b82f6' }
          },
          { name: 'status',      type: 'select',   label: 'Estado',              required: true,  isBadge: true,    showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
            options: [
              { value: 'available',    label: 'Disponible'   },
              { value: 'low_stock',    label: 'Stock Bajo'   },
              { value: 'out_of_stock', label: 'Sin Stock'    },
              { value: 'discontinued', label: 'Descontinuado'}
            ],
            badgeColors: { 'available': '#10b981', 'low_stock': '#f59e0b', 'out_of_stock': '#ef4444', 'discontinued': '#6b7280' }
          },
          { name: 'price',       type: 'number',   label: 'Precio',              required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 0, format: 'currency' },
          { name: 'stock',       type: 'number',   label: 'Stock',               required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 0 },
          { name: 'supplier',    type: 'text',     label: 'Proveedor',           required: true,                   showInList: true,  showInDetail: true,  filterable: true, filterType: 'search' },
          { name: 'weight',      type: 'number',   label: 'Peso (kg)',                                             showInList: false, showInDetail: true,  min: 0 },
          { name: 'description', type: 'textarea', label: 'Descripción',                                          showInList: false, showInDetail: true  },
          { name: 'tags',        type: 'tags',     label: 'Etiquetas',                                             showInList: false, showInDetail: true  }
        ]
      },
      data: [
        { id: 1, name: 'Laptop Pro 15"',       sku: 'ELC-0001', category: 'electronics', status: 'available',    price: 1299.99, stock: 45,  supplier: 'TechCorp Solutions',    weight: 1.8, description: 'Laptop de alto rendimiento con pantalla 4K.',          tags: ['laptop', 'premium', '4K'] },
        { id: 2, name: 'Camiseta Algodón Org.', sku: 'CLO-0002', category: 'clothing',    status: 'available',    price: 24.99,  stock: 200, supplier: 'ProServices Group',     weight: 0.2, description: 'Camiseta de algodón orgánico, múltiples colores.',     tags: ['ropa', 'ecológico'] },
        { id: 3, name: 'Granola Artesanal 1kg', sku: 'FOD-0003', category: 'food',        status: 'low_stock',    price: 12.50,  stock: 8,   supplier: 'FoodBev International', weight: 1.0, description: 'Granola artesanal con frutos secos y miel.',           tags: ['organic', 'snack'] },
        { id: 4, name: 'Taladro Inalámbrico',  sku: 'TOL-0004', category: 'tools',        status: 'available',    price: 89.99,  stock: 32,  supplier: 'PrimeMateriales SA',    weight: 1.5, description: 'Taladro 18V con batería de litio y set de brocas.',   tags: ['herramienta', 'inalámbrico'] },
        { id: 5, name: 'Silla Ergonómica',     sku: 'FUR-0005', category: 'furniture',    status: 'available',    price: 349.00, stock: 15,  supplier: 'ProServices Group',     weight: 12.0,description: 'Silla de oficina con soporte lumbar ajustable.',       tags: ['oficina', 'ergonómico'] },
        { id: 6, name: 'Monitor 27" 4K',       sku: 'ELC-0006', category: 'electronics', status: 'out_of_stock',  price: 599.99, stock: 0,   supplier: 'TechCorp Solutions',    weight: 5.2, description: 'Monitor UHD 4K con panel IPS y 144Hz.',               tags: ['monitor', '4K', 'gaming'] },
        { id: 7, name: 'Angular Design Patterns',sku:'BOK-0007', category: 'books',       status: 'available',    price: 45.00,  stock: 60,  supplier: 'ProServices Group',     weight: 0.8, description: 'Guía avanzada de patrones de diseño en Angular 17.',  tags: ['angular', 'programación'] },
        { id: 8, name: 'Auric. Noise Cancel.', sku: 'ELC-0008', category: 'electronics', status: 'discontinued',  price: 199.99, stock: 3,   supplier: 'TechCorp Solutions',    weight: 0.3, description: 'Auriculares con cancelación activa de ruido.',         tags: ['audio', 'wireless'] }
      ]
    },

    // ─────────────────────────── PACIENTES ───────────────────────────
    patients: {
      schema: {
        entity: {
          key: 'patients',
          singular: 'Paciente',
          plural: 'Pacientes',
          icon: 'heart',
          description: 'Registro y seguimiento de pacientes'
        },
        fields: [
          { name: 'fullName',       type: 'text',   label: 'Nombre Completo',   required: true,  isTitle: true,    showInList: true,  showInDetail: true,  sortable: true,  filterable: true, filterType: 'search', minLength: 3 },
          { name: 'patientId',      type: 'text',   label: 'ID Paciente',       required: true,  isSubtitle: true, showInList: true,  showInDetail: true,  sortable: true,  pattern: '^PAC-\\d{5}$', patternMessage: 'Formato: PAC-00000' },
          { name: 'status',         type: 'select', label: 'Estado',            required: true,  isBadge: true,    showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
            options: [
              { value: 'active',     label: 'Activo'        },
              { value: 'discharged', label: 'Alta'          },
              { value: 'critical',   label: 'Crítico'       },
              { value: 'scheduled',  label: 'Programado'    }
            ],
            badgeColors: { 'active': '#10b981', 'discharged': '#6b7280', 'critical': '#ef4444', 'scheduled': '#3b82f6' }
          },
          { name: 'age',            type: 'number', label: 'Edad',              required: true,                   showInList: true,  showInDetail: true,  sortable: true,  min: 0, max: 150 },
          { name: 'gender',         type: 'select', label: 'Género',            required: true,                   showInList: true,  showInDetail: true,  filterable: true, filterType: 'select',
            options: [
              { value: 'male',   label: 'Masculino' },
              { value: 'female', label: 'Femenino'  },
              { value: 'other',  label: 'Otro'      }
            ]
          },
          { name: 'bloodType',      type: 'select', label: 'Tipo de Sangre',    required: true,  isBadge: true,    showInList: true,  showInDetail: true,
            options: [
              { value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' },
              { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' },
              { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' },
              { value: 'AB+',label: 'AB+'},  { value: 'AB-',label: 'AB-'}
            ],
            badgeColors: { 'A+': '#ef4444', 'A-': '#f97316', 'B+': '#3b82f6', 'B-': '#6366f1', 'O+': '#10b981', 'O-': '#14b8a6', 'AB+': '#8b5cf6', 'AB-': '#ec4899' }
          },
          { name: 'phone',          type: 'tel',    label: 'Teléfono',          required: true,                   showInList: false, showInDetail: true  },
          { name: 'email',          type: 'email',  label: 'Email',                                               showInList: false, showInDetail: true  },
          { name: 'doctor',         type: 'text',   label: 'Médico Asignado',   required: true,                   showInList: true,  showInDetail: true,  filterable: true, filterType: 'search' },
          { name: 'admissionDate',  type: 'date',   label: 'Fecha de Ingreso',  required: true,                   showInList: true,  showInDetail: true,  sortable: true,  format: 'date' },
          { name: 'diagnosis',      type: 'textarea',label: 'Diagnóstico',      required: true,                   showInList: false, showInDetail: true  },
          { name: 'allergies',      type: 'tags',   label: 'Alergias',                                            showInList: false, showInDetail: true  }
        ]
      },
      data: [
        { id: 1, fullName: 'María González López',   patientId: 'PAC-00001', status: 'active',     age: 45, gender: 'female', bloodType: 'O+',  phone: '+34 612 345 678', email: 'maria.g@email.com',   doctor: 'Dr. Ramírez',   admissionDate: '2024-12-01', diagnosis: 'Hipertensión arterial crónica bajo tratamiento.',       allergies: ['penicilina'] },
        { id: 2, fullName: 'Carlos Fernández Torres', patientId: 'PAC-00002', status: 'critical',   age: 67, gender: 'male',   bloodType: 'A+',  phone: '+34 698 765 432', email: 'carlos.f@email.com',  doctor: 'Dra. Morales',  admissionDate: '2024-12-10', diagnosis: 'Infarto agudo de miocardio, UCI.',                      allergies: ['aspirina', 'iodine'] },
        { id: 3, fullName: 'Ana Martínez Soto',       patientId: 'PAC-00003', status: 'scheduled',  age: 32, gender: 'female', bloodType: 'B+',  phone: '+34 677 123 456', email: 'ana.m@email.com',     doctor: 'Dr. Ramírez',   admissionDate: '2025-01-05', diagnosis: 'Cirugía programada de rodilla (menisco).',              allergies: [] },
        { id: 4, fullName: 'Luis Hernández Pérez',    patientId: 'PAC-00004', status: 'discharged', age: 58, gender: 'male',   bloodType: 'AB+', phone: '+34 654 987 321', email: 'luis.h@email.com',    doctor: 'Dra. Morales',  admissionDate: '2024-11-15', diagnosis: 'Neumonía bacteriana. Alta el 28/11/2024.',              allergies: ['sulfas'] },
        { id: 5, fullName: 'Sofia Ruiz Castillo',     patientId: 'PAC-00005', status: 'active',     age: 28, gender: 'female', bloodType: 'O-',  phone: '+34 633 456 789', email: 'sofia.r@email.com',   doctor: 'Dr. López',     admissionDate: '2024-12-15', diagnosis: 'Diabetes mellitus tipo 1, control y ajuste de dosis.',  allergies: ['latex'] },
        { id: 6, fullName: 'Roberto García Blanco',   patientId: 'PAC-00006', status: 'active',     age: 41, gender: 'male',   bloodType: 'B-',  phone: '+34 666 789 012', email: 'roberto.g@email.com', doctor: 'Dr. López',     admissionDate: '2024-12-18', diagnosis: 'Fractura de fémur derecho. Postoperatorio.',            allergies: [] },
        { id: 7, fullName: 'Isabel Díaz Vega',        patientId: 'PAC-00007', status: 'active',     age: 75, gender: 'female', bloodType: 'A-',  phone: '+34 611 234 567', email: 'isabel.d@email.com',  doctor: 'Dr. Ramírez',   admissionDate: '2024-12-05', diagnosis: 'EPOC. Control respiratorio y rehabilitación.',          allergies: ['penicilina', 'dust'] },
        { id: 8, fullName: 'Miguel Torres Fuentes',   patientId: 'PAC-00008', status: 'scheduled',  age: 19, gender: 'male',   bloodType: 'O+',  phone: '+34 644 567 890', email: 'miguel.t@email.com',  doctor: 'Dra. Morales',  admissionDate: '2025-01-12', diagnosis: 'Apendicitis aguda. Cirugía laparoscópica programada.',  allergies: [] }
      ]
    },

    // ─────────────────────────── FICHAS CLÍNICAS ───────────────────────────
    'clinical-records': {
      schema: {
        entity: {
          key: 'clinical-records',
          singular: 'Ficha Clínica',
          plural: 'Fichas Clínicas',
          icon: 'clipboard',
          moduleType: 'clinical-record',
          description: 'Fichas clínicas y registros médicos de pacientes'
        },
        fields: []   // schema comes from auth response
      },
      data: [
        {
          id: 1, fullName: 'María González López', patientId: 'PAC-00001', rut: '12.345.678-9',
          birthDate: '1981-03-14', age: 45, gender: 'female', bloodType: 'O+',
          insurance: 'fonasa_c', phone: '+56 9 6123 4567', email: 'maria.g@email.com',
          address: 'Los Aromos 234, Las Condes, Santiago', emergencyContact: 'Pedro González +56 9 9876 5432',
          doctor: 'Dra. Morales', lastVisit: '2026-03-24', status: 'active',
          allergies: ['Penicilina', 'Sulfas'],
          contraindications: 'AINEs (riesgo de hipertensión). Evitar IECAS por tos crónica.',
          alertNotes: 'Reacción anafiláctica documentada a penicilina (2015). Llevar EpiPen.',
          bp: '132/85', heartRate: 72, temperature: 36.6, o2Saturation: 97, weight: 68.5, height: 162, bmi: 26.1, respiratoryRate: 16,
          personalHistory: 'Hipertensión arterial (desde 2018). Dislipidemia (desde 2020). Hipotiroidismo subclínico (2022).',
          familyHistory: 'Padre: cardiopatía coronaria (fallecido 62 años). Madre: diabetes mellitus tipo 2.',
          surgicalHistory: 'Apendicectomía (1998). Cesárea (2010).',
          habits: 'No fumadora. Alcohol ocasional (1-2 copas/semana). Caminata 30 min/día.',
          currentMedications: 'Losartán 50mg c/12h\nAtorvastantina 20mg c/24h (nocturno)\nLevotiroxina 50mcg c/24h (ayuno)',
          chronicConditions: ['Hipertensión', 'Dislipidemia', 'Hipotiroidismo'],
          diagnosisCode: 'I10', diagnosisLabel: 'Hipertensión esencial (primaria)',
          differentialDx: 'Hipertensión secundaria descartada por estudio nefrológico.',
          soapSubjective: 'Paciente refiere cefalea occipital moderada (EVA 4/10) de inicio matutino hace 3 días. Niega visión borrosa, tinitus o náuseas. Cumple tratamiento antihipertensivo regularmente.',
          soapObjective: 'PA: 132/85 mmHg (brazo derecho), FC: 72 lpm, T: 36.6°C, SatO2: 97%. Examen neurológico normal. Sin edema en extremidades inferiores.',
          soapAssessment: 'HTA esencial en control subóptimo. Cefalea tensional asociada. Sin signos de crisis hipertensiva ni daño de órgano blanco.',
          soapPlan: '1. Ajuste Losartán → 100mg c/24h\n2. Control PA en 7 días\n3. Paracetamol 500mg c/8h PRN cefalea\n4. Derivar a nutricionista para reducción de sal\n5. Traer perfil lipídico próxima consulta',
          encounters: [
            {
              encounterDate: '2026-03-24', doctor: 'Dra. Morales', motivo: 'Control mensual HTA',
              presionArterial: '120/80 mmHg', frecuenciaCardiaca: '70 lpm', peso: '68 kg',
              diagnostico: 'HTA esencial estabilizada', tratamiento: 'Mantiene Losartán 100mg c/24h + Atorvastatina 20mg',
              indicaciones: 'Continuar dieta hiposódica. Caminata 30 min/día. Control en 1 mes.'
            },
            {
              encounterDate: '2026-02-18', doctor: 'Dra. Morales', motivo: 'Control HTA + perfil lipídico',
              presionArterial: '138/88 mmHg', frecuenciaCardiaca: '74 lpm', peso: '69.2 kg',
              diagnostico: 'HTA con control subóptimo. Dislipidemia compensada.', tratamiento: 'Ajuste Losartán 50mg → 100mg c/24h',
              examenes: 'Colesterol total 198 mg/dL, LDL 112 mg/dL, HDL 52 mg/dL, TG 170 mg/dL',
              indicaciones: 'Reducir sal y grasas saturadas. Repetir perfil lipídico en 3 meses.'
            },
            {
              encounterDate: '2026-01-10', doctor: 'Dra. Morales', motivo: 'Control tiroides + HTA',
              presionArterial: '130/82 mmHg', frecuenciaCardiaca: '68 lpm', peso: '69.8 kg',
              diagnostico: 'Hipotiroidismo subclínico estable. HTA en control.',
              examenes: 'TSH 3.8 mUI/L (normal). T4L 1.1 ng/dL.',
              tratamiento: 'Mantiene Levotiroxina 50mcg + Losartán 50mg',
              indicaciones: 'TSH dentro de rango. Control tiroides en 6 meses.'
            },
            {
              encounterDate: '2025-11-05', doctor: 'Dra. Morales', motivo: 'Control anual + vacuna influenza',
              presionArterial: '128/80 mmHg', frecuenciaCardiaca: '71 lpm', peso: '70.1 kg',
              diagnostico: 'HTA en control. Sin nuevas patologías.', tratamiento: 'Mantiene esquema farmacológico habitual',
              indicaciones: 'Vacuna influenza aplicada. Mamografía anual pendiente. Control en 3 meses.'
            },
            {
              encounterDate: '2025-08-22', doctor: 'Dra. Morales', motivo: 'Cefalea persistente',
              presionArterial: '148/92 mmHg', frecuenciaCardiaca: '76 lpm', peso: '70.5 kg',
              diagnostico: 'Crisis hipertensiva leve. Cefalea tensional secundaria.',
              tratamiento: 'Amlodipino 5mg agregado transitoriamente. Paracetamol 1g c/8h PRN',
              indicaciones: 'Reposo relativo 48h. Monitoreo PA domiciliario. Control urgente si PA > 160/100.'
            }
          ]
        },
        {
          id: 2, fullName: 'Carlos Fernández Torres', patientId: 'PAC-00002', rut: '8.765.432-1',
          birthDate: '1959-07-22', age: 67, gender: 'male', bloodType: 'A+',
          insurance: 'isapre', phone: '+56 9 6987 6543', email: 'carlos.f@email.com',
          address: 'Av. Providencia 1540, Providencia, Santiago', emergencyContact: 'Rosa Torres +56 9 8765 4321',
          doctor: 'Dra. Morales', lastVisit: '2026-03-19', status: 'critical',
          allergies: ['Aspirina', 'Medio de contraste yodado'],
          contraindications: 'Aspirina y AINEs absolutamente contraindicados. Precaución con anticoagulantes.',
          alertNotes: 'IAM anterior STEMI (ene 2026). Stent en DA proximal. En doble antiagregación. RIESGO ALTO.',
          bp: '115/70', heartRate: 58, temperature: 36.4, o2Saturation: 96, weight: 82, height: 175, bmi: 26.8, respiratoryRate: 14,
          personalHistory: 'HTA (2005). DM tipo 2 (2012). IAM anterior STEMI con stent en DA proximal (enero 2026). Dislipidemia severa.',
          familyHistory: 'Hermano: IAM a los 55 años. Madre: ACV isquémico.',
          surgicalHistory: 'Angioplastia coronaria con stent (enero 2026).',
          habits: 'Ex fumador (30 paquetes-año, dejó 2020). Sin alcohol. Sedentario.',
          currentMedications: 'Clopidogrel 75mg c/24h\nAtorvastantina 80mg c/24h\nEnalapril 10mg c/12h\nMetoprolol 50mg c/12h\nMetformina 850mg c/12h',
          chronicConditions: ['IAM', 'HTA', 'DM2', 'Dislipidemia'],
          diagnosisCode: 'I25.1', diagnosisLabel: 'Enfermedad aterosclerótica del corazón',
          differentialDx: 'Angina inestable descartada. Espasmo coronario en estudio.',
          soapSubjective: 'Paciente refiere disnea de esfuerzo CF II (antes CF I). Ortopnea leve con 1 almohada. Niega dolor torácico. Refiere cumplir medicación pero olvida a veces metoprolol nocturno.',
          soapObjective: 'PA: 115/70 mmHg, FC: 58 lpm irregular, T: 36.4°C, SatO2: 96%. Auscultación: R1R2 normales, no soplos. Leve edema pretibial bilateral ++.',
          soapAssessment: 'Cardiopatía isquémica crónica post-IAM. Deterioro funcional CF I→II sugiere descompensación leve. Posible IC con FE preservada. Adherencia parcial.',
          soapPlan: '1. Ecocardiograma Doppler urgente\n2. BNP y troponina sérica\n3. Ajuste Metoprolol → 100mg c/12h\n4. Agregar Furosemida 20mg c/24h\n5. Reforzar adherencia farmacológica\n6. Derivar a rehabilitación cardíaca',
          encounters: [
            {
              encounterDate: '2026-03-19', doctor: 'Dra. Morales', motivo: 'Ajuste de tratamiento post-IAM',
              presionArterial: '115/70 mmHg', frecuenciaCardiaca: '58 lpm', saturacionO2: '96%',
              diagnostico: 'Cardiopatía isquémica crónica. Deterioro funcional CF I→II.',
              tratamiento: 'Metoprolol 100mg c/12h. Furosemida 20mg c/24h agregada.',
              examenes: 'Pendiente: Ecocardiograma Doppler, BNP, troponina sérica.',
              indicaciones: 'Restricción hídrica 1.5L/día. Pesar diariamente. Urgencia si aumento > 2kg en 48h.'
            },
            {
              encounterDate: '2026-03-03', doctor: 'Dra. Morales', motivo: 'Revisión post-operatoria stent',
              presionArterial: '118/72 mmHg', frecuenciaCardiaca: '62 lpm', saturacionO2: '97%',
              diagnostico: 'Evolución favorable 6 semanas post-angioplastia. Sin signos de reestenosis.',
              tratamiento: 'Continúa doble antiagregación (Clopidogrel + Ticagrelor). Atorvastatina 80mg.',
              examenes: 'ECG: ritmo sinusal, sin cambios isquémicos. Troponina negativa.',
              indicaciones: 'Mantiene restricción de esfuerzo físico moderado. Prohíbe suspender antiagregantes.'
            },
            {
              encounterDate: '2026-02-10', doctor: 'Dra. Morales', motivo: 'Primer control ambulatorio post-alta',
              presionArterial: '122/76 mmHg', frecuenciaCardiaca: '66 lpm', saturacionO2: '97%',
              diagnostico: 'Postoperatorio inmediato favorable. Adherencia farmacológica parcial.',
              tratamiento: 'Ajuste Enalapril 10mg c/12h. Refuerzo educativo adherencia.',
              indicaciones: 'No levantar objetos > 5kg. Herida cicatrizando correctamente. Control en 3 semanas.'
            },
            {
              encounterDate: '2026-01-28', doctor: 'Cardiología HCUCH', motivo: 'Alta hospitalaria post-IAM STEMI',
              presionArterial: '120/75 mmHg', frecuenciaCardiaca: '70 lpm', saturacionO2: '98%',
              diagnostico: 'IAM anterior STEMI resuelto. Stent en DA proximal exitoso. FE 45%.',
              tratamiento: 'Alta con: Clopidogrel 75mg, Ticagrelor 90mg c/12h, Atorvastatina 80mg, Enalapril 10mg, Metoprolol 50mg, Metformina 850mg.',
              indicaciones: 'Alta con indicación de control cardiológico en 2 semanas. Rehabilitación cardíaca programada.'
            }
          ]
        },
        {
          id: 3, fullName: 'Ana Martínez Soto', patientId: 'PAC-00003', rut: '16.543.210-K',
          birthDate: '1994-11-05', age: 32, gender: 'female', bloodType: 'B+',
          insurance: 'fonasa_b', phone: '+56 9 6771 2345', email: 'ana.m@email.com',
          address: 'Calle Los Almendros 89, Ñuñoa, Santiago', emergencyContact: 'Jorge Martínez +56 9 7654 3210',
          doctor: 'Dra. Morales', lastVisit: '2026-03-31', status: 'scheduled',
          allergies: [],
          contraindications: '',
          alertNotes: '',
          bp: '112/70', heartRate: 68, temperature: 36.7, o2Saturation: 99, weight: 61, height: 168, bmi: 21.6, respiratoryRate: 14,
          personalHistory: 'Sana. Lesión menisco medial rodilla derecha (2025). Sin enfermedades crónicas.',
          familyHistory: 'Sin antecedentes relevantes.',
          surgicalHistory: 'Sin cirugías previas.',
          habits: 'No fumadora. Sin alcohol. Deporte 4 veces/semana (running, natación). Dieta equilibrada.',
          currentMedications: 'Ibuprofeno 400mg PRN (dolor)\nOmeprazol 20mg c/24h (gastroprotección)',
          chronicConditions: [],
          diagnosisCode: 'M23.2', diagnosisLabel: 'Trastorno del menisco por rotura antigua',
          differentialDx: 'LCA integro en RMN. Sin condromalacia.',
          soapSubjective: 'Acude a control preoperatorio. Refiere dolor al bajar escaleras (EVA 5/10). Sensación de chasquido. Función limitada para correr. Motivada para cirugía.',
          soapObjective: 'McMurray (+) rodilla derecha. Test de Apley (+) en rotación interna. Sin derrame articular. RMN: rotura parcial menisco medial segmento posterior.',
          soapAssessment: 'Rotura meniscal medial sintomática con fracaso de tratamiento conservador. Indicación quirúrgica electiva.',
          soapPlan: '1. Meniscectomía parcial artroscópica programada 31-mar-2026\n2. Suspender ibuprofeno 5 días previos\n3. Exámenes preoperatorios: hemograma, coagulación, ECG\n4. Anestesia raquídea confirmada con anestesista\n5. Kinesioterapia postoperatoria desde día 3'
        },
        {
          id: 4, fullName: 'Sofia Ruiz Castillo', patientId: 'PAC-00005', rut: '20.123.456-7',
          birthDate: '1998-05-18', age: 28, gender: 'female', bloodType: 'O-',
          insurance: 'fonasa_a', phone: '+56 9 6334 5678', email: 'sofia.r@email.com',
          address: 'Población La Pincoya 34, Huechuraba, Santiago', emergencyContact: 'Carmen Castillo +56 9 5432 1098',
          doctor: 'Dra. Morales', lastVisit: '2026-03-26', status: 'active',
          allergies: ['Látex', 'Plátano'],
          contraindications: 'Latex en procedimientos. Riesgo de hipoglicemia con actividad física intensa sin ajuste de insulina.',
          alertNotes: 'Alergia cruzada látex-fruta (latex-fruit syndrome). Avisar a pabellón en caso de cirugía.',
          bp: '105/65', heartRate: 82, temperature: 36.9, o2Saturation: 98, weight: 54, height: 158, bmi: 21.6, respiratoryRate: 15,
          personalHistory: 'DM tipo 1 desde los 12 años. Sin nefropatía ni retinopatía documentada. Hipoglicemias ocasionales nocturnas.',
          familyHistory: 'Hermana: DM tipo 1. Abuela materna: DM tipo 2.',
          surgicalHistory: 'Sin cirugías.',
          habits: 'No fumadora. Sin alcohol. Activa (bailarina amateur). Come en horarios irregulares.',
          currentMedications: 'Insulina Glargina 20 UI (nocturno)\nInsulina Aspart 4-6 UI c/comida (ajuste por glucemia)\nMetformina 500mg c/24h',
          chronicConditions: ['DM1', 'Alergia látex'],
          diagnosisCode: 'E10.9', diagnosisLabel: 'Diabetes mellitus tipo 1 sin complicaciones',
          differentialDx: 'DM tipo 2 descartada (anticuerpos anti-GAD positivos, 2015).',
          soapSubjective: 'Paciente refiere 3 episodios de hipoglicemia nocturna esta semana (60-65 mg/dL), resueltos con glucagón oral. Refiere mayor actividad física por competencia de baile.',
          soapObjective: 'PA: 105/65, FC: 82, T: 36.9°C. HbA1c reciente: 7.2%. Glucemia hoy: 110 mg/dL (ayuno). Examen físico: sin signos de complicación crónica.',
          soapAssessment: 'DM1 con control adecuado (HbA1c < 7.5%). Hipoglicemias nocturnas secundarias a mayor actividad. Ajuste insulínico necesario.',
          soapPlan: '1. Reducir Glargina → 16 UI en período de actividad física aumentada\n2. Colación antes de actividad: 15g hidratos rápidos\n3. Glucómetro continuo (CGM): solicitar Fonasa para dispositivo\n4. Educación en ajuste insulina/ejercicio\n5. Control en 4 semanas con log de glucemias'
        },
        {
          id: 5, fullName: 'Isabel Díaz Vega', patientId: 'PAC-00007', rut: '5.678.901-2',
          birthDate: '1951-02-09', age: 75, gender: 'female', bloodType: 'A-',
          insurance: 'fonasa_b', phone: '+56 9 6112 3456', email: 'isabel.d@email.com',
          address: 'San Martín 567, Pudahuel, Santiago', emergencyContact: 'Francisco Díaz +56 9 4321 0987',
          doctor: 'Dra. Morales', lastVisit: '2026-03-19', status: 'active',
          allergies: ['Penicilina', 'Polvo'],
          contraindications: 'Beta-bloqueadores contraindicados (broncoespasmo). Evitar opiáceos en EPOC descompensado.',
          alertNotes: 'EPOC GOLD III. Oxigenoterapia domiciliaria nocturna. Riesgo de desaturación en procedimientos.',
          bp: '138/88', heartRate: 88, temperature: 37.1, o2Saturation: 91, weight: 58, height: 155, bmi: 24.1, respiratoryRate: 22,
          personalHistory: 'EPOC (desde 2010, GOLD III). HTA leve. Osteoporosis. AIT (2019).',
          familyHistory: 'Esposo: EPOC (fumador). Hijo: asma.',
          surgicalHistory: 'Fractura de cadera (prótesis 2022).',
          habits: 'Ex fumadora 40 paquetes-año (dejó 2010). Sin alcohol. Muy sedentaria por disnea.',
          currentMedications: 'Tiotropio 18mcg c/24h (inhalador)\nSalmeterol/Fluticasona 50/500 c/12h\nPrednisona 5mg c/24h (mantenimiento)\nCalcio + Vit D c/24h\nEnalapril 5mg c/24h',
          chronicConditions: ['EPOC', 'HTA', 'Osteoporosis'],
          diagnosisCode: 'J44.1', diagnosisLabel: 'EPOC con exacerbación aguda',
          differentialDx: 'IC descompensada descartada (BNP normal). Neumonía descartada (TAC limpio).',
          soapSubjective: 'Paciente consulta por aumento disnea basal desde hace 5 días. Expectoración amarillenta, más abundante. Fiebre hasta 37.8°C. Uso de salbutamol de rescate 6 veces/día (antes 1-2).',
          soapObjective: 'PA: 138/88, FC: 88, T: 37.1°C, SatO2: 91% (aire ambiente). FR: 22 rpm. Auscultación: roncus bilaterales, sibilancias espiratorias ++. Uso de músculos accesorios.',
          soapAssessment: 'Exacerbación aguda moderada de EPOC (GOLD III) de probable etiología infecciosa bacteriana. Sin criterios de hospitalización (SatO2 ≥90% con O2 suplementario).',
          soapPlan: '1. Amoxicilina-clavulánico 875/125mg c/8h × 7 días\n2. Prednisona 40mg c/24h × 5 días\n3. Nebulización Salbutamol + Ipratropio c/4h × 48h\n4. O2 domiciliario ≥15h/día\n5. Espirometría control en 4 semanas\n6. Volver urgencia si SatO2 < 88% o no mejora en 48h',
          encounters: [
            {
              encounterDate: '2026-03-19', doctor: 'Dra. Morales', motivo: 'Exacerbación aguda EPOC',
              presionArterial: '138/88 mmHg', frecuenciaCardiaca: '88 lpm', saturacionO2: '91%', frecuenciaRespiratoria: '22 rpm',
              diagnostico: 'Exacerbación aguda EPOC GOLD III. Probable etiología bacteriana.',
              tratamiento: 'Amoxicilina-clavulánico 875/125mg c/8h × 7d. Prednisona 40mg × 5d. Nebulizaciones c/4h.',
              indicaciones: 'O2 domiciliario ≥15h/día. Volver a urgencia si SatO2 < 88%. Control espirometría en 4 semanas.'
            },
            {
              encounterDate: '2026-01-15', doctor: 'Dra. Morales', motivo: 'Control trimestral EPOC',
              presionArterial: '135/85 mmHg', frecuenciaCardiaca: '82 lpm', saturacionO2: '93%', frecuenciaRespiratoria: '18 rpm',
              diagnostico: 'EPOC GOLD III estable. Sin exacerbaciones desde oct 2025.',
              examenes: 'Espirometría: FEV1 42% del teórico (sin cambio significativo). Gasometría: pH 7.38, PaO2 68 mmHg.',
              tratamiento: 'Mantiene Tiotropio + Salmeterol/Fluticasona + Prednisona 5mg mantenimiento.',
              indicaciones: 'Refuerza técnica inhalatoria. Vacuna neumococo actualizada. Control en 3 meses.'
            },
            {
              encounterDate: '2025-10-08', doctor: 'Dra. Morales', motivo: 'Exacerbación leve + control osteoporosis',
              presionArterial: '132/82 mmHg', frecuenciaCardiaca: '86 lpm', saturacionO2: '92%',
              diagnostico: 'Exacerbación leve EPOC. Osteoporosis estable (T-score -2.4 columna lumbar).',
              tratamiento: 'Prednisona 30mg × 5d. Aumenta Salbutamol rescate. Mantiene Calcio + Vit D.',
              examenes: 'Densitometría ósea: sin cambio vs 2024.',
              indicaciones: 'No suspender Calcio/VitD. Evitar caídas. Próxima densitometría 2027.'
            },
            {
              encounterDate: '2025-07-22', doctor: 'Broncopulmonar HCUCH', motivo: 'Control especialidad EPOC',
              presionArterial: '130/80 mmHg', frecuenciaCardiaca: '80 lpm', saturacionO2: '94%',
              diagnostico: 'EPOC GOLD III con respuesta limitada a broncodilatación. AIT 2019 sin secuelas.',
              examenes: 'Test 6 minutos marcha: 240m (severamente reducido). TAC tórax: enfisema centrolobulillar difuso, sin condensación.',
              tratamiento: 'Sin cambios en esquema. Evalúa candidatura para rehabilitación pulmonar.',
              indicaciones: 'Derivada a programa rehabilitación pulmonar. Oxigenoterapia crónica ≥18h/día confirmada.'
            },
            {
              encounterDate: '2025-04-10', doctor: 'Dra. Morales', motivo: 'Control HTA + EPOC',
              presionArterial: '142/90 mmHg', frecuenciaCardiaca: '84 lpm', saturacionO2: '93%',
              diagnostico: 'HTA leve en control subóptimo. EPOC estable.',
              tratamiento: 'Aumenta Enalapril 5mg → 10mg c/24h. Mantiene esquema broncodilatador.',
              indicaciones: 'Monitoreo PA domiciliario 2 veces/semana. Control en 6 semanas.'
            }
          ]
        },
        {
          id: 6, fullName: 'Luis Hernández Pérez', patientId: 'PAC-00004', rut: '9.012.345-6',
          birthDate: '1968-09-30', age: 58, gender: 'male', bloodType: 'AB+',
          insurance: 'isapre', phone: '+56 9 6549 8732', email: 'luis.h@email.com',
          address: 'Los Peumos 1120, Vitacura, Santiago', emergencyContact: 'Claudia Pérez +56 9 3210 9876',
          doctor: 'Dra. Morales', lastVisit: '2026-03-26', status: 'active',
          allergies: ['Sulfamidas'],
          contraindications: 'Sulfamidas (erupción cutánea severa). Precaución con IECAS por creatinina limítrofe.',
          alertNotes: '',
          bp: '125/80', heartRate: 65, temperature: 36.5, o2Saturation: 98, weight: 87, height: 178, bmi: 27.5, respiratoryRate: 14,
          personalHistory: 'Hernia inguinal reparada (2015). Gastritis crónica H.pylori (2020, erradicado). Sin enfermedades crónicas actuales.',
          familyHistory: 'Padre: cáncer colorrectal (68 años). Madre: hipertiroidismo.',
          surgicalHistory: 'Herniorrafía inguinal bilateral (2015). Colecistectomía laparoscópica (2021).',
          habits: 'Fumador leve (5 cig/día). Alcohol social 3-4 veces/semana. Sedentario (trabajo de oficina).',
          currentMedications: 'Omeprazol 20mg PRN\nComplejo B c/24h',
          chronicConditions: [],
          diagnosisCode: 'K57.30', diagnosisLabel: 'Diverticulosis del intestino grueso sin perforación',
          differentialDx: 'Cáncer colorrectal descartado (colonoscopía 2025). SII descartado.',
          soapSubjective: 'Control post-colonscopía. Asintomático. Refiere mejora dieta alta en fibra indicada. Continúa tabaquismo leve. Solicita resultado informe histológico.',
          soapObjective: 'PA: 125/80, FC: 65, T: 36.5°C, SatO2: 98%. Abdomen blando, no doloroso. Sin masas palpables.',
          soapAssessment: 'Diverticulosis colónica sin complicaciones. Sin evidencia de displasia en biopsias. Factores de riesgo modificables presentes (tabaco, sedentarismo, dieta).',
          soapPlan: '1. Informe histológico: sin displasia. Repetir colonoscopía en 5 años\n2. Dieta alta en fibra 25-30g/día\n3. Actividad física ≥150 min/semana\n4. Cesación tabáquica: referir a programa\n5. Screening familiar (hijo >40 años)\n6. Control anual médico general'
        }
      ]
    },

    // ─────────────────────────── SESIONES PSICOLÓGICAS ───────────────────
    'psych-sessions': {
      schema: {
        entity: { key: 'psych-sessions', singular: 'Sesión', plural: 'Sesiones', icon: 'calendar', moduleType: 'calendar', description: 'Agenda de sesiones terapéuticas' },
        fields: []
      },
      data: [
        { id: 1, title: 'Sesión individual — ansiedad', patientName: 'Valentina Rojas', patientEmail: 'valentina.r@email.com', startDate: '2026-03-24T10:00', endDate: '2026-03-24T10:50', sessionType: 'individual', status: 'completed', room: 'Box 1', notes: 'Avance en reestructuración cognitiva.', createdAt: '2026-03-17', updatedAt: '2026-03-24' },
        { id: 2, title: 'Evaluación psicodiagnóstica',  patientName: 'Tomás Herrera',   patientEmail: 'tomas.h@email.com',    startDate: '2026-03-26T11:00', endDate: '2026-03-26T11:50', sessionType: 'evaluation', status: 'scheduled', room: 'Box 1', notes: 'Aplicar PHQ-9 y GAD-7.', createdAt: '2026-03-20', updatedAt: '2026-03-20' },
        { id: 3, title: 'Terapia de pareja',            patientName: 'Valentina Rojas', patientEmail: 'valentina.r@email.com', startDate: '2026-03-27T15:00', endDate: '2026-03-27T15:50', sessionType: 'couple',     status: 'scheduled', room: 'Box 2', notes: 'Primera sesión conjunta.', createdAt: '2026-03-22', updatedAt: '2026-03-22' }
      ]
    },

    // ─────────────────────────── FICHAS PSICOLÓGICAS ─────────────────────
    'psych-records': {
      schema: {
        entity: { key: 'psych-records', singular: 'Ficha Psicológica', plural: 'Fichas Psicológicas', icon: 'brain', moduleType: 'clinical-record', description: 'Fichas psicológicas y registros terapéuticos' },
        fields: []
      },
      data: [
        {
          id: 1, fullName: 'Valentina Rojas', patientId: 'PSI-00001', rut: '18.765.432-1',
          birthDate: '1995-06-12', age: 30, gender: 'female', occupation: 'Diseñadora gráfica', education: 'university', maritalStatus: 'single',
          insurance: 'isapre', phone: '+56 9 8877 6655', email: 'valentina.r@email.com', address: 'Av. Italia 2200, Ñuñoa', emergencyContact: 'Madre +56 9 1122 3344',
          doctor: 'Ps. Carolina Vega', lastVisit: '2026-03-24', status: 'active',
          allergies: ['Ideación pasiva previa (2023)'], contraindications: 'Sin riesgo actual. Última evaluación: sin ideación suicida.', alertNotes: '',
          bp: 'Aseada, vestimenta casual', heartRate: 'Eutímico', temperature: 'Reactivo, congruente', o2Saturation: 'Lógico, sin alteraciones', weight: 'Sin alteraciones', height: 'Orientada x3', bmi: 'Parcial', respiratoryRate: 'Adecuado',
          personalHistory: 'Episodio depresivo mayor en 2023 tratado con sertralina por 8 meses. Actualmente sin fármacos.', familyHistory: 'Madre con trastorno de ansiedad generalizada. Padre alcohólico en recuperación.', surgicalHistory: 'Ninguna.', habits: 'PHQ-9: 8 (leve). GAD-7: 12 (moderado). Beck-II: 14.',
          currentMedications: 'TCC enfocada en ansiedad, frecuencia semanal. Objetivo: reducir evitación social.', chronicConditions: ['Trastorno ansiedad generalizada'],
          diagnosisCode: 'F41.1', diagnosisLabel: 'Trastorno de ansiedad generalizada', differentialDx: 'Fobia social descartada. Rasgos evitativos leves sin criterio diagnóstico.',
          soapSubjective: 'Reporta menor frecuencia de crisis ansiosas. Completó registro de pensamientos automáticos.', soapObjective: 'Aspecto cuidado. Contacto visual adecuado. Ánimo eutímico. Ansiedad leve al hablar de situaciones sociales.', soapAssessment: 'Progreso en reestructuración cognitiva. Evitación social persiste pero con menor intensidad.', soapPlan: 'Exposición graduada a situaciones sociales. Tarea: asistir a evento social breve. Control en 1 semana.',
          encounters: [
            { encounterDate: '2026-03-17', terapeuta: 'Ps. Carolina Vega', motivo: 'Control semanal', observacion: 'Ansiedad moderada ante evaluación laboral. Aplicación de técnicas de respiración.', plan: 'Registro de pensamientos automáticos diario.' },
            { encounterDate: '2026-03-10', terapeuta: 'Ps. Carolina Vega', motivo: 'Sesión regular', observacion: 'Reporta 2 crisis de ansiedad en la semana. Identificados gatillantes laborales.', plan: 'Reestructuración cognitiva sobre creencias de rendimiento.' }
          ]
        },
        {
          id: 2, fullName: 'Tomás Herrera', patientId: 'PSI-00002', rut: '17.654.321-0',
          birthDate: '1998-02-28', age: 28, gender: 'male', occupation: 'Estudiante postgrado', education: 'postgrad', maritalStatus: 'cohabiting',
          insurance: 'fonasa_b', phone: '+56 9 4455 6677', email: 'tomas.h@email.com', address: 'Macul 3300, Macul', emergencyContact: 'Pareja +56 9 9988 7766',
          doctor: 'Ps. Carolina Vega', lastVisit: '2026-03-20', status: 'scheduled',
          allergies: [], contraindications: '', alertNotes: 'Derivado por médico general por insomnio crónico.',
          bp: 'Ojeras marcadas, postura encorvada', heartRate: 'Irritable', temperature: 'Aplanado', o2Saturation: 'Rumiativo', weight: 'Sin alteraciones', height: 'Orientado x3', bmi: 'Presente', respiratoryRate: 'Conservado',
          personalHistory: 'Sin antecedentes psiquiátricos previos. Insomnio progresivo desde hace 6 meses.', familyHistory: 'Abuelo paterno: depresión mayor.', surgicalHistory: 'Ninguna.', habits: 'Pendiente: PHQ-9, GAD-7, ISI (Insomnia Severity Index).',
          currentMedications: 'Evaluación psicodiagnóstica en curso. Pendiente definir enfoque.', chronicConditions: ['Insomnio'],
          diagnosisCode: '', diagnosisLabel: 'En evaluación', differentialDx: 'Hipótesis: Trastorno de insomnio vs. Ansiedad con insomnio secundario.',
          soapSubjective: 'Refiere dormir 3-4 horas diarias. Dificultad para concentrarse en tesis.', soapObjective: 'Aspecto fatigado. Ánimo irritable. Pensamiento coherente pero con contenido rumiativo nocturno.', soapAssessment: 'Insomnio crónico con impacto funcional significativo. Requiere evaluación completa.', soapPlan: 'Aplicar batería: PHQ-9, GAD-7, ISI. Psicoeducación en higiene del sueño. Control post-evaluación.',
          encounters: []
        }
      ]
    },

    // ─────────────────────────── CITAS DENTALES ─────────────────────────
    'dental-sessions': {
      schema: {
        entity: { key: 'dental-sessions', singular: 'Cita Dental', plural: 'Citas Dentales', icon: 'tooth', moduleType: 'calendar', description: 'Agenda de citas odontológicas' },
        fields: []
      },
      data: [
        { id: 1, title: 'Limpieza semestral',        patientName: 'Andrea Muñoz',    patientEmail: 'andrea.m@email.com',  startDate: '2026-03-24T09:00', endDate: '2026-03-24T09:40', treatmentType: 'cleaning',     status: 'completed', chair: 'Sillón 1', notes: 'Destartraje + pulido.',        createdAt: '2026-03-17', updatedAt: '2026-03-24' },
        { id: 2, title: 'Obturación pieza 36',       patientName: 'Felipe Contreras', patientEmail: 'felipe.c@email.com',  startDate: '2026-03-26T10:00', endDate: '2026-03-26T10:45', treatmentType: 'filling',      status: 'scheduled', chair: 'Sillón 2', notes: 'Caries mesial clase II.',      createdAt: '2026-03-20', updatedAt: '2026-03-20' },
        { id: 3, title: 'Control ortodoncia mensual', patientName: 'Andrea Muñoz',   patientEmail: 'andrea.m@email.com',  startDate: '2026-03-27T11:00', endDate: '2026-03-27T11:30', treatmentType: 'orthodontics', status: 'scheduled', chair: 'Sillón 1', notes: 'Activación arco superior.',    createdAt: '2026-03-22', updatedAt: '2026-03-22' }
      ]
    },

    // ─────────────────────────── FICHAS DENTALES ────────────────────────
    'dental-records': {
      schema: {
        entity: { key: 'dental-records', singular: 'Ficha Dental', plural: 'Fichas Dentales', icon: 'tooth', moduleType: 'clinical-record', description: 'Fichas odontológicas y registros de tratamientos' },
        fields: []
      },
      data: [
        {
          id: 1, fullName: 'Andrea Muñoz', patientId: 'DEN-00001', rut: '19.876.543-2',
          birthDate: '2000-11-05', age: 25, gender: 'female',
          insurance: 'fonasa_c', phone: '+56 9 3344 5566', email: 'andrea.m@email.com',
          doctor: 'Dr. Ramírez', lastVisit: '2026-03-24', status: 'orthodontic',
          allergies: ['Látex'], contraindications: 'Usar guantes nitrilo. Alergia a látex confirmada.', alertNotes: '',
          bp: '2', heartRate: 'Buena', temperature: 'No', o2Saturation: 'Grado 0', weight: '12%', height: 'Clase I', bmi: 'Normal', respiratoryRate: 'No',
          personalHistory: 'Sana. Sin enfermedades sistémicas.', familyHistory: 'Madre con periodontitis crónica.', surgicalHistory: 'Extracción 3ros molares (2024).', habits: 'Sin bruxismo. Sin succión digital.',
          currentMedications: 'Ninguna.', chronicConditions: ['Ortodoncia activa'],
          diagnosisCode: 'K07.3', diagnosisLabel: 'Apiñamiento dentario moderado', differentialDx: 'Tratamiento ortodóncico con brackets metálicos. Duración estimada: 18 meses. Inicio: sept 2025.',
          soapSubjective: 'Control mensual ortodoncia. Sin dolor. Refiere bracket suelto pieza 23 hace 2 días.', soapObjective: 'Bracket pieza 23 descementado. Resto de aparatología en buen estado. Higiene buena.', soapAssessment: 'Evolución ortodóncica favorable. Incidente menor con bracket.', soapPlan: 'Recementado bracket pieza 23. Activación arco superior NiTi 0.016. Control en 4 semanas.',
          encounters: [
            { encounterDate: '2026-02-24', odontologo: 'Dr. Ramírez', motivo: 'Control ortodoncia', procedimiento: 'Cambio ligaduras. Sin novedades.', indicaciones: 'Mantener higiene. Evitar alimentos duros.' }
          ]
        },
        {
          id: 2, fullName: 'Felipe Contreras', patientId: 'DEN-00002', rut: '16.543.210-9',
          birthDate: '1988-04-18', age: 37, gender: 'male',
          insurance: 'particular', phone: '+56 9 7788 9900', email: 'felipe.c@email.com',
          doctor: 'Dr. Ramírez', lastVisit: '2026-03-10', status: 'active',
          allergies: [], contraindications: '', alertNotes: '',
          bp: '4', heartRate: 'Regular', temperature: 'Sí (localizado)', o2Saturation: 'Grado 0', weight: '28%', height: 'Clase I', bmi: 'Normal', respiratoryRate: 'Térmica pieza 36',
          personalHistory: 'Hipertensión controlada con losartán 50mg.', familyHistory: 'Sin antecedentes relevantes.', surgicalHistory: 'Ninguna odontológica previa.', habits: 'Bruxismo nocturno leve. Fumador social.',
          currentMedications: 'Losartán 50mg/día (HTA).', chronicConditions: ['Bruxismo', 'HTA'],
          diagnosisCode: 'K02.1', diagnosisLabel: 'Caries dentina pieza 36', differentialDx: 'Pulpitis reversible descartada (test vitalidad normal). Indicación: obturación directa.',
          soapSubjective: 'Dolor leve al masticar lado izquierdo, 2 semanas de evolución. Sensibilidad al frío pieza 36.', soapObjective: 'Caries mesial pieza 36 visible. Test vitalidad positivo normal. Percusión negativa. Rx: lesión radiolúcida en dentina sin compromiso pulpar.', soapAssessment: 'Caries clase II mesial pieza 36 en dentina. Vitalidad conservada. Sin compromiso pulpar.', soapPlan: 'Obturación directa resina compuesta. Cita programada 26/03. Plano relajación por bruxismo.',
          encounters: []
        }
      ]
    }
  };

  /**
   * Returns entity metadata for sidebar navigation.
   * SOURCE: authorized schemas from the backend auth response.
   * Only entities the backend granted access to are returned.
   */
  getAvailableEntities(): EntityMeta[] {
    const authorized = this.auth.getAuthorizedSchemas();
    if (authorized.length > 0) {
      return authorized.map(s => s.entity);
    }
    // Fallback to full catalog (used in tests / before login)
    return Object.values(this.catalog).map(p => p.schema.entity);
  }

  /**
   * Returns the full payload (schema + data) for a given entity key.
   * Schema definition comes from the auth response when available,
   * data rows come from the local catalog (mock store).
   */
  getEntityPayload(key: string): EntityPayload | null {
    if (!this.catalog[key]) return null;
    const authorizedSchema = this.auth.getAuthorizedSchemas().find(s => s.entity.key === key);
    return {
      schema: authorizedSchema ?? this.catalog[key].schema,
      data: this.catalog[key].data
    };
  }

  /**
   * Returns only the schema for a given entity key.
   * Prefers the schema from the auth response (backend-driven).
   */
  getSchema(key: string): EntitySchema | null {
    const authorizedSchema = this.auth.getAuthorizedSchemas().find(s => s.entity.key === key);
    if (authorizedSchema) return authorizedSchema;
    return this.catalog[key]?.schema ?? null;
  }
}
