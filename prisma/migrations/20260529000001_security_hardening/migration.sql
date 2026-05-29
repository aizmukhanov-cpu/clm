-- Security hardening: brute-force protection + session invalidation
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "session_version"        INTEGER NOT NULL DEFAULT 0;
