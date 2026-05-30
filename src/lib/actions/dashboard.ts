"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UserRole, CLMStage, CLMCohort, DealStatus } from "@/generated/prisma/client";
import { clientAccessWhere } from "@/lib/access";
import { getSnapshotHistory } from "@/lib/actions/snapshots";
import type { SnapshotPoint } from "@/lib/actions/snapshots";

/* ─── Weekly trend helpers ─────────────────────────────── */

/** Generates N weekly buckets ending now (newest last). */
function weekBuckets(n: number): { start: Date; end: Date; label: string }[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const end   = new Date(now); end.setDate(now.getDate() - 7 * i);
    const start = new Date(end); start.setDate(end.getDate() - 7);
    const d     = new Date(start);
    const label = `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    return { start, end, label };
  }).reverse();
}

export async function getDashboardData() {
  const session = await getSession();
  if (!session) return null;

  // Dashboard доступен для ADMIN, DIRECTOR, ANALYST, TEAM_LEAD
  // Specialists/KAM/Supervisor используют "Мой портфель"
  const clientWhere: Record<string, unknown> = {
    isArchived: false,
    ...clientAccessWhere(session),
  };

  const taskWhere: Record<string, unknown> = { status: { notIn: ["DONE", "CANCELLED"] as const } };

  const now      = new Date();
  const week     = new Date(now);  week.setDate(week.getDate() - 7);
  const month    = new Date(now);  month.setDate(month.getDate() - 30);
  const prevWeekStart = new Date(now); prevWeekStart.setDate(now.getDate() - 14);
  const prevWeekEnd   = week;
  const prevMonthStart = new Date(now); prevMonthStart.setDate(now.getDate() - 60);
  const prevMonthEnd   = month;

  const TREND_WEEKS = 8;
  const buckets = weekBuckets(TREND_WEEKS);

  const [
    stageGroups,
    cohortGroups,
    totalClients,
    // Activity segments
    activeClients,      // ≥1 тр. за 30д И gmv > 100 сом
    lowActiveClients,   // ≥1 тр. за 30д НО gmv ≤ 100 сом (мелкие транзакции)
    atRiskClients,      // 0 тр. за 30д, НО были ранее (1–60 дней без тр.)
    lapsedClients,      // 0 тр. за 30д, >60 дней без тр.
    neverActiveClients, // ни одной транзакции никогда
    tasksPending,
    tasksOverdue,
    tasksP1,
    activitiesWeek,
    activityTypes,
    b2bDeals,
    kmDeals,
    recentActivities,
    recentChangelogs,
    branches,
    productSums,
    branchActiveGroups,
    topRiskClients,
    snapshotHistory,
    weeklyActivityTrend,
    weeklyActivationsTrend,
    activitiesWeekPrev,
  ] = await Promise.all([
    // CLM funnel
    db.client.groupBy({
      by: ["clmStage"],
      where: clientWhere,
      _count: { id: true },
    }),

    // Cohort distribution
    db.client.groupBy({
      by: ["clmCohort"],
      where: clientWhere,
      _count: { id: true },
    }),

    // Total clients
    db.client.count({ where: clientWhere }),

    // ── Активность базы ───────────────────────────────────
    // Активные: ≥1 тр. за 30д И GMV > 100 сом
    db.client.count({
      where: { ...clientWhere, txnCount30d: { gte: 1 }, gmv30d: { gt: 100 } },
    }),

    // Слабые: ≥1 тр. за 30д НО суммарный GMV ≤ 100 сом
    db.client.count({
      where: { ...clientWhere, txnCount30d: { gte: 1 }, gmv30d: { lte: 100 } },
    }),

    // Под риском: 0 тр. за 30д, но была активность (1–60 дней без тр.)
    db.client.count({
      where: { ...clientWhere, txnCount30d: 0, daysSinceLastTxn: { gte: 1, lte: 60 } },
    }),

    // Потерянные: 0 тр. за 30д И >60 дней без тр.
    db.client.count({
      where: { ...clientWhere, txnCount30d: 0, daysSinceLastTxn: { gt: 60 } },
    }),

    // Никогда не транзачили (daysSinceLastTxn = 0 AND txnCount30d = 0)
    db.client.count({
      where: { ...clientWhere, txnCount30d: 0, daysSinceLastTxn: 0 },
    }),

    // Tasks pending (not overdue)
    db.task.count({
      where: { ...taskWhere, dueDate: { gte: now } },
    }),

    // Tasks overdue
    db.task.count({
      where: { ...taskWhere, dueDate: { lt: now } },
    }),

    // Tasks P1
    db.task.count({
      where: { ...taskWhere, priority: "P1" },
    }),

    // Activities this week
    db.activity.count({
      where: { performedAt: { gte: week } },
    }),

    // Activity breakdown by type this week
    db.activity.groupBy({
      by: ["type"],
      where: { performedAt: { gte: week } },
      _count: { id: true },
    }),

    // B2B active pipeline
    db.deal.aggregate({
      where: { team: "B2B", status: DealStatus.ACTIVE },
      _count: { id: true },
      _sum: { amount: true },
    }),

    // KM active pipeline
    db.deal.aggregate({
      where: { team: "KM", status: DealStatus.ACTIVE },
      _count: { id: true },
      _sum: { amount: true },
    }),

    // Recent activities
    db.activity.findMany({
      where: {},
      include: {
        client: { select: { id: true, name: true } },
        user:   { select: { name: true } },
      },
      orderBy: { performedAt: "desc" },
      take: 8,
    }),

    // Recent stage changes
    db.changelog.findMany({
      where: { field: "clmStage" },
      include: {
        client: { select: { id: true, name: true } },
        user:   { select: { name: true } },
      },
      orderBy: { changedAt: "desc" },
      take: 6,
    }),

    // Branch stats — grouped by branchId
    db.branch.findMany({
      select: {
        id: true,
        name: true,
        targetPct: true,
        _count: {
          select: { clients: { where: { ...clientWhere } } },
        },
      },
      orderBy: { name: "asc" },
    }),

    // Product adoption — count per product (Prisma doesn't SUM booleans)
    Promise.all([
      db.client.count({ where: { ...clientWhere, hasMBusiness:     true } }),
      db.client.count({ where: { ...clientWhere, hasMKassaPos:     true } }),
      db.client.count({ where: { ...clientWhere, hasMKassaQr:      true } }),
      db.client.count({ where: { ...clientWhere, hasAcquiring:     true } }),
      db.client.count({ where: { ...clientWhere, hasSalaryProject: true } }),
      db.client.count({ where: { ...clientWhere, hasPayroll:       true } }),
      db.client.count({ where: { ...clientWhere, hasCorporateCard: true } }),
      db.client.count({ where: { ...clientWhere, hasCredit:        true } }),
      db.client.count({ where: { ...clientWhere, hasDeposit:       true } }),
      db.client.count({ where: { ...clientWhere, hasTradeFinance:  true } }),
    ]),

    // Per-branch active clients count (for activation %)
    db.client.groupBy({
      by: ["branchId"],
      where: { ...clientWhere, txnCount30d: { gte: 1 }, gmv30d: { gt: 100 } },
      _count: { id: true },
    }),

    // Top 5 clients at churn risk: >30 days without transaction, not ACQUIRE
    db.client.findMany({
      where: {
        ...clientWhere,
        clmStage: { not: "ACQUIRE" },
        daysSinceLastTxn: { gte: 30 },
      },
      select: {
        id: true, name: true, inn: true,
        clmStage: true, clmCohort: true,
        daysSinceLastTxn: true, gmv30d: true,
        manager: { select: { name: true } },
      },
      orderBy: { daysSinceLastTxn: "desc" },
      take: 5,
    }),

    // Snapshot history for sparklines
    getSnapshotHistory(12),

    // Weekly activity counts (last 8 weeks) — for bar chart
    Promise.all(
      buckets.map((b) =>
        db.activity.count({ where: { performedAt: { gte: b.start, lt: b.end } } })
          .then((count) => ({ label: b.label, count }))
      )
    ),

    // Weekly activations (transitions to ACTIVATE stage, last 8 weeks)
    Promise.all(
      buckets.map((b) =>
        db.changelog.count({
          where: { field: "clmStage", newVal: "ACTIVATE", changedAt: { gte: b.start, lt: b.end } },
        }).then((count) => ({ label: b.label, count }))
      )
    ),

    // Activities previous week (7–14 days ago) — for WoW delta
    db.activity.count({ where: { performedAt: { gte: prevWeekStart, lt: prevWeekEnd } } }),
  ]);

  // Build stage funnel map
  const stageFunnel = (
    [CLMStage.ACQUIRE, CLMStage.ONBOARD, CLMStage.ACTIVATE, CLMStage.GROW, CLMStage.REACTIVATE] as CLMStage[]
  ).map((s) => ({
    stage: s,
    count: stageGroups.find((g) => g.clmStage === s)?._count.id ?? 0,
  }));

  // Cohort map
  const cohortMap = (
    [CLMCohort.ACTIVE, CLMCohort.LOW_ACTIVE, CLMCohort.NEVER_ACTIVE, CLMCohort.LAPSED] as CLMCohort[]
  ).map((c) => ({
    cohort: c,
    count: cohortGroups.find((g) => g.clmCohort === c)?._count.id ?? 0,
  }));

  // Activity type map
  const actTypeMap: Record<string, number> = {};
  for (const a of activityTypes) actTypeMap[a.type] = a._count.id;

  // Branch stats with activation %
  const branchStats = branches.map((b) => {
    const total  = b._count.clients;
    const active = branchActiveGroups.find((g) => g.branchId === b.id)?._count.id ?? 0;
    const pct    = total > 0 ? Math.round((active / total) * 100) : 0;
    const gap    = pct - b.targetPct;
    return { id: b.id, name: b.name, total, active, pct, targetPct: b.targetPct, gap };
  }).filter((b) => b.total > 0).sort((a, b) => a.gap - b.gap); // worst first

  // Product adoption
  const [pMBusiness, pMKassaPos, pMKassaQr, pAcquiring,
         pSalary, pPayroll, pCorpCard, pCredit,
         pDeposit, pTrade] = productSums;
  const productAdoption = [
    { key: "hasMBusiness",     label: "MBusiness",     count: pMBusiness  },
    { key: "hasMKassaPos",     label: "MKassa POS",    count: pMKassaPos  },
    { key: "hasMKassaQr",      label: "MKassa QR",     count: pMKassaQr   },
    { key: "hasAcquiring",     label: "Эквайринг",     count: pAcquiring  },
    { key: "hasSalaryProject", label: "ЗП-проект",     count: pSalary     },
    { key: "hasPayroll",       label: "Зарплата",      count: pPayroll    },
    { key: "hasCorporateCard", label: "Корп. карта",   count: pCorpCard   },
    { key: "hasCredit",        label: "Кредит",        count: pCredit     },
    { key: "hasDeposit",       label: "Депозит",       count: pDeposit    },
    { key: "hasTradeFinance",  label: "Торг. финанс.", count: pTrade      },
  ].map((p) => ({
    ...p,
    pct: totalClients > 0 ? Math.round((p.count / totalClients) * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  // WoW delta for activities (%)
  const activitiesWoWDelta = activitiesWeekPrev > 0
    ? Math.round(((activitiesWeek - activitiesWeekPrev) / activitiesWeekPrev) * 100)
    : null;

  return {
    totalClients,
    stageFunnel,
    cohortMap,
    tasks: { pending: tasksPending, overdue: tasksOverdue, p1: tasksP1 },
    pipeline: {
      b2b: { count: b2bDeals._count.id, amount: b2bDeals._sum.amount ?? 0 },
      km:  { count: kmDeals._count.id,  amount: kmDeals._sum.amount  ?? 0 },
    },
    activitiesWeek,
    activitiesWoWDelta,
    actTypeMap,
    recentActivities,
    recentChangelogs,
    // Активность базы
    activity: {
      active:      activeClients,
      lowActive:   lowActiveClients,
      atRisk:      atRiskClients,
      lapsed:      lapsedClients,
      neverActive: neverActiveClients,
    },
    branchStats,
    productAdoption,
    topRiskClients,
    // ── Тренды ───────────────────────────────────────────
    snapshotHistory,
    weeklyActivityTrend,
    weeklyActivationsTrend,
  };
}
