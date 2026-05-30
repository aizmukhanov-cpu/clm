/**
 * Next Best Action (NBA) Engine
 *
 * Rule-based system that evaluates client signals and returns
 * prioritised action recommendations for the manager.
 *
 * Inspired by Salesforce Einstein NBA / SAP Next Best Action.
 */

export type NBARecommendation = {
  priority: "P1" | "P2" | "P3";
  icon:     string;
  title:    string;
  reason:   string;
  action:   string;
  tag:      "call" | "cross-sell" | "reactivation" | "review" | "onboard" | "escalate";
};

type ClientSignals = {
  clmStage:         string;
  clmCohort:        string;
  daysSinceLastTxn: number;
  txnCount30d:      number;
  gmv30d:           number;
  productDepthPct:  number;
  hasMBusiness:     boolean;
  hasMKassaPos:     boolean;
  hasMKassaQr:      boolean;
  hasSalaryProject: boolean;
  hasAcquiring:     boolean;
  hasCredit:        boolean;
  hasDeposit:       boolean;
  hasTradeFinance:  boolean;
  hasPayroll:       boolean;
  hasCorporateCard: boolean;
  openTasksCount:   number;
  lastActivityDays: number | null; // дней с последней активности менеджера
  isKAMClient:      boolean;
  /**
   * triggerDay значения активных (PENDING/OVERDUE) задач клиента.
   * NBA не показывает рекомендацию, если задача по тому же триггеру уже существует.
   */
  activeTriggers:   string[];
};

const PRODUCT_COUNT = 10;

function productsActive(c: ClientSignals): number {
  return [
    c.hasMBusiness, c.hasMKassaPos, c.hasMKassaQr, c.hasSalaryProject,
    c.hasAcquiring, c.hasCredit, c.hasDeposit, c.hasTradeFinance,
    c.hasPayroll, c.hasCorporateCard,
  ].filter(Boolean).length;
}

/**
 * Проверяет, есть ли уже активная задача для данного триггера.
 *
 * Используется для P2/P3 рекомендаций — снижение шума когда задача уже в работе.
 * P1 рекомендации намеренно НЕ подавляются, КРОМЕ онбордингового блока (где
 * D+ задачи уже полностью отслеживают ситуацию).
 */
function hasTask(activeTriggers: string[], ...keys: string[]): boolean {
  return keys.some(k => activeTriggers.some(t => t === k || t.startsWith(`seq:${k}:`)));
}

