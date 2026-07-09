import pg from 'pg';
import { getLogger } from './logger.mjs';

const { Pool } = pg;

export const pool = new Pool({
  host:                    process.env.DB_HOST,
  port:                    parseInt(process.env.DB_PORT || '5432'),
  database:                process.env.DB_NAME,
  user:                    process.env.DB_USER,
  password:                process.env.DB_PASSWORD,
  max:                     5,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 5_000,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) =>
  getLogger().error('DB pool idle client error', { message: err.message })
);

/**
 * Acquire a client from the pool.
 * Caller is responsible for calling client.release() in a finally block.
 */
export async function getClient() {
  return pool.connect();
}

/**
 * Convenience wrapper: acquires a client, runs fn(client), releases it.
 * Eliminates try/finally boilerplate at every call site.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// Guard so DDL/seed runs at most once per Lambda instance lifetime.
let lookupTablesReady = false;

/**
 * Idempotent bootstrap: creates lookup tables and seeds reference data.
 * Runs once per Lambda instance (warm invocations are no-ops).
 * Must be called after acquiring a client, before entity queries.
 *
 * @param {import('pg').PoolClient} client
 */
export async function ensureLookupTables(client) {
  if (lookupTablesReady) return;

  await client.query(`CREATE TABLE IF NOT EXISTS supplier_status (
    value TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT, sort_order INTEGER DEFAULT 0)`);
  await client.query(`CREATE TABLE IF NOT EXISTS expense_status (
    value TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT, sort_order INTEGER DEFAULT 0)`);
  await client.query(`CREATE TABLE IF NOT EXISTS expense_payment_method (
    value TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT, sort_order INTEGER DEFAULT 0)`);
  await client.query(`CREATE TABLE IF NOT EXISTS appointment_status (
    value TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT, sort_order INTEGER DEFAULT 0)`);
  await client.query(`CREATE TABLE IF NOT EXISTS appointment_modality (
    value TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT, sort_order INTEGER DEFAULT 0)`);

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

  await client.query(`CREATE TABLE IF NOT EXISTS prevision (
    id SERIAL PRIMARY KEY, nombre TEXT NOT NULL UNIQUE, sort_order INTEGER DEFAULT 0)`);
  await client.query(`INSERT INTO prevision (nombre, sort_order) VALUES
    ('FONASA A',1),('FONASA B',2),('FONASA C',3),('FONASA D',4),
    ('ISAPRE',5),('Particular',6),('Sin Previsión',7),('CAPREDENA',8),('DIPRECA',9)
    ON CONFLICT DO NOTHING`);

  await client.query(`CREATE TABLE IF NOT EXISTS patient (
    id SERIAL PRIMARY KEY, name TEXT, rut TEXT, birth_date DATE, gender TEXT,
    email TEXT, phone TEXT, address TEXT, blood_type TEXT, emergency_contact TEXT,
    notes TEXT, prevision_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);

  await client.query(`CREATE TABLE IF NOT EXISTS professional (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, specialty TEXT, rut TEXT,
    email TEXT, phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);

  await client.query(`CREATE TABLE IF NOT EXISTS product (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, sku TEXT, status TEXT DEFAULT 'active',
    price NUMERIC(12,2), stock INTEGER DEFAULT 0, weight NUMERIC(8,3), description TEXT,
    tags JSONB DEFAULT '[]', category_id INTEGER REFERENCES category(id),
    supplier_id INTEGER REFERENCES supplier(id),
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);

  await client.query(`CREATE TABLE IF NOT EXISTS presupuesto (
    id SERIAL PRIMARY KEY, numero TEXT, patient_id INTEGER REFERENCES patient(id),
    professional_id INTEGER REFERENCES professional(id),
    patient_name TEXT, patient_rut TEXT, patient_phone TEXT, patient_email TEXT,
    doctor_name TEXT, specialty TEXT, fecha_emision DATE, fecha_vencimiento DATE,
    prevision TEXT DEFAULT 'particular', coverage_percent NUMERIC(5,2) DEFAULT 0,
    discount_global NUMERIC(5,2) DEFAULT 0, items JSONB DEFAULT '[]', notes TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);

  await client.query(`CREATE TABLE IF NOT EXISTS payment (
    id SERIAL PRIMARY KEY, invoice_number TEXT, date DATE, concept TEXT,
    amount NUMERIC(12,2), payment_method TEXT, status TEXT DEFAULT 'pending', notes TEXT,
    commission_rate NUMERIC(5,2), commission_amount NUMERIC(12,2), commission_status TEXT,
    patient_id INTEGER REFERENCES patient(id), professional_id INTEGER REFERENCES professional(id),
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);

  await client.query(`CREATE TABLE IF NOT EXISTS user_config (
    user_id INTEGER PRIMARY KEY REFERENCES app_user(id),
    zk_enabled BOOLEAN DEFAULT false, updated_at TIMESTAMPTZ DEFAULT NOW())`);

  await client.query(`INSERT INTO app_schema (schema_key, singular, plural, module_type, icon)
    VALUES ('user-management', 'Usuario', 'Gestion de Usuarios', 'admin', 'shield')
    ON CONFLICT DO NOTHING`);

  await client.query(`ALTER TABLE clinical_record ADD COLUMN IF NOT EXISTS profession TEXT`);
  await client.query(`ALTER TABLE clinical_record ADD COLUMN IF NOT EXISTS birth_date DATE`);

  lookupTablesReady = true;
  getLogger().info('Lookup tables ready');
}
