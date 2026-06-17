-- Migration 009: refresh token table
-- Stores hashed refresh tokens (never the raw token).
-- Rotation: old token is revoked on each /refresh call and a new one issued.
CREATE TABLE IF NOT EXISTS refresh_token (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     BIGINT       NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash  TEXT         NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_rt_user   ON refresh_token(user_id);
CREATE INDEX IF NOT EXISTS idx_rt_lookup ON refresh_token(token_hash) WHERE revoked_at IS NULL;
