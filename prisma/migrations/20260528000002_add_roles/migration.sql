-- Migration: role hierarchy + supervisorId
-- Replaces MANAGER → SPECIALIST, KAM_ROLE → KAM
-- Adds DIRECTOR, TEAM_LEAD, SUPERVISOR roles
-- Adds supervisor_id to users table

-- Step 1: create new enum with all values
CREATE TYPE "UserRole_new" AS ENUM (
  'ADMIN', 'DIRECTOR', 'ANALYST', 'TEAM_LEAD', 'SUPERVISOR', 'SPECIALIST', 'KAM'
);

-- Step 2: add supervisor_id column (nullable)
ALTER TABLE "users"
  ADD COLUMN "supervisor_id" TEXT;

-- Step 3: migrate existing role values
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole_new"
    USING CASE "role"::TEXT
      WHEN 'MANAGER'  THEN 'SPECIALIST'::"UserRole_new"
      WHEN 'KAM_ROLE' THEN 'KAM'::"UserRole_new"
      ELSE "role"::TEXT::"UserRole_new"
    END;

-- Step 4: swap enum names
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- Step 5: add FK constraint for supervisor_id (self-reference)
ALTER TABLE "users"
  ADD CONSTRAINT "users_supervisor_id_fkey"
  FOREIGN KEY ("supervisor_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
