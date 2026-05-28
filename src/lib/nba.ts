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
};

const PRODUCT_COUNT = 10;

function productsActive(c: ClientSignals): number {
  return [
    c.hasMBusiness, c.hasMKassaPos, c.hasMKassaQr, c.hasSalaryProject,
    c.hasAcquiring, c.hasCredit, c.hasDeposit, c.hasTradeFinance,
    c.hasPayroll, c.hasCorporateCard,
  ].filter(Boolean).length;
}

/** Returns sorted recommendations (P1 first) */
export function getNextBestActions(c: ClientSignals): NBARecommendation[] {
  const recs: NBARecommendation[] = [];

  // ── ОНБОРДИНГ ────────────────────────────────────────────
  if (c.clmStage === "ONBOARD" && c.txnCount30d === 0 && c.daysSinceLastTxn > 7) {
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
  if (c.daysSinceLastTxn >= 60 && c.clmStage !== "ACQUIRE") {
    recs.push({
      priority: "P1",
      icon: "🔴",
      title: "Срочная реактивация",
      reason: `${c.daysSinceLastTxn} дней без транзакций — высокий риск оттока`,
      action: "Звонок + встреча. Выяснить причину, предложить условия возврата",
      tag: "reactivation",
    });
  } else if (c.daysSinceLastTxn >= 30 && c.clmStage === "GROW") {
    recs.push({
      priority: "P2",
      icon: "⚠️",
      title: "Снижение активности",
      reason: `${c.daysSinceLastTxn} дней без транзакций у GROW-клиента`,
      action: "Позвонить, уточнить удовлетворённость. Предложить новый продукт",
      tag: "reactivation",
    });
  }

  // ── КРОСС-ПРОДАЖИ ─────────────────────────────────────────
  if (c.clmCohort === "ACTIVE" || c.clmStage === "GROW") {
    const active = productsActive(c);
    const depth  = active / PRODUCT_COUNT;

    if (!c.hasAcquiring && !c.hasMKassaPos && !c.hasMKassaQr && c.gmv30d > 100_000) {
      recs.push({
        priority: "P2",
        icon: "💳",
        title: "Предложить эквайринг",
        reason: `GMV ${(c.gmv30d / 1000).toFixed(0)}K — клиент готов к POS/QR`,
        action: "Выслать КП на MKassa. Упор на комиссию ниже рынка",
        tag: "cross-sell",
      });
    }

    if (!c.hasSalaryProject && !c.hasPayroll && c.gmv30d > 200_000) {
      recs.push({
        priority: "P2",
        icon: "👥",
        title: "Зарплатный проект",
        reason: "Активный клиент без зарплатного проекта — упущенный продукт",
        action: "Запросить кол-во сотрудников, выслать предложение",
        tag: "cross-sell",
      });
    }

    if (!c.hasMBusiness && c.clmCohort === "ACTIVE") {
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
  if (c.isKAMClient && c.lastActivityDays !== null && c.lastActivityDays > 60) {
    recs.push({
      priority: "P1",
      icon: "🤝",
      title: "Account Review просрочен",
      reason: `${c.lastActivityDays} дней без контакта с KAM-клиентом`,
      action: "Запланировать встречу. Обновить Account Plan",
      tag: "review",
    });
  } else if (c.isKAMClient && (c.lastActivityDays === null || c.lastActivityDays > 30)) {
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
  if (
    c.lastActivityDays !== null &&
    c.lastActivityDays > 30 &&
    c.clmStage !== "ACQUIRE"
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
