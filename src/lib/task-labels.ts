/**
 * Человекочитаемые метки для задач.
 * Используется в TaskCard, activation-desk, my-portfolio и любом другом UI,
 * где отображается triggerDay или приоритет задачи.
 */

import { SEQUENCE_TEMPLATES } from "@/lib/sequences";

// Метки приоритетов
export const TASK_PRIORITY_LABEL: Record<string, string> = {
  P1: "Срочно",
  P2: "Важно",
  P3: "Задача",
};

// Метки event-trigger и системных задач
export const TRIGGER_LABELS: Record<string, string> = {
  // Онбординг (sequential D+ tasks)
  "D+1":  "Онбординг: Welcome",
  "D+3":  "Онбординг: первая транзакция?",
  "D+7":  "Онбординг: нет транзакций",
  "D+14": "Онбординг: эскалация",

  // Реактивация
  "reactivation-30d":  "Реактивация — 30 дней",
  "reactivation-60d":  "Реактивация — 60 дней",

  // Кросс-продажи
  "cross-sell-acquiring": "Кросс-продажа: эквайринг",
  "cross-sell-salary":    "Кросс-продажа: зарплатный проект",
  "cross-sell-mbusiness": "Кросс-продажа: MBusiness",

  // KAM / Account
  "kam-review-60d":    "KAM Review",
  "grow-account-plan": "Account Plan",
  "qbr-overdue":       "QBR — просрочен",

  // Системные
  "unowned-client":       "Ничейный клиент",
  "no-touch-30d":         "Check-in — 30 дней без касания",
  "handoff":              "Передача клиента",
  "ghosting-auto-close":  "Ghosting: сделка без активности",
};

// Человекочитаемые названия последовательностей
export const SEQ_NAMES: Record<string, string> = {
  "onboarding":           "Онбординг",
  "reactivation":         "Реактивация",
  "cross-sell-acquiring": "MKassa",
  "account-plan-grow":    "Account Plan",
  "salary-project":       "ЗП-проект",
};

/**
 * Возвращает человекочитаемое название задачи по её triggerDay.
 *
 * Примеры:
 *   "D+3"                    → "Онбординг: первая транзакция?"
 *   "reactivation-60d"       → "Реактивация — 60 дней"
 *   "seq:onboarding:d14"     → "Онбординг — шаг 4 из 5"
 *   "seq:salary-project:d7"  → "ЗП-проект — шаг 3 из 5"
 *   null                     → "Задача"
 */
export function taskLabel(triggerDay: string | null | undefined): string {
  if (!triggerDay) return "Задача";

  // Последовательность: seq:{seqId}:d{dayOffset}
  const seqMatch = triggerDay.match(/^seq:([^:]+):d(\d+)$/);
  if (seqMatch) {
    const [, seqId, dayStr] = seqMatch;
    const seqName   = SEQ_NAMES[seqId] ?? seqId;
    const dayOffset = Number(dayStr);

    // Найти реальный порядковый номер шага по dayOffset
    const template  = SEQUENCE_TEMPLATES.find(s => s.id === seqId);
    if (template) {
      const stepIdx = template.steps.findIndex(s => s.dayOffset === dayOffset);
      const stepNum = stepIdx >= 0 ? stepIdx + 1 : dayOffset + 1;
      return `${seqName} — шаг ${stepNum} из ${template.steps.length}`;
    }
    return `${seqName} — шаг ${dayOffset + 1}`;
  }

  return TRIGGER_LABELS[triggerDay] ?? triggerDay;
}
