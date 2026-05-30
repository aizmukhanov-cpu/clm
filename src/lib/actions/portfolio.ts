"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CLMStage } from "@/generated/prisma/client";
import { STAGE_LABELS } from "@/lib/clm-config";

/* ─── My clients list (filterable + paginated) ─────────── */

export type MyClientRow = {
  id: string;
  name: string;
  inn: string;
  clmStage: string;
  clmCohort: string | null;
  sizeCategory: string | null;
  txnCount30d: number;
  gmv30d: number;
  daysSinceLastTxn: number;
  openTasks: number;
};

export async function getMyClients(params: {
  search?: string;
  stage?: string;
  page?: number;
}) {
  const session = await getSession();
  if (!session) return null;

  const PAGE_SIZE = 20;
  const page = Math.max(1, params.page ?? 1);

  const buildBase = (): Record<string, unknown> => {
    if (session.role === "SPECIALIST") return { managerId: session.id, isArchived: false };
    if (session.role === "KAM")        return { kamId: session.id, isArchived: false };
    if (session.role === "SUPERVISOR") {
      if (session.team === "KAM") {
        return {
          isArchived: false,
          OR: [{ kamId: session.id }, { kam: { supervisorId: session.id } }],
        };
      }
      return {
        isArchived: false,
        OR: [{ managerId: session.id }, { manager: { supervisorId: session.id } }],
      };
    }
    if (session.role === "TEAM_LEAD") {
      if (session.team === "KAM") return { isArchived: false, kam: { team: "KAM" } };
      return { isArchived: false, manager: { team: session.team } };
    }
    return { isArchived: false };
  };
  const baseWhere = buildBase();

  const where: Record<string, unknown> = { ...baseWhere };

  if (params.search?.trim()) {
    where.OR = [
      { name: { contains: params.search.trim(), mode: "insensitive" } },
      { inn:  { contains: params.search.trim() } },
    ];
  }

  if (params.stage && params.stage !== "ALL") {
    where.clmStage = params.stage;
  }

  const [rows, total] = await Promise.all([
    db.client.findMany({
      where,
      select: {
        id: true, name: true, inn: true,
        clmStage: true, clmCohort: true,
        txnCount30d: true, gmv30d: true, daysSinceLastTxn: true,
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: [{ daysSinceLastTxn: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.client.count({ where }),
  ]);

  const clients: MyClientRow[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    inn: c.inn,
    clmStage: c.clmStage,
    clmCohort: c.clmCohort,
    sizeCategory: null,   // available after migration + server restart
    txnCount30d: c.txnCount30d,
    gmv30d: c.gmv30d,
    daysSinceLastTxn: c.daysSinceLastTxn,
    openTasks: c._count.tasks,
  }));

  return {
    clients,
    total,
    pages: Math.ceil(total / PAGE_SIZE),
    page,
  };
}

export async function getMyPortfolio() {
  const session = await getSession();
  if (!session) return null;

  const now  = new Date();
  const week = new Date(now);
  week.setDate(week.getDate() - 7);

  // Scope by role:
  //   SPECIALIST  → own clients (managerId = me)
  //   KAM         → own KAM-clients (kamId = me)
  //   SUPERVISOR  → own + subordinates' clients
  //   TEAM_LEAD   → whole team clients
  //   others      → all (ADMIN/DIRECTOR/ANALYST redirect to dashboard)
  const buildClientWhere = (): Record<string, unknown> => {
    if (session.role === "SPECIALIST") return { managerId: session.id, isArchived: false };
    if (session.role === "KAM")        return { kamId: session.id, isArchived: false };
    if (session.role === "SUPERVISOR") {
      if (session.team === "KAM") {
        return {
          isArchived: false,
          OR: [{ kamId: session.id }, { kam: { supervisorId: session.id } }],
        };
      }
      return {
        isArchived: false,
        OR: [{ managerId: session.id }, { manager: { supervisorId: session.id } }],
      };
    }
    if (session.role === "TEAM_LEAD") {
      if (session.team === "KAM") return { isArchived: false, kam: { team: "KAM" } };
      return { isArchived: false, manager: { team: session.team } };
    }
    return { isArchived: false }; // ADMIN / DIRECTOR / ANALYST
  };
  const clientWhere = buildClientWhere();

  const [
    stageFunnel,
    totalClients,
    activeClients,
    atRiskClients,
    lapsedClients,
    activitiesWeek,
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

    // Activities this week by me
    db.activity.count({
      where: { performedBy: session.id, performedAt: { gte: week } },
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
    activitiesWeek,
    funnel,
    topClients,
  };
}

/* ─── My Tasks ──────────────────────────────────────────── */

export type MyTaskRow = {
  id: string;
  triggerDay: string | null;
  dueDate: Date;
  priority: string;
  status: string;
  action: string;
  result: string | null;
  client: { id: string; name: string; inn: string; clmStage: string };
};

export type MyTaskFilters = {
  priority?:   string;
  triggerDay?: string;
  status?:     string;
  page?:       number;
};

const TASKS_PAGE_SIZE = 50;

export async function getMyTasks(filters: MyTaskFilters = {}) {
  const session = await getSession();
  if (!session) return null;

  const now = new Date();
  const page = Math.max(1, filters.page ?? 1);

  const where: Record<string, unknown> = {
    assignedTo: session.id,
  };

  if (filters.priority && filters.priority !== "ALL") where.priority = filters.priority;
  if (filters.triggerDay && filters.triggerDay !== "ALL") where.triggerDay = filters.triggerDay;

  if (filters.status === "DONE") {
    where.status = "DONE";
  } else if (filters.status === "OVERDUE") {
    where.status = { notIn: ["DONE", "CANCELLED"] as const };
    where.dueDate = { lt: now };
  } else if (filters.status === "TODAY") {
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(now); endOfDay.setHours(23, 59, 59, 999);
    where.status = { notIn: ["DONE", "CANCELLED"] as const };
    where.dueDate = { gte: startOfDay, lte: endOfDay };
  } else if (filters.status === "PENDING" || !filters.status || filters.status === "ALL") {
    // default: open only
    where.status = { notIn: ["DONE", "CANCELLED"] as const };
  }
  // "ALL_WITH_DONE" — показывает всё включая выполненные

  const [tasks, openCount, overdueCount, p1Count] = await Promise.all([
    db.task.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, inn: true, clmStage: true } },
      },
      orderBy: [
        { dueDate: "asc" },
        { priority: "asc" },
      ],
      skip: (page - 1) * TASKS_PAGE_SIZE,
      take: TASKS_PAGE_SIZE,
    }),
    db.task.count({ where: { assignedTo: session.id, status: { notIn: ["DONE", "CANCELLED"] as const } } }),
    db.task.count({ where: { assignedTo: session.id, status: { notIn: ["DONE", "CANCELLED"] as const }, dueDate: { lt: now } } }),
    db.task.count({ where: { assignedTo: session.id, status: { notIn: ["DONE", "CANCELLED"] as const }, priority: "P1" } }),
  ]);

  return {
    tasks: tasks as MyTaskRow[],
    stats: { open: openCount, overdue: overdueCount, p1: p1Count },
    page,
    hasMore: tasks.length === TASKS_PAGE_SIZE,
  };
}
