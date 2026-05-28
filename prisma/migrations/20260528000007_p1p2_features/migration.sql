-- P1/P2 features migration
-- Adds: Merchant, ManagerMonthlySnapshot, KYCChecklist models
-- Extends: ActivityType enum, User/Client/Branch/Activity/Deal fields
-- New enums: DealLostReason, KYCItemStatus

-- ── New enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "DealLostReason" AS ENUM (
  'PRICE', 'COMPETITOR', 'NO_NEED', 'TIMING', 'NO_BUDGET',
  'DOCS_MISSING', 'AML_DECLINED', 'CONTACT_LOST', 'OTHER'
);

CREATE TYPE "KYCItemStatus" AS ENUM ('PENDING', 'DONE', 'N_A');

-- ── Extend ActivityType enum ───────────────────────────────────────────────────
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'WHATSAPP';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'VISIT';

-- ── User: add planMonthly + telegramChatId ────────────────────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "plan_monthly"      INTEGER,
  ADD COLUMN IF NOT EXISTS "telegram_chat_id"  TEXT;

-- ── Client: add firstTxnAt ────────────────────────────────────────────────────
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "first_txn_at" TIMESTAMP(3);

-- ── Branch: add market capacity fields ────────────────────────────────────────
ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS "market_capacity_yl"  INTEGER,
  ADD COLUMN IF NOT EXISTS "market_capacity_ip"  INTEGER,
  ADD COLUMN IF NOT EXISTS "market_share_pct"    DOUBLE PRECISION;

-- ── Activity: add dealId, isPlanned, completedAt ──────────────────────────────
ALTER TABLE "activities"
  ADD COLUMN IF NOT EXISTS "deal_id"      TEXT,
  ADD COLUMN IF NOT EXISTS "is_planned"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

-- ── Deal: add lostReasonCode ──────────────────────────────────────────────────
ALTER TABLE "deals"
  ADD COLUMN IF NOT EXISTS "lost_reason_code" "DealLostReason";

-- ── Merchant table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "merchants" (
  "id"            TEXT NOT NULL,
  "client_id"     TEXT NOT NULL,
  "terminal_id"   TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
  "last_txn_date" TIMESTAMP(3),
  "txn_count_30d" INTEGER NOT NULL DEFAULT 0,
  "is_phantom"    BOOLEAN NOT NULL DEFAULT false,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "merchants_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "merchants_terminal_id_key"   UNIQUE ("terminal_id"),
  CONSTRAINT "merchants_client_id_fkey"    FOREIGN KEY ("client_id")
    REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ── ManagerMonthlySnapshot table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "manager_monthly_snapshots" (
  "id"               TEXT NOT NULL,
  "user_id"          TEXT NOT NULL,
  "year"             INTEGER NOT NULL,
  "month"            INTEGER NOT NULL,
  "planned_clients"  INTEGER NOT NULL DEFAULT 0,
  "actual_clients"   INTEGER NOT NULL DEFAULT 0,
  "activation_rate"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "activities_count" INTEGER NOT NULL DEFAULT 0,
  "activations"      INTEGER NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "manager_monthly_snapshots_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "manager_monthly_snapshots_user_year_month"   UNIQUE ("user_id", "year", "month"),
  CONSTRAINT "manager_monthly_snapshots_user_id_fkey"      FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ── KYCChecklist table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "kyc_checklist" (
  "id"          TEXT NOT NULL,
  "client_id"   TEXT NOT NULL,
  "item"        TEXT NOT NULL,
  "status"      "KYCItemStatus" NOT NULL DEFAULT 'PENDING',
  "note"        TEXT,
  "updated_by"  TEXT,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "kyc_checklist_pkey"                PRIMARY KEY ("id"),
  CONSTRAINT "kyc_checklist_client_item_key"     UNIQUE ("client_id", "item"),
  CONSTRAINT "kyc_checklist_client_id_fkey"      FOREIGN KEY ("client_id")
    REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