/** Returns sorted recommendations (P1 first), suppressed if task already exists */
export function getNextBestActions(c: ClientSignals): NBARecommendation[] {
  const recs: NBARecommendation[] = [];
  const at = c.activeTriggers;

  // ── ОНБОРДИНГ ────────────────────────────────────────────
  // Не показываем, если D+ задачи уже в работе: они точнее отслеживают ситуацию.
  // NBA здесь нужен только для самого раннего момента (до первого cron-запуска).
  // daysSinceLastTxn > 7 убрано: для нового клиента default=0, условие никогда не выполнялось.
  // Теперь рекомендация показывается сразу в день онбординга.
  // Подавляется как только создаётся D+1 задача (hasTask выше).
  if (
    c.clmStage === "ONBOARD" &&
    c.txnCount30d === 0 &&
    !hasTask(at, "D+1", "D+3", "D+7", "D+14") // D+ задачи уже ведут эту ситуацию
  ) {
    recs.push({
      priority: "P1",
      icon: "🚀",
      title: "Первая транзакция",
      reason: `${c.daysSinceLastTxn} дней без транзакций после открытия счёта`,
      action: "Позвонить — убрать технические барьеры подключения MBusiness",
      tag: "onboard",
    });
  }

  // ── РЕАКТИВАЦИЯ ───────────────────────────────────────────
  // P1 — ВСЕГДА показывается при REACTIVATE или 60+ дней без транзакций.
  if (c.clmStage === "REACTIVATE" || (c.daysSinceLastTxn >= 60 && c.clmStage !== "ACQUIRE")) {
    recs.push({
      priority: "P1",
      icon: "🔴",
      title: "Срочная реактивация",
      reason: c.clmStage === "REACTIVATE"
        ? `Клиент в стадии реактивации — ${c.daysSinceLastTxn} дней без транзакций`
        : `${c.daysSinceLastTxn} дней без транзакций — высокий риск оттока`,
      action: "Звонок + встреча. Выяснить причину, предложить условия возврата",
      tag: "reactivation",
    });
  } else if (
    c.daysSinceLastTxn >= 30 &&
    (c.clmStage === "GROW" || c.clmStage === "ACTIVATE") && // было только GROW — добавлен ACTIVATE
    !hasTask(at, "reactivation-30d", "reactivation-60d") // P2 — подавляется если задача есть
  ) {
    recs.push({
      priority: "P2",
      icon: "⚠️",
      title: "Снижение активности",
      reason: `${c.daysSinceLastTxn} дней без транзакций — клиент теряет активность`,
      action: "Позвонить, уточнить удовлетворённость. Предложить новый продукт",
      tag: "reactivation",
    });
  }

  // ── КРОСС-ПРОДАЖИ ─────────────────────────────────────────
  // Не показываем кросс-продажи для клиентов в реактивации —
  // сначала нужно восстановить базовую активность.
  if (
    (c.clmCohort === "ACTIVE" || c.clmStage === "GROW") &&
    c.clmStage !== "REACTIVATE"
  ) {
    const active = productsActive(c);
    const depth  = active / PRODUCT_COUNT;

    if (
      !c.hasAcquiring && !c.hasMKassaPos && !c.hasMKassaQr &&
      c.gmv30d > 100_000 &&
      !hasTask(at, "cross-sell-acquiring")
    ) {
      recs.push({
        priority: "P2",
        icon: "💳",
        title: "Предложить эквайринг",
        reason: `GMV ${(c.gmv30d / 1000).toFixed(0)}K — клиент готов к POS/QR`,
        action: "Выслать КП на MKassa. Упор на комиссию ниже рынка",
        tag: "cross-sell",
      });
    }

    if (
      !c.hasSalaryProject && !c.hasPayroll &&
      c.gmv30d > 200_000 &&
      !hasTask(at, "cross-sell-salary", "salary-project")
    ) {
      recs.push({
        priority: "P2",
        icon: "👥",
        title: "Зарплатный проект",
        reason: "Активный клиент без зарплатного проекта — упущенный продукт",
        action: "Запросить кол-во сотрудников, выслать предложение",
        tag: "cross-sell",
      });
    }

    if (
      !c.hasMBusiness &&
      c.clmCohort === "ACTIVE" &&
      !hasTask(at, "cross-sell-mbusiness")
    ) {
      recs.push({
        priority: "P2",
        icon: "📱",
        title: "Подключить MBusiness",
        reason: "Клиент активен, но не использует интернет-банк",
        action: "Провести демо MBusiness. Онбординг — 1 час",
        tag: "cross-sell",
      });
    }

    if (!c.hasTradeFinance && c.gmv30d > 1_000_000) {
      recs.push({
        priority: "P3",
        icon: "📦",
        title: "Торговое финансирование",
        reason: `GMV ${(c.gmv30d / 1_000_000).toFixed(1)}M — потенциал для ТФ`,
        action: "Направить предложение по аккредитивам / гарантиям",
        tag: "cross-sell",
      });
    }

    if (!c.hasCredit && depth < 0.4 && c.clmCohort === "ACTIVE") {
      recs.push({
        priority: "P3",
        icon: "📋",
        title: "Кредитование",
        reason: `Глубина продуктов ${Math.round(depth * 100)}% — есть куда расти`,
        action: "Оценить кредитный потенциал, предложить овердрафт",
        tag: "cross-sell",
      });
    }
  }

  // ── ACCOUNT REVIEW (для KAM-клиентов) ────────────────────
  // P1 — не подавляется: KAM обязан знать о просроченном review
  if (c.isKAMClient && c.lastActivityDays !== null && c.lastActivityDays > 60) {
    recs.push({
      priority: "P1",
      icon: "🤝",
      title: "Account Review просрочен",
      reason: `${c.lastActivityDays} дней без контакта с KAM-клиентом`,
      action: "Запланировать встречу. Обновить Account Plan",
      tag: "review",
    });
  } else if (
    c.isKAMClient &&
    (c.lastActivityDays === null || c.lastActivityDays > 30) &&
    !hasTask(at, "grow-account-plan", "account-plan-grow")
  ) {
    recs.push({
      priority: "P2",
      icon: "📅",
      title: "Запланировать встречу",
      reason: "KAM-клиент — рекомендована встреча раз в месяц",
      action: "Согласовать дату следующего Account Review",
      tag: "review",
    });
  }

  // ── НЕТ АКТИВНОСТЕЙ ОТ МЕНЕДЖЕРА ─────────────────────────
  // Подавляется если есть задача реактивации — она уже требует того же звонка.
  if (
    c.lastActivityDays !== null &&
    c.lastActivityDays > 30 &&
    c.clmStage !== "ACQUIRE" &&
    !hasTask(at, "no-touch-30d", "reactivation-30d", "reactivation-60d")
  ) {
    recs.push({
      priority: "P3",
      icon: "📞",
      title: "Нет касания 30+ дней",
      reason: `Последний контакт ${c.lastActivityDays} дней назад`,
      action: "Позвонить — плановый check-in. Зафиксировать в истории",
      tag: "call",
    });
  }

  // Сортировка: P1 → P2 → P3
  const order = { P1: 0, P2: 1, P3: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}
