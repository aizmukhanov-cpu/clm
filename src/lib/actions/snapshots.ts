"use server";

import { db } from "@/lib/db";

/* ─── Захват снимка ─────────────────────────────────────────
 * Вызывается в конце каждого CLM-sync (и доступен вручную ADMIN-у).
 * Использует upsert по (snapshotDate, team) — idempotent.
 */
export async function capturePortfolioSnapshot() {
  const now = new Date();
  // Начало сегодняшнего дня в UTC
  const snapshotDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const weekAgo = new Date(snapshotDate);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const base = { isArchived: false };

  const [total, active, atRisk, lapsed, activitiesWeek] = await Promise.all([
    db.client.count({ where: base }),
    db.client.count({ where: { ...base, txnCount30d: { gte: 1 }, gmv30d: { gt: 100 } } }),
    db.client.count({ where: { ...base, txnCount30d: 0, daysSinceLastTxn: { gte: 1, lte: 60 } } }),
    db.client.count({ where: { ...base, txnCount30d: 0, daysSinceLastTxn: { gt: 60 } } }),
    db.activity.count({ where: { performedAt: { gte: weekAgo, lt: snapshotDate } } }),
  ]);

  const activationRate = total > 0 ? Math.round((active / total) * 100 * 10) / 10 : 0;

  await db.portfolioSnapshot.upsert({
    where:  { snapshotDate_team: { snapshotDate, team: "__all__" } },
    create: { snapshotDate, team: "__all__", totalClients: total, activeClients: active, atRiskClients: atRisk, lapsedClients: lapsed, activationRate, activitiesWeek },
    update: { totalClients: total, activeClients: active, atRiskClients: atRisk, lapsedClients: lapsed, activationRate, activitiesWeek },
  });

  return { snapshotDate, totalClients: total, activeClients: active, activationRate };
}

/* ─── История снимков ────────────────────────────────────── */
export async function getSnapshotHistory(weeks = 12): Promise<SnapshotPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);

  const rows = await db.portfolioSnapshot.findMany({
    where:   { team: "__all__", snapshotDate: { gte: since } },
    orderBy: { snapshotDate: "asc" },
    select: {
      snapshotDate:  true,
      totalClients:  true,
      activeClients: true,
      atRiskClients: true,
      activationRate: true,
      activitiesWeek: true,
    },
  });

  return rows.map((r) => ({
    date:           r.snapshotDate,
    totalClients:   r.totalClients,
    activeClients:  r.activeClients,
    atRiskClients:  r.atRiskClients,
    activationRate: r.activationRate,
    activitiesWeek: r.activitiesWeek,
  }));
}

export type SnapshotPoint = {
  date:           Date;
  totalClients:   number;
  activeClients:  number;
  atRiskClients:  number;
  activationRate: number;
  activitiesWeek: number;
};
