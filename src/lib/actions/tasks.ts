"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendNotification } from "@/lib/notifications";
import { createNotification } from "@/lib/notify";

/**
 * Завершить задачу со структурированным исходом.
 *
 * @param outcome  - значение из TASK_OUTCOMES (напр. "txn_done", "no_answer")
 * @param outcomeLabel - человекочитаемый текст исхода (напр. "✅ Транзакция уже прошла")
 * @param comment  - опциональный дополнительный комментарий менеджера
 *
 * Активность в истории клиента создаётся ВСЕГДА — это обязательный аудит-след.
 */
export async function completeTask(
  taskId: string,
  clientId: string,
  outcome: string,
  outcomeLabel: string,
  comment: string = "",
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Не авторизован" };

  if (!outcome || !outcomeLabel) return { error: "Укажите исход задачи" };

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: {
      assignedTo: true,
      clientId:   true,
      action:     true,
      triggerDay: true,
      user: { select: { name: true, supervisorId: true } },
      client: { select: { name: true } },
    },
  });
  if (!task) return { error: "Задача не найдена" };

  // Тип активности: встреча для review-задач, звонок для остальных
  const MEETING_TRIGGERS = new Set([
    "grow-account-plan", "qbr-overdue", "kam-review-60d",
  ]);
  const activityType = MEETING_TRIGGERS.has(task.triggerDay ?? "") ? "MEETING" : "CALL";

  // Итоговый текст: "✅ Транзакция уже прошла — позвонил, договорились о встрече"
  const fullResult = comment.trim()
    ? `${outcomeLabel} — ${comment.trim()}`
    : outcomeLabel;

  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { status: "DONE", result: fullResult },
    });

    // Активность создаётся ВСЕГДА — обязательный след в истории клиента.
    // Нельзя закрыть задачу без записи в историю контактов.
    await tx.activity.create({
      data: {
        clientId,
        type: activityType,
        result: fullResult,
        performedBy: session.id,
        performedAt: new Date(),
      },
    });
  });

  // In-app уведомление руководителю если задача выполнена подчинённым
  const supervisorId = task.user?.supervisorId;
  if (supervisorId && task.assignedTo !== session.id) {
    // Кто-то чужой закрыл задачу — уведомим исходного исполнителя
    await createNotification({
      userId: task.assignedTo,
      type:   "task_completed",
      title:  `Задача закрыта: ${task.triggerDay ?? task.action.slice(0, 40)}`,
      body:   `${task.client?.name ?? ""} — ${outcomeLabel}`,
      href:   `/clients/${clientId}`,
    });
  }
  if (supervisorId) {
    await createNotification({
      userId: supervisorId,
      type:   "task_completed",
      title:  `✅ ${session.name} закрыл задачу`,
      body:   `${task.client?.name ?? ""} — ${outcomeLabel}`,
      href:   `/clients/${clientId}`,
    });
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/activation-desk");
  revalidatePath("/my-tasks");
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
