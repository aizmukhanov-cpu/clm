"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function upsertAccountPlan(
  clientId: string,
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Не авторизован";
  if (!["ADMIN", "ANALYST", "KAM", "TEAM_LEAD", "SUPERVISOR"].includes(session.role)) {
    return "Недостаточно прав";
  }

  const targetRaw   = formData.get("revenueTarget") as string;
  const actualRaw   = formData.get("revenueActual") as string;
  const meetingRaw  = formData.get("nextMeeting")   as string;
  const initRaw     = (formData.get("initiatives")   as string)?.trim() || null;

  const revenueTarget  = targetRaw  ? parseFloat(targetRaw)  * 1000 : null; // в тыс. сом
  const revenueActual  = actualRaw  ? parseFloat(actualRaw)  * 1000 : null;
  const nextMeeting    = meetingRaw ? new Date(meetingRaw)           : null;

  // initiatives — одна строка в строке, сохраняем как JSON
  const initiativesList = initRaw
    ? initRaw.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];
  const initiatives = JSON.stringify(initiativesList);

  await db.accountPlan.upsert({
    where: { clientId },
    create: {
      clientId,
      revenueTarget,
      revenueActual,
      nextMeeting,
      initiatives,
      updatedBy: session.id,
    },
    update: {
      revenueTarget,
      revenueActual,
      nextMeeting,
      initiatives,
      updatedBy: session.id,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return null;
}
