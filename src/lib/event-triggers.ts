/**
 * Event Trigger Engine
 *
 * Checks all non-archived clients against trigger rules and creates
 * tasks + notifications when conditions are met.
 *
 * Run nightly alongside RFM sync via POST /api/cron/event-triggers.
 *
 * Each trigger has a cooldown: won't fire again for the same client
 * if a matching PENDING task already exists.
 */

import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications";

export type TriggerResult = {
  tasksCreated: number;
  triggered:    string[];
  errors:       string[];
};

type TriggerRule = {
  id:        string;         // unique rule id for dedup
  name:      string;
  priority:  "P1" | "P2" | "P3";
  condition: (c: ClientRow, existing: string[]) => boolean;
  action:    string;
  daysUntilDue: number;
  assignTo:  (c: ClientRow) => string | null; // returns userId or null
};

type ClientRow = {
  id:               string;
  name:             string;
  clmStage:         string;
  clmCohort:        string;
  daysSinceLastTxn: number;
  txnCount30d:      number;
  gmv30d:           number;
  productDepthPct:  number;
  hasMBusiness:     boolean;
  hasAcquiring:     boolean;
  hasMKassaPos:     boolean;
  hasMKassaQr:      boolean;
  hasSalaryProject: boolean;
  managerId:        string | null;
  kamId:            string | null;
  activities:       { performedAt: Date }[];
  accountPlan:      { nextMeeting: Date | null } | null;
};

