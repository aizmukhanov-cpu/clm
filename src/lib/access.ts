/**
 * Централизованная логика доступа на основе роли и команды.
 *
 * Модель доступа:
 *   clientAccessWhere  → ALL authenticated users see ALL clients
 *                        (sensitive columns masked via PermissionConfig)
 *
 *   teamWorkFilter     → team-scoped access for WORK QUEUES
 *                        (Activation Desk, Reactivation working view)
 *                        ADMIN / ANALYST → всё
 *                        MANAGER (B2B/KM) → только клиенты своей команды
 *                        KAM_ROLE → только свои клиенты (kam.id = session.id)
 *
 *   canEdit  → только ADMIN и ANALYST могут менять стадию / архивировать
 */

import { SessionUser } from "@/lib/auth";

export type ClientWhereFilter = Record<string, unknown>;

/** Для реестра клиентов и карточки клиента — все видят всех */
export function clientAccessWhere(_session: SessionUser): ClientWhereFilter {
  return {};
}

/** Для рабочих очередей (Activation Desk) — командная фильтрация */
export function teamWorkFilter(session: SessionUser): ClientWhereFilter {
  if (session.role === "ADMIN" || session.role === "ANALYST") {
    return {};
  }
  if (session.role === "KAM_ROLE") {
    return { kamId: session.id };
  }
  if (session.role === "MANAGER") {
    return { manager: { team: session.team } };
  }
  return { id: "__none__" };
}

/** Может ли пользователь видеть/редактировать клиента — теперь все могут смотреть */
export function canViewClient(
  _session: SessionUser,
  _client: { managerId: string | null; kamId: string | null; manager?: { team: string } | null },
): boolean {
  return true; // Все аутентифицированные пользователи видят всех клиентов
}

/** Может ли пользователь менять стадию / архивировать */
export function canEdit(session: SessionUser): boolean {
  return session.role === "ADMIN" || session.role === "ANALYST";
}
