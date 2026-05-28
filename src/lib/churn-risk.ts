/**
 * Churn Risk Predictor (rule-based, v1)
 *
 * Returns churn probability and risk tier.
 * v2: replace with ML model trained on historical attrition data.
 *
 * Inspired by Salesforce Einstein Churn Scoring (76% accuracy @ 45 days).
 */

type ChurnInput = {
  clmStage:         string;
  clmCohort:        string;
  daysSinceLastTxn: number;
  txnCount30d:      number;
  gmv30d:           number;
  lastActivityDays: number | null;
};

export type ChurnRisk = {
  probability: number;     // 0–100
  tier:        "low" | "medium" | "high" | "critical";
  color:       string;
  label:       string;
  drivers:     string[];   // what's driving the risk
};

export function getChurnRisk(input: ChurnInput): ChurnRisk {
  let prob = 0;
  const drivers: string[] = [];

  // Stale client — no transactions
  if (input.daysSinceLastTxn > 90) {
    prob += 40; drivers.push(`${input.daysSinceLastTxn} дней без транзакций`);
  } else if (input.daysSinceLastTxn > 60) {
    prob += 28; drivers.push(`${input.daysSinceLastTxn} дней без транзакций`);
  } else if (input.daysSinceLastTxn > 30) {
    prob += 15; drivers.push(`${input.daysSinceLastTxn} дней без транзакций`);
  }

  // Low frequency
  if (input.txnCount30d === 0 && input.clmStage !== "ACQUIRE") {
    prob += 20; drivers.push("Нет транзакций за последние 30 дней");
  } else if (input.txnCount30d <= 1) {
    prob += 8;
  }

  // Cohort signal
  if (input.clmCohort === "LAPSED") {
    prob += 20; drivers.push("Когорта: Отток");
  } else if (input.clmCohort === "NEVER_ACTIVE") {
    prob += 15; drivers.push("Когорта: Никогда не активный");
  }

  // No manager contact
  if (input.lastActivityDays !== null && input.lastActivityDays > 45) {
    prob += 10; drivers.push(`${input.lastActivityDays} дней без контакта менеджера`);
  }

  // Reactivation stage = already at risk
  if (input.clmStage === "REACTIVATE") {
    prob += 10; drivers.push("Стадия: Реактивация");
  }

  // High GMV = less likely to churn (sticky)
  if (input.gmv30d > 500_000) prob = Math.max(0, prob - 10);
  if (input.gmv30d > 1_000_000) prob = Math.max(0, prob - 10);

  prob = Math.min(100, prob);

  let tier: ChurnRisk["tier"];
  let color: string;
  let label: string;

  if (prob >= 70) {
    tier = "critical"; color = "#dc2626"; label = "Критический";
  } else if (prob >= 45) {
    tier = "high";     color = "#f97316"; label = "Высокий";
  } else if (prob >= 20) {
    tier = "medium";   color = "#f59e0b"; label = "Средний";
  } else {
    tier = "low";      color = "#16a34a"; label = "Низкий";
  }

  return { probability: prob, tier, color, label, drivers };
}
