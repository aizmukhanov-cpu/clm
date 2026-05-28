/**
 * RFM-D Cohort & Stage Auto-Sync (Cron version)
 *
 * Runs nightly via POST /api/cron/rfm-sync without a user session.
 * Uses the SAME rules as the manual admin sync (calcCohort / calcStageTransition
 * from clm-rules.ts) so behaviour is always consistent.
 *
 * The admin page (/admin/clm-rules) runs runCLMSync() which requires an
 * authenticated ADMIN session. This function is the session-less equivalent
 * for cron use.
 */

import { db } from "@/lib/db";
import { calcCohort, calcStageTransition } from "@/lib/clm-rules";
import type { CohortKey, StageKey } from "@/lib/clm-rules";

export type RFMResult = {
  updated:     number;
  stageShifts: number;
  errors:      string[];
};

export async function runRFMSync(): Promise<RFMResult> {
  const result: RFMResult = { updated: 0, stageShifts: 0, errors: [] };

  // Resolve a system user for changelog attribution
  // (looks for "clm-automation" user, falls back to first ADMIN)
  const systemUser = await db.user.findFirst({
    where: { email: "clm-automation" },
    select: { id: true },
  }) ?? await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  const clients = await db.client.findMany({
    where: {
      isArchived: false,
      clmStage: { not: "ACQUIRE" }, // ACQUIRE is manual-only
    },
    select: {
      id:               true,
      clmCohort:        true,
      clmStage:         true,
      daysSinceLastTxn: true,
      txnCount30d:      true,
      gmv30d:           true,
    },
  });

  for (const c of clients) {
    try {
      const snapshot = {
        clmStage:         c.clmStage  as StageKey,
        clmCohort:        c.clmCohort as CohortKey,
        txnCount30d:      c.txnCount30d,
        gmv30d:           c.gmv30d,
        daysSinceLastTxn: c.daysSinceLastTxn,
      };

      const newCohort = calcCohort(snapshot);
      const newStage  = calcStageTransition(snapshot); // null = no change

      const cohortChanged = newCohort !== c.clmCohort;
      const stageChanged  = newStage !== null && newStage !== c.clmStage;

      if (!cohortChanged && !stageChanged) continue;

      const data: Record<string, string> = {};
      if (cohortChanged) data.clmCohort = newCohort;
      if (stageChanged)  data.clmStage  = newStage!;

      await db.client.update({ where: { id: c.id }, data: data as never });

      if (stageChanged) {
        result.stageShifts++;
        if (systemUser) {
          await db.changelog.create({
            data: {
              clientId:  c.id,
              changedBy: systemUser.id,
              field:     "clmStage",
              oldVal:    c.clmStage,
              newVal:    newStage!,
            },
          });
        }
      }

      result.updated++;
    } catch (e) {
      result.errors.push(`${c.id}: ${String(e)}`);
    }
  }

  return result;
}
