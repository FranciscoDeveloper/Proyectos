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
          { name: 'room',  type: 'text',     label: 'Consultorio', required: false, showInList: true,  showInDetail: true  },
          { name: 'notes', type: 'textarea', label: 'Notas',       required: false, showInList: false, showInDetail: true  }
        ]
      },
      data: [
        // ── Semana 1 (2–6 mar) ──────────────────────────────────────────────
        { id: 1,  title: 'Control de hipertensión',      patientName: 'María González López',    startDate: '2026-03-03T09:00', endDate: '2026-03-03T09:45', status: 'completed', room: 'Consultorio 1', notes: 'Ajuste de dosis antihipertensiva.',          createdAt: '2026-02-20', updatedAt: '2026-03-03' },
        { id: 2,  title: 'Revisión post-operatoria',     patientName: 'Carlos Fernández Torres', startDate: '2026-03-03T09:45', endDate: '2026-03-03T10:30', status: 'completed', room: 'Consultorio 1', notes: 'Evolución favorable tras stent coronario.',   createdAt: '2026-02-22', updatedAt: '2026-03-03' },
        { id: 3,  title: 'Consulta cardiología',         patientName: 'Ana Martínez Soto',       startDate: '2026-03-05T10:30', endDate: '2026-03-05T11:15', status: 'completed', room: 'Consultorio 2', notes: 'ECG en rango normal.',                        createdAt: '2026-02-25', updatedAt: '2026-03-05' },
        // ── Semana 2 (9–13 mar) ─────────────────────────────────────────────
        { id: 4,  title: 'Seguimiento diabetes',         patientName: 'Sofia Ruiz Castillo',     startDate: '2026-03-10T09:00', endDate: '2026-03-10T09:45', status: 'completed', room: 'Consultorio 3', notes: 'HbA1c 6.8%. Dosis estable.',                  createdAt: '2026-03-01', updatedAt: '2026-03-10' },
        { id: 5,  title: 'Control respiratorio',         patientName: 'Isabel Díaz Vega',        startDate: '2026-03-10T09:45', endDate: '2026-03-10T10:30', status: 'completed', room: 'Consultorio 1', notes: 'Espirometría mejorada vs mes anterior.',       createdAt: '2026-03-05', updatedAt: '2026-03-10' },
        { id: 6,  title: 'Revisión fractura fémur',      patientName: 'Roberto García Blanco',   startDate: '2026-03-12T14:00', endDate: '2026-03-12T14:45', status: 'no_show',   room: 'Consultorio 2', notes: 'Paciente no se presentó. Reprogramar.',      createdAt: '2026-03-05', updatedAt: '2026-03-12' },
        // ── Semana 3 (16–20 mar) ────────────────────────────────────────────
        { id: 7,  title: 'Primera consulta',             patientName: 'Pedro Alvarado Cruz',     startDate: '2026-03-17T09:00', endDate: '2026-03-17T09:45', status: 'completed', room: 'Consultorio 1', notes: 'Derivado por médico de cabecera.',             createdAt: '2026-03-10', updatedAt: '2026-03-17' },
        { id: 8,  title: 'Control cardiológico',         patientName: 'Lucía Vega Moreno',       startDate: '2026-03-17T10:30', endDate: '2026-03-17T11:15', status: 'cancelled', room: 'Consultorio 3', notes: 'Cancelada por la paciente.',                  createdAt: '2026-03-12', updatedAt: '2026-03-17' },
        { id: 9,  title: 'Ajuste de tratamiento',        patientName: 'Carlos Fernández Torres', startDate: '2026-03-19T09:00', endDate: '2026-03-19T09:45', status: 'completed', room: 'Consultorio 2', notes: 'Reducción dosis anticoagulante.',              createdAt: '2026-03-15', updatedAt: '2026-03-19' },
        { id: 10, title: 'Evaluación neurológica',       patientName: 'Isabel Díaz Vega',        startDate: '2026-03-19T14:00', endDate: '2026-03-19T14:45', status: 'completed', room: 'Consultorio 1', notes: 'Sin nuevos episodios. Control en 3 meses.',   createdAt: '2026-03-10', updatedAt: '2026-03-19' },
        // ── Semana 4 (23–27 mar — semana actual, hoy jue 26) ────────────────
        { id: 11, title: 'Control mensual',              patientName: 'María González López',    startDate: '2026-03-24T09:00', endDate: '2026-03-24T09:45', status: 'completed', room: 'Consultorio 1', notes: 'Presión arterial estabilizada 120/80.',        createdAt: '2026-03-17', updatedAt: '2026-03-24' },
        { id: 12, title: 'Revisión de exámenes',         patientName: 'Miguel Torres Fuentes',   startDate: '2026-03-24T10:30', endDate: '2026-03-24T11:15', status: 'completed', room: 'Consultorio 2', notes: 'Resultados de lab normales.',                  createdAt: '2026-03-20', updatedAt: '2026-03-24' },
        { id: 13, title: 'Seguimiento postquirúrgico',   patientName: 'Luis Hernández Pérez',    startDate: '2026-03-26T09:00', endDate: '2026-03-26T09:45', status: 'scheduled', room: 'Consultorio 1', notes: 'Seguimiento a 4 meses de la operación.',      createdAt: '2026-03-20', updatedAt: '2026-03-20' },
        { id: 14, title: 'Control diabetes',             patientName: 'Sofia Ruiz Castillo',     startDate: '2026-03-26T10:30', endDate: '2026-03-26T11:15', status: 'scheduled', room: 'Consultorio 3', notes: 'Control mensual glucemia.',                    createdAt: '2026-03-21', updatedAt: '2026-03-21' },
        { id: 15, title: 'Consulta de urgencia',         patientName: 'Carmen López Ibáñez',     startDate: '2026-03-27T09:00', endDate: '2026-03-27T09:45', status: 'scheduled', room: 'Consultorio 2', notes: 'Derivación por dolor torácico recurrente.',    createdAt: '2026-03-25', updatedAt: '2026-03-25' },
        { id: 16, title: 'Control fractura fémur',       patientName: 'Roberto García Blanco',   startDate: '2026-03-27T14:00', endDate: '2026-03-27T14:45', status: 'scheduled', room: 'Consultorio 2', notes: 'Reprogramada de id-6.',                        createdAt: '2026-03-25', updatedAt: '2026-03-25' },
        // ── Semana 5 (30 mar – 3 abr) ───────────────────────────────────────
        { id: 17, title: 'Revisión eco-cardiograma',     patientName: 'Ana Martínez Soto',       startDate: '2026-03-31T14:00', endDate: '2026-03-31T14:45', status: 'scheduled', room: 'Consultorio 1', notes: 'Seguimiento post cirugía de rodilla.',         createdAt: '2026-03-20', updatedAt: '2026-03-20' },
        { id: 18, title: 'Control respiratorio trim.',   patientName: 'Isabel Díaz Vega',        startDate: '2026-04-07T09:00', endDate: '2026-04-07T09:45', status: 'scheduled', room: 'Consultorio 1', notes: 'Revisión trimestral EPOC.',                   createdAt: '2026-03-22', updatedAt: '2026-03-22' }
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
