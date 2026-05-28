import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

/* ─── Продукты ─────────────────────────────────────────── */

const PRODUCTS: { key: string; label: string; field: string; color: string }[] = [
  { key: "MBUSINESS",      label: "MBusiness",       field: "hasMBusiness",     color: "#1A5C38" },
  { key: "MKASSA_POS",     label: "MKassa POS",      field: "hasMKassaPos",     color: "#1d4ed8" },
  { key: "MKASSA_QR",      label: "MKassa QR",       field: "hasMKassaQr",      color: "#7c3aed" },
  { key: "SALARY_PROJECT", label: "Зарплатный пр.",  field: "hasSalaryProject", color: "#0891b2" },
  { key: "ACQUIRING",      label: "Эквайринг",       field: "hasAcquiring",     color: "#d97706" },
  { key: "CREDIT",         label: "Кредит",          field: "hasCredit",        color: "#dc2626" },
  { key: "DEPOSIT",        label: "Депозит",         field: "hasDeposit",       color: "#059669" },
  { key: "TRADE_FINANCE",  label: "Торг. финанс.",   field: "hasTradeFinance",  color: "#be185d" },
  { key: "PAYROLL",        label: "Payroll",         field: "hasPayroll",       color: "#ea580c" },
  { key: "CORPORATE_CARD", label: "Корп. карта",     field: "hasCorporateCard", color: "#6d28d9" },
];

type ProductField = "hasMBusiness" | "hasMKassaPos" | "hasMKassaQr" | "hasSalaryProject" |
  "hasAcquiring" | "hasCredit" | "hasDeposit" | "hasTradeFinance" | "hasPayroll" | "hasCorporateCard";

/* ─── Данные ───────────────────────────────────────────── */

async function getBranchData(year: number) {
  const [branches, targets] = await Promise.all([
    db.branch.findMany({
      include: {
        clients: {
          where: { isArchived: false },
          select: {
            clmStage: true,
            clmCohort: true,
            hasMBusiness: true,
            hasMKassaPos: true,
            hasMKassaQr: true,
            hasSalaryProject: true,
            hasAcquiring: true,
            hasCredit: true,
            hasDeposit: true,
            hasTradeFinance: true,
            hasPayroll: true,
            hasCorporateCard: true,
          },
        },
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.branchProductTarget.findMany({ where: { year } }),
  ]);

  // Индекс: branchId → product → targetCount
  const targetMap: Record<string, Record<string, number>> = {};
  for (const t of targets) {
    if (!targetMap[t.branchId]) targetMap[t.branchId] = {};
    targetMap[t.branchId][t.product] = t.targetCount;
  }

  return branches.map((b) => {
    const totalClients = b.clients.length;
    const activeClients = b.clients.filter((c) => c.clmCohort === "ACTIVE").length;
    const activationRate = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0;

    const products = PRODUCTS.map((p) => {
      const actual = b.clients.filter((c) => c[p.field as ProductField] === true).length;
      const target = targetMap[b.id]?.[p.key] ?? 0;
      const pct = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0;
      return { ...p, actual, target, pct };
    });

    const totalTarget = products.reduce((s, p) => s + p.target, 0);
    const totalActual = products.reduce((s, p) => s + p.actual, 0);
    const overallPct  = totalTarget > 0 ? Math.min(Math.round((totalActual / totalTarget) * 100), 100) : 0;

    return {
      id: b.id,
      name: b.name,
      region: b.region,
      managerCount: b._count.users,
      totalClients,
      activeClients,
      activationRate,
      targetPct: b.targetPct,
      products,
      totalTarget,
      totalActual,
      overallPct,
    };
  });
}

/* ─── Page ──────────────────────────────────────────────── */

export default async function BranchesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const year = new Date().getFullYear();
  const branches = await getBranchData(year);

  const grandTotal   = branches.reduce((s, b) => s + b.totalClients, 0);
  const grandActive  = branches.reduce((s, b) => s + b.activeClients, 0);
  const grandTarget  = branches.reduce((s, b) => s + b.totalTarget, 0);
  const grandActual  = branches.reduce((s, b) => s + b.totalActual, 0);
  const grandPct     = grandTarget > 0 ? Math.min(Math.round((grandActual / grandTarget) * 100), 100) : 0;

  return (
    <div className="space-y-6">

      {/* ── Заголовок ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Филиалы</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Цели по продуктам {year} · {branches.length} филиала
          </p>
        </div>
        <div
          className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
          style={{ background: "var(--mbank-green)" }}
        >
          Корп. сегмент
        </div>
      </div>

      {/* ── Итого ── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Всего клиентов",  val: grandTotal,  sub: "во всех филиалах" },
          { label: "Активных",        val: grandActive, sub: `${grandTotal > 0 ? Math.round((grandActive / grandTotal) * 100) : 0}% от базы` },
          { label: "Факт подключений",val: grandActual, sub: `план ${grandTarget}` },
          { label: "Выполнение плана",val: `${grandPct}%`, sub: `${grandActual} из ${grandTarget}` },
        ].map(({ label, val, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className="text-2xl font-bold text-gray-900">{val}</div>
            <div className="text-xs text-gray-400 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Карточки филиалов ── */}
      {branches.map((b) => (
        <div key={b.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Шапка филиала */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0"
                style={{ background: "var(--mbank-green-dark)" }}
              >
                {b.name.slice(0, 2)}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800">{b.name}</div>
                <div className="text-xs text-gray-400">{b.region} · {b.managerCount} менеджеров</div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-right">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Клиентов</div>
                <div className="text-lg font-bold text-gray-800">{b.totalClients}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Активация</div>
                <div className={`text-lg font-bold ${b.activationRate >= b.targetPct ? "text-green-600" : "text-orange-500"}`}>
                  {b.activationRate}%
                  <span className="text-xs font-normal text-gray-400 ml-1">цель {b.targetPct}%</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Продукты</div>
                <div className={`text-lg font-bold ${b.overallPct >= 80 ? "text-green-600" : b.overallPct >= 50 ? "text-amber-500" : "text-red-500"}`}>
                  {b.overallPct}%
                  <span className="text-xs font-normal text-gray-400 ml-1">{b.totalActual}/{b.totalTarget}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Продуктовая таблица */}
          <div className="grid grid-cols-5 gap-0 divide-x divide-y divide-gray-50">
            {b.products.map((p) => (
              <div key={p.key} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">{p.label}</span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: p.pct >= 80 ? "#dcfce7" : p.pct >= 50 ? "#fef9c3" : "#fee2e2",
                      color:      p.pct >= 80 ? "#16a34a" : p.pct >= 50 ? "#ca8a04" : "#dc2626",
                    }}
                  >
                    {p.pct}%
                  </span>
                </div>
                {/* Прогресс-бар */}
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${p.pct}%`,
                      background: p.pct >= 80 ? "#16a34a" : p.pct >= 50 ? "#f59e0b" : p.color,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span className="font-semibold text-gray-700">{p.actual}</span>
                  <span>из {p.target}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Ссылка на клиентов */}
          <div className="px-6 py-3 bg-gray-50/60 border-t border-gray-50 flex justify-end">
            <Link
              href={`/clients?branch=${b.id}`}
              className="text-xs font-medium hover:underline"
              style={{ color: "var(--mbank-green)" }}
            >
              Клиенты филиала →
            </Link>
          </div>
        </div>
      ))}

    </div>
  );
}
