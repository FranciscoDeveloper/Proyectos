"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEntityHandlers = void 0;
/**
 * In-memory entity stores.
 * Keyed by entity key (e.g. 'suppliers', 'products', 'payments', 'expenses').
 * Data persists for the lifetime of the Electron process (until the app closes).
 * In a production app, replace with SQLite or a file-based store.
 */
const _stores = {
    suppliers: [
        { id: 1, name: 'TechCorp Solutions', code: 'TC-001', email: 'contact@techcorp.com', phone: '+1 555 234-5678', category: 'technology', status: 'active', country: 'Estados Unidos', city: 'San Francisco', contactPerson: 'Alice Johnson', rating: 4.8, totalSpent: 1250000, notes: 'Socio tecnológico premium.', tags: ['IT', 'cloud'], createdAt: '2022-01-15', updatedAt: '2024-11-10' },
        { id: 2, name: 'Global Logistics Co', code: 'GL-002', email: 'ops@globallogistics.com', phone: '+44 20 7946 0958', category: 'logistics', status: 'active', country: 'Reino Unido', city: 'Londres', contactPerson: 'James Wilson', rating: 4.5, totalSpent: 890000, notes: 'Cobertura logística global.', tags: ['shipping'], createdAt: '2021-06-20', updatedAt: '2024-12-01' },
        { id: 3, name: 'PrimeMateriales SA', code: 'PM-003', email: 'ventas@primematerials.es', phone: '+34 91 234 5678', category: 'raw-materials', status: 'active', country: 'España', city: 'Madrid', contactPerson: 'Carlos Ruiz', rating: 4.2, totalSpent: 650000, notes: 'Certificado ISO 9001.', tags: ['metals'], createdAt: '2022-03-10', updatedAt: '2024-10-15' },
        { id: 4, name: 'HealthPlus Supplies', code: 'HP-004', email: 'procurement@healthplus.ca', phone: '+1 416 555 0199', category: 'healthcare', status: 'active', country: 'Canadá', city: 'Toronto', contactPerson: 'Sarah Mitchell', rating: 4.9, totalSpent: 2100000, notes: 'Socio crítico en salud.', tags: ['FDA-approved'], createdAt: '2019-05-12', updatedAt: '2024-12-15' },
        { id: 5, name: 'MediEquip Chile', code: 'ME-005', email: 'ventas@mediequip.cl', phone: '+56 2 2345 6789', category: 'healthcare', status: 'active', country: 'Chile', city: 'Santiago', contactPerson: 'Luis Tapia', rating: 4.6, totalSpent: 780000, notes: 'Equipamiento médico nacional.', tags: ['equipamiento'], createdAt: '2021-11-01', updatedAt: '2024-11-30' },
        { id: 6, name: 'LogiCare Distribución', code: 'LC-006', email: 'contacto@logicare.cl', phone: '+56 2 2987 6543', category: 'services', status: 'pending', country: 'Chile', city: 'Valparaíso', contactPerson: 'Ana Fuentes', rating: 3.8, totalSpent: 120000, notes: 'Nuevo proveedor en evaluación.', tags: ['distribución'], createdAt: '2024-08-01', updatedAt: '2024-12-10' },
        { id: 7, name: 'FarmaInsumos SA', code: 'FI-007', email: 'pedidos@farmainsumos.cl', phone: '+56 2 2111 2233', category: 'healthcare', status: 'inactive', country: 'Chile', city: 'Concepción', contactPerson: 'Pedro Vargas', rating: 3.2, totalSpent: 430000, notes: 'Contrato pausado, pendiente reno.', tags: ['farmacia'], createdAt: '2020-11-05', updatedAt: '2024-07-20' },
        { id: 8, name: 'ProServices Group', code: 'PS-008', email: 'hello@proservices.com.au', phone: '+61 2 9876 5432', category: 'services', status: 'active', country: 'Australia', city: 'Sídney', contactPerson: 'Emma Thompson', rating: 4.6, totalSpent: 540000, notes: 'Excelente cumplimiento de SLA.', tags: ['consulting', 'SLA'], createdAt: '2021-09-18', updatedAt: '2024-11-30' }
    ],
    products: [
        { id: 1, name: 'Monitor de Presión Arterial', sku: 'MED-0001', category: 'medical', status: 'available', price: 85000, stock: 24, supplier: 'HealthPlus Supplies', description: 'Monitor digital automático de muñeca.', tags: ['tensiómetro', 'presión'], createdAt: '2023-01-10', updatedAt: '2024-11-15' },
        { id: 2, name: 'Estetoscopio Littmann', sku: 'MED-0002', category: 'medical', status: 'available', price: 180000, stock: 12, supplier: 'HealthPlus Supplies', description: 'Estetoscopio cardiology III de precisión.', tags: ['diagnóstico'], createdAt: '2023-02-05', updatedAt: '2024-10-20' },
        { id: 3, name: 'Termómetro Digital', sku: 'MED-0003', category: 'medical', status: 'available', price: 12000, stock: 50, supplier: 'MediEquip Chile', description: 'Termómetro infrarrojo sin contacto.', tags: ['temperatura'], createdAt: '2023-03-12', updatedAt: '2024-11-01' },
        { id: 4, name: 'Mesa de Examen Clínico', sku: 'FUR-0001', category: 'furniture', status: 'available', price: 650000, stock: 4, supplier: 'MediEquip Chile', description: 'Mesa de examen tapizada, altura regulable.', tags: ['mobiliario', 'clínica'], createdAt: '2023-04-01', updatedAt: '2024-09-10' },
        { id: 5, name: 'Oxímetro de Pulso', sku: 'MED-0004', category: 'medical', status: 'available', price: 35000, stock: 30, supplier: 'HealthPlus Supplies', description: 'Oxímetro de dedo, lectura instantánea.', tags: ['oxígeno', 'saturación'], createdAt: '2023-05-20', updatedAt: '2024-11-22' },
        { id: 6, name: 'Computador HP EliteDesk', sku: 'ELE-0001', category: 'electronics', status: 'available', price: 890000, stock: 8, supplier: 'TechCorp Solutions', description: 'Computador de escritorio empresarial i5, 16GB RAM.', tags: ['computador', 'admin'], createdAt: '2023-06-15', updatedAt: '2024-10-30' },
        { id: 7, name: 'Impresora Térmica', sku: 'ELE-0002', category: 'electronics', status: 'low_stock', price: 95000, stock: 3, supplier: 'TechCorp Solutions', description: 'Impresora para tickets y recetas médicas.', tags: ['impresión'], createdAt: '2023-07-08', updatedAt: '2024-11-05' },
        { id: 8, name: 'Maletín Médico', sku: 'MED-0005', category: 'medical', status: 'out_of_stock', price: 45000, stock: 0, supplier: 'MediEquip Chile', description: 'Maletín equipado para atención domiciliaria.', tags: ['emergencia', 'visita'], createdAt: '2023-08-01', updatedAt: '2024-12-01' },
        { id: 9, name: 'Lámpara de Examen', sku: 'MED-0006', category: 'medical', status: 'available', price: 78000, stock: 15, supplier: 'HealthPlus Supplies', description: 'Lámpara LED de brazo articulado para consultorio.', tags: ['iluminación'], createdAt: '2023-09-14', updatedAt: '2024-10-18' },
        { id: 10, name: 'Kit de Sutura Estéril', sku: 'MED-0007', category: 'medical', status: 'available', price: 8500, stock: 100, supplier: 'FarmaInsumos SA', description: 'Kit desechable para sutura de heridas menores.', tags: ['cirugía', 'estéril'], createdAt: '2023-10-05', updatedAt: '2024-11-28' }
    ],
    payments: [
        { id: 1, patientName: 'María González López', invoiceNumber: 'FAC-2026-001', date: '2026-03-03', concept: 'consulta', amount: 45000, paymentMethod: 'fonasa', status: 'pagado', notes: '', createdAt: '2026-03-03', updatedAt: '2026-03-03' },
        { id: 2, patientName: 'Carlos Fernández Torres', invoiceNumber: 'FAC-2026-002', date: '2026-03-03', concept: 'procedimiento', amount: 180000, paymentMethod: 'isapre', status: 'pagado', notes: 'Stent coronario - cov. parcial.', createdAt: '2026-03-03', updatedAt: '2026-03-03' },
        { id: 3, patientName: 'Ana Martínez Soto', invoiceNumber: 'FAC-2026-003', date: '2026-03-05', concept: 'examenes', amount: 72000, paymentMethod: 'debito', status: 'pagado', notes: '', createdAt: '2026-03-05', updatedAt: '2026-03-05' },
        { id: 4, patientName: 'Sofia Ruiz Castillo', invoiceNumber: 'FAC-2026-004', date: '2026-03-10', concept: 'consulta', amount: 45000, paymentMethod: 'fonasa', status: 'pagado', notes: '', createdAt: '2026-03-10', updatedAt: '2026-03-10' },
        { id: 5, patientName: 'Isabel Díaz Vega', invoiceNumber: 'FAC-2026-005', date: '2026-03-10', concept: 'consulta', amount: 45000, paymentMethod: 'isapre', status: 'pagado', notes: '', createdAt: '2026-03-10', updatedAt: '2026-03-10' },
        { id: 6, patientName: 'Luis Hernández Pérez', invoiceNumber: 'FAC-2026-006', date: '2026-03-17', concept: 'procedimiento', amount: 95000, paymentMethod: 'credito', status: 'pendiente', notes: 'Pendiente confirmación isapre.', createdAt: '2026-03-17', updatedAt: '2026-03-17' },
        { id: 7, patientName: 'Carlos Fernández Torres', invoiceNumber: 'FAC-2026-007', date: '2026-03-19', concept: 'consulta', amount: 45000, paymentMethod: 'efectivo', status: 'pagado', notes: '', createdAt: '2026-03-19', updatedAt: '2026-03-19' },
        { id: 8, patientName: 'Isabel Díaz Vega', invoiceNumber: 'FAC-2026-008', date: '2026-03-19', concept: 'examenes', amount: 85000, paymentMethod: 'fonasa', status: 'pagado', notes: '', createdAt: '2026-03-19', updatedAt: '2026-03-19' },
        { id: 9, patientName: 'María González López', invoiceNumber: 'FAC-2026-009', date: '2026-03-24', concept: 'consulta', amount: 45000, paymentMethod: 'isapre', status: 'pagado', notes: '', createdAt: '2026-03-24', updatedAt: '2026-03-24' },
        { id: 10, patientName: 'Luis Hernández Pérez', invoiceNumber: 'FAC-2026-010', date: '2026-03-24', concept: 'examenes', amount: 62000, paymentMethod: 'transferencia', status: 'pagado', notes: '', createdAt: '2026-03-24', updatedAt: '2026-03-24' },
        { id: 11, patientName: 'Sofia Ruiz Castillo', invoiceNumber: 'FAC-2026-011', date: '2026-03-26', concept: 'consulta', amount: 45000, paymentMethod: 'fonasa', status: 'pendiente', notes: 'Esperando voucher FONASA.', createdAt: '2026-03-26', updatedAt: '2026-03-26' },
        { id: 12, patientName: 'Ana Martínez Soto', invoiceNumber: 'FAC-2026-012', date: '2026-03-27', concept: 'procedimiento', amount: 120000, paymentMethod: 'isapre', status: 'pendiente', notes: 'Post-cirugía rodilla, cov. total.', createdAt: '2026-03-27', updatedAt: '2026-03-27' },
        { id: 13, patientName: 'Carlos Fernández Torres', invoiceNumber: 'FAC-2026-013', date: '2026-03-27', concept: 'consulta', amount: 45000, paymentMethod: 'efectivo', status: 'pendiente', notes: '', createdAt: '2026-03-27', updatedAt: '2026-03-27' },
        { id: 14, patientName: 'Pedro Soto Reyes', invoiceNumber: 'FAC-2026-014', date: '2026-03-28', concept: 'medicamentos', amount: 38500, paymentMethod: 'debito', status: 'pagado', notes: '', createdAt: '2026-03-28', updatedAt: '2026-03-28' },
        { id: 15, patientName: 'María González López', invoiceNumber: null, date: '2026-03-28', concept: 'examenes', amount: 55000, paymentMethod: 'transferencia', status: 'pendiente', notes: 'Laboratorio pendiente emisión.', createdAt: '2026-03-28', updatedAt: '2026-03-28' }
    ],
    expenses: [
        { id: 1, description: 'Arriendo consultorio piso 3', supplier: 'Inmobiliaria Santa Ana', date: '2026-03-01', category: 'arriendo', amount: 950000, paymentMethod: 'transferencia', status: 'pagado', notes: '', createdAt: '2026-03-01', updatedAt: '2026-03-01' },
        { id: 2, description: 'Sueldo Dr. Martínez', supplier: 'Remuneraciones', date: '2026-03-05', category: 'remuneraciones', amount: 2800000, paymentMethod: 'transferencia', status: 'pagado', notes: 'Incluye bono.', createdAt: '2026-03-05', updatedAt: '2026-03-05' },
        { id: 3, description: 'Sueldo Dra. López', supplier: 'Remuneraciones', date: '2026-03-05', category: 'remuneraciones', amount: 2500000, paymentMethod: 'transferencia', status: 'pagado', notes: '', createdAt: '2026-03-05', updatedAt: '2026-03-05' },
        { id: 4, description: 'Sueldo Recepcionista', supplier: 'Remuneraciones', date: '2026-03-05', category: 'remuneraciones', amount: 650000, paymentMethod: 'transferencia', status: 'pagado', notes: '', createdAt: '2026-03-05', updatedAt: '2026-03-05' },
        { id: 5, description: 'Insumos médicos marzo', supplier: 'MediEquip Chile', date: '2026-03-07', category: 'insumos', amount: 185000, paymentMethod: 'transferencia', status: 'pagado', notes: 'Guantes, jeringas, algodón.', createdAt: '2026-03-07', updatedAt: '2026-03-07' },
        { id: 6, description: 'Cuenta de electricidad', supplier: 'Enel Distribución', date: '2026-03-08', category: 'servicios', amount: 145000, paymentMethod: 'transferencia', status: 'pagado', notes: '', createdAt: '2026-03-08', updatedAt: '2026-03-08' },
        { id: 7, description: 'Internet y telefonía', supplier: 'Movistar Empresas', date: '2026-03-08', category: 'servicios', amount: 89000, paymentMethod: 'tarjeta', status: 'pagado', notes: 'Plan fibra + líneas.', createdAt: '2026-03-08', updatedAt: '2026-03-08' },
        { id: 8, description: 'Reactivos laboratorio', supplier: 'FarmaInsumos SA', date: '2026-03-12', category: 'insumos', amount: 340000, paymentMethod: 'transferencia', status: 'pagado', notes: 'Hemograma y bioquímica.', createdAt: '2026-03-12', updatedAt: '2026-03-12' },
        { id: 9, description: 'Mantención equipos médicos', supplier: 'HealthPlus Supplies', date: '2026-03-15', category: 'equipamiento', amount: 220000, paymentMethod: 'transferencia', status: 'pagado', notes: 'Servicio anual.', createdAt: '2026-03-15', updatedAt: '2026-03-15' },
        { id: 10, description: 'Seguro responsabilidad civil', supplier: 'Seguros Chile', date: '2026-03-15', category: 'servicios', amount: 185000, paymentMethod: 'transferencia', status: 'pagado', notes: 'Prima trimestral.', createdAt: '2026-03-15', updatedAt: '2026-03-15' },
        { id: 11, description: 'Agua y gas', supplier: 'Aguas Andinas / Metrogas', date: '2026-03-20', category: 'servicios', amount: 68000, paymentMethod: 'transferencia', status: 'pagado', notes: '', createdAt: '2026-03-20', updatedAt: '2026-03-20' },
        { id: 12, description: 'Material de oficina', supplier: 'OfficeMax', date: '2026-03-22', category: 'insumos', amount: 45000, paymentMethod: 'efectivo', status: 'pagado', notes: 'Resmas papel, tóner.', createdAt: '2026-03-22', updatedAt: '2026-03-22' },
        { id: 13, description: 'Capacitación RCP personal', supplier: 'Cruz Roja Chilena', date: '2026-03-25', category: 'otro', amount: 120000, paymentMethod: 'transferencia', status: 'pendiente', notes: 'Factura pendiente.', createdAt: '2026-03-25', updatedAt: '2026-03-25' },
        { id: 14, description: 'Sueldo Auxiliar de Aseo', supplier: 'Remuneraciones', date: '2026-03-05', category: 'remuneraciones', amount: 480000, paymentMethod: 'transferencia', status: 'pagado', notes: '', createdAt: '2026-03-05', updatedAt: '2026-03-05' },
        { id: 15, description: 'Fumigación y sanitización', supplier: 'CleanPro SpA', date: '2026-03-28', category: 'servicios', amount: 95000, paymentMethod: 'efectivo', status: 'pendiente', notes: 'Cuatrimestralmente.', createdAt: '2026-03-28', updatedAt: '2026-03-28' }
    ]
};
// Auto-increment IDs per entity
const _nextId = {
    suppliers: 9,
    products: 11,
    payments: 16,
    expenses: 16
};
// ─── Handler registration ──────────────────────────────────────────────────────
function registerEntityHandlers(ipcMain) {
    ipcMain.handle('entity:list', (_event, key) => {
        return _stores[key] ?? [];
    });
    ipcMain.handle('entity:create', (_event, key, data) => {
        if (!_stores[key])
            _stores[key] = [];
        if (!_nextId[key])
            _nextId[key] = 1;
        const now = new Date().toISOString().slice(0, 10);
        const record = { ...data, id: _nextId[key]++, createdAt: now, updatedAt: now };
        _stores[key].push(record);
        return record;
    });
    ipcMain.handle('entity:update', (_event, key, id, data) => {
        const store = _stores[key];
        if (!store)
            throw new Error(`Entity '${key}' not found.`);
        const idx = store.findIndex(r => r['id'] === id);
        if (idx === -1)
            throw new Error(`Record ${id} not found in '${key}'.`);
        const updated = { ...store[idx], ...data, id, updatedAt: new Date().toISOString().slice(0, 10) };
        store[idx] = updated;
        return updated;
    });
    ipcMain.handle('entity:delete', (_event, key, id) => {
        const store = _stores[key];
        if (!store)
            throw new Error(`Entity '${key}' not found.`);
        const idx = store.findIndex(r => r['id'] === id);
        if (idx !== -1)
            store.splice(idx, 1);
        return { success: true };
    });
}
exports.registerEntityHandlers = registerEntityHandlers;
