-- DropIndex (old annual unique constraint)
DROP INDEX IF EXISTS "branch_product_targets_branch_id_product_year_key";

-- AlterTable: add month column (default 1 = January, keeps existing data valid)
ALTER TABLE "branch_product_targets" ADD COLUMN IF NOT EXISTS "month" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex (new monthly unique constraint)
CREATE UNIQUE INDEX IF NOT EXISTS "branch_product_targets_branch_id_product_year_month_key"
  ON "branch_product_targets"("branch_id", "product", "year", "month");

-- CreateTable: product catalog
CREATE TABLE IF NOT EXISTS "products" (
    "id"         TEXT        NOT NULL,
    "code"       TEXT        NOT NULL,
    "label"      TEXT        NOT NULL,
    "icon"       TEXT        NOT NULL DEFAULT '📦',
    "active"     BOOLEAN     NOT NULL DEFAULT true,
    "sort_order" INTEGER     NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "products_code_key" ON "products"("code");

-- Seed initial 10 products (only if table is empty)
INSERT INTO "products" ("id", "code", "label", "icon", "active", "sort_order", "updated_at")
SELECT gen_random_uuid()::TEXT, code, label, icon, true, sort_order, NOW()
FROM (VALUES
  ('MBUSINESS',      'MBusiness',      '📱',  1),
  ('MKASSA_POS',     'MKassa POS',     '💳',  2),
  ('MKASSA_QR',      'MKassa QR',      '📷',  3),
  ('ACQUIRING',      'Эквайринг',      '💰',  4),
  ('SALARY_PROJECT', 'ЗП-проект',      '👥',  5),
  ('PAYROLL',        'Зарплата',       '💼',  6),
  ('CORPORATE_CARD', 'Корп. карта',    '🪪',  7),
  ('CREDIT',         'Кредит',         '📋',  8),
  ('DEPOSIT',        'Депозит',        '🏦',  9),
  ('TRADE_FINANCE',  'Торг. финанс.',  '📦', 10)
) AS v(code, label, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "products" LIMIT 1);
