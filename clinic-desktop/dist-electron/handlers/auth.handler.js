"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthHandlers = void 0;
// ─── Schema definitions ────────────────────────────────────────────────────────
const SCHEMA_SUPPLIERS = {
    entity: { key: 'suppliers', singular: 'Proveedor', plural: 'Proveedores', icon: 'users', description: 'Gestión de proveedores y socios comerciales' },
    fields: [
        { name: 'name', type: 'text', label: 'Nombre', required: true, isTitle: true, showInList: true, showInDetail: true, sortable: true, filterable: true, filterType: 'search', minLength: 2, maxLength: 100 },
        { name: 'code', type: 'text', label: 'Código', required: true, isSubtitle: true, showInList: true, showInDetail: true, sortable: true, pattern: '^[A-Z]{2}-\\d{3,}$', patternMessage: 'Formato: XX-000' },
        { name: 'email', type: 'email', label: 'Email', required: true, showInList: false, showInDetail: true },
        { name: 'phone', type: 'tel', label: 'Teléfono', required: true, showInList: false, showInDetail: true },
        { name: 'category', type: 'select', label: 'Categoría', required: true, isBadge: true, showInList: true, showInDetail: true, sortable: true, filterable: true, filterType: 'select',
            options: [
                { value: 'technology', label: 'Tecnología' },
                { value: 'manufacturing', label: 'Manufactura' },
                { value: 'logistics', label: 'Logística' },
                { value: 'services', label: 'Servicios' },
                { value: 'raw-materials', label: 'Materias Primas' },
                { value: 'healthcare', label: 'Salud' }
            ],
            badgeColors: { technology: '#6366f1', manufacturing: '#f59e0b', logistics: '#3b82f6', services: '#10b981', 'raw-materials': '#8b5cf6', healthcare: '#14b8a6' }
        },
        { name: 'status', type: 'select', label: 'Estado', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
            options: [{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }, { value: 'pending', label: 'Pendiente' }, { value: 'blacklisted', label: 'Bloqueado' }],
            badgeColors: { active: '#10b981', inactive: '#6b7280', pending: '#f59e0b', blacklisted: '#ef4444' }
        },
        { name: 'country', type: 'text', label: 'País', required: true, showInList: true, showInDetail: true, sortable: true },
        { name: 'city', type: 'text', label: 'Ciudad', required: true, showInList: false, showInDetail: true },
        { name: 'contactPerson', type: 'text', label: 'Contacto', required: true, showInList: true, showInDetail: true },
        { name: 'rating', type: 'range', label: 'Calificación', required: true, showInList: true, showInDetail: true, sortable: true, min: 1, max: 5, step: 0.1, format: 'stars' },
        { name: 'totalSpent', type: 'number', label: 'Total Gastado', required: true, showInList: true, showInDetail: true, sortable: true, min: 0, format: 'currency' },
        { name: 'notes', type: 'textarea', label: 'Notas', showInList: false, showInDetail: true },
        { name: 'tags', type: 'tags', label: 'Etiquetas', showInList: false, showInDetail: true }
    ]
};
const SCHEMA_PRODUCTS = {
    entity: { key: 'products', singular: 'Producto', plural: 'Productos', icon: 'package', description: 'Catálogo de productos e inventario' },
    fields: [
        { name: 'name', type: 'text', label: 'Nombre del Producto', required: true, isTitle: true, showInList: true, showInDetail: true, sortable: true, filterable: true, filterType: 'search', minLength: 2 },
        { name: 'sku', type: 'text', label: 'SKU', required: true, isSubtitle: true, showInList: true, showInDetail: true, sortable: true, pattern: '^[A-Z]{3}-\\d{4}$', patternMessage: 'Formato: ABC-0000' },
        { name: 'category', type: 'select', label: 'Categoría', required: true, isBadge: true, showInList: true, showInDetail: true, sortable: true, filterable: true, filterType: 'select',
            options: [{ value: 'electronics', label: 'Electrónica' }, { value: 'medical', label: 'Médico' }, { value: 'tools', label: 'Herramientas' }, { value: 'furniture', label: 'Muebles' }],
            badgeColors: { electronics: '#6366f1', medical: '#14b8a6', tools: '#f59e0b', furniture: '#8b5cf6' }
        },
        { name: 'status', type: 'select', label: 'Estado', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
            options: [{ value: 'available', label: 'Disponible' }, { value: 'low_stock', label: 'Stock Bajo' }, { value: 'out_of_stock', label: 'Sin Stock' }],
            badgeColors: { available: '#10b981', low_stock: '#f59e0b', out_of_stock: '#ef4444' }
        },
        { name: 'price', type: 'number', label: 'Precio', required: true, showInList: true, showInDetail: true, sortable: true, min: 0, format: 'currency' },
        { name: 'stock', type: 'number', label: 'Stock', required: true, showInList: true, showInDetail: true, sortable: true, min: 0 },
        { name: 'supplier', type: 'text', label: 'Proveedor', required: true, showInList: true, showInDetail: true, filterable: true, filterType: 'search' },
        { name: 'description', type: 'textarea', label: 'Descripción', showInList: false, showInDetail: true },
        { name: 'tags', type: 'tags', label: 'Etiquetas', showInList: false, showInDetail: true }
    ]
};
const SCHEMA_PAYMENTS = {
    entity: { key: 'payments', singular: 'Cobro', plural: 'Cobros', icon: 'dollar-sign', description: 'Registro de cobros e ingresos', disableEdit: true, disableDelete: true },
    fields: [
        { name: 'patientName', type: 'text', label: 'Paciente', required: true, isTitle: true, showInList: true, showInDetail: true, filterable: true, filterType: 'search', sortable: true },
        { name: 'invoiceNumber', type: 'text', label: 'N° Documento', required: false, isSubtitle: true, showInList: true, showInDetail: true },
        { name: 'date', type: 'date', label: 'Fecha', required: true, showInList: true, showInDetail: true, sortable: true },
        { name: 'concept', type: 'select', label: 'Concepto', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
            options: [
                { value: 'consulta', label: 'Consulta médica' },
                { value: 'procedimiento', label: 'Procedimiento' },
                { value: 'examenes', label: 'Exámenes' },
                { value: 'medicamentos', label: 'Medicamentos' },
                { value: 'otro', label: 'Otro' }
            ],
            badgeColors: { consulta: '#6366f1', procedimiento: '#8b5cf6', examenes: '#3b82f6', medicamentos: '#10b981', otro: '#6b7280' }
        },
        { name: 'amount', type: 'number', label: 'Monto (CLP)', required: true, showInList: true, showInDetail: true, sortable: true, min: 0, format: 'currency' },
        { name: 'paymentMethod', type: 'select', label: 'Medio de pago', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
            options: [
                { value: 'efectivo', label: 'Efectivo' },
                { value: 'debito', label: 'Débito' },
                { value: 'transferencia', label: 'Transferencia' },
                { value: 'fonasa', label: 'FONASA' },
                { value: 'isapre', label: 'Isapre' }
            ],
            badgeColors: { efectivo: '#10b981', debito: '#3b82f6', transferencia: '#8b5cf6', fonasa: '#f59e0b', isapre: '#ec4899' }
        },
        { name: 'status', type: 'select', label: 'Estado', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
            options: [{ value: 'pagado', label: 'Pagado' }, { value: 'pendiente', label: 'Pendiente' }, { value: 'anulado', label: 'Anulado' }],
            badgeColors: { pagado: '#10b981', pendiente: '#f59e0b', anulado: '#ef4444' }
        },
        { name: 'notes', type: 'textarea', label: 'Observaciones', required: false, showInList: false, showInDetail: true }
    ]
};
const SCHEMA_EXPENSES = {
    entity: { key: 'expenses', singular: 'Gasto', plural: 'Gastos', icon: 'trending-down', description: 'Control de gastos y egresos operacionales' },
    fields: [
        { name: 'description', type: 'text', label: 'Descripción', required: true, isTitle: true, showInList: true, showInDetail: true, filterable: true, filterType: 'search', sortable: true },
        { name: 'supplier', type: 'text', label: 'Proveedor / Origen', required: false, isSubtitle: true, showInList: true, showInDetail: true, filterable: true, filterType: 'search' },
        { name: 'date', type: 'date', label: 'Fecha', required: true, showInList: true, showInDetail: true, sortable: true },
        { name: 'category', type: 'select', label: 'Categoría', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
            options: [
                { value: 'insumos', label: 'Insumos médicos' },
                { value: 'remuneraciones', label: 'Remuneraciones' },
                { value: 'arriendo', label: 'Arriendo' },
                { value: 'servicios', label: 'Servicios básicos' },
                { value: 'equipamiento', label: 'Equipamiento' },
                { value: 'otro', label: 'Otro' }
            ],
            badgeColors: { insumos: '#6366f1', remuneraciones: '#ec4899', arriendo: '#f59e0b', servicios: '#3b82f6', equipamiento: '#8b5cf6', otro: '#6b7280' }
        },
        { name: 'amount', type: 'number', label: 'Monto (CLP)', required: true, showInList: true, showInDetail: true, sortable: true, min: 0, format: 'currency' },
        { name: 'paymentMethod', type: 'select', label: 'Medio de pago', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
            options: [{ value: 'efectivo', label: 'Efectivo' }, { value: 'transferencia', label: 'Transferencia' }, { value: 'tarjeta', label: 'Tarjeta' }],
            badgeColors: { efectivo: '#10b981', transferencia: '#6366f1', tarjeta: '#3b82f6' }
        },
        { name: 'status', type: 'select', label: 'Estado', required: true, isBadge: true, showInList: true, showInDetail: true, filterable: true, filterType: 'select',
            options: [{ value: 'pagado', label: 'Pagado' }, { value: 'pendiente', label: 'Pendiente' }, { value: 'rechazado', label: 'Rechazado' }],
            badgeColors: { pagado: '#10b981', pendiente: '#f59e0b', rechazado: '#ef4444' }
        },
        { name: 'notes', type: 'textarea', label: 'Observaciones', required: false, showInList: false, showInDetail: true }
    ]
};
// ─── Mock users ────────────────────────────────────────────────────────────────
const MOCK_USERS = [
    {
        password: 'admin123',
        user: { id: 1, name: 'Admin General', email: 'admin@clinica.com', role: 'admin', avatar: 'AG' },
        schemas: [SCHEMA_SUPPLIERS, SCHEMA_PRODUCTS, SCHEMA_PAYMENTS, SCHEMA_EXPENSES]
    },
    {
        password: 'compras123',
        user: { id: 2, name: 'Jefe de Compras', email: 'compras@clinica.com', role: 'manager', avatar: 'JC' },
        schemas: [SCHEMA_SUPPLIERS, SCHEMA_PRODUCTS, SCHEMA_EXPENSES]
    },
    {
        password: 'medico123',
        user: { id: 3, name: 'Dra. Morales', email: 'medico@clinica.com', role: 'manager', avatar: 'DM' },
        schemas: [SCHEMA_PAYMENTS]
    },
    {
        password: 'viewer123',
        user: { id: 4, name: 'Auditor', email: 'auditor@clinica.com', role: 'viewer', avatar: 'AU' },
        schemas: [SCHEMA_SUPPLIERS, SCHEMA_PAYMENTS, SCHEMA_EXPENSES]
    }
];
// ─── Handler registration ──────────────────────────────────────────────────────
function registerAuthHandlers(ipcMain) {
    ipcMain.handle('auth:login', (_event, credentials) => {
        const mock = MOCK_USERS.find(u => u.user.email === credentials.email);
        if (!mock || mock.password !== credentials.password) {
            throw new Error('Credenciales inválidas. Verifique su email y contraseña.');
        }
        const response = {
            token: `token_${mock.user.id}_${Date.now()}`,
            expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
            user: mock.user,
            schemas: mock.schemas
        };
        return response;
    });
}
exports.registerAuthHandlers = registerAuthHandlers;
