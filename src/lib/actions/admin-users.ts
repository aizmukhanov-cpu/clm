"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole, TeamType } from "@/generated/prisma/client";

const VALID_ROLES = Object.keys(UserRole) as UserRole[];
const VALID_TEAMS = Object.keys(TeamType) as TeamType[];

function adminOnly(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session || session.role !== "ADMIN") return "Недостаточно прав";
  return null;
}

/* ─── CREATE ─────────────────────────────────────────────── */

export async function createUser(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  const guard   = adminOnly(session);
  if (guard) return guard;

  const name           = (formData.get("name")           as string)?.trim();
  const email          = (formData.get("email")          as string)?.trim().toLowerCase();
  const password       = (formData.get("password")       as string)?.trim();
  const role           = (formData.get("role")           as string) as UserRole;
  const team           = (formData.get("team")           as string) as TeamType;
  const branchId       = (formData.get("branchId")       as string)?.trim();
  const supervisorId   = (formData.get("supervisorId")   as string)?.trim() || null;
  const planMonthlyRaw = (formData.get("planMonthly")    as string)?.trim();
  const telegramChatId = (formData.get("telegramChatId") as string)?.trim() || null;
  const planMonthly    = planMonthlyRaw ? parseInt(planMonthlyRaw, 10) : null;

  if (!name)                         return "Укажите имя";
  if (!email)                        return "Укажите email";
  if (!password || password.length < 6) return "Пароль минимум 6 символов";
  if (!VALID_ROLES.includes(role))   return "Выберите роль";
  if (!VALID_TEAMS.includes(team))   return "Выберите команду";
  if (!branchId)                     return "Выберите филиал";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return `Email ${email} уже используется`;

  const passwordHash = await hash(password, 10);

  await db.user.create({
    data: { name, email, role, team, branchId, passwordHash, supervisorId, planMonthly, telegramChatId },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

/* ─── UPDATE ─────────────────────────────────────────────── */

export async function updateUser(
  userId: string,
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  const guard   = adminOnly(session);
  if (guard) return guard;

  const name           = (formData.get("name")           as string)?.trim();
  const email          = (formData.get("email")          as string)?.trim().toLowerCase();
  const password       = (formData.get("password")       as string)?.trim();
  const role           = (formData.get("role")           as string) as UserRole;
  const team           = (formData.get("team")           as string) as TeamType;
  const branchId       = (formData.get("branchId")       as string)?.trim();
  const supervisorId   = (formData.get("supervisorId")   as string)?.trim() || null;
  const planMonthlyRaw = (formData.get("planMonthly")    as string)?.trim();
  const telegramChatId = (formData.get("telegramChatId") as string)?.trim() || null;
  const planMonthly    = planMonthlyRaw ? parseInt(planMonthlyRaw, 10) : null;

  if (!name)                       return "Укажите имя";
  if (!email)                      return "Укажите email";
  if (!VALID_ROLES.includes(role)) return "Выберите роль";
  if (!VALID_TEAMS.includes(team)) return "Выберите команду";
  if (!branchId)                   return "Выберите филиал";

  // Check email uniqueness (exclude self)
  const conflict = await db.user.findFirst({ where: { email, NOT: { id: userId } } });
  if (conflict) return `Email ${email} уже используется другим пользователем`;

  const data: Record<string, unknown> = {
    name, email, role, team, branchId, supervisorId, planMonthly, telegramChatId,
  };

  if (password) {
    if (password.length < 6) return "Пароль минимум 6 символов";
    data.passwordHash = await hash(password, 10);
  }

  await db.user.update({ where: { id: userId }, data });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

/* ─── EMERGENCY PORTFOLIO REASSIGNMENT (#5 P1) ──────────── */

export async function reassignPortfolio(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await getSession();
  if (!session || !["ADMIN", "DIRECTOR"].includes(session.role)) {
    return "Недостаточно прав";
  }

  const fromUserId = (formData.get("fromUserId") as string)?.trim();
  const mode       = (formData.get("mode") as string)?.trim(); // "specific" | "auto"
  const toUserId   = (formData.get("toUserId") as string)?.trim() || null;

  if (!fromUserId) return "Выберите менеджера-источника";

  const fromUser = await db.user.findUnique({
    where: { id: fromUserId },
    include: {
      managedClients: { where: { isArchived: false }, select: { id: true } },
      kamClients:     { where: { isArchived: false }, select: { id: true } },
      branch:         { select: { id: true } },
    },
  });
  if (!fromUser) return "Менеджер не найден";

  const clientIds = [
    ...fromUser.managedClients.map(c => c.id),
    ...fromUser.kamClients.map(c => c.id),
  ];
  if (clientIds.length === 0) return "У менеджера нет клиентов для перераспределения";

  if (mode === "specific") {
    if (!toUserId) return "Выберите получателя";
    const toUser = await db.user.findUnique({ where: { id: toUserId }, select: { id: true, role: true } });
    if (!toUser) return "Получатель не найден";

    // Переназначаем всех клиентов на одного получателя
    await db.client.updateMany({
      where: { managerId: fromUserId },
      data:  { managerId: toUserId },
    });
    await db.client.updateMany({
      where: { kamId: fromUserId },
      data:  { kamId: toUserId },
    });

    // Журналируем
    const changes = clientIds.map(clientId => ({
      clientId,
      changedBy: session.id,
      field:     "managerId",
      oldVal:    fromUserId,
      newVal:    toUserId,
    }));
    await db.changelog.createMany({ data: changes });

  } else {
    // Авто-балансировка: найти менеджеров с минимальной нагрузкой в том же филиале
    const candidates = await db.user.findMany({
      where: {
        role:     { in: ["SPECIALIST", "KAM"] },
        branchId: fromUser.branch.id,
        id:       { not: fromUserId },
      },
      include: {
        _count: { select: { managedClients: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    if (candidates.length === 0) {
      return "Нет доступных менеджеров в том же филиале для авто-балансировки";
    }

    // Распределяем клиентов round-robin по кандидатам (сортировка по нагрузке)
    const sorted = [...candidates].sort(
      (a, b) => a._count.managedClients - b._count.managedClients
    );

    for (let i = 0; i < clientIds.length; i++) {
      const target = sorted[i % sorted.length];
      await db.client.update({
        where: { id: clientIds[i] },
        data:  {
          managerId: fromUser.managedClients.some(c => c.id === clientIds[i])
            ? target.id : undefined,
          kamId: fromUser.kamClients.some(c => c.id === clientIds[i])
            ? target.id : undefined,
        },
      });
      await db.changelog.create({
        data: {
          clientId:  clientIds[i],
          changedBy: session.id,
          field:     "managerId",
          oldVal:    fromUserId,
          newVal:    target.id,
        },
      });
    }
  }

  revalidatePath("/admin/users");
  revalidatePath("/clients");
  return null;
}

/* ─── DELETE (soft: reassign clients first) ─────────────── */

export async function deleteUser(userId: string): Promise<{ error?: string }> {
  const session = await getSession();
  const guard   = adminOnly(session);
  if (guard) return { error: guard };
  if (userId === session!.id) return { error: "Нельзя удалить себя" };

  // Проверяем есть ли у него клиенты
  const clientCount = await db.client.count({
    where: { OR: [{ managerId: userId }, { kamId: userId }] },
  });
  if (clientCount > 0) {
    return { error: `Перед удалением переназначьте ${clientCount} клиентов другому менеджеру` };
  }

  await db.user.delete({ where: { id: userId } });

  revalidatePath("/admin/users");
  return {};
}
