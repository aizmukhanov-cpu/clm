import { notFound } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/lib/actions/clients";
import { getSession } from "@/lib/auth";
import { getPermissionsForRole } from "@/lib/permissions";
import { StageBadge } from "./StageBadge";
import { TaskCard } from "./TaskCard";
import { ProductEditor } from "./ProductEditor";
import { ContactPersons } from "./ContactPersons";
import { AccountPlanPanel } from "./AccountPlanPanel";
import { NBAPanel } from "./NBAPanel";
import { SequenceLauncher } from "./SequenceLauncher";
import { ClientNotes } from "./ClientNotes";
import { getHealthScore } from "@/lib/health-score";
import { getChurnRisk } from "@/lib/churn-risk";
import { getActiveSequences } from "@/lib/actions/sequences";
import { getClientNotes } from "@/lib/actions/clients";
import { UserRole } from "@/generated/prisma/client";
import { formatDistanceToNow, format } from "date-fns";
import { ru } from "date-fns/locale";

/* ─── Helpers ────────────────────────────────────────────── */

const COHORT_LABEL: Record<string, string> = {
  NEVER_ACTIVE: "Нет активности",
  LOW_ACTIVE:   "Низкая активность",
  ACTIVE:       "Активный",
  LAPSED:       "Отток",
};
const COHORT_STYLE: Record<string, { bg: string; text: string }> = {
  NEVER_ACTIVE: { bg: "#f3f4f6", text: "#6b7280" },
  LOW_ACTIVE:   { bg: "#fefce8", text: "#92400e" },
  ACTIVE:       { bg: "var(--mbank-green-pale)", text: "var(--mbank-green)" },
  LAPSED:       { bg: "#fef2f2", text: "#dc2626" },
};

const ACTIVITY_ICON: Record<string, string> = {
  CALL:    "📞",
  MEETING: "🤝",
  EMAIL:   "✉️",
};

const PRODUCTS = [
  { key: "hasMBusiness",     label: "MBusiness",    icon: "📱", category: "digital" },
  { key: "hasMKassaPos",     label: "MKassa POS",   icon: "💳", category: "acquiring" },
  { key: "hasMKassaQr",      label: "MKassa QR",    icon: "📷", category: "acquiring" },
  { key: "hasAcquiring",     label: "Эквайринг",    icon: "💰", category: "acquiring" },
  { key: "hasSalaryProject", label: "ЗП-проект",    icon: "👥", category: "payroll" },
  { key: "hasPayroll",       label: "Зарплата",     icon: "💼", category: "payroll" },
  { key: "hasCorporateCard", label: "Корп. карта",  icon: "🪪", category: "card" },
  { key: "hasCredit",        label: "Кредит",       icon: "📋", category: "credit" },
  { key: "hasDeposit",       label: "Депозит",      icon: "🏦", category: "credit" },
  { key: "hasTradeFinance",  label: "Торг. финанс.",icon: "📦", category: "trade" },
] as const;

/* Заглушка для скрытой метрики в карточке */
function RestrictedCell({ label }: { label: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 opacity-60">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-sm font-bold text-gray-300 flex items-center gap-1">
        <span>🔒</span>
        <span className="text-xs font-normal text-gray-400">Нет доступа</span>
      </div>
    </div>
  );
}

/* Заглушка для скрытой секции (задачи, история) */
function RestrictedSection({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 opacity-70">
      {label && <h3 className="text-sm font-semibold text-gray-500 mb-2">{label}</h3>}
      <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
        <span>🔒</span>
        <span>Раздел скрыт — обратитесь к администратору для получения доступа</span>
      </div>
    </div>
  );
}

function fmtGmv(v: number) {
  if (!v) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M сом`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K сом`;
  return `${v} сом`;
}

/* ─── Page ───────────────────────────────────────────────── */

type Params = Promise<{ id: string }>;

