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

  const name         = (formData.get("name")         as string)?.trim();
  const email        = (formData.get("email")        as string)?.trim().toLowerCase();
  const password     = (formData.get("password")     as string)?.trim();
  const role         = (formData.get("role")         as string) as UserRole;
  const team         = (formData.get("team")         as string) as TeamType;
  const branchId     = (formData.get("branchId")     as string)?.trim();
  const supervisorId = (formData.get("supervisorId") as string)?.trim() || null;

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
    data: { name, email, role, team, branchId, passwordHash, supervisorId },
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

  const name         = (formData.get("name")         as string)?.trim();
  const email        = (formData.get("email")        as string)?.trim().toLowerCase();
  const password     = (formData.get("password")     as string)?.trim();
  const role         = (formData.get("role")         as string) as UserRole;
  const team         = (formData.get("team")         as string) as TeamType;
  const branchId     = (formData.get("branchId")     as string)?.trim();
  const supervisorId = (formData.get("supervisorId") as string)?.trim() || null;

  if (!name)                       return "Укажите имя";
  if (!email)                      return "Укажите email";
  if (!VALID_ROLES.includes(role)) return "Выберите роль";
  if (!VALID_TEAMS.includes(team)) return "Выберите команду";
  if (!branchId)                   return "Выберите филиал";

  // Check email uniqueness (exclude self)
  const conflict = await db.user.findFirst({ where: { email, NOT: { id: userId } } });
  if (conflict) return `Email ${email} уже используется другим пользователем`;

  const data: Record<string, unknown> = {
    name, email, role, team, branchId, supervisorId,
  };

  if (password) {
    if (password.length < 6) return "Пароль минимум 6 символов";
    data.passwordHash = await hash(password, 10);
  }

  await db.user.update({ where: { id: userId }, data });

  revalidatePath("/admin/users");
  redirect("/admin/users");
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
