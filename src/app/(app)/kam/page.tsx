import { Suspense } from "react";
import { getKAMPortfolio, KAMFilters } from "@/lib/actions/kam";
import { KAMTable } from "./KAMTable";

type SearchParams = Promise<Record<string, string>>;

const COHORT_COLORS: Record<string, string> = {
  ACTIVE:       "var(--mbank-green)",
  LOW_ACTIVE:   "#f59e0b",
  NEVER_ACTIVE: "#9ca3af",
  LAPSED:       "#ef4444",
  LAPSED_DEEP:  "#991b1b",
};

const COHORT_LABELS: Record<string, string> = {
  ACTIVE: "Активные", LOW_ACTIVE: "Низкая акт.", NEVER_ACTIVE: "Нет акт.",
  LAPSED: "Отток", LAPSED_DEEP: "Глуб. отток",
};

async function KAMContent({ sp }: { sp: Record<string, string> }) {
  const filters: KAMFilters = {
    search:    sp.search,
    cohort:    sp.cohort,
    kamId:     sp.kamId,
    page:      sp.page ? Number(sp.page) : 1,
  };

  const { clients, total, pages, kams, stats = [] } = await getKAMPortfolio(filters);

  const totalKAM = stats.reduce((s, g) => s + g._count.id, 0);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">KAM-клиентов всего</div>
          <div className="text-2xl font-bold text-gray-900">{totalKAM}</div>
        </div>
        {["ACTIVE", "LOW_ACTIVE", "LAPSED", "LAPSED_DEEP"].map((cohort) => {
          const g = stats.find((s) => s.clmCohort === cohort);
          return (
            <div key={cohort} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-400 mb-1">{COHORT_LABELS[cohort]}</div>
              <div className="text-2xl font-bold" style={{ color: COHORT_COLORS[cohort] }}>
                {g?._count.id ?? 0}
              </div>
              {g?._avg.gmv30d ? (
                <div className="text-xs text-gray-400 mt-1">
                  GMV avg: {Math.round(g._avg.gmv30d / 1000)}K
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <KAMTable
        clients={clients as Parameters<typeof KAMTable>[0]["clients"]}
        total={total}
        pages={pages}
        kams={kams}
      />
    </div>
  );
}

export default async function KAMPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">KAM Портфель</h2>
        <p className="text-sm text-gray-400 mt-0.5">Корпоративные клиенты под управлением KAM</p>
      </div>

      <Suspense fallback={<div className="text-sm text-gray-400 py-8 text-center">Загружаю...</div>}>
        <KAMContent sp={sp} />
      </Suspense>
    </div>
  );
}
