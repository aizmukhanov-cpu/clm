/**
 * Конфигурация матрицы доступа — ТОЛЬКО константы и типы.
 * Этот файл безопасен для импорта в client components.
 * Серверные функции (getPermissionsForRole, getAllPermissions) — в permissions.ts
 */

export const PERMISSION_RESOURCES = [
  "financials",
  "credit",
  "txn_metrics",
  "activities",
  "tasks",
  "changelog",
] as const;

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

export const RESOURCE_LABELS: Record<PermissionResource, string> = {
  financials:  "GMV и объём транзакций",
  credit:      "Кредитные продукты",
  txn_metrics: "Дней без транзакций",
  activities:  "История контактов",
  tasks:       "Задачи клиента",
  changelog:   "История изменений",
};

export const RESOURCE_DESCRIPTIONS: Record<PermissionResource, string> = {
  financials:  "gmv30d, txnCount30d — объём платежей клиента",
  credit:      "Наличие кредита, депозита, торгового финансирования",
  txn_metrics: "Сколько дней прошло с последней транзакции",
  activities:  "Лог звонков, встреч, переписок",
  tasks:       "Открытые и выполненные задачи по клиенту",
  changelog:   "Когда и кто менял CLM-стадию",
};

export const CONFIGURABLE_ROLES = [
  "ANALYST", "DIRECTOR",
  "TEAM_LEAD", "SUPERVISOR", "SPECIALIST", "KAM",
] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

export const ROLE_LABELS: Record<ConfigurableRole, string> = {
  ANALYST:    "Аналитик",
  DIRECTOR:   "Директор",
  TEAM_LEAD:  "Руководитель команды",
  SUPERVISOR: "Супервайзер",
  SPECIALIST: "Специалист (B2B/KM/VB/BRANCH)",
  KAM:        "KAM-менеджер",
};

export const DEFAULT_PERMISSIONS: Record<ConfigurableRole, Record<PermissionResource, boolean>> = {
  ANALYST: {
    financials:  true,
    credit:      true,
    txn_metrics: true,
    activities:  true,
    tasks:       true,
    changelog:   true,
  },
  DIRECTOR: {
    financials:  true,
    credit:      true,
    txn_metrics: true,
    activities:  true,
    tasks:       true,
    changelog:   true,
  },
  TEAM_LEAD: {
    financials:  true,
    credit:      false,
    txn_metrics: true,
    activities:  true,
    tasks:       true,
    changelog:   true,
  },
  SUPERVISOR: {
    financials:  false,
    credit:      false,
    txn_metrics: true,
    activities:  true,
    tasks:       true,
    changelog:   true,
  },
  SPECIALIST: {
    financials:  false,
    credit:      false,
    txn_metrics: true,
    activities:  true,
    tasks:       true,
    changelog:   true,
  },
  KAM: {
    financials:  false,
    credit:      false,
    txn_metrics: false,
    activities:  true,
    tasks:       true,
    changelog:   false,
  },
};

export type PermissionMatrix = Record<PermissionResource, boolean>;