const TRIGGER_RULES: TriggerRule[] = [
  // ── НИЧЕЙНЫЕ КЛИЕНТЫ (#1 P1) ─────────────────────────────
  {
    id:       "unowned-client",
    name:     "Клиент без ответственного",
    priority: "P1",
    condition: (c, existing) =>
      c.clmStage !== "ACQUIRE" &&
      !c.managerId &&
      !c.kamId &&
      !existing.includes("unowned-client"),
    action:   "⚠️ НИЧЕЙНЫЙ КЛИЕНТ: нет ответственного менеджера. Назначить менеджера срочно",
    daysUntilDue: 0,
    assignTo: () => null, // will be assigned to admin in runEventTriggers
  },

  // ── РЕАКТИВАЦИЯ ─────────────────────────────────────────
  {
    id:       "reactivation-30d",
    name:     "30 дней без транзакций",
    priority: "P2",
    condition: (c, existing) =>
      c.daysSinceLastTxn >= 30 &&
      c.clmStage !== "ACQUIRE" &&
      !existing.includes("reactivation-30d"),
    action:   "Первый звонок реактивации — выяснить причину отсутствия активности",
    daysUntilDue: 1,
    assignTo: (c) => c.managerId,
  },
  {
    id:       "reactivation-60d",
    name:     "60 дней без транзакций — P1 эскалация",
    priority: "P1",
    condition: (c, existing) =>
      c.daysSinceLastTxn >= 60 &&
      c.clmStage !== "ACQUIRE" &&
      !existing.includes("reactivation-60d"),
    action:   "P1 ЭСКАЛАЦИЯ: 60 дней без транзакций. Срочная встреча + переключить на KAM",
    daysUntilDue: 0,
    assignTo: (c) => c.kamId ?? c.managerId,
  },

  // ── КРОСС-ПРОДАЖИ ────────────────────────────────────────
  {
    id:       "cross-sell-acquiring",
    name:     "Кросс-продажа: эквайринг",
    priority: "P2",
    condition: (c, existing) =>
      (c.clmCohort === "ACTIVE" || c.clmStage === "GROW") &&
      !c.hasAcquiring && !c.hasMKassaPos && !c.hasMKassaQr &&
      c.gmv30d > 100_000 &&
      !existing.includes("cross-sell-acquiring"),
    action:   "Предложить эквайринг MKassa: клиент активен с GMV >100K, нет POS/QR",
    daysUntilDue: 3,
    assignTo: (c) => c.managerId,
  },
  {
    id:       "cross-sell-salary",
    name:     "Кросс-продажа: зарплатный проект",
    priority: "P2",
    condition: (c, existing) =>
      (c.clmCohort === "ACTIVE" || c.clmStage === "GROW") &&
      !c.hasSalaryProject &&
      c.gmv30d > 200_000 &&
      !existing.includes("cross-sell-salary"),
    action:   "Предложить зарплатный проект: GMV >200K, продукт отсутствует",
    daysUntilDue: 5,
    assignTo: (c) => c.managerId,
  },
  // cross-sell-mbusiness намеренно убран из авто-задач (P3, слишком широкое условие).
  // Рекомендация по MBusiness остаётся в NBA (nba.ts) как подсказка без создания задачи.

  // ── ACCOUNT REVIEW (KAM) ─────────────────────────────────
  {
    id:       "kam-review-60d",
    name:     "KAM Account Review просрочен",
    priority: "P1",
    condition: (c, existing) => {
      if (!c.kamId) return false;
      const lastActivity = c.activities[0];
      if (!lastActivity) return !existing.includes("kam-review-60d");
      const days = Math.floor(
        (Date.now() - new Date(lastActivity.performedAt).getTime()) / 86_400_000
      );
      return days >= 60 && !existing.includes("kam-review-60d");
    },
    action:   "Account Review: 60+ дней без контакта с KAM-клиентом. Встреча обязательна",
    daysUntilDue: 0,
    assignTo: (c) => c.kamId,
  },

  // ── СТАДИЯ GROW → Account Plan ───────────────────────────
  {
    id:       "grow-account-plan",
    name:     "GROW: создать Account Plan",
    priority: "P2",
    condition: (c, existing) =>
      c.clmStage === "GROW" &&
      c.kamId !== null &&
      !existing.includes("grow-account-plan"),
    action:   "Заполнить Account Plan: поставить revenue target, запланировать следующую встречу",
    daysUntilDue: 14,
    assignTo: (c) => c.kamId ?? c.managerId,
  },

  // ── QBR ПРОСРОЧЕН (#9 P2) ────────────────────────────────
  {
    id:       "qbr-overdue",
    name:     "QBR просрочен — запланировать встречу",
    priority: "P2",
    condition: (c, existing) => {
      if (!c.kamId) return false;
      if (existing.includes("qbr-overdue")) return false;
      return (c as ClientRow & { accountPlanOverdue?: boolean }).accountPlanOverdue === true;
    },
    action:   "QBR просрочен: запланировать Account Review встречу в течение 7 дней",
    daysUntilDue: 7,
    assignTo: (c) => c.kamId,
  },

  // ── МЕНЕДЖЕР НЕ КАСАЛСЯ КЛИЕНТА ──────────────────────────
  {
    id:       "no-touch-30d",
    name:     "Нет касания 30 дней",
    priority: "P3",
    condition: (c, existing) => {
      if (c.clmStage === "ACQUIRE") return false;
      const lastActivity = c.activities[0];
      if (!lastActivity) return !existing.includes("no-touch-30d");
      const days = Math.floor(
        (Date.now() - new Date(lastActivity.performedAt).getTime()) / 86_400_000
      );
      return days >= 30 && !existing.includes("no-touch-30d");
    },
    action:   "Плановый check-in: 30+ дней без контакта. Позвонить, зафиксировать в истории",
    daysUntilDue: 2,
    assignTo: (c) => c.managerId ?? c.kamId,
  },
];