export default async function ClientPage({ params }: { params: Params }) {
  const { id } = await params;
  const [client, session] = await Promise.all([getClient(id), getSession()]);

  if (!client) notFound();

  const perms = await getPermissionsForRole(session?.role ?? "");

  const canEdit  = session?.role === UserRole.ADMIN || session?.role === "ANALYST";
  const isKAM    = session?.role === UserRole.KAM_ROLE;
  const canEditAccountPlan = canEdit || isKAM;
  const activeProducts = PRODUCTS.filter((p) => client[p.key]).length;

  // ── Health Score & Churn Risk ────────────────────────────
  const activitiesLast30d = client.activities?.filter((a: { performedAt: Date }) => {
    const days = (Date.now() - new Date(a.performedAt).getTime()) / 86_400_000;
    return days <= 30;
  }).length ?? 0;

  const healthScore = getHealthScore({
    daysSinceLastTxn:  client.daysSinceLastTxn,
    txnCount30d:       client.txnCount30d,
    gmv30d:            client.gmv30d,
    productDepthPct:   (activeProducts / 10) * 100,
    activitiesLast30d,
  });

  const lastActivityDays = client.activities?.[0]?.performedAt
    ? Math.floor((Date.now() - new Date(client.activities[0].performedAt).getTime()) / 86_400_000)
    : null;

  const churnRisk = getChurnRisk({
    clmStage:         client.clmStage,
    clmCohort:        client.clmCohort,
    daysSinceLastTxn: client.daysSinceLastTxn,
    txnCount30d:      client.txnCount30d,
    gmv30d:           client.gmv30d,
    lastActivityDays,
  });

  const [activeSequences, clientNotes] = await Promise.all([
    getActiveSequences(client.id),
    getClientNotes(client.id),
  ]);

  // D+14 warning — ACTIVATE stage, 14+ days without txn
  const showReactivateWarning =
    client.clmStage === "ACTIVATE" && client.daysSinceLastTxn >= 14;

  // Reactivation success — REACTIVATE stage, has txn last 30 days
  const showReactivatedBanner =
    client.clmStage === "REACTIVATE" && client.txnCount30d >= 1;

  return (
    <div className="space-y-5">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/clients" className="hover:text-gray-600 transition-colors">
          Клиенты
        </Link>
        <span>{"/"}</span>
        <span className="text-gray-700 font-medium truncate max-w-xs">{client.name}</span>
      </div>

      {/* ── D+14 Warning Banner ── */}
      {showReactivateWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {client.daysSinceLastTxn} дней без транзакций
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Система автоматически переведёт клиента в Реактивацию при следующей ночной синхронизации
              (порог: {60} дней). Запустите NBA-действие для ускорения.
            </p>
          </div>
        </div>
      )}

      {/* ── Reactivated Banner ── */}
      {showReactivatedBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
          <span className="text-xl">🎉</span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Клиент снова активен! {client.txnCount30d} транз. за 30 дней
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Реактивация успешна — система автоматически переведёт в ACTIVATE при следующей синхронизации
            </p>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ background: "var(--mbank-green)" }}
            >
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{client.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono text-sm text-gray-400">{client.inn}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  client.type === "YL" ? "bg-indigo-50 text-indigo-700" : "bg-teal-50 text-teal-700"
                }`}>
                  {client.type === "YL" ? "Юр. лицо" : "ИП"}
                </span>
              </div>
            </div>
          </div>

          {/* Stage + actions */}
          <div className="flex items-start gap-3">
            {canEdit && (
              <Link
                href={`/clients/${client.id}/edit`}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors font-medium"
              >
                ✏️ Редактировать
              </Link>
            )}
            <StageBadge stage={client.clmStage} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">

        {/* ── Block A: Основные данные ── */}
        <div className="col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Основные данные</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {[
                { label: "Филиал",    value: client.branch?.name ?? "—" },
                { label: "Менеджер",  value: client.manager?.name ?? "—" },
                { label: "KAM",       value: client.kam?.name ?? "—" },
                { label: "ОКВЭД",     value: client.okved ?? "—" },
                {
                  label: "Открыт счёт",
                  value: client.accountOpenedAt
                    ? format(new Date(client.accountOpenedAt), "dd.MM.yyyy")
                    : "—",
                },
                { label: "Команда", value: client.manager?.team ?? "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                  <div className="text-sm font-medium text-gray-800">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Block B: RFM-D метрики ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">RFM-D метрики</h3>
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: COHORT_STYLE[client.clmCohort]?.bg ?? "#f3f4f6",
                  color: COHORT_STYLE[client.clmCohort]?.text ?? "#374151",
                }}
              >
                {COHORT_LABEL[client.clmCohort] ?? client.clmCohort}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

              {/* R — Recency */}
              {perms.txn_metrics ? (
                <div className="rounded-xl border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">R</span>
                    <span className="text-[10px] text-gray-400">Давность</span>
                  </div>
                  <div className={`text-xl font-bold tabular-nums ${
                    client.daysSinceLastTxn > 60 ? "text-red-600" :
                    client.daysSinceLastTxn > 30 ? "text-orange-500" : "text-gray-800"
                  }`}>
                    {client.daysSinceLastTxn > 0 ? client.daysSinceLastTxn : "—"}
                  </div>
                  <div className="text-[10px] text-gray-400">дней без тр.</div>
                </div>
              ) : (
                <RestrictedCell label="Давность (R)" />
              )}

              {/* F — Frequency */}
              {perms.txn_metrics ? (
                <div className="rounded-xl border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">F</span>
                    <span className="text-[10px] text-gray-400">Частота</span>
                  </div>
                  <div className={`text-xl font-bold tabular-nums ${
                    client.txnCount30d >= 5 ? "text-emerald-600" :
                    client.txnCount30d >= 1 ? "text-amber-600" : "text-gray-400"
                  }`}>
                    {client.txnCount30d > 0 ? client.txnCount30d : "—"}
                  </div>
                  <div className="text-[10px] text-gray-400">транз. за 30д</div>
                </div>
              ) : (
                <RestrictedCell label="Частота (F)" />
              )}

              {/* M — Monetary */}
              {perms.financials ? (
                <div className="rounded-xl border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">M</span>
                    <span className="text-[10px] text-gray-400">Оборот</span>
                  </div>
                  <div className="text-xl font-bold text-gray-800">
                    {fmtGmv(client.gmv30d)}
                  </div>
                  <div className="text-[10px] text-gray-400">GMV за 30 дней</div>
                </div>
              ) : (
                <RestrictedCell label="Оборот (M)" />
              )}

              {/* D — Depth */}
              <div className="rounded-xl border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">D</span>
                  <span className="text-[10px] text-gray-400">Глубина</span>
                </div>
                <div className="text-xl font-bold text-gray-800 tabular-nums">
                  {activeProducts}
                  <span className="text-sm font-normal text-gray-400">{"/10"}</span>
                </div>
                <div className="text-[10px] text-gray-400">продуктов подкл.</div>
              </div>

            </div>
          </div>

          {/* ── Block B2: Health Score + Churn Risk ── */}
          <div className="grid grid-cols-2 gap-4">

            {/* Health Score */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Health Score</h3>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: healthScore.color + "18", color: healthScore.color }}
                >
                  {healthScore.label}
                </span>
              </div>

              {/* Score ring */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-shrink-0 w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={healthScore.color}
                      strokeWidth="3.5"
                      strokeDasharray={`${healthScore.score} ${100 - healthScore.score}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold tabular-nums" style={{ color: healthScore.color }}>
                      {healthScore.score}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  из <span className="font-semibold text-gray-600">100</span> баллов
                </div>
              </div>

              {/* Breakdown bars */}
              <div className="space-y-1.5">
                {[
                  { label: "Давность",   value: healthScore.breakdown.recency,   max: 30 },
                  { label: "Частота",    value: healthScore.breakdown.frequency,  max: 25 },
                  { label: "Оборот",     value: healthScore.breakdown.monetary,   max: 20 },
                  { label: "Глубина",    value: healthScore.breakdown.depth,      max: 15 },
                  { label: "Контакты",   value: healthScore.breakdown.engagement, max: 10 },
                ].map(({ label, value, max }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-16 shrink-0">{label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(value / max) * 100}%`,
                          background: healthScore.color,
                        }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-gray-500 w-8 text-right">
                      {`${value}/${max}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Churn Risk */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Риск оттока</h3>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: churnRisk.color + "18", color: churnRisk.color }}
                >
                  {churnRisk.label}
                </span>
              </div>

              {/* Probability gauge */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-shrink-0 w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={churnRisk.color}
                      strokeWidth="3.5"
                      strokeDasharray={`${churnRisk.probability} ${100 - churnRisk.probability}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold tabular-nums" style={{ color: churnRisk.color }}>
                      {churnRisk.probability}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  % вероятность<br />оттока
                </div>
              </div>

              {/* Drivers */}
              {churnRisk.drivers.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Факторы риска</p>
                  {churnRisk.drivers.map((d, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-[10px] mt-0.5" style={{ color: churnRisk.color }}>●</span>
                      <span className="text-[11px] text-gray-600 leading-snug">{d}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-600">
                  <span>✅</span>
                  <span>Факторов риска не выявлено</span>
                </div>
              )}
            </div>

          </div>

          {/* ── Block C: Продуктовая карта ── */}
          {canEdit ? (
            <ProductEditor
              clientId={client.id}
              initial={{
                hasMBusiness:     client.hasMBusiness,
                hasMKassaPos:     client.hasMKassaPos,
                hasMKassaQr:      client.hasMKassaQr,
                hasAcquiring:     client.hasAcquiring,
                hasSalaryProject: client.hasSalaryProject,
                hasPayroll:       client.hasPayroll,
                hasCorporateCard: client.hasCorporateCard,
                hasCredit:        client.hasCredit,
                hasDeposit:       client.hasDeposit,
                hasTradeFinance:  client.hasTradeFinance,
              }}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Продуктовая карта</h3>
                <div className="flex items-center gap-2.5">
                  <div className="h-1.5 w-28 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(activeProducts / 10) * 100}%`,
                        background: activeProducts >= 6 ? "var(--mbank-green)" : activeProducts >= 3 ? "#f59e0b" : "#94a3b8",
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums"
                    style={{ color: activeProducts >= 6 ? "var(--mbank-green)" : activeProducts >= 3 ? "#d97706" : "#94a3b8" }}>
                    {`${activeProducts}/10`}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {PRODUCTS.map((p) => {
                  const active = client[p.key];
                  return (
                    <div
                      key={p.key}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "ring-1" : ""}`}
                      style={active
                        ? { background: "var(--mbank-green-pale)", color: "var(--mbank-green)" }
                        : { background: "#f9fafb", color: "#c4c9d0" }
                      }
                    >
                      <span className="text-base leading-none shrink-0">{p.icon}</span>
                      <span className={`text-xs font-medium ${active ? "" : "text-gray-300"}`}>{p.label}</span>
                      {active && <span className="ml-auto text-[10px] font-bold" style={{ color: "var(--mbank-green)" }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">

          {/* Cross-sell подсказки */}
          {(() => {
            const tips: { icon: string; text: string }[] = [];
            if (client.gmv30d > 600_000 && !client.hasMKassaPos && !client.hasMKassaQr) {
              tips.push({ icon: "💳", text: "GMV > 600K — предложите MKassa POS / QR" });
            }
            if (client.hasMBusiness && !client.hasSalaryProject && !client.hasPayroll) {
              tips.push({ icon: "👥", text: "Есть MBusiness, нет зарплатного проекта — cross-sell возможность" });
            }
            if (client.txnCount30d >= 5 && !client.hasDeposit && !client.hasCredit) {
              tips.push({ icon: "🏦", text: "Активный клиент без депозита/кредита — предложите размещение" });
            }
            if (client.clmStage === "GROW" && !client.hasTradeFinance && (client.hasCredit || client.hasDeposit)) {
              tips.push({ icon: "📦", text: "Клиент в GROW с кредитом — предложите торговое финансирование" });
            }
            if (tips.length === 0) return null;
            return (
              <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-4">
                <h3 className="text-xs font-semibold text-amber-700 mb-2.5">💡 Cross-sell возможности</h3>
                <div className="space-y-2">
                  {tips.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-700 bg-amber-50 rounded-lg px-3 py-2">
                      <span className="shrink-0">{t.icon}</span>
                      <span>{t.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Next Best Action ── */}
          <NBAPanel client={client} />

          {/* ── Automated Sequences ── */}
          <SequenceLauncher
            clientId={client.id}
            clientStage={client.clmStage}
            activeSequences={activeSequences}
          />

          {/* Задачи */}
          {perms.tasks ? (
            client.tasks.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Задачи</h3>
                <div className="space-y-2">
                  {client.tasks.map((t) => (
                    <TaskCard key={t.id} task={t} clientId={client.id} />
                  ))}
                </div>
              </div>
            )
          ) : (
            <RestrictedSection label="Задачи" />
          )}

          {/* Account Plan — только если есть KAM */}
          {client.kamId && (
            <AccountPlanPanel
              clientId={client.id}
              plan={client.accountPlan ? {
                revenueTarget: client.accountPlan.revenueTarget,
                revenueActual: client.accountPlan.revenueActual,
                nextMeeting:   client.accountPlan.nextMeeting,
                initiatives:   client.accountPlan.initiatives,
              } : null}
              canEdit={canEditAccountPlan}
            />
          )}

          {/* История изменений */}
          {perms.changelog ? (
            client.changelogs.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">История изменений</h3>
                <div className="space-y-2.5">
                  {client.changelogs.slice(0, 8).map((c) => (
                    <div key={c.id} className="text-xs">
                      <div className="flex items-center justify-between text-gray-400">
                        <span>{c.user.name}</span>
                        <span>{formatDistanceToNow(new Date(c.changedAt), { locale: ru, addSuffix: true })}</span>
                      </div>
                      <p className="text-gray-600 mt-0.5">
                        <span className="font-medium">{c.field}</span>:{" "}
                        <span className="line-through text-gray-400">{c.oldVal ?? "—"}</span>
                        {" → "}
                        <span className="font-medium">{c.newVal ?? "—"}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <RestrictedSection label="История изменений" />
          )}
        </div>
      </div>

      {/* ── Контактные лица ── */}
      <ContactPersons
        clientId={client.id}
        contacts={client.contactPersons}
        canEdit={canEdit || isKAM}
      />

      {/* ── Лента активностей ── */}
      {perms.activities ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Контакты</h3>
            <Link
              href={`/clients/${client.id}/activity/new`}
              className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--mbank-green)" }}
            >
              + Добавить контакт
            </Link>
          </div>

          {client.activities.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Контактов пока нет</p>
          ) : (
            <div className="space-y-3">
              {client.activities.map((a) => (
                <div key={a.id} className="flex gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className="text-xl shrink-0 mt-0.5">
                    {ACTIVITY_ICON[a.type] ?? "📋"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800">{a.result}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {format(new Date(a.performedAt), "dd.MM.yyyy")}
                      </span>
                    </div>
                    {a.notes && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{a.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{a.user.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Контакты</h3>
          <RestrictedSection label="" />
        </div>
      )}

      {/* ── Client Notes ── */}
      <ClientNotes
        clientId={client.id}
        initialNotes={clientNotes}
        canEdit={canEdit || session?.role === "MANAGER"}
      />
    </div>
  );
}
