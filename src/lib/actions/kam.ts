"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";
import { clientAccessWhere } from "@/lib/access";

export type KAMFilters = {
  search?: string;
  cohort?: string;
  kamId?: string;
  page?: number;
};

const PAGE_SIZE = 40;

export async function getKAMPortfolio(filters: KAMFilters = {}) {
  const session = await getSession();
  if (!session) return { clients: [], total: 0, pages: 0, kams: [], stats: [] };

  const page = filters.page ?? 1;
  const skip = (page - 1) * PAGE_SIZE;

  // Base: clients with KAM assigned + team-level access
  const where: Record<string, unknown> = {
    isArchived: false,
    kamId: { not: null },
    ...clientAccessWhere(session),  // ADMIN/ANALYST → все; KAM_ROLE → свои; MANAGER → своя команда
  };

  if (filters.search) {
    where.OR = [
      { inn:  { contains: filters.search, mode: "insensitive" } },
      { name: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.cohort && filters.cohort !== "ALL") where.clmCohort = filters.cohort;

  // KAM filter: только admin/analyst может фильтровать по конкретному KAM
  if (filters.kamId && filters.kamId !== "ALL" &&
      session.role !== "KAM") {
    where.kamId = filters.kamId;
  }

  const [clients, total] = await Promise.all([
    db.client.findMany({
      where,
      include: {
        branch:  { select: { name: true } },
        manager: { select: { name: true } },
        kam:     { select: { id: true, name: true } },
        tasks: {
          where: { status: { not: "DONE" } },
          orderBy: { dueDate: "asc" },
          take: 1,
        },
        _count: { select: { activities: true } },
      },
      orderBy: [{ clmCohort: "asc" }, { daysSinceLastTxn: "desc" }],
      skip,
      take: PAGE_SIZE,
    }),
    db.client.count({ where }),
  ]);

  // Список KAM для фильтра — только admin/analyst
  const isPersonal = session.role === "KAM" || session.role === "SPECIALIST";
  const kams = isPersonal
    ? []
    : await db.user.findMany({
        where: { role: "KAM" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

  // Portfolio stats — same access scope
  const statsWhere: Record<string, unknown> = {
    isArchived: false,
    kamId: { not: null },
    ...clientAccessWhere(session),
  };

  const stats = await db.client.groupBy({
    by: ["clmCohort"],
    where: statsWhere,
    _count: { id: true },
    _avg: { gmv30d: true },
  });

  return { clients, total, pages: Math.ceil(total / PAGE_SIZE), kams, stats };
}
