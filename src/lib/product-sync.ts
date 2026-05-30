/**
 * Product Sync from АБС (Core Banking System)
 *
 * АБС/ETL пушит данные через POST /api/sync/products.
 * CLM обновляет продуктовые флаги, логирует изменения в changelog.
 *
 * Формат входных данных — массив записей:
 * { inn: string, products: Record<AbsProductCode, boolean> }
 *
 * Маппинг кодов АБС → поля CLM задаётся в ABS_PRODUCT_MAP ниже.
 * Адаптируйте под реальные коды вашей системы (IBSO/Oracle/RS-Bank).
 */

import { db } from "@/lib/db";

export type AbsProductCode =
  | "mbusiness"
  | "mkassa_pos"
  | "mkassa_qr"
  | "salary_project"
  | "acquiring"
  | "credit"
  | "deposit"
  | "trade_finance"
  | "payroll"
  | "corporate_card";

export type AbsClientRow = {
  inn:      string;
  products: Partial<Record<AbsProductCode, boolean>>;
};

export type ProductSyncResult = {
  processed: number;
  updated:   number;
  skipped:   number; // INN не найден в CLM
  unchanged: number;
  errors:    string[];
};

/**
 * Маппинг кодов АБС → поля Prisma Client.
 * Замените ключи на реальные коды из вашей АБС.
 *
 * Примеры для разных систем:
 *   IBSO:    "RKO_MBIZ", "EKVA_POS", ...
 *   Oracle:  "PROD_001", "PROD_002", ...
 *   RS-Bank: "MBZ", "MPOS", ...
 */
export const ABS_PRODUCT_MAP: Record<AbsProductCode, string> = {
  mbusiness:       "hasMBusiness",
  mkassa_pos:      "hasMKassaPos",
  mkassa_qr:       "hasMKassaQr",
  salary_project:  "hasSalaryProject",
  acquiring:       "hasAcquiring",
  credit:          "hasCredit",
  deposit:         "hasDeposit",
  trade_finance:   "hasTradeFinance",
  payroll:         "hasPayroll",
  corporate_card:  "hasCorporateCard",
};

const ALL_PRODUCT_KEYS = Object.values(ABS_PRODUCT_MAP);

/** Системный пользователь для атрибуции изменений из АБС */
async function getSystemUser() {
  return (
    await db.user.findFirst({ where: { email: "clm-automation" }, select: { id: true } }) ??
    await db.user.findFirst({ where: { role: "ADMIN" },           select: { id: true } })
  );
}

/**
 * Основная функция синка.
 * @param rows — данные от АБС (массив { inn, products })
 */
export async function runProductSync(rows: AbsClientRow[]): Promise<ProductSyncResult> {
  const result: ProductSyncResult = {
    processed: rows.length,
    updated:   0,
    skipped:   0,
    unchanged: 0,
    errors:    [],
  };

  const systemUser = await getSystemUser();
  const now = new Date();

  // Загружаем только те поля, которые нам нужны
  const selectProducts = Object.fromEntries(
    ALL_PRODUCT_KEYS.map((k) => [k, true])
  ) as Record<string, true>;

  for (const row of rows) {
    try {
      const client = await db.client.findUnique({
        where:  { inn: row.inn.trim() },
        select: { id: true, ...selectProducts },
      });

      if (!client) {
        result.skipped++;
        continue;
      }

      // Вычисляем изменения
      const changes: Record<string, boolean> = {};
      const changelogs: { field: string; oldVal: string; newVal: string }[] = [];

      for (const [absCode, newVal] of Object.entries(row.products) as [AbsProductCode, boolean][]) {
        const prismaField = ABS_PRODUCT_MAP[absCode];
        if (!prismaField) continue;

        const oldVal = (client as Record<string, unknown>)[prismaField] as boolean;
        if (oldVal !== newVal) {
          changes[prismaField] = newVal;
          changelogs.push({
            field:  prismaField,
            oldVal: String(oldVal),
            newVal: String(newVal),
          });
        }
      }

      // Пересчёт productDepthPct — учитываем все поля, включая несинченные
      const fullClient = await db.client.findUnique({
        where:  { id: client.id },
        select: Object.fromEntries(ALL_PRODUCT_KEYS.map((k) => [k, true])) as Record<string, true>,
      });

      const merged = { ...fullClient, ...changes };
      const activeCount = ALL_PRODUCT_KEYS.filter((k) => (merged as Record<string, unknown>)[k]).length;
      const newDepth = activeCount / ALL_PRODUCT_KEYS.length;

      // Обновляем только если есть изменения (или обновляем productSyncedAt в любом случае)
      await db.$transaction(async (tx) => {
        await tx.client.update({
          where: { id: client.id },
          data: {
            ...changes,
            productDepthPct: newDepth,
            productSyncedAt: now, // всегда обновляем — подтверждаем актуальность
          } as never,
        });

        if (changelogs.length > 0 && systemUser) {
          for (const cl of changelogs) {
            await tx.changelog.create({
              data: {
                clientId:  client.id,
                changedBy: systemUser.id,
                field:     `abs:${cl.field}`, // префикс "abs:" — изменение из АБС, не вручную
                oldVal:    cl.oldVal,
                newVal:    cl.newVal,
              },
            });
          }
        }
      });

      if (changelogs.length > 0) {
        result.updated++;
      } else {
        result.unchanged++;
      }
    } catch (e) {
      result.errors.push(`INN ${row.inn}: ${String(e)}`);
    }
  }

  return result;
}
