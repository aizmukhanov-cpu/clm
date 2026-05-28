import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyPortfolio } from "@/lib/actions/portfolio";
import { format, isAfter } from "date-fns";
import { CLMStage } from "@/generated/prisma/client";

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  ACQUIRE:    { bg: "#f3f4f6", text: "#374151" },
  ONBOARD:    { bg: "#eff6ff", text: "#1d4ed8" },
  ACTIVATE:   { bg: "#fffbeb", text: "#d97706" },
  GROW:       { bg: "var(--mbank-green-pale)", text: "var(--mbank-green)" },
  REACTIVATE: { bg: "#fff7ed", text: "#c2410c" },
};

const PRIORITY_STYLE: Record<string, string> = {
  P1: "bg-red-100 text-red-700",
  P2: "bg-amber-100 text-amber-700",
  P3: "bg-blue-50 text-blue-600",
};

export default async function MyPortfolioPage() {
  const data = await getMyPortfolio();
  if (!data) redirect("/login");

  const {
    user, totalClients, activationRate, activeClients, atRiskClients,
    lapsedClients, tasks, activitiesWeek, funnel, recentTasks, topClients,
  } = data;

  const maxFunnel = Math.max(...funnel.map((f) => f.count), 1);

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Мой портфель</h2>
          <p className="text-sm text-gray-400 mt-0.5">{user.name}</p>
        </div>
        <Link
          href="/clients"
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Все клиенты →
        </Link>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Клиентов</div>
          <div className="text-3xl font-bold text-gray-900">{totalClients}</div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${activationRate}%`, background: "var(--mbank-green)" }}
              />
            </div>
            <span className="text-xs font-semibold shrink-0" style={{ color: "var(--mbank-green)" }}>
              {activationRate}% акт.
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Задачи</div>
          <div className="flex items-end gap-3">
            <div>
              <div className="text-3xl font-bold text-gray-900">{tasks.open + tasks.overdue}</div>
              <div className="text-xs text-gray-400 mt-1">открытых</div>
            </div>
            {tasks.overdue > 0 && (
              <div className="pb-0.5">
                <span className="text-sm font-bold text-red-600">{tasks.overdue}</span>
                <span className="text-xs text-red-400 ml-1">просроч.</span>
              </div>
            )}
          </div>
          {tasks.p1 > 0 && (
            <div className="mt-2">
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">
                P1: {tasks.p1}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Активности (7 дней)</div>
          <div className="text-3xl font-bold text-gray-900">{activitiesWeek}</div>
          <div className="mt-2 text-xs text-gray-400">контактов с клиентами</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Сегменты</div>
          <div className="space-y-1.5 mt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-600">● Активные</span>
              <span className="font-bold">{activeClients}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-orange-500">● Под риском</span>
              <span className="font-bold">{atRiskClients}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-red-600">● Отток</span>
              <span className="font-bold">{lapsedClients}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">

        {/* ── CLM Funnel ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">CLM Воронка</h3>
          <div className="space-y-2.5">
            {funnel.map(({ stage, label, count }) => {
              const col = STAGE_COLORS[stage] ?? { bg: "#f3f4f6", text: "#374151" };
              const pct = Math.round((count / maxFunnel) * 100);
              return (
                <Link key={stage} href={`/clients?stage=${stage}`}>
                  <div className="group hover:opacity-80 transition-opacity">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-600">{label}</span>
                      <span className="font-bold" style={{ color: col.text }}>{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: col.text }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Upcoming Tasks ── */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Ближайшие задачи</h3>
          {recentTasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Задач нет 🎉</p>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((t) => {
                const overdue = isAfter(new Date(), new Date(t.dueDate));
                return (
                  <Link key={t.id} href={`/clients/${t.client.id}`}>
                    <div className={`flex items-start gap-3 rounded-lg p-3 border text-xs transition-colors hover:bg-gray-50 ${
                      overdue ? "border-red-100 bg-red-50/50" : "border-gray-100"
                    }`}>
                      <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${PRIORITY_STYLE[t.priority] ?? ""}`}>
                        {t.priority}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-gray-700 truncate">{t.client.name}</span>
                          {t.triggerDay && (
                            <span className="text-[10px] text-gray-400 shrink-0">{t.triggerDay}</span>
                          )}
                        </div>
                        <p className="text-gray-600 leading-snug truncate">{t.action}</p>
                      </div>
                      <span className={`shrink-0 font-medium tabular-nums ${overdue ? "text-red-500" : "text-gray-400"}`}>
                        {format(new Date(t.dueDate), "dd.MM")}
                        {overdue && " ⚠"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Clients needing attention ── */}
      {topClients.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Требуют внимания
            <span className="ml-2 text-xs font-normal text-gray-400">
              — дольше всего без транзакций в активных стадиях
            </span>
          </h3>
          <div className="divide-y divide-gray-50">
            {topClients.map((c) => {
              const col = STAGE_COLORS[c.clmStage] ?? { bg: "#f3f4f6", text: "#374151" };
              return (
                <Link key={c.id} href={`/clients/${c.id}`}>
                  <div className="flex items-center gap-4 py-3 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                    </div>
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: col.bg, color: col.text }}
                    >
                      {c.clmStage}
                    </span>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-bold tabular-nums ${
                        c.daysSinceLastTxn > 60 ? "text-red-600"
                        : c.daysSinceLastTxn > 30 ? "text-orange-500"
                        : "text-gray-600"
                      }`}>
                        {c.daysSinceLastTxn > 0 ? `${c.daysSinceLastTxn} дн.` : "сегодня"}
                      </div>
                      <div className="text-[10px] text-gray-400">без тр.</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
