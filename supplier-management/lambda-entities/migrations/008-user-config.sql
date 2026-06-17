-- Migration 008: per-user configuration table
-- Stores per-user settings; initially only the ZK encryption flag.
-- One row per user (UNIQUE on user_id), FK cascades on user delete.
CREATE TABLE IF NOT EXISTS user_config (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     BIGINT      NOT NULL UNIQUE REFERENCES app_user(id) ON DELETE CASCADE,
  zk_enabled  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
