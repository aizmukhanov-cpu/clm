CREATE TABLE IF NOT EXISTS "team_product_targets" (
    "id"          TEXT         NOT NULL,
    "team"        TEXT         NOT NULL,
    "product"     TEXT         NOT NULL,
    "target_count" INTEGER     NOT NULL,
    "year"        INTEGER      NOT NULL,
    "month"       INTEGER      NOT NULL DEFAULT 1,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_product_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_product_targets_team_product_year_month_key"
  ON "team_product_targets"("team", "product", "year", "month");
