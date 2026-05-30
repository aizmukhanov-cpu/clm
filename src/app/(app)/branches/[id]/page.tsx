import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";

type Params = Promise<{ id: string }>;

const PRODUCTS = [
  { key: "MBUSINESS",      label: "MBusiness",       field: "hasMBusiness"     },
  { key: "MKASSA_POS",     label: "MKassa POS",      field: "hasMKassaPos"     },
  { key: "MKASSA_QR",      label: "MKassa QR",       field: "hasMKassaQr"      },
  { key: "SALARY_PROJECT", label: "ЗП-проект",       field: "hasSalaryProject" },
  { key: "ACQUIRING",      label: "Эквайринг",       field: "hasAcquiring"     },
  { key: "CREDIT",         label: "Кредит",          field: "hasCredit"        },
  { key: "DEPOSIT",        label: "Депозит",         field: "hasDeposit"       },
  { key: "TRADE_FINANCE",  label: "Торг. финанс.",   field: "hasTradeFinance"  },
  { key: "PAYROLL",        label: "Payroll",         field: "hasPayroll"       },
  { key: "CORPORATE_CARD", label: "Корп. карта",     field: "hasCorporateCard" },
] as const;

type ProductField = (typeof PRODUCTS)[number]["field"];

export default async function BranchDashboardPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const now        = new Date();
  const year       = now.getFullYear();
  const month      = now.getMonth() + 1;
  const monthStart = startOfMonth(now);

  const branch = await db.branch.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true, name: true, team: true, role: true, planMonthly: true,
          _count: { select: { managedClients: true } },
        },
        orderBy: [{ team: "asc" }, { name: "asc" }],
      },
      clients: {
        where: { isArchived: false },
        select: {
          clmStage: true, clmCohort: true, managerId: true,
          createdAt: true, activatedAt: true,
          hasMBusiness: true, hasMKassaPos: true, hasMKassaQr: true,
          hasSalaryProject: true, hasAcquiring: true, hasCredit: true,
          hasDeposit: true, hasTradeFinance: true, hasPayroll: true,
          hasCorporateCard: true,
        },
      },
      productTargets: { where: { year, month } },
    },
  });

  if (!branch) notFound();

  // Access control: ADMIN sees all, DIRECTOR/TEAM_LEAD can see their branch
  const canView =
    session.role === "ADMIN" ||
    session.role === "DIRECTOR" ||
    session.role === "ANALYST" ||
    (session.role === "TEAM_LEAD" && branch.users.some(u => u.id === session.id));

  if (!canView) redirect("/branches");

  // Compute stats
  const totalClients  = branch.clients.length;
  const activeClients = branch.clients.filter(c => c.clmCohort === "ACTIVE").length;
  const activationRate = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0;

  // New clients this month (ONBOARD/ACTIVATE/GROW clients created this month)
  const newThisMonth = branch.clients.filter(
    c => new Date(c.createdAt) >= monthStart && c.clmStage !== "ACQUIRE"
  ).length;

  // Activities this month
  const activitiesThisMonth = await db.activity.count({
    where: {
      client: { branchId: id },
      performedAt: { gte: monthStart },
    },
  });

  // Open + overdue tasks
  const [openTasks, overdueTasks] = await Promise.all([
    db.task.count({
      where: { client: { branchId: id }, status: "PENDING", dueDate: { gte: now } },
    }),
    db.task.count({
      where: { client: { branchId: id }, status: { notIn: ["DONE", "CANCELLED"] as const }, dueDate: { lt: now } },
    }),
  ]);

  // Product targets + actuals
  const targetMap: Record<string, number> = {};
  for (const t of branch.productTargets) targetMap[t.product] = t.targetCount;

  const productStats = PRODUCTS.map(p => {
    const actual = branch.clients.filter(c => c[p.field as ProductField] === true).length;
    const target = targetMap[p.key] ?? 0;
    const pct    = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : null;
    return { ...p, actual, target, pct };
  });

  // Per-manager stats
  const managerStats = await Promise.all(
    branch.users
      .filter(u => ["SPECIALIST", "KAM", "SUPERVISOR"].includes(u.role))
      .map(async (mgr) => {
        const [activations, activities, overdue] = await Promise.all([
          db.changelog.count({
            where: {
              changedBy: mgr.id, field: "clmStage", newVal: "ACTIVATE",
              changedAt: { gte: monthStart },
            },
          }),
          db.activity.count({
            where: { performedBy: mgr.id, performedAt: { gte: monthStart } },
          }),
          db.task.count({
            where: { assignedTo: mgr.id, status: { notIn: ["DONE", "CANCELLED"] as const }, dueDate: { lt: now } },
          }),
        ]);
        return {
          ...mgr,
          clientCount: mgr._count.managedClients,
          activations,
          activities,
          overdue,
          planPct: mgr.planMonthly && mgr.planMonthly > 0
            ? Math.min(Math.round((activations / mgr.planMonthly) * 100), 100)
            : null,
        };
      })
  );

  const monthLabel = format(now, "LLLL yyyy", { locale: ru });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/branches" className="hover:text-gray-600">Филиалы</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{branch.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{branch.name}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{branch.region} · {monthLabel}</p>
          </div>
          {branch.marketSharePct && (
            <div className="text-right">
              <div className="text-xs text-gray-400">Доля рынка</div>
              <div className="text-lg font-bold text-gray-800">{branch.marketSharePct.toFixed(1)}%</div>
              {branch.marketCapacityYL && branch.marketCapacityIP && (
                <div className="text-xs text-gray-400">
                  из {(branch.marketCapacityYL + branch.marketCapacityIP).toLocaleString()} ЮЛ+ИП
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Клиентов", val: totalClients, sub: "в портфеле" },
          { label: "Активных", val: activeClients, sub: `${activationRate}% активация`, green: activationRate >= branch.targetPct },
          { label: "Новых в месяце", val: newThisMonth, sub: monthLabel, green: newThisMonth > 0 },
          { label: "Активностей", val: activitiesThisMonth, sub: "контактов за месяц" },
        ].map(({ label, val, sub, green }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className={`text-2xl font-bold ${green ? "text-emerald-600" : "text-gray-900"}`}>{val}</div>
            <div className="text-xs text-gray-400 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Tasks summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Открытых задач</div>
          <div className="text-2xl font-bold text-gray-900">{openTasks}</div>
        </div>
        <div className={`rounded-xl border shadow-sm p-4 ${overdueTasks > 0 ? "bg-red-50 border-red-100" : "bg-white border-gray-100"}`}>
          <div className="text-xs text-gray-400 mb-1">Просрочено</div>
          <div className={`text-2xl font-bold ${overdueTasks > 0 ? "text-red-600" : "text-gray-900"}`}>
            {overdueTasks}
          </div>
        </div>
      </div>

      {/* Product targets */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Продукты — план/факт {monthLabel}</h3>
        </div>
        <div className="grid grid-cols-5 gap-0 divide-x divide-y divide-gray-50">
          {productStats.map(p => (
            <div key={p.key} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">{p.label}</span>
                {p.pct !== null && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: p.pct >= 80 ? "#dcfce7" : p.pct >= 50 ? "#fef9c3" : "#fee2e2",
                      color:      p.pct >= 80 ? "#16a34a" : p.pct >= 50 ? "#ca8a04" : "#dc2626",
                    }}
                  >
                    {p.pct}%
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-1.5">
                {p.pct !== null && (
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:      `${p.pct}%`,
                      background: p.pct >= 80 ? "#16a34a" : p.pct >= 50 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[11px] text-gray-400">
                <span className="font-semibold text-gray-700">{p.actual}</span>
                <span>{p.target > 0 ? `из ${p.target}` : "нет плана"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manager breakdown */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Менеджеры — {monthLabel}</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              {["Менеджер", "Команда", "Клиентов", "Активаций", "% плана", "Активностей", "Просрочено"].map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {managerStats.map(mgr => (
              <tr key={mgr.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{mgr.name}</td>
                <td className="px-4 py-3">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {mgr.team}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{mgr.clientCount}</td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-bold ${mgr.activations > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                    {mgr.activations}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {mgr.planPct !== null ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${mgr.planPct}%`,
                            background: mgr.planPct >= 80 ? "#16a34a" : mgr.planPct >= 50 ? "#f59e0b" : "#ef4444",
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: mgr.planPct >= 80 ? "#16a34a" : mgr.planPct >= 50 ? "#d97706" : "#dc2626" }}
                      >
                        {mgr.planPct}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">нет плана</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{mgr.activities}</td>
                <td className="px-4 py-3">
                  {mgr.overdue > 0 ? (
                    <span className="text-sm font-semibold text-red-600">{mgr.overdue}</span>
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            {managerStats.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">
                  Нет менеджеров в этом филиале
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
