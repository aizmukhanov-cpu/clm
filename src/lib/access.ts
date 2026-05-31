/**
 * Централизованная логика доступа на основе роли и команды.
 *
 * ┌─────────────┬──────────┬──────────────────────────────────────────────────────┐
 * │ Роль        │ Команда  │ Область видимости клиентов                           │
 * ├─────────────┼──────────┼──────────────────────────────────────────────────────┤
 * │ ADMIN       │ любая    │ Все клиенты, полный доступ + admin-панель            │
 * │ DIRECTOR    │ любая    │ Все клиенты, read-only + KPI                         │
 * │ ANALYST     │ любая    │ Все клиенты, read-only аналитика                     │
 * │ TEAM_LEAD   │ любая    │ Все клиенты своей команды (team)                     │
 * │ SUPERVISOR  │ любая    │ Свои клиенты + клиенты своих подчинённых             │
 * │ SPECIALIST  │ VB       │ ВСЕ клиенты банка (активация + реактивация всей базы)│
 * │ SPECIALIST  │ другая   │ Только свои клиенты (managerId = session.id)         │
 * │ KAM         │ KAM      │ Только свои KAM-клиенты (kamId = session.id)         │
 * └─────────────┴──────────┴──────────────────────────────────────────────────────┘
 */

import { SessionUser } from "@/lib/auth";

export type ClientWhereFilter = Record<string, unknown>;

/** Роли с глобальным доступом */
const GLOBAL_ROLES = ["ADMIN", "DIRECTOR", "ANALYST"];

/** True — роль видит всех клиентов */
export function hasGlobalAccess(session: SessionUser): boolean {
  return GLOBAL_ROLES.includes(session.role);
}

/**
 * Фильтр для рабочих очередей и портфельных страниц.
 * Использовать там, где нужно ограничить видимость по роли.
 */
export function teamWorkFilter(session: SessionUser): ClientWhereFilter {
  if (hasGlobalAccess(session)) return {};

  if (session.role === "TEAM_LEAD") {
    // Вся команда по полю team менеджера или KAM-связи
    if (session.team === "KAM") {
      return { kam: { team: "KAM" } };
    }
    return { manager: { team: session.team } };
  }

  if (session.role === "SUPERVISOR") {
    // Собственные клиенты + клиенты подчинённых
    if (session.team === "KAM") {
      return {
        OR: [
          { kamId: session.id },
          { kam: { supervisorId: session.id } },
        ],
      };
    }
    return {
      OR: [
        { managerId: session.id },
        { manager: { supervisorId: session.id } },
      ],
    };
  }

  if (session.role === "KAM") {
    return { kamId: session.id };
  }

  if (session.role === "SPECIALIST") {
    // VB (Virtual Branch) — команда активации/реактивации всей клиентской базы банка.
    // Они не «владеют» клиентами через managerId, а работают со всей базой.
    if (session.team === "VB") return {};
    return { managerId: session.id };
  }

  // Fallback — ничего не показывать
  return { id: "__none__" };
}

/**
 * Фильтр для задач в Activation Desk и других рабочих очередях.
 * Возвращает фрагмент where для модели Task.
 */
export function taskScopeFilter(session: SessionUser): Record<string, unknown> {
  if (hasGlobalAccess(session)) return {};

  if (session.role === "TEAM_LEAD") {
    // Задачи любого члена команды
    return { user: { team: session.team } };
  }

  if (session.role === "SUPERVISOR") {
    // Задачи своих подчинённых + свои
    return {
      user: {
        OR: [
          { id: session.id },
          { supervisorId: session.id },
        ],
      },
    };
  }

  // VB SPECIALIST — видит все задачи (они ведут активацию/реактивацию всей базы)
  if (session.team === "VB") return {};

  // SPECIALIST / KAM — только свои
  return { assignedTo: session.id };
}

/** Для реестра клиентов — все видят всех (чувствительные поля маскируются через PermissionConfig) */
export function clientAccessWhere(_session: SessionUser): ClientWhereFilter {
  return {};
}

/** Может ли пользователь менять стадию / архивировать */
export function canEdit(session: SessionUser): boolean {
  return session.role === "ADMIN" || session.role === "ANALYST";
}

/** Может ли пользователь видеть полный реестр клиентов */
export function canViewRegistry(session: SessionUser): boolean {
  return ["ADMIN", "DIRECTOR", "ANALYST", "TEAM_LEAD"].includes(session.role);
}
