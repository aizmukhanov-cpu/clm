/**
 * POST /api/cron/monthly-snapshot
 *
 * Runs on the 1st of each month (vercel.json: "0 4 1 * *").
 * Captures ManagerMonthlySnapshot for the PREVIOUS month.
 * Used for 3-month trend analysis in /kpi.
 *
 * Protected by Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Снапшот делается для ПРЕДЫДУЩЕГО месяца
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const year  = prevMonthEnd.getFullYear();
  const month = prevMonthEnd.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1);

  const managers = await db.user.findMany({
    where: { role: { in: ["SPECIALIST", "KAM", "SUPERVISOR"] } },
    select: { id: true, planMonthly: true },
  });

  let created = 0;
  let skipped = 0;

  for (const mgr of managers) {
    const [
      actualClients,
      activeClients,
      totalClients,
      activitiesCount,
      activations,
    ] = await Promise.all([
      // Новые клиенты — первый переход в ACTIVATE за месяц
      db.changelog.count({
        where: {
          changedBy: mgr.id,
          field:     "clmStage",
          newVal:    "ACTIVATE",
          changedAt: { gte: monthStart, lte: prevMonthEnd },
        },
      }),
      // Активных клиентов на конец месяца
      db.client.count({
        where: {
          managerId:   mgr.id,
          isArchived:  false,
          txnCount30d: { gte: 1 },
        },
      }),
      db.client.count({ where: { managerId: mgr.id, isArchived: false } }),
      // Активностей за месяц
      db.activity.count({
        where: {
          performedBy: mgr.id,
          performedAt: { gte: monthStart, lte: prevMonthEnd },
        },
      }),
      // Активаций за месяц
      db.changelog.count({
        where: {
          changedBy: mgr.id,
          field:     "clmStage",
          newVal:    "ACTIVATE",
          changedAt: { gte: monthStart, lte: prevMonthEnd },
        },
      }),
    ]);

    const activationRate = totalClients > 0
      ? Math.round((activeClients / totalClients) * 100)
      : 0;

    try {
      await db.managerMonthlySnapshot.upsert({
        where: { userId_year_month: { userId: mgr.id, year, month } },
        create: {
          userId:         mgr.id,
          year,
          month,
          plannedClients: mgr.planMonthly ?? 0,
          actualClients,
          activationRate,
          activitiesCount,
          activations,
        },
        update: {
          plannedClients: mgr.planMonthly ?? 0,
          actualClients,
          activationRate,
          activitiesCount,
          activations,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, year, month, created, skipped });
}
