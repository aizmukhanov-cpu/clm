"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CLMStage } from "@/generated/prisma/client";
import { STAGE_LABELS } from "@/lib/clm-config";

export async function getMyPortfolio() {
  const session = await getSession();
  if (!session) return null;

  const now  = new Date();
  const week = new Date(now);
  week.setDate(week.getDate() - 7);

  // For MANAGER: clients where managerId = me
  // For KAM_ROLE: clients where kamId = me
  // For ADMIN/ANALYST: all (redirect to dashboard instead)
  const clientWhere =
    session.role === "MANAGER"
      ? { managerId: session.id, isArchived: false }
      : session.role === "KAM_ROLE"
      ? { kamId: session.id, isArchived: false }
      : { isArchived: false }; // admin/analyst fallback

  const [
    stageFunnel,
    totalClients,
    activeClients,
    atRiskClients,
    lapsedClients,
    openTasks,
    overdueTasks,
    p1Tasks,
    activitiesWeek,
    recentTasks,
    topClients,
  ] = await Promise.all([
    // CLM funnel for my clients
    db.client.groupBy({
      by: ["clmStage"],
      where: clientWhere,
      _count: { id: true },
    }),

    db.client.count({ where: clientWhere }),

    db.client.count({
      where: { ...clientWhere, txnCount30d: { gte: 1 }, gmv30d: { gt: 100 } },
    }),

    db.client.count({
      where: { ...clientWhere, txnCount30d: 0, daysSinceLastTxn: { gte: 1, lte: 60 } },
    }),

    db.client.count({
      where: { ...clientWhere, txnCount30d: 0, daysSinceLastTxn: { gt: 60 } },
    }),

    // My open tasks
    db.task.count({
      where: { assignedTo: session.id, status: { not: "DONE" }, dueDate: { gte: now } },
    }),

    db.task.count({
      where: { assignedTo: session.id, status: { not: "DONE" }, dueDate: { lt: now } },
    }),

    db.task.count({
      where: { assignedTo: session.id, status: { not: "DONE" }, priority: "P1" },
    }),

    // Activities this week by me
    db.activity.count({
      where: { performedBy: session.id, performedAt: { gte: week } },
    }),

    // My upcoming tasks
    db.task.findMany({
      where: { assignedTo: session.id, status: { not: "DONE" } },
      include: { client: { select: { id: true, name: true, clmStage: true } } },
      orderBy: [{ dueDate: "asc" }],
      take: 8,
    }),

    // Clients needing attention (most days since txn, still in active stages)
    db.client.findMany({
      where: {
        ...clientWhere,
        clmStage: { in: [CLMStage.ACTIVATE, CLMStage.REACTIVATE, CLMStage.GROW] },
      },
      orderBy: { daysSinceLastTxn: "desc" },
      take: 5,
      select: {
        id: true, name: true, clmStage: true,
        daysSinceLastTxn: true, txnCount30d: true, clmCohort: true,
      },
    }),
  ]);

  const stages: CLMStage[] = [CLMStage.ACQUIRE, CLMStage.ONBOARD, CLMStage.ACTIVATE, CLMStage.GROW, CLMStage.REACTIVATE];
  const funnel = stages.map((s) => ({
    stage: s,
    label: STAGE_LABELS[s] ?? s,
    count: stageFunnel.find((g) => g.clmStage === s)?._count.id ?? 0,
  }));

  const activationRate = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0;

  return {
    user: { name: session.name, role: session.role },
    totalClients,
    activationRate,
    activeClients,
    atRiskClients,
    lapsedClients,
    tasks: { open: openTasks, overdue: overdueTasks, p1: p1Tasks },
    activitiesWeek,
    funnel,
    recentTasks,
    topClients,
  };
}
