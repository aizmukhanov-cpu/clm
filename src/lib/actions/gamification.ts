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
  activations:     number;
  activities:      number;
  activationRate:  number;
  score:           number;      // composite score for ranking
  medal:           "🥇" | "🥈" | "🥉" | null;
  trend:           "up" | "down" | "same";
};

/** Composite score = activations×10 + activities×1 + activationRate×0.5 */
function calcScore(activations: number, activities: number, activationRate: number): number {
  return Math.round(activations * 10 + activities + activationRate * 0.5);
}

export async function getLeaderboard(): Promise<LeaderboardEntry[] | null> {
  const session = await getSession();
  if (!session) return null;

  // Only ADMIN, DIRECTOR, ANALYST, TEAM_LEAD can see leaderboard
  if (!["ADMIN", "DIRECTOR", "ANALYST", "TEAM_LEAD"].includes(session.role)) return null;

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const managers = await db.user.findMany({
    where: { role: { in: ["SPECIALIST", "KAM"] } },
    select: { id: true, name: true, team: true },
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
    const score = calcScore(activations, activities, activationRate);
    const trend: "up" | "down" | "same" =
      activations > prevActivations ? "up" :
      activations < prevActivations ? "down" : "same";

    entries.push({
      rank:           0,
      userId:         mgr.id,
      name:           mgr.name,
      team:           mgr.team,
      activations,
      activities,
      activationRate,
      score,
      medal:          null,
      trend,
    });
  }

  // Sort by score descending
  entries.sort((a, b) => b.score - a.score);

  // Assign ranks and medals
  entries.forEach((e, idx) => {
    e.rank  = idx + 1;
    e.medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
  });

  return entries;
}

export async function getMyAchievements(): Promise<Achievement[] | null> {
  const session = await getSession();
  if (!session) return null;

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
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
      where: { assignedTo: session.id, status: { not: "DONE" }, dueDate: { lt: now } },
    }),
  ]);

  const activationRate = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0;

  const achievements: Achievement[] = [
    {
      id:          "first-activation",
      icon:        "🚀",
      label:       "Первая активация",
      description: "Активировал первого клиента",
      earned:      totalActivations >= 1,
      tier:        "bronze",
    },
    {
      id:          "activations-10",
      icon:        "⚡",
      label:       "10 активаций",
      description: "Активировал 10+ клиентов всего",
      earned:      totalActivations >= 10,
      tier:        "silver",
    },
    {
      id:          "activations-50",
      icon:        "🏆",
      label:       "50 активаций",
      description: "Активировал 50+ клиентов",
      earned:      totalActivations >= 50,
      tier:        "gold",
    },
    {
      id:          "activity-streak-20",
      icon:        "📞",
      label:       "20 контактов за месяц",
      description: "Провёл 20+ взаимодействий в одном месяце",
      earned:      activitiesThisMonth >= 20,
      tier:        "bronze",
    },
    {
      id:          "activity-streak-50",
      icon:        "🔥",
      label:       "50 контактов за месяц",
      description: "Провёл 50+ взаимодействий в одном месяце",
      earned:      activitiesThisMonth >= 50,
      tier:        "gold",
    },
    {
      id:          "activation-rate-50",
      icon:        "💪",
      label:       "50% активация",
      description: "Уровень активации портфеля ≥50%",
      earned:      activationRate >= 50,
      tier:        "silver",
    },
    {
      id:          "activation-rate-80",
      icon:        "👑",
      label:       "80% активация",
      description: "Уровень активации портфеля ≥80%",
      earned:      activationRate >= 80,
      tier:        "gold",
    },
    {
      id:          "month-champion",
      icon:        "🌟",
      label:       "5 активаций в месяц",
      description: "5+ новых активаций за текущий месяц",
      earned:      activationsThisMonth >= 5,
      tier:        "silver",
    },
    {
      id:          "zero-overdue",
      icon:        "✅",
      label:       "Нет просрочек",
      description: "Ни одной просроченной задачи",
      earned:      overdueTasks === 0 && totalClients > 0,
      tier:        "bronze",
    },
    {
      id:          "total-activities-100",
      icon:        "💼",
      label:       "100 взаимодействий",
      description: "100+ взаимодействий за всё время",
      earned:      totalActivities >= 100,
      tier:        "silver",
    },
  ];

  return achievements;
}
