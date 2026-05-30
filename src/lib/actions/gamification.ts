"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export type Achievement = {
  id:          string;
  icon:        string;
  label:       string;
  description: string;
  earned:      boolean;
  tier:        "bronze" | "silver" | "gold";
};

export type LeaderboardEntry = {
  rank:            number;
  userId:          string;
  name:            string;
  team:            string;
  branchId:        string;
  activations:     number;
  activities:      number;
  activationRate:  number;
  score:           number;
  medal:           "🥇" | "🥈" | "🥉" | null;
  trend:           "up" | "down" | "same";
};

export type BranchLeaderboardEntry = {
  rank:              number;
  branchId:          string;
  branchName:        string;
  managerCount:      number;
  totalActivations:  number;
  totalActivities:   number;
  avgActivationRate: number;
  avgScore:          number;
  medal:             "🥇" | "🥈" | "🥉" | null;
};

/** TeamLeaderboards: team → ranked entries within that team */
export type TeamLeaderboards = Record<string, LeaderboardEntry[]>;

/** Composite score = activations×10 + activities×1 + activationRate×0.5 */
function calcScore(activations: number, activities: number, activationRate: number): number {
  return Math.round(activations * 10 + activities + activationRate * 0.5);
}

/** Internal: compute per-manager scores for the current month */
async function computeManagerScores(): Promise<LeaderboardEntry[]> {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const managers = await db.user.findMany({
    where:   { role: { in: ["SPECIALIST", "KAM"] } },
    select:  { id: true, name: true, team: true, branchId: true },
    orderBy: { name: "asc" },
  });

  const entries: LeaderboardEntry[] = [];

  for (const mgr of managers) {
    const [activations, activities, activeClients, totalClients, prevActivations] = await Promise.all([
      db.changelog.count({
        where: { changedBy: mgr.id, field: "clmStage", newVal: "ACTIVATE", changedAt: { gte: monthStart } },
      }),
      db.activity.count({
        where: { performedBy: mgr.id, performedAt: { gte: monthStart } },
      }),
      db.client.count({
        where: { managerId: mgr.id, isArchived: false, txnCount30d: { gte: 1 } },
      }),
      db.client.count({ where: { managerId: mgr.id, isArchived: false } }),
      db.changelog.count({
        where: { changedBy: mgr.id, field: "clmStage", newVal: "ACTIVATE", changedAt: { gte: prevStart, lte: prevEnd } },
      }),
    ]);

    const activationRate = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0;
    const score          = calcScore(activations, activities, activationRate);
    const trend: "up" | "down" | "same" =
      activations > prevActivations ? "up" :
      activations < prevActivations ? "down" : "same";

    entries.push({
      rank: 0, medal: null,
      userId:         mgr.id,
      name:           mgr.name,
      team:           mgr.team,
      branchId:       mgr.branchId,
      activations,
      activities,
      activationRate,
      score,
      trend,
    });
  }

  return entries;
}

/**
 * Returns leaderboards grouped by team.
 * — Privileged roles (ADMIN, DIRECTOR, ANALYST, TEAM_LEAD) see ALL teams.
 * — Regular SPECIALIST/KAM see only their own team.
 */
export async function getTeamLeaderboards(): Promise<TeamLeaderboards | null> {
  const session = await getSession();
  if (!session) return null;

  const isPrivileged = ["ADMIN", "DIRECTOR", "ANALYST", "TEAM_LEAD"].includes(session.role);

  let entries = await computeManagerScores();

  // Filter to own team unless privileged
  if (!isPrivileged) {
    entries = entries.filter(e => e.team === session.team);
  }

  // Group by team
  const byTeam: TeamLeaderboards = {};
  for (const entry of entries) {
    if (!byTeam[entry.team]) byTeam[entry.team] = [];
    byTeam[entry.team].push(entry);
  }

  // Rank within each team independently
  for (const team of Object.keys(byTeam)) {
    byTeam[team].sort((a, b) => b.score - a.score);
    byTeam[team].forEach((e, idx) => {
      e.rank  = idx + 1;
      e.medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
    });
  }

  return byTeam;
}

/**
 * Returns branches ranked by average manager score.
 * Visible to all authenticated users.
 */
