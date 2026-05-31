"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UserRole, CLMCohort } from "@/generated/prisma/client";
import { teamWorkFilter } from "@/lib/access";

export type ReactivationFilters = {
  search?: string;
  minDays?: number;
  managerId?: string;
  stage?: string;
  page?: number;
};

const PAGE_SIZE = 50;

export async function getReactivationList(filters: ReactivationFilters = {}) {
  const session = await getSession();
  if (!session) return { clients: [], total: 0, pages: 0, managers: [] };

  const page = filters.page ?? 1;
  const skip = (page - 1) * PAGE_SIZE;

  // Reactivation = LAPSED cohort or REACTIVATE stage
  const where: Record<string, unknown> = {
    isArchived: false,
    AND: [
      { OR: [{ clmCohort: CLMCohort.LAPSED }, { clmStage: "REACTIVATE" }] },
      teamWorkFilter(session), // KAM-8: KAM видит только своих, SPECIALIST — только своих
    ],
  };

  if (filters.search) {
    where.AND = [
      {
        OR: [
          { inn:  { contains: filters.search, mode: "insensitive" } },
          { name: { contains: filters.search, mode: "insensitive" } },
        ],
      },
    ];
  }
  if (filters.minDays) {
    where.daysSinceLastTxn = { gte: filters.minDays };
  }
  // Фильтр по менеджеру доступен только admin/analyst
  if ((session.role === "ADMIN" || session.role === "ANALYST") &&
      filters.managerId && filters.managerId !== "ALL") {
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

  const managers =
    session.role === "SPECIALIST" || session.role === "KAM"
      ? []
      : await db.user.findMany({
          where: { role: { in: ["SPECIALIST", "SUPERVISOR"] } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });

  const stats = {
    total: await db.client.count({
      where: { isArchived: false, OR: [{ clmCohort: CLMCohort.LAPSED }, { clmStage: "REACTIVATE" }] },
    }),
    over90: await db.client.count({
      where: {
        isArchived: false,
        OR: [{ clmCohort: CLMCohort.LAPSED }, { clmStage: "REACTIVATE" }],
        daysSinceLastTxn: { gte: 90 },
      },
    }),
    noContact: await db.client.count({
      where: {
        isArchived: false,
        OR: [{ clmCohort: CLMCohort.LAPSED }, { clmStage: "REACTIVATE" }],
        activities: { none: {} },
      },
    }),
  };

  return { clients, total, pages: Math.ceil(total / PAGE_SIZE), managers, stats };
}
