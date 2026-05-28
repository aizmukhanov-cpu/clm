-- Historical portfolio snapshots for trend charts
-- Captured daily by CLM sync; team="__all__" = aggregate across all teams

CREATE TABLE "portfolio_snapshots" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "snapshot_date"   TIMESTAMP(3) NOT NULL,
  "team"            TEXT NOT NULL DEFAULT '__all__',
  "total_clients"   INTEGER NOT NULL DEFAULT 0,
  "active_clients"  INTEGER NOT NULL DEFAULT 0,
  "at_risk_clients" INTEGER NOT NULL DEFAULT 0,
  "lapsed_clients"  INTEGER NOT NULL DEFAULT 0,
  "activation_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "activities_week" INTEGER NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portfolio_snapshots_snapshot_date_team_key"
  ON "portfolio_snapshots"("snapshot_date", "team");
