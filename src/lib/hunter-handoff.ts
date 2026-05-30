/**
 * Hunter → Farmer Handoff Engine
 *
 * B2B and KM teams are "hunters" — they acquire new clients.
 * After a client has been in ACTIVATE or GROW stage for HANDOFF_DAYS (60 days),
 * they are automatically transferred to a "farmer" team:
 *
 *   SMALL  (annual GMV < 10M KGS)   — B2B segment  → BRANCH (branch-level service)
 *   MEDIUM (annual GMV 10–100M KGS) — KM segment   → VB     (business vertical)
 *   LARGE  (annual GMV ≥ 100M KGS)  — KAM segment  → KAM    (key account management)
 *
 * Handoff conditions (all must be true):
 *   ✓ Client in ACTIVATE or GROW stage
 *   ✓ activatedAt is at least HANDOFF_DAYS ago
 *   ✓ handoffDoneAt is null (not yet transferred)
 *   ✓ Current manager belongs to B2B or KM team
 *
 * Target manager selection:
 *   1. Prefer same branch (for BRANCH/VB targets)
 *   2. Pick user with fewest currently managed ACTIVATE/GROW clients (lightest load)
 *   3. Fall back to any available user in target team if no same-branch match
 *
 * For LARGE clients (→ KAM):
 *   - Sets kamId = target KAM
 *   - Sets managerId = null (KAM is the primary owner)
 *
 * For SMALL/MEDIUM clients (→ BRANCH/VB):
 *   - Sets managerId = target farmer
 *   - kamId is unchanged
 */

import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications";
import { createNotification } from "@/lib/notify";
import { calcSizeCategory, HANDOFF_TARGET_TEAM, HANDOFF_DAYS } from "@/lib/clm-rules";
import type { SizeCategoryKey } from "@/lib/clm-rules";

export type HandoffResult = {
  transferred: number;
  skipped:     number;
  errors:      string[];
  log:         string[];
};

