"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UserRole, DealStatus } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { PIPELINE_STAGES, B2B_STAGES, BRANCH_STAGES } from "@/lib/pipeline-config";

export type PipelineFilters = {
  ownerId?: string;
  status?: string;
};

export async function getDeals(team: "B2B" | "KM" | "BRANCH", filters: PipelineFilters = {}) {
  const session = await getSession();
  if (!session) return { deals: [], owners: [] };

  const where: Record<string, unknown> = { team, status: DealStatus.ACTIVE };

  if (session.role === UserRole.MANAGER) where.ownerId = session.id;
  if (filters.ownerId && filters.ownerId !== "ALL") where.ownerId = filters.ownerId;

  const deals = await db.deal.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, inn: true } },
      owner:  { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const owners =
    session.role === UserRole.MANAGER
      ? []
      : await db.user.findMany({
          where: {
            role: { in: [UserRole.MANAGER] },
            team: team as "B2B" | "KM" | "BRANCH",
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });

  // Summary stats by stage
  const allActive = await db.deal.findMany({
    where: {
      team,
      status: DealStatus.ACTIVE,
      ...(session.role === UserRole.MANAGER ? { ownerId: session.id } : {}),
    },
    select: { stage: true, amount: true },
  });

  const wonCount = await db.deal.count({
    where: {
      team,
      status: DealStatus.WON,
      ...(session.role === UserRole.MANAGER ? { ownerId: session.id } : {}),
    },
  });

  // Stage list by team
  const stages =
    team === "B2B"    ? (B2B_STAGES     as readonly string[]) :
    team === "BRANCH" ? (BRANCH_STAGES  as readonly string[]) :
                        (PIPELINE_STAGES as readonly string[]);

  const stageStats = stages.map((s) => {
    const stageDeal = allActive.filter((d) => d.stage === s);
    return {
      stage: s,
      count: stageDeal.length,
      amount: stageDeal.reduce((sum, d) => sum + (d.amount ?? 0), 0),
    };
  });

  return { deals, owners, stageStats, wonCount };
}

/**
 * Ищет клиента по ИНН — используется для live-lookup в форме B2B.
 * Возвращает { id, name } если найден, иначе null.
 */
export async function lookupClientByInn(
  inn: string,
): Promise<{ id: string; name: string } | null> {
  const session = await getSession();
  if (!session || !inn.trim()) return null;

  const client = await db.client.findUnique({
    where: { inn: inn.trim() },
    select: { id: true, name: true },
  });

  return client ?? null;
}

export async function createDeal(
  team: "B2B" | "KM" | "BRANCH",
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Не авторизован";

  const inn        = (formData.get("inn")      as string)?.trim() || null;
  const leadName   = (formData.get("leadName") as string)?.trim();
  const product    = (formData.get("product")  as string)?.trim() || null;
  const amountRaw  = formData.get("amount") as string;
  const probRaw    = formData.get("probability") as string;
  const closeRaw   = formData.get("expectedClose") as string;
  const notes      = (formData.get("notes") as string)?.trim() || null;
  // KM-specific contact fields
  const contact    = (formData.get("contact") as string)?.trim() || null;
  const phone      = (formData.get("phone")   as string)?.trim() || null;

  let clientId: string | null = (formData.get("clientId") as string)?.trim() || null;
  let finalLeadName = leadName || null;

  if (inn) {
    const existing = await db.client.findUnique({
      where: { inn },
      select: { id: true, name: true },
    });

    if (team === "B2B") {
      // B2B — только новые клиенты
      if (existing) {
        return `Клиент «${existing.name}» (ИНН ${inn}) уже есть в базе. B2B пайплайн — только для новых клиентов.`;
      }
    } else if (team === "KM") {
      // KM — если клиент есть в базе, линкуем сделку к нему
      if (existing) {
        clientId = existing.id;
        finalLeadName = null; // используем имя из client
      }
      // если нет — создаём лид без клиента, ИНН в notes
    }
  }

  if (!finalLeadName && !clientId) return "Введите название компании или ИНН";

  const ownerId =
    (session.role === UserRole.ADMIN || session.role === "ANALYST")
      ? ((formData.get("ownerId") as string) || session.id)
      : session.id;

  // Строим структурированные notes
  // B2B: форма уже собирает structured notes на клиенте → берём как есть
  // KM: поля contact/phone передаются отдельно → собираем на сервере
  let finalNotes: string | null;
  if (team === "KM" || team === "BRANCH") {
    const metaParts: string[] = [];
    if (inn && !clientId)  metaParts.push(`inn:${inn}`);
    if (contact)           metaParts.push(`contact:${contact}`);
    if (phone)             metaParts.push(`phone:${phone}`);
    if (notes)             metaParts.push(`note:${notes}`);
    finalNotes = metaParts.length > 0 ? metaParts.join("|") : null;
  } else {
    // B2B: notes уже structured (contact:…|phone:…|addr:…|note:…), добавляем inn если нужно
    finalNotes = notes;
    if (inn && !clientId) {
      finalNotes = finalNotes ? `inn:${inn}|${finalNotes}` : `inn:${inn}`;
    }
  }

  await db.deal.create({
    data: {
      team: team as "B2B" | "KM" | "BRANCH",
      stage: "QUALIFY",
      status: DealStatus.ACTIVE,
      ownerId,
      clientId,
      leadName: finalLeadName,
      productName: product,
      amount: amountRaw ? parseFloat(amountRaw) * 1000 : null, // форма в тыс. сом
      probability: probRaw ? parseInt(probRaw) : 20,
      expectedClose: closeRaw ? new Date(closeRaw) : null,
      notes: finalNotes,
    },
  });

  revalidatePath(`/pipeline/${team === "BRANCH" ? "branch" : team.toLowerCase()}`);
  return null;
}

export async function moveDealStage(
  dealId: string,
  newStage: string,
  team: string,
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Не авторизован" };

  const validStages = [...PIPELINE_STAGES, ...B2B_STAGES, ...BRANCH_STAGES] as string[];
  if (!validStages.includes(newStage)) {
    return { error: "Неверная стадия" };
  }

  await db.deal.update({ where: { id: dealId }, data: { stage: newStage } });
  revalidatePath(`/pipeline/${team === "BRANCH" ? "branch" : team.toLowerCase()}`);
  return {};
}

export async function closeDeal(
  dealId: string,
  outcome: "WON" | "LOST",
  lostReason: string | null,
  team: string,
): Promise<{ error?: string; clientId?: string }> {
  const session = await getSession();
  if (!session) return { error: "Не авторизован" };

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true, clientId: true, leadName: true, notes: true,
      ownerId: true, team: true,
    },
  });
  if (!deal) return { error: "Сделка не найдена" };

  let linkedClientId = deal.clientId;

  if (outcome === "WON") {
    if (deal.clientId) {
      // Клиент уже существует — если он в ACQUIRE, переводим в ONBOARD
      const existing = await db.client.findUnique({
        where: { id: deal.clientId },
        select: { clmStage: true, managerId: true },
      });
      if (existing && existing.clmStage === "ACQUIRE") {
        const assignedTo = existing.managerId ?? deal.ownerId;
        const now = new Date();
        const onboardTasks = [
          { day: "D+1",  offset: 1,  priority: "P3" as const, action: "Welcome — помочь с настройкой MBusiness" },
          { day: "D+3",  offset: 3,  priority: "P3" as const, action: "Первая транзакция? Позвонить, убрать барьер" },
          { day: "D+7",  offset: 7,  priority: "P2" as const, action: "Нет транзакций — выяснить причину" },
          { day: "D+14", offset: 14, priority: "P1" as const, action: "Эскалация — нет тр. 14 дней, передать в реактивацию" },
        ];
        await db.$transaction(async (tx) => {
          await tx.client.update({
            where: { id: deal.clientId! },
            data: { clmStage: "ONBOARD" },
          });
          await tx.changelog.create({
            data: {
              clientId: deal.clientId!,
              changedBy: session.id,
              field: "clmStage",
              oldVal: "ACQUIRE",
              newVal: "ONBOARD",
            },
          });
          for (const t of onboardTasks) {
            const due = new Date(now);
            due.setDate(due.getDate() + t.offset);
            await tx.task.create({
              data: {
                clientId: deal.clientId!,
                triggerDay: t.day,
                assignedTo,
                dueDate: due,
                priority: t.priority,
                action: t.action,
              },
            });
          }
        });
      }
    } else {
      // Нет clientId — создаём клиента из лида (B2B или KM без ИНН в базе)
      const meta: Record<string, string> = {};
      if (deal.notes) {
        deal.notes.split("|").forEach((part) => {
          const idx = part.indexOf(":");
          if (idx > 0) meta[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
        });
      }

      const inn = meta["inn"] || null;
      if (inn) {
        // Проверяем — вдруг уже появился
        const maybeClient = await db.client.findUnique({ where: { inn }, select: { id: true } });
        if (maybeClient) {
          linkedClientId = maybeClient.id;
        } else {
          // Создаём нового клиента
          const owner = await db.user.findUnique({
            where: { id: deal.ownerId },
            select: { branchId: true },
          });
          if (owner?.branchId) {
            const now = new Date();
            const onboardTasks = [
              { day: "D+1",  offset: 1,  priority: "P3" as const, action: "Welcome — помочь с настройкой MBusiness" },
              { day: "D+3",  offset: 3,  priority: "P3" as const, action: "Первая транзакция? Позвонить, убрать барьер" },
              { day: "D+7",  offset: 7,  priority: "P2" as const, action: "Нет транзакций — выяснить причину" },
              { day: "D+14", offset: 14, priority: "P1" as const, action: "Эскалация — нет тр. 14 дней, передать в реактивацию" },
            ];
            const newClient = await db.$transaction(async (tx) => {
              const c = await tx.client.create({
                data: {
                  inn,
                  name: deal.leadName ?? `Клиент ИНН ${inn}`,
                  type: "YL",
                  branchId: owner.branchId!,
                  managerId: deal.ownerId,
                  clmStage: "ONBOARD",
                },
              });
              await tx.changelog.create({
                data: {
                  clientId: c.id,
                  changedBy: session.id,
                  field: "clmStage",
                  oldVal: null,
                  newVal: "ONBOARD",
                },
              });
              for (const t of onboardTasks) {
                const due = new Date(now);
                due.setDate(due.getDate() + t.offset);
                await tx.task.create({
                  data: {
                    clientId: c.id,
                    triggerDay: t.day,
                    assignedTo: deal.ownerId,
                    dueDate: due,
                    priority: t.priority,
                    action: t.action,
                  },
                });
              }
              return c;
            });
            linkedClientId = newClient.id;
          }
        }
      }
    }
  }

  await db.deal.update({
    where: { id: dealId },
    data: {
      status: outcome === "WON" ? DealStatus.WON : DealStatus.LOST,
      lostReason: outcome === "LOST" ? lostReason : null,
      clientId: outcome === "WON" ? (linkedClientId ?? deal.clientId) : deal.clientId,
    },
  });

  revalidatePath(`/pipeline/${team === "BRANCH" ? "branch" : team.toLowerCase()}`);
  if (linkedClientId) revalidatePath(`/clients/${linkedClientId}`);
  revalidatePath("/clients");

  return { clientId: linkedClientId ?? undefined };
}
