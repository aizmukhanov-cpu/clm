/**
 * Task Due-Date Reminders
 *
 * Sends Telegram notifications to managers for tasks due tomorrow.
 * Run daily at 09:00 via POST /api/cron/reminders.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Find tasks due tomorrow (next 24h window)
  const now      = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const tasks = await db.task.findMany({
    where: {
      status:  { in: ["PENDING"] },
      dueDate: {
        gte: now,
        lte: tomorrow,
      },
    },
    include: {
      client: { select: { id: true, name: true } },
      user:   { select: { id: true, name: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  if (tasks.length === 0) {
    return NextResponse.json({ reminded: 0 });
  }

  // Group by user.id (не по имени — у двух менеджеров может совпасть имя)
  const byUser = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!byUser.has(t.user.id)) byUser.set(t.user.id, []);
    byUser.get(t.user.id)!.push(t);
  }

  // Send one notification per manager (or a summary if too many)
  const lines: string[] = [];
  for (const [, managerTasks] of byUser) {
    const managerName = managerTasks[0].user.name;
    lines.push(`\n👤 <b>${managerName}</b> (${managerTasks.length} задач):`);
    for (const t of managerTasks.slice(0, 5)) {
      const priority = t.priority === "P1" ? "🔴" : t.priority === "P2" ? "🟡" : "🔵";
      lines.push(`  ${priority} ${t.client.name} — ${t.action.slice(0, 60)}${t.action.length > 60 ? "…" : ""}`);
    }
    if (managerTasks.length > 5) {
      lines.push(`  … и ещё ${managerTasks.length - 5} задач`);
    }
  }

  await sendNotification(
    `📅 <b>Напоминание CLM</b>: ${tasks.length} задач на завтра\n` +
    lines.join("\n")
  );

  return NextResponse.json({ reminded: tasks.length });
}
