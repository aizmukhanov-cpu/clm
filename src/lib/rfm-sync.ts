/**
 * RFM-D Cohort & Stage Auto-Sync (Cron version)
 *
 * Runs nightly via POST /api/cron/rfm-sync without a user session.
 * Uses the SAME rules as the manual admin sync (calcCohort / calcStageTransition
 * from clm-rules.ts) so behaviour is always consistent.
 *
 * Additionally:
 *  - Computes and stores sizeCategory (SMALL/MEDIUM/LARGE) from gmv30d × 12
 *  - Sets activatedAt on the first transition into ACTIVATE stage
 *    (and backfills it for existing ACTIVATE/GROW clients with no activatedAt)
 */

import { db } from "@/lib/db";
import { calcCohort, calcStageTransition, calcSizeCategory } from "@/lib/clm-rules";
import type { CohortKey, StageKey, SizeCategoryKey } from "@/lib/clm-rules";

export type RFMResult = {
  updated:     number;
  stageShifts: number;
  errors:      string[];
};

export async function runRFMSync(): Promise<RFMResult> {
  const result: RFMResult = { updated: 0, stageShifts: 0, errors: [] };

  // Resolve a system user for changelog attribution
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
      sizeCategory:     true,
      activatedAt:      true,
    },
  });

  const now = new Date();

  for (const c of clients) {
    try {
      const snapshot = {
        clmStage:         c.clmStage  as StageKey,
        clmCohort:        c.clmCohort as CohortKey,
        txnCount30d:      c.txnCount30d,
        gmv30d:           c.gmv30d,
        daysSinceLastTxn: c.daysSinceLastTxn,
      };

      const newCohort       = calcCohort(snapshot);
      const newStage        = calcStageTransition(snapshot); // null = no change
      const newSizeCategory = calcSizeCategory(c.gmv30d) as SizeCategoryKey;

      const cohortChanged = newCohort !== c.clmCohort;
      const stageChanged  = newStage !== null && newStage !== c.clmStage;
      const sizeChanged   = newSizeCategory !== c.sizeCategory;

      // Set activatedAt when:
      //  a) client is transitioning into ACTIVATE now for the first time, OR
      //  b) client is already in ACTIVATE/GROW but activatedAt was never set (backfill)
      const enteringActivate = stageChanged && newStage === "ACTIVATE";
      const alreadyActiveNoDate =
        !stageChanged &&
        (c.clmStage === "ACTIVATE" || c.clmStage === "GROW") &&
        c.activatedAt === null;
      const setActivatedAt = (enteringActivate || alreadyActiveNoDate) && c.activatedAt === null;

      if (!cohortChanged && !stageChanged && !sizeChanged && !setActivatedAt) continue;

      const data: Record<string, unknown> = {};
      if (cohortChanged)  data.clmCohort    = newCohort;
      if (stageChanged)   data.clmStage     = newStage!;
      if (sizeChanged)    data.sizeCategory = newSizeCategory;
      if (setActivatedAt) data.activatedAt  = now;

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
