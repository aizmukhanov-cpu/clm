/**
 * Серверные функции для матрицы доступа.
 * Импортирует db — использовать ТОЛЬКО в server components / server actions.
 * Для client components импортируй из @/lib/permissions-config
 */

import "server-only";

import { db } from "@/lib/db";
import {
  PERMISSION_RESOURCES,
  DEFAULT_PERMISSIONS,
  CONFIGURABLE_ROLES,
  type PermissionResource,
  type ConfigurableRole,
  type PermissionMatrix,
} from "@/lib/permissions-config";

// Re-export всё из config для удобства серверного кода
export * from "@/lib/permissions-config";

/**
 * Загружает матрицу доступа для роли из БД.
 * ADMIN всегда получает полный доступ.
 */
export async function getPermissionsForRole(role: string): Promise<PermissionMatrix> {
  if (role === "ADMIN") {
    return Object.fromEntries(PERMISSION_RESOURCES.map((r) => [r, true])) as PermissionMatrix;
  }

  const rows = await db.permissionConfig.findMany({
    where: { role },
    select: { resource: true, canView: true },
  });

  const defaults = DEFAULT_PERMISSIONS[role as ConfigurableRole] ?? {};
  const matrix: Record<string, boolean> = { ...defaults };
  for (const row of rows) {
    matrix[row.resource] = row.canView;
  }

  return matrix as PermissionMatrix;
}

/**
 * Загружает полную матрицу для всех ролей (страница настроек).
 */
export async function getAllPermissions(): Promise<Record<ConfigurableRole, PermissionMatrix>> {
  const rows = await db.permissionConfig.findMany({
    select: { role: true, resource: true, canView: true },
  });

  const result = {} as Record<ConfigurableRole, PermissionMatrix>;

  for (const role of CONFIGURABLE_ROLES) {
    const defaults = { ...DEFAULT_PERMISSIONS[role] };
    const roleRows = rows.filter((r) => r.role === role);
    for (const row of roleRows) {
      defaults[row.resource as PermissionResource] = row.canView;
    }
    result[role] = defaults as PermissionMatrix;
  }

  return result;
}
