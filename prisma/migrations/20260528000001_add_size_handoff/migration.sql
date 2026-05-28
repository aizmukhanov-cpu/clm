-- Migration: add client size segmentation and hunter→farmer handoff fields
-- Applied after: 20260526172416_init

-- CreateEnum: client size category based on annual GMV
CREATE TYPE "ClientSizeCategory" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- AlterTable: three new nullable columns on clients
ALTER TABLE "clients"
  ADD COLUMN "size_category"   "ClientSizeCategory",
  ADD COLUMN "activated_at"    TIMESTAMP(3),
  ADD COLUMN "handoff_done_at" TIMESTAMP(3);

-- NOTE: sizeCategory is computed and populated by the nightly RFM sync.
-- activatedAt is set the first time a client transitions to ACTIVATE stage.
-- handoffDoneAt is set when the hunter→farmer handoff is executed.
-- All three columns are nullable — no backfill required at migration time.