export async function runHunterHandoff(): Promise<HandoffResult> {
  const result: HandoffResult = { transferred: 0, skipped: 0, errors: [], log: [] };

  const systemUser = await db.user.findFirst({
    where: { email: "clm-automation" },
    select: { id: true },
  }) ?? await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - HANDOFF_DAYS);

  // Clients ready for handoff
  const candidates = await db.client.findMany({
    where: {
      isArchived:    false,
      clmStage:      { in: ["ACTIVATE", "GROW"] },
      activatedAt:   { not: null, lte: cutoff },
      handoffDoneAt: null,
      manager: {
        team: { in: ["B2B", "KM"] },
      },
    },
    select: {
      id:           true,
      name:         true,
      branchId:     true,
      gmv30d:       true,
      sizeCategory: true,
      managerId:    true,
      kamId:        true,
      manager: {
        select: { id: true, name: true, team: true },
      },
    },
  });

  if (candidates.length === 0) return result;

  // Load all farmer users with their current active-client load
  const farmers = await db.user.findMany({
    where: { team: { in: ["BRANCH", "VB", "KAM"] } },
    select: {
      id:       true,
      name:     true,
      team:     true,
      branchId: true,
      _count: {
        select: {
          managedClients: {
            where: { isArchived: false, clmStage: { in: ["ACTIVATE", "GROW"] } },
          },
        },
      },
    },
  });

  // Build mutable load map (keeps load accurate within a single run)
  const loadMap = new Map<string, number>(
    farmers.map(f => [f.id, f._count.managedClients])
  );

  const now = new Date();

  for (const client of candidates) {
    try {
      const sizeCategory = (client.sizeCategory ?? calcSizeCategory(client.gmv30d)) as SizeCategoryKey;
      const targetTeam   = HANDOFF_TARGET_TEAM[sizeCategory];
      const isKAM        = targetTeam === "KAM";

      // Select target: same branch first (for BRANCH/VB), then global; lightest load wins
      const sameBranch = farmers.filter(
        f => f.team === targetTeam && f.branchId === client.branchId
      );
      const global = farmers.filter(f => f.team === targetTeam);
      const pool = sameBranch.length > 0 ? sameBranch : global;

      if (pool.length === 0) {
        result.skipped++;
        result.log.push(`⚠️  ${client.name} [${sizeCategory}]: нет менеджеров команды ${targetTeam}`);
        continue;
      }

      const target = pool.reduce((best, f) =>
        (loadMap.get(f.id) ?? 0) <= (loadMap.get(best.id) ?? 0) ? f : best
      );

      const oldManagerId   = client.managerId;
      const oldManagerName = client.manager?.name ?? "—";
      const oldTeam        = client.manager?.team ?? "?";

      // ── Apply handoff ──────────────────────────────────────
      const updateData: Record<string, unknown> = { handoffDoneAt: now };

      if (isKAM) {
        updateData.kamId     = target.id;
        updateData.managerId = null;
      } else {
        updateData.managerId = target.id;
      }

      await db.client.update({ where: { id: client.id }, data: updateData as never });

      // ── Changelog ─────────────────────────────────────────
      if (systemUser) {
        // Main handoff record
        await db.changelog.create({
          data: {
            clientId:  client.id,
            changedBy: systemUser.id,
            field:     "handoff",
            oldVal:    `${oldTeam} / ${oldManagerName}`,
            newVal:    `${targetTeam} / ${target.name}`,
          },
        });

        if (isKAM) {
          await db.changelog.create({
            data: {
              clientId:  client.id,
              changedBy: systemUser.id,
              field:     "kamId",
              oldVal:    client.kamId ?? null,
              newVal:    target.id,
            },
          });
          if (oldManagerId) {
            await db.changelog.create({
              data: {
                clientId:  client.id,
                changedBy: systemUser.id,
                field:     "managerId",
                oldVal:    oldManagerId,
                newVal:    null,
              },
            });
          }
        } else {
          await db.changelog.create({
            data: {
              clientId:  client.id,
              changedBy: systemUser.id,
              field:     "managerId",
              oldVal:    oldManagerId ?? null,
              newVal:    target.id,
            },
          });
        }
      }

      // Переназначаем открытые задачи от старого менеджера новому
      if (oldManagerId) {
        await db.task.updateMany({
          where: {
            clientId:   client.id,
            assignedTo: oldManagerId,
            status:     { in: ["PENDING", "OVERDUE"] },
          },
          data: { assignedTo: target.id },
        });
      }

      // In-app уведомление старому КМ о передаче
      if (oldManagerId) {
        await createNotification({
          userId: oldManagerId,
          type:   "client_assigned",
          title:  `Клиент передан: ${client.name}`,
          body:   `Передан в команду ${targetTeam} → ${target.name}`,
          href:   `/clients/${client.id}`,
        });
      }
      // Уведомление новому менеджеру о новом клиенте
      await createNotification({
        userId: target.id,
        type:   "client_assigned",
        title:  `Новый клиент: ${client.name}`,
        body:   `Передан от ${oldManagerName} (${oldTeam})`,
        href:   `/clients/${client.id}`,
      });

      // Update in-memory load counter so subsequent picks stay balanced
      loadMap.set(target.id, (loadMap.get(target.id) ?? 0) + 1);

      result.transferred++;
      result.log.push(
        `✅ ${client.name} [${sizeCategory}]: ${oldManagerName} (${oldTeam}) → ${target.name} (${targetTeam})`
      );
    } catch (e) {
      result.errors.push(`${client.id}: ${String(e)}`);
    }
  }

  // ── Telegram summary ──────────────────────────────────────
  if (result.transferred > 0 || result.skipped > 0) {
    const lines = result.log.slice(0, 8).join("\n");
    await sendNotification(
      `🔀 <b>Hunter Handoff</b>: передано ${result.transferred} клиентов` +
      (result.skipped > 0 ? `, пропущено ${result.skipped} (нет фермера)` : "") +
      `\n\n${lines}` +
      (result.log.length > 8 ? `\n…ещё ${result.log.length - 8}` : "")
    );
  }

  return result;
}
