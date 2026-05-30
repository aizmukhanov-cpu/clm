import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications";
import { createNotification } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Защита через CRON_SECRET
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const candidates = await db.task.findMany({
    where: {
      status:  { in: ["PENDING", "OVERDUE"] },
      dueDate: { lte: sevenDaysAgo },
      result:  null,
    },
    select: {
      id:         true,
      clientId:   true,
      assignedTo: true,
      action:     true,
      client: { select: { name: true } },
      user:   { select: { name: true } },
    },
  });

  if (candidates.length === 0) {
    return NextResponse.json({ escalated: 0 });
  }

  await db.task.updateMany({
    where: { id: { in: candidates.map(t => t.id) } },
    data:  { status: "ESCALATED" },
  });

  // In-app уведомления каждому ответственному менеджеру
  for (const t of candidates) {
    await createNotification({
      userId: t.assignedTo,
      type:   "task_escalated",
      title:  `Задача эскалирована: ${t.action.slice(0, 60)}`,
      body:   `${t.client.name} — просрочено >7 дней`,
      href:   `/clients/${t.clientId}`,
    });
  }

  const lines = candidates.map(t =>
    `• ${t.client.name} — «${t.action}» (${t.user.name})`
  ).join("\n");

  await sendNotification(
    `🚨 <b>Эскалация CLM</b>: ${candidates.length} задач без результата >7 дней\n\n${lines}`
  );

  return NextResponse.json({ escalated: candidates.length });
}
