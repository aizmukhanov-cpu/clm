"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { TEAMS } from "@/lib/product-config";
import type { TeamCode } from "@/lib/product-config";

/* ─── Types ──────────────────────────────────────────────── */

export type ProductRow = {
  id:        string;
  code:      string;
  label:     string;
  icon:      string;
  active:    boolean;
  sortOrder: number;
};

/* ─── Product catalog ────────────────────────────────────── */

export async function getProducts(): Promise<ProductRow[]> {
  const rows = await db.product.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({
    id:        r.id,
    code:      r.code,
    label:     r.label,
    icon:      r.icon,
    active:    r.active,
    sortOrder: r.sortOrder,
  }));
}

export async function saveProduct(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return "Недостаточно прав";

  const id        = (formData.get("id")        as string | null) ?? "";
  const code      = (formData.get("code")      as string ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  const label     = (formData.get("label")     as string ?? "").trim();
  const icon      = (formData.get("icon")      as string ?? "📦").trim() || "📦";
  const sortOrder = Math.max(0, Number(formData.get("sortOrder") ?? 0) || 0);
  const active    = formData.get("active") !== "false";

  if (!code)  return "Код продукта обязателен";
  if (!label) return "Название продукта обязательно";
  if (!/^[A-Z0-9_]+$/.test(code)) return "Код должен содержать только латиницу, цифры и _";

  if (id) {
    // Update
    await db.product.update({
      where: { id },
      data:  { code, label, icon, sortOrder, active },
    });
  } else {
    // Create — check code uniqueness
    const existing = await db.product.findUnique({ where: { code } });
    if (existing) return `Продукт с кодом «${code}» уже существует`;
    await db.product.create({ data: { code, label, icon, sortOrder, active } });
  }

  revalidatePath("/admin/products");
  return null;
}

export async function deleteProduct(id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Недостаточно прав" };

  // Check if targets exist for this product
  const product = await db.product.findUnique({ where: { id } });
  if (!product) return { error: "Продукт не найден" };

  const targetsCount = await db.branchProductTarget.count({ where: { product: product.code } });
  if (targetsCount > 0) {
    await db.branchProductTarget.deleteMany({ where: { product: product.code } });
  }

  await db.product.delete({ where: { id } });
  revalidatePath("/admin/products");
  return {};
}

/* ─── Monthly targets matrix ─────────────────────────────── */

export async function getProductTargets(year: number, month: number) {
  const [branches, products, targets] = await Promise.all([
    db.branch.findMany({
      select:  { id: true, name: true, region: true },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({
      where:   { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.branchProductTarget.findMany({
      where:  { year, month },
      select: { branchId: true, product: true, targetCount: true },
    }),
  ]);

  // Build map: branchId → productCode → targetCount
  const map: Record<string, Record<string, number>> = {};
  for (const t of targets) {
    if (!map[t.branchId]) map[t.branchId] = {};
    map[t.branchId][t.product] = t.targetCount;
  }

  return { branches, products, map };
}

export async function saveProductTargets(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return "Недостаточно прав";

  const year  = Number(formData.get("year"))  || new Date().getFullYear();
  const month = Number(formData.get("month")) || new Date().getMonth() + 1;

  const upserts: { branchId: string; product: string; targetCount: number }[] = [];

  for (const [key, raw] of formData.entries()) {
    // field name format: "t_{branchId}_{PRODUCT_CODE}"
    const match = key.match(/^t_([^_]+)_(.+)$/);
    if (!match) continue;
    const [, branchId, product] = match;
    const targetCount = Math.max(0, Math.round(Number(raw) || 0));
    upserts.push({ branchId, product, targetCount });
  }

  if (upserts.length === 0) return "Нет данных для сохранения";

  await Promise.all(
    upserts.map(({ branchId, product, targetCount }) =>
      db.branchProductTarget.upsert({
        where:  { branchId_product_year_month: { branchId, product, year, month } },
        create: { branchId, product, targetCount, year, month },
        update: { targetCount },
      }),
    ),
  );

  revalidatePath("/admin/products");
  return null;
}

/* ─── Team targets matrix ────────────────────────────────── */

export async function getTeamTargets(year: number, month: number) {
  const [products, targets] = await Promise.all([
    db.product.findMany({
      where:   { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.teamProductTarget.findMany({
      where:  { year, month },
      select: { team: true, product: true, targetCount: true },
    }),
  ]);

  // Build map: team → productCode → targetCount
  const map: Record<string, Record<string, number>> = {};
  for (const t of targets) {
    if (!map[t.team]) map[t.team] = {};
    map[t.team][t.product] = t.targetCount;
  }

  return { products, map };
}

export async function saveTeamTargets(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return "Недостаточно прав";

  const year  = Number(formData.get("year"))  || new Date().getFullYear();
  const month = Number(formData.get("month")) || new Date().getMonth() + 1;

  const upserts: { team: string; product: string; targetCount: number }[] = [];

  for (const [key, raw] of formData.entries()) {
    // field name format: "tt_{team}_{PRODUCT_CODE}"
    const match = key.match(/^tt_([^_]+)_(.+)$/);
    if (!match) continue;
    const [, team, product] = match;
    if (!(TEAMS as readonly string[]).includes(team)) continue;
    const targetCount = Math.max(0, Math.round(Number(raw) || 0));
    upserts.push({ team, product, targetCount });
  }

  if (upserts.length === 0) return "Нет данных для сохранения";

  await Promise.all(
    upserts.map(({ team, product, targetCount }) =>
      db.teamProductTarget.upsert({
        where:  { team_product_year_month: { team, product, year, month } },
        create: { team, product, targetCount, year, month },
        update: { targetCount },
      }),
    ),
  );

  revalidatePath("/admin/products");
  return null;
}
