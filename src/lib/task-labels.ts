/**
 * Человекочитаемые метки для задач.
 * Используется в TaskCard, activation-desk, my-portfolio и любом другом UI,
 * где отображается triggerDay или приоритет задачи.
 */

// Метки приоритетов
export const TASK_PRIORITY_LABEL: Record<string, string> = {
  P1: "Срочно",
  P2: "Важно",
  P3: "Задача",
};

// Метки event-trigger задач
export const TRIGGER_LABELS: Record<string, string> = {
  "reactivation-30d":        "Реактивация — 30 дней",
  "reactivation-60d":        "Реактивация — 60 дней",
  "cross-sell-acquiring":    "Кросс-продажа: эквайринг",
  "cross-sell-salary":       "Кросс-продажа: зарплатный проект",
  "cross-sell-mbusiness":    "Кросс-продажа: MBusiness",
  "kam-review-60d":          "KAM Review",
  "grow-account-plan":       "Account Plan",
  "no-touch-30d":            "Плановый check-in",
  "handoff":                 "Передача клиента",
};

// Человекочитаемые названия последовательностей
export const SEQ_NAMES: Record<string, string> = {
  "onboarding":            "Онбординг",
  "reactivation":          "Реактивация",
  "cross-sell-acquiring":  "MKassa",
  "account-plan-grow":     "Account Plan",
  "salary-project":        "ЗП-проект",
};

/**
 * Возвращает человекочитаемое название задачи по её triggerDay.
 *
 * Примеры:
 *   "reactivation-60d"       → "Реактивация — 60 дней"
 *   "seq:onboarding:d2"      → "Онбординг — шаг 3"
 *   "seq:salary-project:d14" → "ЗП-проект — шаг 2"
 *   null                     → "Задача"
 */
export function taskLabel(triggerDay: string | null | undefined): string {
  if (!triggerDay) return "Задача";

  // Последовательность: seq:{seqId}:d{dayOffset}
  const seqMatch = triggerDay.match(/^seq:([^:]+):d(\d+)$/);
  if (seqMatch) {
    const [, seqId, day] = seqMatch;
    const seqName = SEQ_NAMES[seqId] ?? seqId;
    return `${seqName} — шаг ${Number(day) + 1}`;
  }

  return TRIGGER_LABELS[triggerDay] ?? triggerDay;
}
