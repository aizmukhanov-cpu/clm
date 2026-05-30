/**
 * Структурированные исходы задач по типу триггера.
 *
 * Отображаются в модалке выполнения задачи вместо свободного текста.
 * Менеджер выбирает исход из списка + пишет опциональный комментарий.
 * Это позволяет строить аналитику по качеству работы с клиентами.
 */

export type TaskOutcome = {
  value: string;
  label: string;
};

/** Исходы по типу триггера (triggerDay) */
export const TASK_OUTCOMES: Record<string, TaskOutcome[]> = {

  // ── Онбординг ──────────────────────────────────────────────
  "D+1": [
    { value: "onboarded",    label: "✅ Онбординг проведён — клиент подключён к MBusiness" },
    { value: "partial",      label: "⚠️ Подключён частично — нужна ещё помощь" },
    { value: "no_answer",    label: "📵 Не дозвонился" },
    { value: "callback",     label: "🔄 Просит перезвонить" },
  ],

  "D+3": [
    { value: "txn_done",     label: "✅ Транзакция уже прошла" },
    { value: "txn_soon",     label: "📅 Обещает в ближайшие дни" },
    { value: "tech_issue",   label: "🛠 Технические проблемы — помогаем решить" },
    { value: "no_answer",    label: "📵 Не дозвонился" },
  ],

  "D+7": [
    { value: "txn_done",     label: "✅ Транзакция прошла" },
    { value: "txn_week",     label: "📅 Обещает на следующей неделе" },
    { value: "competitor",   label: "😟 Переходит к конкуренту" },
    { value: "no_answer",    label: "📵 Не выходит на связь" },
  ],

  "D+14": [
    { value: "resolved",     label: "✅ Проблема решена — транзакция будет" },
    { value: "reactivate",   label: "🔁 Переводим в реактивацию" },
    { value: "closing",      label: "❌ Клиент закрывает счёт" },
    { value: "no_answer",    label: "📵 Не выходит на связь" },
  ],

  // ── Реактивация ────────────────────────────────────────────
  "reactivation-30d": [
    { value: "returning",    label: "✅ Готов вернуться — обещает транзакцию" },
    { value: "txn_soon",     label: "📅 Обещает на следующей неделе" },
    { value: "competitor",   label: "😟 Работает с конкурентом" },
    { value: "no_answer",    label: "📵 Не выходит на связь" },
  ],

  "reactivation-60d": [
    { value: "meeting_set",  label: "🤝 Назначили встречу" },
    { value: "returning",    label: "✅ Обещает вернуться" },
    { value: "closing",      label: "❌ Уходит окончательно" },
    { value: "no_answer",    label: "📵 Не выходит на связь" },
  ],

  // ── Касание ────────────────────────────────────────────────
  "no-touch-30d": [
    { value: "checkin_ok",   label: "✅ Check-in: всё хорошо, клиент активен" },
    { value: "issue_found",  label: "⚠️ Выявили проблему — работаем" },
    { value: "no_answer",    label: "📵 Не ответил" },
  ],

  // ── Кросс-продажи ──────────────────────────────────────────
  "cross-sell-acquiring": [
    { value: "proposal_sent", label: "📧 Отправили КП на MKassa" },
    { value: "meeting_set",   label: "📅 Назначили встречу" },
    { value: "interested",    label: "✅ Заинтересован — ждём решения" },
    { value: "declined",      label: "❌ Отказался" },
  ],

  "cross-sell-salary": [
    { value: "proposal_sent", label: "📧 Отправили КП на ЗП-проект" },
    { value: "meeting_set",   label: "📅 Назначили встречу" },
    { value: "interested",    label: "✅ Заинтересован — ждём решения" },
    { value: "declined",      label: "❌ Отказался" },
  ],

  // ── KAM / Account ──────────────────────────────────────────
  "kam-review-60d": [
    { value: "meeting_done",  label: "✅ Account Review проведён" },
    { value: "meeting_set",   label: "📅 Встреча запланирована" },
    { value: "postponed",     label: "🔄 Клиент перенёс" },
  ],

  "qbr-overdue": [
    { value: "qbr_done",     label: "✅ QBR проведён" },
    { value: "meeting_set",  label: "📅 Встреча запланирована" },
    { value: "postponed",    label: "🔄 Клиент перенёс" },
  ],

  "grow-account-plan": [
    { value: "plan_created", label: "✅ Account Plan заполнен" },
    { value: "in_progress",  label: "🔄 В процессе согласования" },
    { value: "declined",     label: "❌ Клиент не готов" },
  ],

  // ── Системные ──────────────────────────────────────────────
  "unowned-client": [
    { value: "assigned",     label: "✅ Менеджер назначен" },
    { value: "transferred",  label: "🔄 Передан в другую команду" },
  ],

  "handoff": [
    { value: "done",         label: "✅ Передача завершена" },
    { value: "in_progress",  label: "🔄 В процессе передачи" },
  ],
};

/**
 * Возвращает список исходов для данного триггера.
 * Если триггер неизвестен — возвращает базовый набор.
 */
export function getOutcomes(triggerDay: string | null | undefined): TaskOutcome[] {
  if (triggerDay && TASK_OUTCOMES[triggerDay]) {
    return TASK_OUTCOMES[triggerDay];
  }
  return [
    { value: "done",        label: "✅ Выполнено" },
    { value: "in_progress", label: "🔄 Продолжаем работу" },
    { value: "no_answer",   label: "📵 Не дозвонился" },
    { value: "declined",    label: "❌ Отказался / не актуально" },
  ];
}
