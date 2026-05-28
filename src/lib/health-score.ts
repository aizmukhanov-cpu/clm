/**
 * Relationship Health Score (0–100)
 *
 * Composite metric combining:
 *   Recency   — daysSinceLastTxn   (max 30 pts)
 *   Frequency — txnCount30d         (max 25 pts)
 *   Monetary  — gmv30d              (max 20 pts)
 *   Depth     — productDepthPct     (max 15 pts)
 *   Engagement— activities last 30d (max 10 pts)
 */

type HealthInput = {
  daysSinceLastTxn:  number;
  txnCount30d:       number;
  gmv30d:            number;
  productDepthPct:   number;
  activitiesLast30d: number;
};

export type HealthScore = {
  score:   number;         // 0–100
  grade:   "high" | "medium" | "low" | "critical";
  color:   string;
  label:   string;
  breakdown: {
    recency:   number;
    frequency: number;
    monetary:  number;
    depth:     number;
    engagement:number;
  };
};

export function getHealthScore(input: HealthInput): HealthScore {
  // Recency (30 pts): best if txn today, 0 if >90 days
  const recency = Math.max(0, Math.round(30 * (1 - Math.min(input.daysSinceLastTxn, 90) / 90)));

  // Frequency (25 pts): 5+ txns/mo = max
  const frequency = Math.min(25, Math.round(input.txnCount30d * 5));

  // Monetary (20 pts): logarithmic scale up to 5M
  const monetary = input.gmv30d <= 0
    ? 0
    : Math.min(20, Math.round(20 * Math.log10(1 + input.gmv30d / 100_000) / Math.log10(51)));

  // Depth (15 pts): productDepthPct 0-100 → 0-15
  const depth = Math.round(input.productDepthPct * 0.15);

  // Engagement (10 pts): activities from manager last 30 days
  const engagement = Math.min(10, input.activitiesLast30d * 3);

  const score = recency + frequency + monetary + depth + engagement;

  let grade: HealthScore["grade"];
  let color: string;
  let label: string;

  if (score >= 70) {
    grade = "high";
    color = "var(--mbank-green)";
    label = "Высокий";
  } else if (score >= 45) {
    grade = "medium";
    color = "#f59e0b";
    label = "Средний";
  } else if (score >= 20) {
    grade = "low";
    color = "#f97316";
    label = "Низкий";
  } else {
    grade = "critical";
    color = "#dc2626";
    label = "Критический";
  }

  return {
    score,
    grade,
    color,
    label,
    breakdown: { recency, frequency, monetary, depth, engagement },
  };
}
