"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CLMStage, CLMCohort, UserRole } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ALLOWED } from "@/lib/clm-config";
import { clientAccessWhere, canViewClient } from "@/lib/access";

export type ClientFilters = {
  search?: string;
  stage?: string;
  cohort?: string;
  branchId?: string;
  team?: string;
  page?: number;
  archived?: boolean;
};

const PAGE_SIZE = 50;

// ─── Списки ───────────────────────────────────────────────

export async function getClients(filters: ClientFilters = {}) {
  const session = await getSession();
  if (!session) return { clients: [], total: 0, pages: 0 };

  const page = filters.page ?? 1;
  const skip = (page - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = {
    isArchived: filters.archived === true ? true : false,
    ...clientAccessWhere(session),
  };

  if (filters.search) {
    where.OR = [
      { inn:  { contains: filters.search, mode: "insensitive" } },
      { name: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.stage   && filters.stage   !== "ALL") where.clmStage  = filters.stage  as CLMStage;
  if (filters.cohort  && filters.cohort  !== "ALL") where.clmCohort = filters.cohort as CLMCohort;
  if (filters.branchId && filters.branchId !== "ALL") where.branchId = filters.branchId;
  // Фильтр по команде доступен только admin/analyst (менеджер и так ограничен своей командой)
  if ((session.role === "ADMIN" || session.role === "ANALYST") && filters.team && filters.team !== "ALL") {
    if (filters.team === "B2B" || filters.team === "KM") where.manager = { team: filters.team };
    else if (filters.team === "KAM") where.kamId = { not: null };
  }

  const [clients, total] = await Promise.all([
    db.client.findMany({
      where,
      include: {
        branch:  { select: { name: true } },
        manager: { select: { name: true, team: true } },
        kam:     { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.client.count({ where }),
  ]);

  return { clients, total, pages: Math.ceil(total / PAGE_SIZE) };
}

export async function getBranches() {
  return db.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

// ─── Карточка клиента ─────────────────────────────────────

export async function getClient(id: string) {
  const session = await getSession();
  if (!session) return null;

  const client = await db.client.findUnique({
    where: { id },
    include: {
      branch:     { select: { id: true, name: true } },
      manager:    { select: { id: true, name: true, team: true } },
      kam:        { select: { id: true, name: true } },
      activities: {
        orderBy: { performedAt: "desc" },
        take: 10,
        include: { user: { select: { name: true } } },
      },
      tasks: {
        where: { status: { not: "DONE" } },
        orderBy: { dueDate: "asc" },
        take: 5,
      },
      changelogs: {
        orderBy: { changedAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      },
      contactPersons: {
        orderBy: [{ isDecisionMaker: "desc" }, { createdAt: "asc" }],
      },
      accountPlan: true,
    },
  });

  if (!client) return null;
  if (!canViewClient(session, client)) return null; // нет доступа = 404

  return client;
}

// ─── Смена стадии CLM ─────────────────────────────────────

export async function changeStage(clientId: string, newStage: CLMStage) {
  const session = await getSession();
  if (!session) return { error: "Не авторизован" };

  // Только ADMIN и ANALYST могут менять стадию
  if (session.role !== UserRole.ADMIN && session.role !== "ANALYST") {
    return { error: "Недостаточно прав" };
  }

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { clmStage: true, managerId: true },
  });
  if (!client) return { error: "Клиент не найден" };

  const allowed = ALLOWED[client.clmStage] ?? [];
  if (!allowed.includes(newStage)) {
    return { error: `Переход ${client.clmStage} → ${newStage} недопустим` };
  }

  const oldStage = client.clmStage;

  // Транзакция: обновить стадию + записать changelog + создать задачи при ONBOARD
  await db.$transaction(async (tx) => {
    await tx.client.update({
      where: { id: clientId },
      data: { clmStage: newStage },
    });

    await tx.changelog.create({
      data: {
        clientId,
        changedBy: session.id,
        field: "clmStage",
        oldVal: oldStage,
        newVal: newStage,
      },
    });

    // При переходе в ONBOARD → авто-создать Activation Tasks
    if (newStage === CLMStage.ONBOARD) {
      const assignedTo = client.managerId ?? session.id;
      const now = new Date();

      const tasks = [
        { day: "D+1",  offset: 1,  priority: "P3" as const, action: "Welcome — помочь с настройкой MBusiness" },
        { day: "D+3",  offset: 3,  priority: "P3" as const, action: "Первая транзакция? Позвонить, убрать барьер" },
        { day: "D+7",  offset: 7,  priority: "P2" as const, action: "Нет транзакций — выяснить причину" },
        { day: "D+14", offset: 14, priority: "P1" as const, action: "Эскалация — нет тр. 14 дней, передать в реактивацию" },
      ];

      for (const t of tasks) {
        const due = new Date(now);
        due.setDate(due.getDate() + t.offset);
        await tx.task.create({
          data: {
            clientId,
            triggerDay: t.day,
            assignedTo,
            dueDate: due,
            priority: t.priority,
            action: t.action,
          },
        });
      }
    }
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { ok: true, newStage };
}

// ─── Создание клиента ─────────────────────────────────────

export async function createClient(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Не авторизован";
  if (session.role !== UserRole.ADMIN && session.role !== "ANALYST") {
    return "Недостаточно прав";
  }

  const inn      = (formData.get("inn") as string)?.trim();
  const name     = (formData.get("name") as string)?.trim();
  const type     = formData.get("type") as "YL" | "IP";
  const branchId = formData.get("branchId") as string;
  const managerId = (formData.get("managerId") as string) || null;
  const kamId    = (formData.get("kamId") as string) || null;
  const okved    = (formData.get("okved") as string)?.trim() || null;
  const dateRaw  = formData.get("accountOpenedAt") as string;

  if (!inn)      return "Введите ИНН";
  if (!name)     return "Введите название";
  if (!type)     return "Выберите тип";
  if (!branchId) return "Выберите филиал";

  const existing = await db.client.findUnique({ where: { inn } });
  if (existing)  return `Клиент с ИНН ${inn} уже существует`;

  const client = await db.client.create({
    data: {
      inn,
      name,
      type,
      branchId,
      managerId,
      kamId,
      okved,
      accountOpenedAt: dateRaw ? new Date(dateRaw) : null,
    },
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

// ─── Обновление клиента ──────────────────────────────────

export async function updateClient(
  clientId: string,
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Не авторизован";
  if (session.role !== UserRole.ADMIN && session.role !== "ANALYST") {
    return "Недостаточно прав";
  }

  const inn       = (formData.get("inn")  as string)?.trim();
  const name      = (formData.get("name") as string)?.trim();
  const type      = formData.get("type")  as "YL" | "IP";
  const branchId  = formData.get("branchId") as string;
  const managerId = (formData.get("managerId") as string) || null;
  const kamId     = (formData.get("kamId")     as string) || null;
  const okved     = (formData.get("okved")     as string)?.trim() || null;
  const dateRaw   = formData.get("accountOpenedAt") as string;

  if (!inn)      return "Введите ИНН";
  if (!name)     return "Введите название";
  if (!type)     return "Выберите тип";
  if (!branchId) return "Выберите филиал";

  // Проверяем дубль ИНН (другой клиент)
  const dup = await db.client.findFirst({ where: { inn, id: { not: clientId } } });
  if (dup) return `ИНН ${inn} уже занят клиентом «${dup.name}»`;

  const before = await db.client.findUnique({ where: { id: clientId } });
  if (!before) return "Клиент не найден";

  const data: Record<string, unknown> = {
    inn, name, type, branchId, managerId, kamId, okved,
    accountOpenedAt: dateRaw ? new Date(dateRaw) : null,
  };

  // Записываем changelog только для изменённых полей
  const tracked: Array<{ field: string; old: unknown; new: unknown }> = [];
  const fields: Array<keyof typeof data> = ["inn", "name", "type", "branchId", "managerId", "kamId", "okved"];
  for (const f of fields) {
    const oldVal = (before as Record<string, unknown>)[f];
    const newVal = data[f];
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      tracked.push({ field: f, old: oldVal ?? null, new: newVal ?? null });
    }
  }

  await db.$transaction(async (tx) => {
    await tx.client.update({ where: { id: clientId }, data });
    for (const t of tracked) {
      await tx.changelog.create({
        data: {
          clientId,
          changedBy: session.id,
          field: t.field,
          oldVal: t.old !== null ? String(t.old) : null,
          newVal: t.new !== null ? String(t.new) : null,
        },
      });
    }
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  redirect(`/clients/${clientId}`);
}

// ─── Тогл продукта клиента ───────────────────────────────

const PRODUCT_KEYS = [
  "hasMBusiness","hasMKassaPos","hasMKassaQr","hasSalaryProject",
  "hasAcquiring","hasCredit","hasDeposit","hasTradeFinance",
  "hasPayroll","hasCorporateCard",
] as const;

type ProductKey = (typeof PRODUCT_KEYS)[number];

export async function toggleClientProduct(
  clientId: string,
  productKey: string,
  value: boolean,
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Не авторизован" };
  if (session.role !== UserRole.ADMIN && session.role !== "ANALYST") {
    return { error: "Недостаточно прав" };
  }
  if (!PRODUCT_KEYS.includes(productKey as ProductKey)) {
    return { error: "Неверный ключ продукта" };
  }

  const before = await db.client.findUnique({
    where: { id: clientId },
    select: { [productKey]: true, productDepthPct: true },
  });
  if (!before) return { error: "Клиент не найден" };

  // Пересчитываем productDepthPct
  const allProducts = await db.client.findUnique({
    where: { id: clientId },
    select: Object.fromEntries(PRODUCT_KEYS.map((k) => [k, true])) as Record<ProductKey, true>,
  });
  if (!allProducts) return { error: "Клиент не найден" };

  const newMap = { ...allProducts, [productKey]: value };
  const activeCount = PRODUCT_KEYS.filter((k) => newMap[k]).length;
  const newDepth = activeCount / PRODUCT_KEYS.length;

  await db.$transaction(async (tx) => {
    await tx.client.update({
      where: { id: clientId },
      data: { [productKey]: value, productDepthPct: newDepth },
    });
    await tx.changelog.create({
      data: {
        clientId,
        changedBy: session.id,
        field: productKey,
        oldVal: String(!value),
        newVal: String(value),
      },
    });
  });

  revalidatePath(`/clients/${clientId}`);
  return {};
}

// ─── Архивирование ────────────────────────────────────────

export async function archiveClient(clientId: string) {
  const session = await getSession();
  if (!session || (session.role !== UserRole.ADMIN && session.role !== "ANALYST")) {
    return { error: "Недостаточно прав" };
  }

  await db.client.update({
    where: { id: clientId },
    data: { isArchived: true },
  });

  await db.changelog.create({
    data: {
      clientId,
      changedBy: session.id,
      field: "isArchived",
      oldVal: "false",
      newVal: "true",
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function unarchiveClient(clientId: string) {
  const session = await getSession();
  if (!session || (session.role !== UserRole.ADMIN && session.role !== "ANALYST")) {
    return { error: "Недостаточно прав" };
  }

  await db.client.update({
    where: { id: clientId },
    data:  { isArchived: false },
  });

  await db.changelog.create({
    data: {
      clientId,
      changedBy: session.id,
      field:  "isArchived",
      oldVal: "true",
      newVal: "false",
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

// ─── Client Notes ─────────────────────────────────────────
export async function getClientNotes(clientId: string): Promise<string | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { notes: true },
  });
  return client?.notes ?? null;
}

export async function saveClientNotes(
  clientId: string,
  notes: string,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Не авторизован" };

  await db.client.update({
    where: { id: clientId },
    data: { notes: notes.trim() || null },
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}
