/**
 * POST /api/cron/midmonth-alert
 *
 * Runs on the 15th of each month (vercel.json: "10 9 15 * *").
 * Compares actual new clients (1–15) against 50% of monthly plan.
 * Creates P1 tasks + Telegram alerts for managers below 30% of plan.
 *
 * Protected by Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendNotification, sendUserNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now       = new Date();
  const year      = now.getFullYear();
  const month     = now.getMonth() + 1; // 1-12
  const monthStart = new Date(year, now.getMonth(), 1);
  const mid        = new Date(year, now.getMonth(), 15, 23, 59, 59);

  // Все менеджеры с планом
  const managers = await db.user.findMany({
    where: {
      role:        { in: ["SPECIALIST", "KAM"] },
      planMonthly: { not: null },
    },
    select: { id: true, name: true, team: true, planMonthly: true, telegramChatId: true },
  });

  const alerts: string[] = [];
  let tasksCreated = 0;

  for (const mgr of managers) {
    const plan = mgr.planMonthly!;
    const halfPlan = Math.ceil(plan * 0.5);

    // Новые клиенты: активированы с начала месяца до 15-го
    const actual = await db.changelog.count({
      where: {
        changedBy: mgr.id,
        field:     "clmStage",
        newVal:    "ACTIVATE",
        changedAt: { gte: monthStart, lte: mid },
      },
    });

    const pct = plan > 0 ? Math.round((actual / plan) * 100) : 100;

    if (pct < 30) {
      // Создать P1-задачу для менеджера (dedup по triggerDay)
      const existing = await db.task.findFirst({
        where: {
          assignedTo: mgr.id,
          triggerDay: "midmonth-alert",
          createdAt:  { gte: monthStart },
        },
      });

      if (!existing) {
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 7);

        // Назначаем задачу на первого доступного менеджера (на себя)
        await db.task.create({
          data: {
            clientId:   await getPlaceholderClientId(mgr.id),
            triggerDay: "midmonth-alert",
            assignedTo: mgr.id,
            dueDate,
            priority:   "P1",
            action:     `⚠️ Midmonth Alert: выполнено только ${pct}% плана (${actual}/${plan}). Нужно ускорить активацию клиентов.`,
          },
        });
        tasksCreated++;
      }

      alerts.push(`• ${mgr.name} (${mgr.team}): ${actual}/${halfPlan} (${pct}% от плана)`);

      // Персональное уведомление менеджеру
      if (mgr.telegramChatId) {
        await sendUserNotification(
          mgr.telegramChatId,
          `📊 <b>Midmonth Check-in</b>\n` +
          `К 15-му числу выполнено <b>${pct}% плана</b> (${actual} из ${plan} клиентов).\n` +
          `🔴 Нужно ускорить — осталось 2 недели!`
        );
      }
    }
  }

  // Уведомление директору
  if (alerts.length > 0) {
    await sendNotification(
      `📊 <b>Midmonth Alert — ${month}/${year}</b>\n` +
      `${alerts.length} менеджеров отстают от плана (<30%):\n\n` +
      alerts.join("\n")
    );
  }

  return NextResponse.json({
    ok: true,
    checked: managers.length,
    alerts: alerts.length,
    tasksCreated,
  });
}

// Вспомогательная функция: берём первого клиента менеджера для задачи
async function getPlaceholderClientId(managerId: string): Promise<string> {
  const client = await db.client.findFirst({
    where: { managerId, isArchived: false },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (client) return client.id;

  // Fallback: берём любого клиента в системе
  const any = await db.client.findFirst({ select: { id: true } });
  if (any) return any.id;

  throw new Error("No clients found for midmonth alert task");
}
