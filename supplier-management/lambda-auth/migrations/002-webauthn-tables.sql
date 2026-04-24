-- WebAuthn / FIDO2 tables
-- Migration 002 — run once against the RDS instance

-- Stored challenges (one-time use, short TTL)
CREATE TABLE IF NOT EXISTS webauthn_challenge (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES app_user(id) ON DELETE CASCADE,
  challenge   TEXT NOT NULL,
  purpose     VARCHAR(20) NOT NULL CHECK (purpose IN ('register', 'login')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wc_challenge ON webauthn_challenge(challenge);
CREATE INDEX IF NOT EXISTS idx_wc_expires   ON webauthn_challenge(expires_at);

-- Registered FIDO2 / passkey credentials
CREATE TABLE IF NOT EXISTS webauthn_credential (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,   -- base64url-encoded credential ID
  public_key    TEXT NOT NULL,          -- base64url-encoded COSE public key
  sign_count    BIGINT NOT NULL DEFAULT 0,
  aaguid        TEXT,                   -- authenticator model GUID
  device_type   VARCHAR(20) DEFAULT 'platform',  -- 'platform' | 'cross-platform'
  device_name   VARCHAR(200),           -- friendly label set by user
  transports    TEXT[],                 -- ['internal','usb','ble','nfc','hybrid']
  prf_salt      TEXT,                   -- base64url salt used for PRF ZK derivation
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wcred_user ON webauthn_credential(user_id);

-- Auto-purge expired challenges (run periodically or via pg_cron)
-- DELETE FROM webauthn_challenge WHERE expires_at < NOW();
