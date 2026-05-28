/**
 * Automated Sequences
 *
 * Pre-defined multi-step task chains.
 * When a manager launches a sequence, all tasks are created at once
 * with calculated due dates relative to today.
 *
 * Each step inherits priority and assignee from the launch call.
 */

export type SequenceStep = {
  dayOffset:  number;     // days from launch date
  action:     string;     // task description
  priority:   "P1" | "P2" | "P3";
  note?:      string;     // manager hint
};

export type SequenceTemplate = {
  id:          string;
  name:        string;
  description: string;
  icon:        string;
  forStage?:   string[];  // recommended CLM stages
  steps:       SequenceStep[];
};

export const SEQUENCE_TEMPLATES: SequenceTemplate[] = [

  // ── ОНБОРДИНГ ─────────────────────────────────────────────
  {
    id:          "onboarding",
    name:        "Онбординг клиента",
    description: "Стандартный 30-дневный план для новых клиентов",
    icon:        "🚀",
    forStage:    ["ONBOARD", "ACTIVATE"],
    steps: [
      { dayOffset: 0,  priority: "P1", action: "Приветственный звонок: представиться, объяснить следующие шаги" },
      { dayOffset: 3,  priority: "P1", action: "Демонстрация MBusiness: показать ключевые функции интернет-банка" },
      { dayOffset: 7,  priority: "P2", action: "Проверить первую транзакцию, решить технические вопросы" },
      { dayOffset: 14, priority: "P2", action: "Check-in: собрать обратную связь, предложить дополнительные продукты" },
      { dayOffset: 30, priority: "P2", action: "30-дневный review: оценить активность, перевести в ACTIVATE если готов" },
    ],
  },

  // ── РЕАКТИВАЦИЯ ────────────────────────────────────────────
  {
    id:          "reactivation",
    name:        "Реактивация клиента",
    description: "7-шаговый план возврата неактивного клиента",
    icon:        "🔄",
    forStage:    ["REACTIVATE"],
    steps: [
      { dayOffset: 0,  priority: "P1", action: "Звонок реактивации: выяснить причину паузы в транзакциях" },
      { dayOffset: 2,  priority: "P1", action: "Отправить персональное предложение / скидку по тарифу" },
      { dayOffset: 5,  priority: "P2", action: "Follow-up звонок: получить ответ на предложение" },
      { dayOffset: 10, priority: "P2", action: "Встреча в офисе / видео-встреча для снятия барьеров" },
      { dayOffset: 21, priority: "P3", action: "Финальная проверка: возобновились ли транзакции?" },
    ],
  },

  // ── КРОСС-ПРОДАЖА ЭКВАЙРИНГА ──────────────────────────────
  {
    id:          "cross-sell-acquiring",
    name:        "Кросс-продажа MKassa",
    description: "Продать эквайринг активному клиенту без POS/QR",
    icon:        "💳",
    forStage:    ["ACTIVATE", "GROW"],
    steps: [
      { dayOffset: 0,  priority: "P2", action: "Первичная презентация MKassa POS/QR: выяснить потребность" },
      { dayOffset: 3,  priority: "P2", action: "Отправить КП с тарифами MKassa, ответить на вопросы" },
      { dayOffset: 7,  priority: "P2", action: "Follow-up: получить решение, при интересе — оформить заявку" },
      { dayOffset: 14, priority: "P3", action: "Проверить статус подключения MKassa в системе" },
    ],
  },

  // ── GROW: ACCOUNT PLAN ─────────────────────────────────────
  {
    id:          "account-plan-grow",
    name:        "Account Plan (GROW)",
    description: "KAM: составить и согласовать годовой план развития",
    icon:        "📈",
    forStage:    ["GROW"],
    steps: [
      { dayOffset: 0,  priority: "P1", action: "Собрать данные: GMV, продукты, цели клиента на год" },
      { dayOffset: 5,  priority: "P1", action: "Подготовить черновик Account Plan с revenue target" },
      { dayOffset: 10, priority: "P1", action: "Встреча с клиентом: презентовать и согласовать Account Plan" },
      { dayOffset: 14, priority: "P2", action: "Подписать plan of record, внести в CRM" },
      { dayOffset: 30, priority: "P2", action: "Первый monthly review по Account Plan" },
      { dayOffset: 60, priority: "P3", action: "Q1 review: выполнение плана, корректировка если нужно" },
    ],
  },

  // ── ЗАРПЛАТНЫЙ ПРОЕКТ ─────────────────────────────────────
  {
    id:          "salary-project",
    name:        "Зарплатный проект",
    description: "Продажа ЗП-проекта активному клиенту",
    icon:        "👥",
    forStage:    ["ACTIVATE", "GROW"],
    steps: [
      { dayOffset: 0,  priority: "P2", action: "Выяснить количество сотрудников, текущий банк для зарплаты" },
      { dayOffset: 2,  priority: "P2", action: "Отправить предложение по зарплатному проекту с тарифами" },
      { dayOffset: 7,  priority: "P2", action: "Follow-up: ответы на вопросы, демо MBusiness для сотрудников" },
      { dayOffset: 14, priority: "P2", action: "Оформить заявку на зарплатный проект, передать в back-office" },
      { dayOffset: 21, priority: "P3", action: "Проверить зачисление первой зарплаты, собрать обратную связь" },
    ],
  },
];

export function getSequenceById(id: string): SequenceTemplate | undefined {
  return SEQUENCE_TEMPLATES.find(s => s.id === id);
}
