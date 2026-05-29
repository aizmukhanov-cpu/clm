"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { KYC_ITEMS } from "@/lib/kyc-config";

export type { KYCItemKey } from "@/lib/kyc-config";

export type KYCRow = {
  item:      string;
  status:    "PENDING" | "DONE" | "N_A";
  note:      string | null;
  updatedBy: string | null;
  updatedAt: Date;
};

/** Get or initialise KYC checklist for a client */
export async function getKYCChecklist(clientId: string): Promise<KYCRow[]> {
  const existing = await db.kYCChecklist.findMany({
    where: { clientId },
    select: { item: true, status: true, note: true, updatedBy: true, updatedAt: true },
  });

  const existingMap = new Map(existing.map(r => [r.item, r]));

  return KYC_ITEMS.map(({ key }) => {
    const row = existingMap.get(key);
    return row
      ? { item: key, status: row.status as "PENDING" | "DONE" | "N_A", note: row.note, updatedBy: row.updatedBy, updatedAt: row.updatedAt }
      : { item: key, status: "PENDING" as const, note: null, updatedBy: null, updatedAt: new Date(0) };
  });
}

/** Update a single KYC item */
export async function updateKYCItem(
  clientId: string,
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Не авторизован";

  const item   = formData.get("item") as string;
  const status = formData.get("status") as "PENDING" | "DONE" | "N_A";
  const note   = (formData.get("note") as string)?.trim() || null;

  if (!item || !["PENDING", "DONE", "N_A"].includes(status)) {
    return "Неверные данные";
  }

  await db.kYCChecklist.upsert({
    where:  { clientId_item: { clientId, item } },
    create: { clientId, item, status, note, updatedBy: session.name },
    update: { status, note, updatedBy: session.name },
  });

  revalidatePath(`/clients/${clientId}`);
  return null;
}