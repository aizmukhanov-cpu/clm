import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getProductTargets, getTeamTargets, getProducts,
} from "@/lib/actions/admin-products";
import { TEAMS } from "@/lib/product-config";
import { ProductTargetsForm }    from "./ProductTargetsForm";
import { TeamTargetsForm }       from "./TeamTargetsForm";
import { ProductCatalogSection } from "./ProductCatalogSection";

type SearchParams = Promise<Record<string, string>>;

const MONTH_LABELS = [
  "Янв","Фев","Мар","Апр","Май","Июн",
  "Июл","Авг","Сен","Окт","Ноя","Дек",
];

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/dashboard");

  const sp    = await searchParams;
  const tab   = sp.tab === "targets" ? "targets" : "catalog";
  const scope = sp.scope === "teams" ? "teams" : "branches";
  const year  = Number(sp.year)  || new Date().getFullYear();
  const month = Number(sp.month) || new Date().getMonth() + 1;

  const products = await getProducts();

  const branchData = (tab === "targets" && scope === "branches")
    ? await getProductTargets(year, month)
    : null;

  const teamData = (tab === "targets" && scope === "teams")
    ? await getTeamTargets(year, month)
    : null;

  // Build year/month URL helper
  function ymUrl(y: number, m: number) {
    return `?tab=targets&scope=${scope}&year=${y}&month=${m}`;
  }
  function scopeUrl(s: string) {
    return `?tab=targets&scope=${s}&year=${year}&month=${month}`;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Продукты и планы</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Управление каталогом банковских продуктов и месячными плановыми показателями
        </p>
      </div>

      {/* Top-level tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <a
          href="?tab=catalog"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "catalog"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📋 Каталог продуктов
        </a>
        <a
          href={`?tab=targets&scope=${scope}&year=${year}&month=${month}`}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "targets"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🎯 Плановые показатели
        </a>
      </div>

      {/* ── Catalog tab ── */}
      {tab === "catalog" && (
        <ProductCatalogSection products={products} />
      )}

      {/* ── Targets tab ── */}
      {tab === "targets" && (
        <>
          {/* Scope switcher: Филиалы | Команды */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <a
                href={scopeUrl("branches")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  scope === "branches"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                🏢 По филиалам
              </a>
              <a
                href={scopeUrl("teams")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  scope === "teams"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                👥 По командам
              </a>
            </div>

            {/* Year selector */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-1">Год:</span>
              {[year - 1, year, year + 1].map((y) => (
                <a
                  key={y}
                  href={ymUrl(y, month)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    y === year
                      ? "border-[var(--mbank-green)] bg-[var(--mbank-green-pale)] text-[var(--mbank-green)] font-semibold"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {y}
                </a>
              ))}
            </div>

            {/* Month selector */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-400 mr-1">Месяц:</span>
              {MONTH_LABELS.map((label, i) => {
                const m = i + 1;
                return (
                  <a
                    key={m}
                    href={ymUrl(year, m)}
                    className={`text-sm px-2.5 py-1 rounded-lg border transition-colors ${
                      m === month
                        ? "border-[var(--mbank-green)] bg-[var(--mbank-green-pale)] text-[var(--mbank-green)] font-semibold"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </a>
                );
              })}
            </div>
          </div>

          {/* No active products warning */}
          {products.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">
              Нет активных продуктов. Сначала добавьте продукты в{" "}
              <a href="?tab=catalog" className="text-[var(--mbank-green)] underline">
                Каталоге продуктов
              </a>
              .
            </div>
          )}

          {/* Branch targets */}
          {scope === "branches" && branchData && products.length > 0 && (
            <ProductTargetsForm
              branches={branchData.branches}
              products={branchData.products.map((p) => ({
                code:  p.code,
                label: p.label,
                icon:  p.icon,
              }))}
              targetMap={branchData.map}
              year={year}
              month={month}
            />
          )}

          {/* Team targets */}
          {scope === "teams" && teamData && products.length > 0 && (
            <TeamTargetsForm
              teams={[...TEAMS]}
              products={teamData.products.map((p) => ({
                code:  p.code,
                label: p.label,
                icon:  p.icon,
              }))}
              targetMap={teamData.map}
              year={year}
              month={month}
            />
          )}
        </>
      )}
    </div>
  );
}
