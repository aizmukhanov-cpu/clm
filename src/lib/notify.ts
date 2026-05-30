/**
 * Внутренние уведомления (in-app).
 * Используется из event-triggers, cron-задач и actions.
 * НЕ server action — можно импортировать в любой серверный код.
 */

import "server-only";
import { db } from "@/lib/db";

export type NotificationType =
  | "task_assigned"
  | "task_overdue"
  | "task_escalated"
  | "task_completed"
  | "client_assigned";

export async function createNotification(params: {
  userId:  string;
  type:    NotificationType;
  title:   string;
  body?:   string;
  href?:   string;
}): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: params.userId,
        type:   params.type,
        title:  params.title,
        body:   params.body ?? "",
        href:   params.href ?? "",
      },
    });
  } catch (e) {
    // Уведомления не критичны — не роняем основной поток
    console.error("[notify] createNotification failed:", e);
  }
}

/**
 * Удаляем старые прочитанные уведомления (старше 30 дней).
 * Вызывается из нового cron-задания или ночного cron.
 */
export async function pruneOldNotifications(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { count } = await db.notification.deleteMany({
    where: {
      readAt:    { not: null },
      createdAt: { lt: cutoff },
    },
  });
  return count;
}
