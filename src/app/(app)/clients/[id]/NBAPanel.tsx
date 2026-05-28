import { getNextBestActions } from "@/lib/nba";
import type { NBARecommendation } from "@/lib/nba";

type Props = {
  client: {
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
    tasks:            { triggerDay: string | null; status: string }[];
    activities:       { performedAt: Date }[];
    kamId:            string | null;
  };
};

const PRIORITY_STYLE: Record<string, { border: string; bg: string; badge: string; badgeText: string }> = {
  P1: {
    border:    "border-l-red-400",
    bg:        "bg-red-50/60",
    badge:     "bg-red-100 text-red-700",
    badgeText: "Срочно",
  },
  P2: {
    border:    "border-l-amber-400",
    bg:        "bg-amber-50/60",
    badge:     "bg-amber-100 text-amber-700",
    badgeText: "Важно",
  },
  P3: {
    border:    "border-l-blue-300",
    bg:        "bg-blue-50/40",
    badge:     "bg-blue-100 text-blue-600",
    badgeText: "Рекомендуется",
  },
};

function daysSince(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

export function NBAPanel({ client }: Props) {
  const lastActivityDays =
    client.activities.length > 0
      ? daysSince(client.activities[0].performedAt)
      : null;

  // Собираем triggerDay всех активных задач (PENDING / OVERDUE)
  // NBA использует их чтобы не дублировать уже созданные задачи
  const activeTriggers = client.tasks
    .filter(t => t.status === "PENDING" || t.status === "OVERDUE")
    .map(t => t.triggerDay)
    .filter((d): d is string => d !== null);

  const recs = getNextBestActions({
    clmStage:         client.clmStage,
    clmCohort:        client.clmCohort,
    daysSinceLastTxn: client.daysSinceLastTxn,
    txnCount30d:      client.txnCount30d,
    gmv30d:           client.gmv30d,
    productDepthPct:  client.productDepthPct,
    hasMBusiness:     client.hasMBusiness,
    hasMKassaPos:     client.hasMKassaPos,
    hasMKassaQr:      client.hasMKassaQr,
    hasSalaryProject: client.hasSalaryProject,
    hasAcquiring:     client.hasAcquiring,
    hasCredit:        client.hasCredit,
    hasDeposit:       client.hasDeposit,
    hasTradeFinance:  client.hasTradeFinance,
    hasPayroll:       client.hasPayroll,
    hasCorporateCard: client.hasCorporateCard,
    openTasksCount:   client.tasks.length,
    lastActivityDays,
    isKAMClient:      client.kamId !== null,
    activeTriggers,
  });

  if (recs.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
          <span>✅</span>
          <span>Всё хорошо — нет рекомендаций по этому клиенту</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="text-base">🤖</span>
        <h3 className="text-sm font-semibold text-gray-800">Next Best Action</h3>
        <span className="ml-auto text-[11px] text-gray-400">{recs.length} рекомендаций</span>
      </div>

      {/* Recommendations */}
      <div className="divide-y divide-gray-50">
        {recs.map((r, i) => {
          const s = PRIORITY_STYLE[r.priority];
          return (
            <div
              key={i}
              className={`flex gap-3 px-5 py-3.5 border-l-2 ${s.border} ${s.bg}`}
            >
              <span className="text-xl shrink-0 mt-0.5">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-800">{r.title}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.badge}`}>
                    {s.badgeText}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-1">{r.reason}</p>
                <p className="text-xs text-gray-700 font-medium">
                  → {r.action}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
