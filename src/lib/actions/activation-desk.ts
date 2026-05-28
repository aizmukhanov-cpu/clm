"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CLMStage } from "@/generated/prisma/client";
import { taskScopeFilter, hasGlobalAccess } from "@/lib/access";

export type DeskFilters = {
  priority?:   string;
  triggerDay?: string;
  assignedTo?: string;
  status?:     string;
};

export async function getDeskTasks(filters: DeskFilters = {}) {
  const session = await getSession();
  if (!session) return { tasks: [], stats: { total: 0, overdue: 0, p1: 0 }, assignees: [] };

  const now = new Date();

  // Client-level filter: только релевантные стадии
  const clientFilter: Record<string, unknown> = {
    isArchived: false,
    clmStage: { in: [CLMStage.ONBOARD, CLMStage.ACTIVATE] },
  };

  const where: Record<string, unknown> = {
    client: clientFilter,
    // Ограничение по роли: кто видит чьи задачи
    ...taskScopeFilter(session),
  };

  if (filters.priority   && filters.priority   !== "ALL") where.priority   = filters.priority;
  if (filters.triggerDay && filters.triggerDay !== "ALL") where.triggerDay = filters.triggerDay;

  // Фильтр по исполнителю — только для ролей с широким доступом
  if (filters.assignedTo && filters.assignedTo !== "ALL" && hasGlobalAccess(session)) {
    where.assignedTo = filters.assignedTo;
  }

  // Фильтр по статусу
  if (filters.status === "DONE") {
    where.status = "DONE";
  } else if (filters.status === "PENDING") {
    where.status = { not: "DONE" };
  } else if (filters.status === "OVERDUE") {
    where.status = { not: "DONE" };
    where.dueDate = { lt: now };
  } else if (filters.status === "ESCALATED") {
    where.status = "ESCALATED";
  } else if (filters.status === "TODAY") {
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(now); endOfDay.setHours(23, 59, 59, 999);
    where.dueDate = { gte: startOfDay, lte: endOfDay };
  }
  // ALL — показываем всё (включая DONE)

  const tasks = await db.task.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, inn: true, clmStage: true } },
      user:   { select: { id: true, name: true } },
    },
    orderBy: [
      { status: "asc" },   // DONE в конец
      { priority: "asc" },
      { dueDate: "asc" },
    ],
    take: 300,
  });

  // Статистика по открытым задачам (с учётом личного скоупа)
  const openTasks = await db.task.findMany({
    where: {
      status: { not: "DONE" },
      client: clientFilter,
      ...taskScopeFilter(session),
    },
    select: { priority: true, dueDate: true },
  });

  const stats = {
    total:   openTasks.length,
    overdue: openTasks.filter((t) => new Date(t.dueDate) < now).length,
    p1:      openTasks.filter((t) => t.priority === "P1").length,
  };

  // Список исполнителей для фильтра — только глобальный доступ
  const assignees = hasGlobalAccess(session)
    ? await db.user.findMany({
        where: { role: { in: ["SPECIALIST", "KAM", "SUPERVISOR", "TEAM_LEAD"] } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return { tasks, stats, assignees };
}
