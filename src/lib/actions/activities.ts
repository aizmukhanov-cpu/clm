"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ActivityType } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createActivity(
  clientId: string,
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Не авторизован";

  const type = formData.get("type") as ActivityType;
  const result = (formData.get("result") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;
  const dateRaw = formData.get("date") as string;

  if (!type || !ActivityType[type]) return "Выберите тип контакта";
  if (!result) return "Укажите результат";
  if (!dateRaw) return "Укажите дату";

  const performedAt = new Date(dateRaw);
  if (isNaN(performedAt.getTime())) return "Неверная дата";

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) return "Клиент не найден";

  await db.activity.create({
    data: {
      clientId,
      type,
      result,
      notes,
      performedBy: session.id,
      performedAt,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
