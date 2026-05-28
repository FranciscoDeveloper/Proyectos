-- Adds email verification columns to app_user required by the registration/activation flow.
-- Idempotent: safe to run multiple times. Default true keeps existing users unblocked.
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS email_verified   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS activation_token TEXT;
