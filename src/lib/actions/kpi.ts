"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UserRole, TeamType } from "@/generated/prisma/client";
import { getSnapshotHistory } from "@/lib/actions/snapshots";

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

export type ActivationTrendPoint = {
  date:           Date;
  activationRate: number;
  activeClients:  number;
};

export type KPIViewMode =
  | { kind: "all";      teams: TeamKPI[]; trend: ActivationTrendPoint[] }
  | { kind: "team";     team: TeamKPI;   trend: ActivationTrendPoint[] }
  | { kind: "personal"; kpi: ManagerKPI; trend: ActivationTrendPoint[] };

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
      where: { assignedTo: m.id, status: { notIn: ["DONE", "CANCELLED"] as const }, dueDate: { gte: now } },
    }),
    db.task.count({
      where: { assignedTo: m.id, status: { notIn: ["DONE", "CANCELLED"] as const }, dueDate: { lt: now } },
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
      // BRANCH-6: считаем ВСЕ активации клиентов менеджера (ручные + авто CLM sync)
      where: { field: "clmStage", newVal: "ACTIVATE", changedAt: { gte: monthStart }, client: { managerId: m.id } },
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

  const [trend] = await Promise.all([
    getSnapshotHistory(12).then((pts) =>
      pts.map((p) => ({ date: p.date, activationRate: p.activationRate, activeClients: p.activeClients }))
    ),
  ]);

  // ── SPECIALIST / KAM → только личный KPI ─────────────
  if (session.role === "SPECIALIST" || session.role === "KAM") {
    const me = { id: session.id, name: session.name, team: session.team ?? "KM" };
    const kpi = await calcManagerKPI(me, now, monthStart, prevStart, prevEnd);
    return { kind: "personal", kpi, trend };
  }

  // ── SUPERVISOR → свои + подчинённые (personal view) ──
  if (session.role === "SUPERVISOR") {
    const me = { id: session.id, name: session.name, team: session.team ?? "KM" };
    const kpi = await calcManagerKPI(me, now, monthStart, prevStart, prevEnd);
    return { kind: "personal", kpi, trend };
  }

  // ── TEAM_LEAD → только своя команда ──────────────────
  // ── DIRECTOR / ADMIN → все команды ───────────────────
  // ── ANALYST → только своя команда ────────────────────
  const teamScopedRoles = ["TEAM_LEAD", "ANALYST"];
  const teamFilter = teamScopedRoles.includes(session.role)
    ? { team: session.team as TeamType }
    : {};

  const managers = await db.user.findMany({
    where: { role: { in: ["SPECIALIST", "KAM", "SUPERVISOR"] }, ...teamFilter },
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
    if (mgrs.length === 0 && session.role !== "ADMIN") continue;

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

  if ((session.role === "ANALYST" || session.role === "TEAM_LEAD") && teams.length === 1) {
    return { kind: "team", team: teams[0], trend };
  }

  return { kind: "all", teams, trend };
}

// Совместимость со старой страницей admin/kpi
export async function getKPIDashboard() {
  const session = await getSession();
  if (!session) return null;
  if (!["ADMIN", "ANALYST", "DIRECTOR"].includes(session.role)) return null;

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const managers = await db.user.findMany({
    where: { role: { in: ["SPECIALIST", "KAM"] } },
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
