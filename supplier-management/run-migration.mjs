import pg from './lambda-entities/node_modules/pg/lib/index.js';
import { readFileSync } from 'fs';

const { Client } = pg;

const client = new Client({
  host:     'database-dairi.c2dmaac0mg07.us-east-1.rds.amazonaws.com',
  port:     5432,
  database: 'postgres',
  user:     'postgres',
  password: 'admin12345',
  ssl:      { rejectUnauthorized: false },
});

const sql = readFileSync('./lambda-entities/migrations/004-schema-cleanup.sql', 'utf8');

await client.connect();
console.log('Connected');
try {
  await client.query(sql);
  console.log('Migration 004 applied successfully');
} catch (err) {
  console.error('Migration error:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
