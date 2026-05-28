/**
 * CLM Automation Rules — правила автоматического перехода стадий и когорт.
 *
 * Данные правила применяются при ночной синхронизации (runCLMSync).
 * Ручные переходы (changeStage) по-прежнему ограничены ALLOWED-матрицей.
 *
 * Источник данных: txnCount30d, gmv30d, daysSinceLastTxn на модели Client.
 * В production эти поля обновляются CDC-пайплайном из core banking.
 */

export type CohortKey  = "NEVER_ACTIVE" | "LOW_ACTIVE" | "ACTIVE" | "LAPSED";
export type StageKey   = "ACQUIRE" | "ONBOARD" | "ACTIVATE" | "GROW" | "REACTIVATE";

// ─── Пороговые значения ────────────────────────────────────
// Изменяемые: в будущем вынести в SystemConfig + UI редактор

export const THRESHOLDS = {
  // Когорты
  ACTIVE_TXN_MIN:     3,        // мин. кол-во транзакций за 30д → ACTIVE
  LAPSED_DAYS:       60,        // дней без транзакций → LAPSED

  // Переходы стадий
  ONBOARD_TXN:        1,        // транзакций за 30д → выход из ONBOARD
  GROW_TXN_MIN:       5,        // мин. транзакций за 30д → вход в GROW
  GROW_GMV_MIN:  500_000,       // мин. GMV за 30д (сом) → вход в GROW
  DORMANT_DAYS:      60,        // дней без тр. → вход в REACTIVATE
  RETURN_TXN:         1,        // транзакций за 30д → выход из REACTIVATE
} as const;

// ─── Описания правил (для UI) ──────────────────────────────

export type RuleDefinition = {
  id:        string;
  from:      StageKey | StageKey[];
  to:        StageKey;
  trigger:   string;
  note?:     string;
};

export const STAGE_RULES: RuleDefinition[] = [
  {
    id:      "onboard_to_activate",
    from:    "ONBOARD",
    to:      "ACTIVATE",
    trigger: `Транзакций за 30д ≥ ${THRESHOLDS.ONBOARD_TXN}`,
    note:    "Первая транзакция — клиент начал пользоваться",
  },
  {
    id:      "activate_to_grow",
    from:    "ACTIVATE",
    to:      "GROW",
    trigger: `Транзакций за 30д ≥ ${THRESHOLDS.GROW_TXN_MIN} И GMV ≥ ${(THRESHOLDS.GROW_GMV_MIN / 1000).toFixed(0)}K сом`,
    note:    "Клиент активен и генерирует стабильный оборот",
  },
  {
    id:      "to_reactivate",
    from:    ["ACTIVATE", "GROW"],
    to:      "REACTIVATE",
    trigger: `Дней без транзакций ≥ ${THRESHOLDS.DORMANT_DAYS}`,
    note:    "Клиент перестал пользоваться продуктами — нужна реактивация",
  },
  {
    id:      "reactivate_to_activate",
    from:    "REACTIVATE",
    to:      "ACTIVATE",
    trigger: `Транзакций за 30д ≥ ${THRESHOLDS.RETURN_TXN} и дней без тр. ≤ 30`,
    note:    "Клиент вернулся — начал транзачить снова",
  },
];

// ─── Чистые функции расчёта ────────────────────────────────

type ClientSnapshot = {
  clmStage:        StageKey;
  clmCohort:       CohortKey;
  txnCount30d:     number;
  gmv30d:          number;
  daysSinceLastTxn: number;
};

/**
 * Вычисляет когорту из транзакционных данных.
 */
export function calcCohort(c: ClientSnapshot): CohortKey {
  const { txnCount30d, daysSinceLastTxn } = c;

  if (txnCount30d >= THRESHOLDS.ACTIVE_TXN_MIN) return "ACTIVE";

  if (txnCount30d > 0) return "LOW_ACTIVE";

  // Нет транзакций за 30д — смотрим историю
  if (daysSinceLastTxn >= THRESHOLDS.LAPSED_DAYS) return "LAPSED";

  return "NEVER_ACTIVE";
}

/**
 * Определяет новую стадию по правилам автоматизации.
 * Возвращает null если стадия не должна меняться.
 *
 * ACQUIRE не затрагивается — переход в ONBOARD только ручной (открытие счёта).
 */
export function calcStageTransition(c: ClientSnapshot): StageKey | null {
  const { clmStage, txnCount30d, gmv30d, daysSinceLastTxn } = c;

  switch (clmStage) {
    case "ONBOARD":
      // Первая транзакция → Активация
      if (txnCount30d >= THRESHOLDS.ONBOARD_TXN && daysSinceLastTxn <= 30) {
        return "ACTIVATE";
      }
      break;

    case "ACTIVATE":
      // Спад → Реактивация
      if (daysSinceLastTxn >= THRESHOLDS.DORMANT_DAYS) {
        return "REACTIVATE";
      }
      // Рост активности → GROW
      if (txnCount30d >= THRESHOLDS.GROW_TXN_MIN && gmv30d >= THRESHOLDS.GROW_GMV_MIN) {
        return "GROW";
      }
      break;

    case "GROW":
      // Спад → Реактивация
      if (daysSinceLastTxn >= THRESHOLDS.DORMANT_DAYS) {
        return "REACTIVATE";
      }
      break;

    case "REACTIVATE":
      // Вернулся → Активация
      if (txnCount30d >= THRESHOLDS.RETURN_TXN && daysSinceLastTxn <= 30) {
        return "ACTIVATE";
      }
      break;
  }

  return null;
}
