/**
 * POST /api/sync/products
 *
 * Endpoint для получения данных о продуктах клиентов из АБС (Core Banking System).
 * Вызывается из ETL-пайплайна или напрямую из АБС.
 *
 * Авторизация: Bearer токен из переменной окружения ABS_SYNC_SECRET.
 * Если переменная не задана — endpoint открыт (только для dev).
 *
 * Поддерживаемые форматы тела запроса:
 *
 * JSON:
 * {
 *   "clients": [
 *     {
 *       "inn": "12345678901234",
 *       "products": {
 *         "mbusiness":      true,
 *         "mkassa_pos":     false,
 *         "mkassa_qr":      true,
 *         "salary_project": false,
 *         "acquiring":      false,
 *         "credit":         true,
 *         "deposit":        false,
 *         "trade_finance":  false,
 *         "payroll":        false,
 *         "corporate_card": false
 *       }
 *     }
 *   ]
 * }
 *
 * CSV (Content-Type: text/csv):
 * inn,mbusiness,mkassa_pos,mkassa_qr,salary_project,acquiring,credit,deposit,trade_finance,payroll,corporate_card
 * 12345678901234,1,0,1,0,0,1,0,0,0,0
 * ...
 * (1 = активен, 0 = не активен)
 */

import { NextRequest, NextResponse } from "next/server";
import { runProductSync, type AbsClientRow } from "@/lib/product-sync";
import { sendNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // ── Авторизация ────────────────────────────────────────────
  const secret = process.env.ABS_SYNC_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const contentType = req.headers.get("content-type") ?? "";
  let rows: AbsClientRow[] = [];

  try {
    if (contentType.includes("text/csv")) {
      // ── CSV-формат ──────────────────────────────────────────
      const text = await req.text();
      rows = parseCsv(text);
    } else {
      // ── JSON-формат ─────────────────────────────────────────
      const body = await req.json();
      if (!Array.isArray(body?.clients)) {
        return NextResponse.json(
          { error: "Expected { clients: [...] }" },
          { status: 400 }
        );
      }
      rows = body.clients as AbsClientRow[];
    }
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "Empty payload" }, { status: 400 });
  }

  const result = await runProductSync(rows);

  // Уведомление при значительных изменениях
  if (result.updated > 0) {
    await sendNotification(
      `🏦 <b>АБС Продукты</b>: синк завершён\n` +
      `📦 Обработано: ${result.processed}\n` +
      `✅ Обновлено: ${result.updated}\n` +
      `🔁 Без изменений: ${result.unchanged}\n` +
      `⚠️ Не найдено в CLM: ${result.skipped}` +
      (result.errors.length > 0 ? `\n❌ Ошибок: ${result.errors.length}` : "")
    );
  }

  return NextResponse.json(result);
}

// ── CSV парсер ────────────────────────────────────────────────
const CSV_PRODUCT_COLS = [
  "mbusiness", "mkassa_pos", "mkassa_qr", "salary_project",
  "acquiring", "credit", "deposit", "trade_finance", "payroll", "corporate_card",
] as const;

function parseCsv(text: string): AbsClientRow[] {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Парсим заголовок для определения порядка колонок
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const innIdx = headers.indexOf("inn");
  if (innIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const inn = cols[innIdx] ?? "";

    const products: Partial<Record<string, boolean>> = {};
    for (const key of CSV_PRODUCT_COLS) {
      const idx = headers.indexOf(key);
      if (idx !== -1) {
        products[key] = cols[idx] === "1" || cols[idx]?.toLowerCase() === "true";
      }
    }

    return { inn, products };
  });
}
