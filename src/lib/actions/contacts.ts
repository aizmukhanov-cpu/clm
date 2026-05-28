"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

// ─── Create contact person ────────────────────────────────

export async function createContactPerson(
  clientId: string,
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Не авторизован";

  const name  = (formData.get("name")  as string)?.trim();
  const role  = (formData.get("role")  as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const isDM  = formData.get("isDecisionMaker") === "true";

  if (!name) return "Введите имя контакта";

  await db.contactPerson.create({
    data: { clientId, name, role, phone, email, notes, isDecisionMaker: isDM },
  });

  revalidatePath(`/clients/${clientId}`);
  return null;
}

// ─── Update contact person ────────────────────────────────

export async function updateContactPerson(
  contactId: string,
  clientId: string,
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Не авторизован";

  const name  = (formData.get("name")  as string)?.trim();
  const role  = (formData.get("role")  as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const isDM  = formData.get("isDecisionMaker") === "true";

  if (!name) return "Введите имя контакта";

  await db.contactPerson.update({
    where: { id: contactId },
    data: { name, role, phone, email, notes, isDecisionMaker: isDM },
  });

  revalidatePath(`/clients/${clientId}`);
  return null;
}

// ─── Delete contact person ────────────────────────────────

export async function deleteContactPerson(
  contactId: string,
  clientId: string,
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Не авторизован" };

  await db.contactPerson.delete({ where: { id: contactId } });
  revalidatePath(`/clients/${clientId}`);
  return {};
}
