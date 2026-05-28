"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import {
  CONFIGURABLE_ROLES,
  PERMISSION_RESOURCES,
  DEFAULT_PERMISSIONS,
  type ConfigurableRole,
  type PermissionResource,
} from "@/lib/permissions-config";

/**
 * Обновляет одно право в матрице.
 * Доступно только ADMIN.
 */
export async function updatePermission(
  role: string,
  resource: string,
  canView: boolean,
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return { error: "Недостаточно прав" };
  }

  if (!CONFIGURABLE_ROLES.includes(role as ConfigurableRole)) {
    return { error: "Неверная роль" };
  }
  if (!PERMISSION_RESOURCES.includes(resource as PermissionResource)) {
    return { error: "Неверный ресурс" };
  }

  await db.permissionConfig.upsert({
    where: { role_resource: { role, resource } },
    update: { canView, updatedBy: session.id },
    create: { role, resource, canView, updatedBy: session.id },
  });

  revalidatePath("/admin/permissions");
  return {};
}

/**
 * Сбрасывает матрицу для роли к дефолту.
 */
export async function resetPermissions(role: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return { error: "Недостаточно прав" };
  }

  if (!CONFIGURABLE_ROLES.includes(role as ConfigurableRole)) {
    return { error: "Неверная роль" };
  }

  // Удаляем все записи для роли — при отсутствии будут использованы дефолты
  await db.permissionConfig.deleteMany({ where: { role } });

  // Записываем дефолтные значения явно
  const defaults = DEFAULT_PERMISSIONS[role as ConfigurableRole];
  await db.permissionConfig.createMany({
    data: PERMISSION_RESOURCES.map((resource) => ({
      role,
      resource,
      canView: defaults[resource],
      updatedBy: session.id,
    })),
  });

  revalidatePath("/admin/permissions");
  return {};
}
