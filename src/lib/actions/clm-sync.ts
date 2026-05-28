"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UserRole, CLMStage, CLMCohort } from "@/generated/prisma/client";
import { calcCohort, calcStageTransition } from "@/lib/clm-rules";
import type { CohortKey, StageKey } from "@/lib/clm-rules";

export type SyncResult = {
  error?: string;
  total: number;
  stageUpdated: number;
  cohortUpdated: number;
  skipped: number;
  durationMs: number;
  details: SyncDetail[];
};

export type SyncDetail = {
  clientId: string;
  clientName: string;
  inn: string;
  stageFrom?: StageKey;
  stageTo?: StageKey;
  cohortFrom?: CohortKey;
  cohortTo?: CohortKey;
};

// System user placeholder for changelog entries created by automation
const SYSTEM_USER_TAG = "clm-automation";

/**
 * Запускает ночную синхронизацию CLM-стадий и когорт.
 * Доступно только для ADMIN и ANALYST.
 *
 * Алгоритм:
 * 1. Загружаем всех не-архивных клиентов (кроме ACQUIRE — ручной переход)
 * 2. Для каждого считаем новую когорту и новую стадию через clm-rules
 * 3. Если что-то изменилось — обновляем в БД + пишем Changelog
 * 4. Возвращаем статистику
 */
export async function runCLMSync(): Promise<SyncResult> {
  const t0 = Date.now();
  const session = await getSession();
  if (!session) return emptyResult("Не авторизован", t0);
  if (session.role !== UserRole.ADMIN && session.role !== UserRole.ANALYST) {
    return emptyResult("Недостаточно прав", t0);
  }

  const clients = await db.client.findMany({
    where: {
      isArchived: false,
      clmStage: { not: CLMStage.ACQUIRE }, // ACQUIRE — только ручной переход
    },
    select: {
      id: true,
      name: true,
      inn: true,
      clmStage: true,
      clmCohort: true,
      txnCount30d: true,
      gmv30d: true,
      daysSinceLastTxn: true,
    },
  });

  // Find or create the system user for changelog entries
  let systemUserId = session.id; // fallback to current user
  const systemUser = await db.user.findFirst({
    where: { email: SYSTEM_USER_TAG },
    select: { id: true },
  });
  if (systemUser) systemUserId = systemUser.id;

  let stageUpdated = 0;
  let cohortUpdated = 0;
  let skipped = 0;
  const details: SyncDetail[] = [];

  for (const client of clients) {
    const snapshot = {
      clmStage:        client.clmStage as StageKey,
      clmCohort:       client.clmCohort as CohortKey,
      txnCount30d:     client.txnCount30d,
      gmv30d:          client.gmv30d,
      daysSinceLastTxn: client.daysSinceLastTxn,
    };

    const newCohort = calcCohort(snapshot);
    const newStage  = calcStageTransition(snapshot); // null = no change

    const cohortChanged = newCohort !== client.clmCohort;
    const stageChanged  = newStage !== null && newStage !== client.clmStage;

    if (!cohortChanged && !stageChanged) {
      skipped++;
      continue;
    }

    const detail: SyncDetail = {
      clientId:   client.id,
      clientName: client.name,
      inn:        client.inn,
    };

    const updateData: Record<string, unknown> = {};
    const changelogEntries: Array<{
      clientId: string;
      changedBy: string;
      field: string;
      oldVal: string;
      newVal: string;
    }> = [];

    if (cohortChanged) {
      detail.cohortFrom = client.clmCohort as CohortKey;
      detail.cohortTo   = newCohort;
      updateData.clmCohort = newCohort as CLMCohort;
      changelogEntries.push({
        clientId:  client.id,
        changedBy: systemUserId,
        field:     "clmCohort",
        oldVal:    client.clmCohort,
        newVal:    newCohort,
      });
      cohortUpdated++;
    }

    if (stageChanged && newStage) {
      detail.stageFrom = client.clmStage as StageKey;
      detail.stageTo   = newStage;
      updateData.clmStage = newStage as CLMStage;
      changelogEntries.push({
        clientId:  client.id,
        changedBy: systemUserId,
        field:     "clmStage",
        oldVal:    client.clmStage,
        newVal:    newStage,
      });
      stageUpdated++;
    }

    // Run update + changelog in a transaction
    await db.$transaction([
      db.client.update({
        where: { id: client.id },
        data:  updateData,
      }),
      ...changelogEntries.map((e) => db.changelog.create({ data: e })),
    ]);

    details.push(detail);
  }

  return {
    total:          clients.length,
    stageUpdated,
    cohortUpdated,
    skipped,
    durationMs:     Date.now() - t0,
    details,
  };
}

function emptyResult(error: string, t0: number): SyncResult {
  return { error, total: 0, stageUpdated: 0, cohortUpdated: 0, skipped: 0, durationMs: Date.now() - t0, details: [] };
}

/**
 * Статистика последнего состояния CLM (для отображения на странице правил).
 */
export async function getCLMStats() {
  const session = await getSession();
  if (!session) return null;

  const [stageCounts, cohortCounts, total] = await Promise.all([
    db.client.groupBy({
      by: ["clmStage"],
      where: { isArchived: false },
      _count: { id: true },
    }),
    db.client.groupBy({
      by: ["clmCohort"],
      where: { isArchived: false },
      _count: { id: true },
    }),
    db.client.count({ where: { isArchived: false } }),
  ]);

  // Last automation changelog entry
  const lastRun = await db.changelog.findFirst({
    where: { field: "clmStage", changedBy: { equals: "" } }, // placeholder
    orderBy: { changedAt: "desc" },
    select: { changedAt: true },
  }).catch(() => null);

  return {
    total,
    stageCounts:  Object.fromEntries(stageCounts.map((s) => [s.clmStage,  s._count.id])),
    cohortCounts: Object.fromEntries(cohortCounts.map((c) => [c.clmCohort, c._count.id])),
    lastRun:      lastRun?.changedAt ?? null,
  };
}
