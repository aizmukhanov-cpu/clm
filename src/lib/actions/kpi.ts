"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UserRole, TeamType } from "@/generated/prisma/client";

/* ─── Типы ─────────────────────────────────────────────── */

export type ManagerKPI = {
  manager: { id: string; name: string; team: string };
  totalClients:   number;
  activeClients:  number;
  activationRate: number;
  openTasks:      number;
  overdueTasks:   number;
  doneTasks:      number;
  activitiesMonth: number;
  actDelta:        number | null;
  activations:     number;
};

export type TeamKPI = {
  team:           string;
  label:          string;
  managerCount:   number;
  totalClients:   number;
  activeClients:  number;
  activationRate: number;
  openTasks:      number;
  overdueTasks:   number;
  activitiesMonth: number;
  activations:    number;
  managers:       ManagerKPI[];
};

export type KPIViewMode =
  | { kind: "all";      teams: TeamKPI[] }
  | { kind: "team";     team: TeamKPI }
  | { kind: "personal"; kpi: ManagerKPI };

const TEAM_LABELS: Record<string, string> = {
  B2B:    "B2B — Микро / ИП",
  KM:     "КМ — МСБ",
  KAM:    "KAM — Крупный бизнес",
  VB:     "Virtual Branch",
  BRANCH: "Филиалы",
};

/* ─── Вспомогательная функция расчёта KPI менеджера ────── */

async function calcManagerKPI(
  m: { id: string; name: string; team: string },
  now: Date,
  monthStart: Date,
  prevStart: Date,
  prevEnd: Date,
): Promise<ManagerKPI> {
  const [
    totalClients,
    activeClients,
    openTasks,
    overdueTasks,
    doneTasks,
    activitiesMonth,
    activitiesPrev,
    activations,
  ] = await Promise.all([
    db.client.count({ where: { managerId: m.id, isArchived: false } }),
    db.client.count({
      where: { managerId: m.id, isArchived: false, txnCount30d: { gte: 1 }, gmv30d: { gt: 100 } },
    }),
    db.task.count({
      where: { assignedTo: m.id, status: { not: "DONE" }, dueDate: { gte: now } },
    }),
    db.task.count({
      where: { assignedTo: m.id, status: { not: "DONE" }, dueDate: { lt: now } },
    }),
    db.task.count({
      where: { assignedTo: m.id, status: "DONE", updatedAt: { gte: monthStart } },
    }),
    db.activity.count({
      where: { performedBy: m.id, performedAt: { gte: monthStart } },
    }),
    db.activity.count({
      where: { performedBy: m.id, performedAt: { gte: prevStart, lte: prevEnd } },
    }),
    db.changelog.count({
      where: { changedBy: m.id, field: "clmStage", newVal: "ACTIVATE", changedAt: { gte: monthStart } },
    }),
  ]);

  const activationRate = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0;
  const actDelta = activitiesPrev > 0
    ? Math.round(((activitiesMonth - activitiesPrev) / activitiesPrev) * 100)
    : null;

  return {
    manager: m,
    totalClients, activeClients, activationRate,
    openTasks, overdueTasks, doneTasks,
    activitiesMonth, actDelta, activations,
  };
}

/* ─── Главная функция ───────────────────────────────────── */

export async function getKPIData(): Promise<KPIViewMode | null> {
  const session = await getSession();
  if (!session) return null;

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // ── MANAGER / KAM_ROLE → только личный KPI ────────────
  if (session.role === UserRole.MANAGER || session.role === UserRole.KAM_ROLE) {
    const me = { id: session.id, name: session.name, team: session.team ?? "KM" };
    const kpi = await calcManagerKPI(me, now, monthStart, prevStart, prevEnd);
    return { kind: "personal", kpi };
  }

  // ── ANALYST → только своя команда ────────────────────
  // ── ADMIN → все команды ──────────────────────────────
  const teamFilter = session.role === UserRole.ANALYST
    ? { team: session.team as TeamType }
    : {};

  const managers = await db.user.findMany({
    where: { role: { in: [UserRole.MANAGER, UserRole.KAM_ROLE] }, ...teamFilter },
    select: { id: true, name: true, team: true },
    orderBy: [{ team: "asc" }, { name: "asc" }],
  });

  const allKPI = await Promise.all(
    managers.map((m) => calcManagerKPI(m, now, monthStart, prevStart, prevEnd))
  );

  // Группируем по командам
  const teamMap: Record<string, ManagerKPI[]> = {};
  for (const kpi of allKPI) {
    const t = kpi.manager.team;
    if (!teamMap[t]) teamMap[t] = [];
    teamMap[t].push(kpi);
  }

  const teamOrder = ["B2B", "KM", "KAM", "VB", "BRANCH"];
  const teams: TeamKPI[] = [];

  for (const team of teamOrder) {
    const mgrs = teamMap[team] ?? [];
    if (mgrs.length === 0 && session.role !== UserRole.ADMIN) continue;

    const sum = mgrs.reduce(
      (acc, m) => ({
        totalClients:    acc.totalClients    + m.totalClients,
        activeClients:   acc.activeClients   + m.activeClients,
        openTasks:       acc.openTasks       + m.openTasks,
        overdueTasks:    acc.overdueTasks    + m.overdueTasks,
        activitiesMonth: acc.activitiesMonth + m.activitiesMonth,
        activations:     acc.activations     + m.activations,
      }),
      { totalClients: 0, activeClients: 0, openTasks: 0, overdueTasks: 0, activitiesMonth: 0, activations: 0 }
    );

    const activationRate = sum.totalClients > 0
      ? Math.round((sum.activeClients / sum.totalClients) * 100)
      : 0;

    teams.push({
      team,
      label: TEAM_LABELS[team] ?? team,
      managerCount: mgrs.length,
      activationRate,
      managers: mgrs,
      ...sum,
    });
  }

  if (session.role === UserRole.ANALYST && teams.length === 1) {
    return { kind: "team", team: teams[0] };
  }

  return { kind: "all", teams };
}

// Совместимость со старой страницей admin/kpi
export async function getKPIDashboard() {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== UserRole.ADMIN && session.role !== "ANALYST") return null;

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const managers = await db.user.findMany({
    where: { role: UserRole.MANAGER },
    select: { id: true, name: true, team: true },
    orderBy: [{ team: "asc" }, { name: "asc" }],
  });

  const stats = await Promise.all(
    managers.map((m) => calcManagerKPI(m, now, monthStart, prevStart, prevEnd))
  );

  const totals = stats.reduce(
    (acc, s) => ({
      clients:     acc.clients     + s.totalClients,
      active:      acc.active      + s.activeClients,
      openTasks:   acc.openTasks   + s.openTasks,
      overdue:     acc.overdue     + s.overdueTasks,
      activities:  acc.activities  + s.activitiesMonth,
      activations: acc.activations + s.activations,
    }),
    { clients: 0, active: 0, openTasks: 0, overdue: 0, activities: 0, activations: 0 }
  );

  return { stats, totals, month: monthStart };
}
