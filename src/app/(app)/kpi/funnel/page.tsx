import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getPipelineFunnel, getLostReasonStats } from "@/lib/actions/pipeline-analytics";

const TEAM_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  B2B:    { bg: "#eff6ff", text: "#1d4ed8", bar: "#3b82f6" },
  KM:     { bg: "#f0fdf4", text: "#15803d", bar: "#22c55e" },
  BRANCH: { bg: "#f0fdfa", text: "#0f766e", bar: "#14b8a6" },
};

function formatAmount(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export default async function PipelineFunnelPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [funnels, lostStats] = await Promise.all([
    getPipelineFunnel(),
    getLostReasonStats(),
  ]);

  if (!funnels) redirect("/login");

  const maxLost = lostStats[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/kpi" className="hover:text-gray-600">KPI</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Воронка Pipeline</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Конверсионная воронка</h2>
          <p className="text-sm text-gray-400 mt-0.5">Активные сделки по стадиям и аналитика проигрышей</p>
        </div>
      </div>

      {/* Funnels per team */}
      <div className="space-y-5">
        {funnels.map(funnel => {
          const col = TEAM_COLORS[funnel.team] ?? { bg: "#f3f4f6", text: "#374151", bar: "#6b7280" };
          const totalActive = funnel.stages.reduce((s, st) => s + st.count, 0);
          const firstCount  = funnel.stages[0]?.count || 1;

          return (
            <div key={funnel.team} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Team header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: col.bg, color: col.text }}
                  >
                    {funnel.team}
                  </span>
                  <span className="text-sm font-semibold text-gray-800">
                    {totalActive} активных сделок
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    Выиграно: {funnel.wonCount}
                    {funnel.wonAmount > 0 && ` · ${formatAmount(funnel.wonAmount)}`}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                    Проиграно: {funnel.lostCount}
                  </span>
                </div>
              </div>

              {/* Funnel stages */}
              <div className="px-6 py-4">
                <div className="space-y-2">
                  {funnel.stages.map((stage, idx) => {
                    const widthPct = firstCount > 0 ? Math.round((stage.count / firstCount) * 100) : 0;
                    return (
                      <div key={stage.stage} className="flex items-center gap-3">
                        {/* Stage label */}
                        <div className="w-32 shrink-0 text-xs text-gray-500 text-right font-medium">
                          {stage.label}
                        </div>

                        {/* Bar */}
                        <div className="flex-1 relative">
                          <div className="h-8 bg-gray-50 rounded-lg overflow-hidden">
                            <div
                              className="h-full rounded-lg flex items-center px-3 transition-all"
                              style={{
                                width:      `${Math.max(widthPct, 4)}%`,
                                background: col.bar,
                                opacity:    0.3 + (0.7 * ((funnel.stages.length - idx) / funnel.stages.length)),
                              }}
                            />
                          </div>
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="text-xs font-bold text-gray-700">{stage.count}</span>
                            {stage.amount > 0 && (
                              <span className="text-[11px] text-gray-400 ml-1">· {formatAmount(stage.amount)}</span>
                            )}
                          </div>
                        </div>

                        {/* Conversion */}
                        <div className="w-16 shrink-0 text-right">
                          {stage.conversionFromPrev !== null ? (
                            <span
                              className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                              style={{
                                background: stage.conversionFromPrev >= 50 ? "#dcfce7" :
                                            stage.conversionFromPrev >= 25 ? "#fefce8" : "#fef2f2",
                                color:      stage.conversionFromPrev >= 50 ? "#15803d" :
                                            stage.conversionFromPrev >= 25 ? "#92400e" : "#dc2626",
                              }}
                            >
                              {stage.conversionFromPrev}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-gray-400 mt-3">
                  * % — конверсия из предыдущей стадии
                </p>
              </div>
            </div>
          );
        })}

        {funnels.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
            Нет активных сделок в pipeline
          </div>
        )}
      </div>

      {/* Lost Reason Analytics */}
      {lostStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">🔴 Топ причин проигрыша</h3>
            <p className="text-xs text-gray-400 mt-0.5">По всем командам · все периоды</p>
          </div>
          <div className="px-6 py-4 space-y-3">
            {lostStats.map(stat => (
              <div key={stat.reason + stat.label} className="flex items-center gap-3">
                <div className="w-40 shrink-0 text-xs text-gray-600 font-medium truncate">
                  {stat.label}
                </div>
                <div className="flex-1 relative">
                  <div className="h-5 bg-gray-50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400"
                      style={{ width: `${Math.round((stat.count / maxLost) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 shrink-0 text-right">
                  <span className="text-xs font-semibold text-gray-700">{stat.count}</span>
                  <span className="text-[11px] text-gray-400 ml-1">({stat.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