export async function runEventTriggers(): Promise<TriggerResult> {
  const result: TriggerResult = { tasksCreated: 0, triggered: [], errors: [] };

  // Находим первого ADMIN для назначения ничейных клиентов
  const adminUser = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  // Загружаем всех клиентов с нужными данными
  const now = new Date();
  const clients = await db.client.findMany({
    where: { isArchived: false },
    include: {
      activities: {
        orderBy: { performedAt: "desc" },
        take: 1,
        select: { performedAt: true },
      },
      accountPlan: {
        select: { nextMeeting: true },
      },
    },
  });

  // Для каждого клиента: получить существующие PENDING-задачи по triggerDay (rule id)
  const existingTasks = await db.task.findMany({
    where: {
      status:     { in: ["PENDING", "OVERDUE"] },
      triggerDay: { not: null },
    },
    select: { clientId: true, triggerDay: true },
  });

  // Группируем по clientId для быстрого поиска
  const existingByClient = new Map<string, string[]>();
  for (const t of existingTasks) {
    if (!existingByClient.has(t.clientId)) existingByClient.set(t.clientId, []);
    existingByClient.get(t.clientId)!.push(t.triggerDay!);
  }

  let unownedCount = 0;

  for (const client of clients as (ClientRow & { accountPlanOverdue?: boolean })[]) {
    // Пометить клиентов с просроченным QBR
    if (client.accountPlan?.nextMeeting && client.kamId) {
      client.accountPlanOverdue = new Date(client.accountPlan.nextMeeting) < now;
    }
    const existing = existingByClient.get(client.id) ?? [];

    for (const rule of TRIGGER_RULES) {
      try {
        if (!rule.condition(client, existing)) continue;

        // Для ничейных клиентов — назначаем на ADMIN
        let assignedTo = rule.assignTo(client);
        if (!assignedTo && rule.id === "unowned-client") {
          assignedTo = adminUser?.id ?? null;
          if (assignedTo) unownedCount++;
        }
        if (!assignedTo) continue;

        // Проверить что пользователь существует
        const userExists = await db.user.findUnique({
          where: { id: assignedTo },
          select: { id: true },
        });
        if (!userExists) continue;

        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + rule.daysUntilDue);

        await db.task.create({
          data: {
            clientId:   client.id,
            triggerDay: rule.id,
            assignedTo,
            dueDate,
            priority:   rule.priority,
            action:     rule.action,
          },
        });

        existing.push(rule.id); // prevent double-trigger in same run
        result.tasksCreated++;
        result.triggered.push(`${client.name} → ${rule.name}`);
      } catch (e) {
        result.errors.push(`${client.id}/${rule.id}: ${String(e)}`);
      }
    }
  }

  // Отдельное Telegram-уведомление по ничейным клиентам
  if (unownedCount > 0) {
    await sendNotification(
      `🚨 <b>НИЧЕЙНЫЕ КЛИЕНТЫ</b>: ${unownedCount} клиентов без ответственного менеджера!\n` +
      `Проверьте раздел <b>Администрирование → Ничейные клиенты</b>`
    );
  }

  // Уведомление если есть P1-триггеры
  const p1 = TRIGGER_RULES.filter(r => r.priority === "P1")
    .flatMap(r => result.triggered.filter(t => t.includes(r.name)));

  if (p1.length > 0) {
    await sendNotification(
      `🎯 <b>Event Triggers</b>: ${result.tasksCreated} новых задач\n` +
      `🔴 P1 срочных: ${p1.length}\n\n` +
      p1.slice(0, 5).map(t => `• ${t}`).join("\n")
    );
  }

  // ── Ghosting auto-close для Pipeline (#7 P2) ─────────────
  await runGhostingTrigger(result);

  return result;
}

/** Detects stale deals (21+ days no activity, no open tasks) and creates P2 task */
async function runGhostingTrigger(result: TriggerResult): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 21);

  const staleDeals = await db.deal.findMany({
    where: {
      status:    "ACTIVE",
      updatedAt: { lt: cutoff },
    },
    include: {
      owner:  { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
  });

  const now = new Date();

  for (const deal of staleDeals) {
    try {
      // Check if already has a ghosting task
      const existing = await db.task.findFirst({
        where: {
          assignedTo: deal.ownerId,
          triggerDay: "ghosting-auto-close",
          status:     { in: ["PENDING", "OVERDUE"] },
          // Привязываем к клиенту сделки если есть
          ...(deal.clientId ? { clientId: deal.clientId } : {}),
        },
      });
      if (existing) continue;

      // Need a clientId for the task
      if (!deal.clientId) continue;

      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 3);

      await db.task.create({
        data: {
          clientId:   deal.clientId,
          triggerDay: "ghosting-auto-close",
          assignedTo: deal.ownerId,
          dueDate,
          priority:   "P2",
          action:     `Ghosting: сделка "${deal.leadName ?? deal.client?.name ?? "—"}" без активности 21+ дней. Закрыть или подтвердить активность.`,
        },
      });

      result.tasksCreated++;
      result.triggered.push(`${deal.client?.name ?? deal.leadName ?? deal.id} → Ghosting auto-close`);
    } catch (e) {
      result.errors.push(`deal/${deal.id}/ghosting: ${String(e)}`);
    }
  }
}
