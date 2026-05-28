-- CreateEnum
CREATE TYPE "CLMStage" AS ENUM ('ACQUIRE', 'ONBOARD', 'ACTIVATE', 'GROW', 'REACTIVATE');

-- CreateEnum
CREATE TYPE "CLMCohort" AS ENUM ('NEVER_ACTIVE', 'LOW_ACTIVE', 'ACTIVE', 'LAPSED');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('YL', 'IP');

-- CreateEnum
CREATE TYPE "TeamType" AS ENUM ('VB', 'B2B', 'KM', 'KAM');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ANALYST', 'MANAGER', 'KAM_ROLE');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'MEETING', 'EMAIL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'DONE', 'OVERDUE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('ACTIVE', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "target_pct" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "team" "TeamType" NOT NULL,
    "branch_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "inn" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClientType" NOT NULL,
    "okved" TEXT,
    "account_opened_at" TIMESTAMP(3),
    "branch_id" TEXT NOT NULL,
    "manager_id" TEXT,
    "kam_id" TEXT,
    "clm_stage" "CLMStage" NOT NULL DEFAULT 'ACQUIRE',
    "clm_cohort" "CLMCohort" NOT NULL DEFAULT 'NEVER_ACTIVE',
    "days_since_last_txn" INTEGER NOT NULL DEFAULT 0,
    "txn_count_30d" INTEGER NOT NULL DEFAULT 0,
    "gmv_30d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "product_depth_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "has_mbusiness" BOOLEAN NOT NULL DEFAULT false,
    "has_mkassa_pos" BOOLEAN NOT NULL DEFAULT false,
    "has_mkassa_qr" BOOLEAN NOT NULL DEFAULT false,
    "has_salary_project" BOOLEAN NOT NULL DEFAULT false,
    "has_acquiring" BOOLEAN NOT NULL DEFAULT false,
    "has_credit" BOOLEAN NOT NULL DEFAULT false,
    "has_deposit" BOOLEAN NOT NULL DEFAULT false,
    "has_trade_finance" BOOLEAN NOT NULL DEFAULT false,
    "has_payroll" BOOLEAN NOT NULL DEFAULT false,
    "has_corporate_card" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "result" TEXT NOT NULL,
    "notes" TEXT,
    "performed_by" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "trigger_day" TEXT,
    "assigned_to" TEXT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'P3',
    "action" TEXT NOT NULL,
    "result" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "lead_name" TEXT,
    "owner_id" TEXT NOT NULL,
    "team" "TeamType" NOT NULL,
    "stage" TEXT NOT NULL,
    "product_name" TEXT,
    "amount" DOUBLE PRECISION,
    "probability" INTEGER,
    "expected_close" TIMESTAMP(3),
    "lost_reason" TEXT,
    "notes" TEXT,
    "status" "DealStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "changelogs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field" TEXT NOT NULL,
    "old_val" TEXT,
    "new_val" TEXT,

    CONSTRAINT "changelogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_inn_key" ON "clients"("inn");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_kam_id_fkey" FOREIGN KEY ("kam_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changelogs" ADD CONSTRAINT "changelogs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changelogs" ADD CONSTRAINT "changelogs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
