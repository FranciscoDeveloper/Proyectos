import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host:                    (process.env.DB_HOST || "database-dairi.c2dmaac0mg07.us-east-1.rds.amazonaws.com").replace("database-1.", "database-dairi."),
  port:                    parseInt(process.env.DB_PORT || "5432"),
  database:                process.env.DB_NAME,
  user:                    process.env.DB_USER,
  password:                (process.env.DB_PASSWORD || "").trim(),
  ssl:                     { rejectUnauthorized: false },
  max:                     5,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 2000
});
