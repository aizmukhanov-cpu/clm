import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMyPortfolio, getMyClients } from "@/lib/actions/portfolio";
import { MyClientsTable } from "./MyClientsTable";

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  ACQUIRE:    { bg: "#f3f4f6", text: "#374151" },
  ONBOARD:    { bg: "#eff6ff", text: "#1d4ed8" },
  ACTIVATE:   { bg: "#fffbeb", text: "#d97706" },
  GROW:       { bg: "var(--mbank-green-pale)", text: "var(--mbank-green)" },
  REACTIVATE: { bg: "#fff7ed", text: "#c2410c" },
};

const STAGE_LABEL: Record<string, string> = {
  ACQUIRE: "Привлечение", ONBOARD: "Онбординг", ACTIVATE: "Активация",
  GROW: "Развитие", REACTIVATE: "Реактивация",
};

type SearchParams = Promise<Record<string, string>>;

export default async function MyPortfolioPage({ searchParams }: { searchParams: SearchParams }) {
  const sp   = await searchParams;
  const data = await getMyPortfolio();
  if (!data) redirect("/login");

  const clientsData = await getMyClients({
    search: sp.search,
    stage:  sp.stage,
    page:   sp.page ? Number(sp.page) : 1,
  });

  const {
    user, totalClients, activationRate, activeClients, atRiskClients,
    lapsedClients, activitiesWeek, funnel, topClients,
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
          href="/my-tasks"
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Мои задачи →
        </Link>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-3 gap-4">
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

      {/* ── CLM Funnel ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">CLM Воронка</h3>
        <div className="grid grid-cols-5 gap-3">
          {funnel.map(({ stage, label, count }) => {
            const col = STAGE_COLORS[stage] ?? { bg: "#f3f4f6", text: "#374151" };
            const pct = Math.round((count / maxFunnel) * 100);
            return (
              <Link key={stage} href={`/my-portfolio?stage=${stage}`} className="group">
                <div className="text-center hover:opacity-80 transition-opacity">
                  <div
                    className="rounded-xl p-3 mb-2"
                    style={{ background: col.bg }}
                  >
                    <div className="text-2xl font-bold" style={{ color: col.text }}>{count}</div>
                  </div>
                  <div className="text-xs text-gray-500 font-medium">{label}</div>
                  <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
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
                      {STAGE_LABEL[c.clmStage] ?? c.clmStage}
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

      {/* ── Full client list ── */}
      <Suspense fallback={<div className="h-64 bg-white rounded-xl animate-pulse" />}>
        {clientsData && (
          <MyClientsTable
            clients={clientsData.clients}
            total={clientsData.total}
            pages={clientsData.pages}
            page={clientsData.page}
          />
        )}
      </Suspense>

    </div>
  );
}
