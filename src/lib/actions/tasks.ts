"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendNotification } from "@/lib/notifications";

export async function completeTask(
  taskId: string,
  clientId: string,
  result: string,
  createActivity: boolean = false,
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Не авторизован" };

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { assignedTo: true, clientId: true },
  });
  if (!task) return { error: "Задача не найдена" };

  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { status: "DONE", result: result || "Выполнено" },
    });

    if (createActivity && result.trim()) {
      await tx.activity.create({
        data: {
          clientId,
          type: "CALL",
          result: result.trim(),
          performedBy: session.id,
          performedAt: new Date(),
        },
      });
    }
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/activation-desk");
  return {};
}

// ─── Авто-эскалация задач D+7 без результата ─────────────
// Вызывается из cron-endpoint или вручную ADMIN'ом
export async function escalateOverdueTasks(): Promise<{ escalated: number; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { escalated: 0, error: "Forbidden" };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Найти задачи: PENDING или OVERDUE, просрочены >7 дней, нет результата
  const candidates = await db.task.findMany({
    where: {
      status: { in: ["PENDING", "OVERDUE"] },
      dueDate: { lte: sevenDaysAgo },
      result: null,
    },
    include: {
      client: { select: { id: true, name: true, inn: true } },
      user:   { select: { name: true, email: true } },
    },
  });

  if (candidates.length === 0) return { escalated: 0 };

  const ids = candidates.map(t => t.id);
  await db.task.updateMany({
    where: { id: { in: ids } },
    data: { status: "ESCALATED" },
  });

  // Уведомление
  const lines = candidates.map(t =>
    `• ${t.client.name} — «${t.action}» (менеджер: ${t.user.name})`
  ).join("\n");
  await sendNotification(
    `🚨 Эскалация: ${candidates.length} задач без результата >7 дней\n\n${lines}`
  );

  revalidatePath("/activation-desk");
  revalidatePath("/clients");
  return { escalated: candidates.length };
}

// ─── Bulk-смена стадии CLM ────────────────────────────────
export async function bulkUpdateStage(
  clientIds: string[],
  stage: string,
): Promise<{ updated: number; error?: string }> {
  const session = await getSession();
  if (!session) return { updated: 0, error: "Не авторизован" };
  if (session.role !== "ADMIN" && session.role !== "ANALYST") {
    return { updated: 0, error: "Недостаточно прав" };
  }
  if (!clientIds.length) return { updated: 0 };

  const valid = ["ACQUIRE","ONBOARD","ACTIVATE","GROW","REACTIVATE"];
  if (!valid.includes(stage)) return { updated: 0, error: "Неверная стадия" };

  const result = await db.client.updateMany({
    where: { id: { in: clientIds } },
    data: { clmStage: stage as never },
  });

  revalidatePath("/clients");
  return { updated: result.count };
}