export async function getBranchLeaderboard(): Promise<BranchLeaderboardEntry[]> {
  const session = await getSession();
  if (!session) return [];

  const [entries, branches] = await Promise.all([
    computeManagerScores(),
    db.branch.findMany({ select: { id: true, name: true } }),
  ]);

  const branchNameMap = Object.fromEntries(branches.map(b => [b.id, b.name]));

  // Aggregate per branch
  const agg: Record<string, {
    name: string;
    entries: LeaderboardEntry[];
  }> = {};

  for (const e of entries) {
    const bName = branchNameMap[e.branchId] ?? e.branchId;
    if (!agg[e.branchId]) agg[e.branchId] = { name: bName, entries: [] };
    agg[e.branchId].entries.push(e);
  }

  const result: BranchLeaderboardEntry[] = Object.entries(agg).map(([branchId, { name, entries: es }]) => {
    const totalActivations  = es.reduce((s, e) => s + e.activations, 0);
    const totalActivities   = es.reduce((s, e) => s + e.activities, 0);
    const avgActivationRate = es.length > 0
      ? Math.round(es.reduce((s, e) => s + e.activationRate, 0) / es.length)
      : 0;
    const avgScore = es.length > 0
      ? Math.round(es.reduce((s, e) => s + e.score, 0) / es.length)
      : 0;

    return {
      rank: 0, medal: null,
      branchId,
      branchName:   name,
      managerCount: es.length,
      totalActivations,
      totalActivities,
      avgActivationRate,
      avgScore,
    };
  });

  // Rank by average score
  result.sort((a, b) => b.avgScore - a.avgScore);
  result.forEach((e, idx) => {
    e.rank  = idx + 1;
    e.medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
  });

  return result;
}

export async function getMyAchievements(): Promise<Achievement[] | null> {
  const session = await getSession();
  if (!session) return null;

  const now          = new Date();
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1);
  const allTimeStart = new Date("2020-01-01");

  const [
    totalActivations,
    totalActivities,
    totalClients,
    activeClients,
    activationsThisMonth,
    activitiesThisMonth,
    overdueTasks,
  ] = await Promise.all([
    db.changelog.count({
      where: { changedBy: session.id, field: "clmStage", newVal: "ACTIVATE", changedAt: { gte: allTimeStart } },
    }),
    db.activity.count({ where: { performedBy: session.id } }),
    db.client.count({ where: { managerId: session.id, isArchived: false } }),
    db.client.count({ where: { managerId: session.id, isArchived: false, txnCount30d: { gte: 1 } } }),
    db.changelog.count({
      where: { changedBy: session.id, field: "clmStage", newVal: "ACTIVATE", changedAt: { gte: monthStart } },
    }),
    db.activity.count({ where: { performedBy: session.id, performedAt: { gte: monthStart } } }),
    db.task.count({
      where: { assignedTo: session.id, status: { notIn: ["DONE", "CANCELLED"] as const }, dueDate: { lt: now } },
    }),
  ]);

  const activationRate = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0;

  const achievements: Achievement[] = [
    {
      id: "first-activation", icon: "🚀",
      label:       "Первая активация",
      description: "Активировал первого клиента",
      earned:      totalActivations >= 1,
      tier:        "bronze",
    },
    {
      id: "activations-10", icon: "⚡",
      label:       "10 активаций",
      description: "Активировал 10+ клиентов всего",
      earned:      totalActivations >= 10,
      tier:        "silver",
    },
    {
      id: "activations-50", icon: "🏆",
      label:       "50 активаций",
      description: "Активировал 50+ клиентов",
      earned:      totalActivations >= 50,
      tier:        "gold",
    },
    {
      id: "activity-streak-20", icon: "📞",
      label:       "20 контактов за месяц",
      description: "Провёл 20+ взаимодействий в одном месяце",
      earned:      activitiesThisMonth >= 20,
      tier:        "bronze",
    },
    {
      id: "activity-streak-50", icon: "🔥",
      label:       "50 контактов за месяц",
      description: "Провёл 50+ взаимодействий в одном месяце",
      earned:      activitiesThisMonth >= 50,
      tier:        "gold",
    },
    {
      id: "activation-rate-50", icon: "💪",
      label:       "50% активация",
      description: "Уровень активации портфеля ≥50%",
      earned:      activationRate >= 50,
      tier:        "silver",
    },
    {
      id: "activation-rate-80", icon: "👑",
      label:       "80% активация",
      description: "Уровень активации портфеля ≥80%",
      earned:      activationRate >= 80,
      tier:        "gold",
    },
    {
      id: "month-champion", icon: "🌟",
      label:       "5 активаций в месяц",
      description: "5+ новых активаций за текущий месяц",
      earned:      activationsThisMonth >= 5,
      tier:        "silver",
    },
    {
      id: "zero-overdue", icon: "✅",
      label:       "Нет просрочек",
      description: "Ни одной просроченной задачи",
      earned:      overdueTasks === 0 && totalClients > 0,
      tier:        "bronze",
    },
    {
      id: "total-activities-100", icon: "💼",
      label:       "100 взаимодействий",
      description: "100+ взаимодействий за всё время",
      earned:      totalActivities >= 100,
      tier:        "silver",
    },
  ];

  return achievements;
}
