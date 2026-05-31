"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CLMCohort } from "@/generated/prisma/client";
import { teamWorkFilter, hasGlobalAccess } from "@/lib/access";

export type ReactivationFilters = {
  search?: string;
  minDays?: number;
  managerId?: string;
  stage?: string;
  page?: number;
};

const PAGE_SIZE = 50;

/**
 * VB (Virtual Branch) — выделенная команда реактивации.
 * Сотрудники колл-центра работают со ВСЕМИ лапсед/REACTIVATE клиентами банка,
 * а не только с теми, кто закреплён за ними лично.
 *
 * Для всех остальных ролей применяется стандартный teamWorkFilter:
 *   KAM         → только свои KAM-клиенты
 *   SPECIALIST  → только свои клиенты (managerId = me)
 *   SUPERVISOR  → свои + подчинённых
 *   TEAM_LEAD   → вся своя команда
 */
function reactivationScopeFilter(session: {
  role: string;
  team?: string | null;
  id: string;
  name: string;
  email: string;
}): Record<string, unknown> {
  if (hasGlobalAccess(session as Parameters<typeof hasGlobalAccess>[0])) return {};
  if (session.team === "VB") return {}; // VB видит всех — это их работа
  return teamWorkFilter(session as Parameters<typeof teamWorkFilter>[0]);
}

export async function getReactivationList(filters: ReactivationFilters = {}) {
  const session = await getSession();
  if (!session) return { clients: [], total: 0, pages: 0, managers: [] };

  const page = filters.page ?? 1;
  const skip = (page - 1) * PAGE_SIZE;

  const scopeFilter = reactivationScopeFilter(session);

  // Reactivation = LAPSED cohort or REACTIVATE stage
  const where: Record<string, unknown> = {
    isArchived: false,
    AND: [
      { OR: [{ clmCohort: CLMCohort.LAPSED }, { clmStage: "REACTIVATE" }] },
      scopeFilter,
    ],
  };

  if (filters.search) {
    // Расширяем AND, не заменяем — иначе теряются scope и LAPSED/REACTIVATE фильтр
    (where.AND as unknown[]).push({
      OR: [
        { inn:  { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  }
  if (filters.minDays) {
    where.daysSinceLastTxn = { gte: filters.minDays };
  }

  // Фильтр по менеджеру: admin/analyst — полный выбор;
  // VB — тоже, т.к. они видят всех и могут захотеть отфильтровать «клиенты KM-команды».
  const canFilterByManager =
    session.role === "ADMIN" || session.role === "ANALYST" || session.team === "VB";
  if (canFilterByManager && filters.managerId && filters.managerId !== "ALL") {
    where.managerId = filters.managerId;
  }

  const [clients, total] = await Promise.all([
    db.client.findMany({
      where,
      include: {
        branch:  { select: { name: true } },
        manager: { select: { name: true } },
        kam:     { select: { name: true } },
        tasks: {
          where: { status: { notIn: ["DONE", "CANCELLED"] as const } },
          orderBy: { dueDate: "asc" },
          take: 1,
        },
        activities: {
          orderBy: { performedAt: "desc" },
          take: 1,
          select: { performedAt: true, type: true, result: true },
        },
      },
      orderBy: { daysSinceLastTxn: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.client.count({ where }),
  ]);

  // Менеджеры для фильтра:
  //   admin/analyst — полный список;
  //   VB — полный список (видят всех клиентов → нужен фильтр по менеджеру);
  //   остальные SPECIALIST/KAM — пустой (они видят только своих).
  const needsManagerList =
    session.role !== "SPECIALIST" && session.role !== "KAM" || session.team === "VB";
  const managers = needsManagerList
    ? await db.user.findMany({
        where: { role: { in: ["SPECIALIST", "SUPERVISOR"] } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Статистика использует тот же scope что и список.
  // VB видит глобальную статистику (это их рабочая очередь).
  const baseStatWhere = {
    isArchived: false,
    AND: [
      { OR: [{ clmCohort: CLMCohort.LAPSED }, { clmStage: "REACTIVATE" }] },
      scopeFilter,
    ],
  };

  const stats = {
    total: await db.client.count({ where: baseStatWhere }),
    over90: await db.client.count({
      where: { ...baseStatWhere, daysSinceLastTxn: { gte: 90 } },
    }),
    noContact: await db.client.count({
      where: { ...baseStatWhere, activities: { none: {} } },
    }),
  };

  return { clients, total, pages: Math.ceil(total / PAGE_SIZE), managers, stats };
}
