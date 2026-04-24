-- Migration 003 — Subscription management
-- Run once against RDS

-- Plan definitions (feature flags per tier)
CREATE TABLE IF NOT EXISTS subscription_plan (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(50) NOT NULL UNIQUE,  -- 'starter' | 'professional' | 'enterprise'
  label           VARCHAR(100) NOT NULL,
  biometric_auth  BOOLEAN NOT NULL DEFAULT FALSE,
  max_users       INTEGER NOT NULL DEFAULT 5,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO subscription_plan (code, label, biometric_auth, max_users) VALUES
  ('starter',      'Starter',      FALSE, 5),
  ('professional', 'Professional', TRUE,  25),
  ('enterprise',   'Enterprise',   TRUE,  9999)
ON CONFLICT (code) DO NOTHING;

-- Subscriptions (one per customer / tenant)
CREATE TABLE IF NOT EXISTS subscription (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  plan_id         INTEGER NOT NULL REFERENCES subscription_plan(id),
  -- Override: vendor can toggle biometric per subscription regardless of plan
  biometric_auth  BOOLEAN,            -- NULL = inherit from plan
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  contact_email   VARCHAR(200),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Link users to their subscription
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscription(id);

-- Seed: create a default subscription for existing users
INSERT INTO subscription (name, plan_id, contact_email)
  SELECT 'Organización Predeterminada',
         (SELECT id FROM subscription_plan WHERE code = 'professional'),
         'admin@empresa.com'
  WHERE NOT EXISTS (SELECT 1 FROM subscription LIMIT 1);

-- Assign all existing users to the default subscription
UPDATE app_user
  SET subscription_id = (SELECT id FROM subscription ORDER BY id LIMIT 1)
  WHERE subscription_id IS NULL;

-- Index for lookup during login
CREATE INDEX IF NOT EXISTS idx_user_subscription ON app_user(subscription_id);
