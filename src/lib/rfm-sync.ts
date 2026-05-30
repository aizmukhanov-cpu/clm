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

/**
 * Возвращает triggerDay-идентификаторы задач, которые устарели при переходе
 * из oldStage → newStage. Устаревшие задачи помечаются CANCELLED.
 */
export function getObsoleteTriggers(oldStage: string, newStage: string): string[] {
  switch (`${oldStage}→${newStage}`) {
    // Клиент сделал первую транзакцию → онбординговые задачи не нужны
    case "ONBOARD→ACTIVATE":
      return ["D+1", "D+3", "D+7", "D+14"];

    // Клиент завис в ONBOARD 30+ дней → онбординг завершается, начинается реактивация
    case "ONBOARD→REACTIVATE":
      return ["D+1", "D+3", "D+7", "D+14"];

    // Клиент вернулся из реактивации → задачи реактивации не нужны
    case "REACTIVATE→ACTIVATE":
      return ["reactivation-30d", "reactivation-60d", "no-touch-30d"];

    // Клиент вырос → задачи онбординга/активации не нужны
    case "ACTIVATE→GROW":
      return ["D+1", "D+3", "D+7", "D+14", "no-touch-30d"];

    default:
      return [];
  }
}

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
      onboardedAt:      true,
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
      const newSizeCategory = calcSizeCategory(c.gmv30d) as SizeCategoryKey;

      // Для ONBOARD-клиентов: если 30+ дней после онбординга и ни одной транзакции
      // → переводим в REACTIVATE (клиент завис, нужна реактивация).
      // calcStageTransition не знает об onboardedAt, обрабатываем здесь отдельно.
      const ONBOARD_STALL_DAYS = 30;
      const daysSinceOnboard   = c.onboardedAt
        ? Math.floor((now.getTime() - new Date(c.onboardedAt).getTime()) / 86_400_000)
        : -1;
      const onboardStalled =
        c.clmStage === "ONBOARD" &&
        c.txnCount30d === 0 &&
        daysSinceOnboard >= ONBOARD_STALL_DAYS;

      const newStage = onboardStalled
        ? ("REACTIVATE" as StageKey)
        : calcStageTransition(snapshot); // null = no change

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

        // Отменяем задачи устаревшие после смены стадии
        const obsolete = getObsoleteTriggers(c.clmStage as StageKey, newStage!);
        if (obsolete.length > 0) {
          await db.task.updateMany({
            where: {
              clientId:   c.id,
              triggerDay: { in: obsolete },
              status:     { in: ["PENDING", "OVERDUE"] },
            },
            data: {
              status: "CANCELLED",
              result: `Авто-отмена: стадия изменена ${c.clmStage} → ${newStage}`,
            },
          });
        }

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
