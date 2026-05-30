-- Дата последней синхронизации продуктов из АБС.
-- NULL = данные введены вручную (доверяем меньше).
-- NOT NULL = данные актуальны из банковской системы.
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "product_synced_at" TIMESTAMP(3);
