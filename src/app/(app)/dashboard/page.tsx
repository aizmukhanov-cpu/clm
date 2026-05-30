import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/actions/dashboard";
import { STAGE_LABELS } from "@/lib/clm-config";
import { CLMStage } from "@/generated/prisma/client";
import { formatDistanceToNow, format } from "date-fns";
import { ru } from "date-fns/locale";
import type { SnapshotPoint } from "@/lib/actions/snapshots";

/* ─── Helpers ─────────────────────────────────────────── */

function fmtAmount(v: number) {
  if (!v) return "0";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

const COHORT_LABELS: Record<string, string> = {
  ACTIVE:       "Активные",
  LOW_ACTIVE:   "Низкая акт.",
  NEVER_ACTIVE: "Нет акт.",
  LAPSED:       "Отток",
};

const COHORT_COLORS: Record<string, { bg: string; bar: string }> = {
  ACTIVE:       { bg: "var(--mbank-green-pale)", bar: "var(--mbank-green)" },
  LOW_ACTIVE:   { bg: "#fffbeb", bar: "#f59e0b" },
  NEVER_ACTIVE: { bg: "#f3f4f6", bar: "#9ca3af" },
  LAPSED:       { bg: "#fef2f2", bar: "#ef4444" },
};

const STAGE_FUNNEL_COLORS: Record<CLMStage, { bg: string; text: string }> = {
  ACQUIRE:    { bg: "#f3f4f6", text: "#374151" },
  ONBOARD:    { bg: "#eff6ff", text: "#1d4ed8" },
  ACTIVATE:   { bg: "#fffbeb", text: "#d97706" },
  GROW:       { bg: "var(--mbank-green-pale)", text: "var(--mbank-green)" },
  REACTIVATE: { bg: "#fff7ed", text: "#c2410c" },
};

const ACTIVITY_ICON: Record<string, string> = {
  CALL: "📞", MEETING: "🤝", EMAIL: "✉️",
};

/* ─── Trend components ────────────────────────────────── */

/** SVG sparkline — suitable for server render (no client JS) */
function Sparkline({
  data,
  color = "var(--mbank-green)",
  width = 80,
  height = 24,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    Number(((i / (data.length - 1)) * width).toFixed(1)),
    Number((height - ((v - min) / range) * (height - 2) - 1).toFixed(1)),
  ]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

/** Horizontal bar chart of weekly counts */
function WeeklyBars({
  data,
  color = "var(--mbank-green)",
  height = 48,
}: {
  data: { label: string; count: number }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const isLast = i === data.length - 1;
        const barH   = Math.max(Math.round((d.count / max) * (height - 16)), 2);
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
            <span className="text-[8px] tabular-nums" style={{ color: isLast ? color : "#9ca3af" }}>
              {d.count > 0 ? d.count : ""}
            </span>
            <div
              className="w-full rounded-sm transition-all"
              style={{ height: barH, background: isLast ? color : (color === "var(--mbank-green)" ? "#bbf7d0" : "#fed7aa") }}
            />
            <span className="text-[8px] text-gray-300 truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Delta badge: +3% / −2% */
function Delta({ value, unit = "%" }: { value: number | null; unit?: string }) {
  if (value === null) return null;
  const pos = value >= 0;
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{
        color:      pos ? "var(--mbank-green)" : "#dc2626",
        background: pos ? "var(--mbank-green-pale)" : "#fef2f2",
      }}
    >
      {pos ? "+" : ""}{value}{unit}
    </span>
  );
}

/* ─── Page ────────────────────────────────────────────── */

// Роли с доступом к полному дашборду
const DASHBOARD_ROLES = ["ADMIN", "DIRECTOR", "ANALYST", "TEAM_LEAD", "SUPERVISOR"];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!DASHBOARD_ROLES.includes(session.role)) redirect("/my-portfolio");

  const data = await getDashboardData();
  if (!data) redirect("/login");

  const {
    totalClients, stageFunnel, cohortMap,
    tasks, pipeline, activitiesWeek, activitiesWoWDelta, actTypeMap,
    recentActivities, recentChangelogs, activity,
    branchStats, productAdoption, topRiskClients,
    snapshotHistory, weeklyActivityTrend, weeklyActivationsTrend,
  } = data;

  // Activation rate — доля клиентов с ≥1 тр. > 100 сом
  const activationRate = totalClients > 0
    ? Math.round((activity.active / totalClients) * 100)
    : 0;
  const anyActive = activity.active + activity.lowActive;

  // Activation rate from snapshots (for sparkline + delta)
  const snapRates = snapshotHistory.map((s: SnapshotPoint) => s.activationRate);
  const snapActivations = snapshotHistory.map((s: SnapshotPoint) => s.activitiesWeek);
  const prevSnap = snapshotHistory.length >= 2 ? snapshotHistory[snapshotHistory.length - 2] : null;
  const activationDelta = prevSnap
    ? Math.round((activationRate - prevSnap.activationRate) * 10) / 10
    : null;
  const activeDelta = prevSnap ? activity.active - prevSnap.activeClients : null;
  const atRiskDelta = prevSnap ? activity.atRisk - prevSnap.atRiskClients : null;

  const maxStage  = Math.max(...stageFunnel.map((s) => s.count), 1);
  const maxCohort = Math.max(...cohortMap.map((c) => c.count), 1);

  return (
    <div className="space-y-5">

      <div>
        <h2 className="text-xl font-bold text-gray-900">Дашборд</h2>
        <p className="text-sm text-gray-400 mt-0.5">Обзор CLM-портфеля</p>
      </div>

      {/* ── Row 1: KPI cards ── */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total clients + activation rate */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Клиентов в базе</div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-bold text-gray-900">{totalClients.toLocaleString()}</div>
            {activeDelta !== null && <Delta value={activeDelta} unit=" акт." />}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${activationRate}%`, background: "var(--mbank-green)" }}
              />
            </div>
            <span className="text-xs font-semibold shrink-0" style={{ color: "var(--mbank-green)" }}>
              {activationRate}% акт.
            </span>
          </div>
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Задачи</div>
          <div className="flex items-end gap-3">
            <div>
              <div className="text-3xl font-bold text-gray-900">{tasks.pending + tasks.overdue}</div>
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

        {/* Activities this week + WoW trend */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Взаимодействия (7 дней)</div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-end gap-2">
                <div className="text-3xl font-bold text-gray-900">{activitiesWeek}</div>
                <Delta value={activitiesWoWDelta} />
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                {["CALL", "MEETING", "EMAIL"].map((t) => (
                  <div key={t} className="flex items-center gap-1 text-xs text-gray-400">
                    <span>{ACTIVITY_ICON[t]}</span>
                    <span>{actTypeMap[t] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
            {weeklyActivityTrend.length >= 2 && (
              <Sparkline data={weeklyActivityTrend.map((w: { count: number }) => w.count)} width={56} height={32} />
            )}
          </div>
        </div>

        {/* Pipeline */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Pipeline (сделки)</div>
          <div className="text-3xl font-bold" style={{ color: "var(--mbank-green)" }}>
            {fmtAmount(pipeline.b2b.amount + pipeline.km.amount)} сом
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>B2B: {pipeline.b2b.count}</span>
            <span>KM: {pipeline.km.count}</span>
          </div>
        </div>
      </div>

      {/* ── Активность базы ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Активность клиентской базы</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Активным считается клиент с ≥1 транзакцией &gt; 100 сом за последние 30 дней
            </p>
          </div>
          {/* Big rate + sparkline */}
          <div className="flex items-center gap-4">
            {snapRates.length >= 2 && (
              <div className="flex flex-col items-end gap-1">
                <Sparkline data={snapRates} width={96} height={28} />
                <span className="text-[9px] text-gray-400">
                  {snapshotHistory.length} снимков · {format(snapshotHistory[0].date, "dd.MM")}–{format(snapshotHistory[snapshotHistory.length - 1].date, "dd.MM")}
                </span>
              </div>
            )}
            <div className="text-right">
              <div
                className="text-4xl font-bold tabular-nums"
                style={{
                  color: activationRate >= 50 ? "var(--mbank-green)" :
                         activationRate >= 30 ? "#d97706" : "#ef4444",
                }}
              >
                {activationRate}%
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="text-xs text-gray-400">от базы активны</span>
                {activationDelta !== null && <Delta value={activationDelta} unit="pp" />}
              </div>
            </div>
          </div>
        </div>

        {/* Segments */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {([
            {
              label: "Активные",  value: activity.active,      delta: activeDelta,
              sub: "≥1 тр. > 100 сом", color: "var(--mbank-green)", bg: "var(--mbank-green-pale)", ring: "#86efac",
            },
            {
              label: "Мало транзачат", value: activity.lowActive, delta: null,
              sub: "≥1 тр. ≤ 100 сом", color: "#d97706", bg: "#fffbeb", ring: "#fde68a",
            },
            {
              label: "Под риском",  value: activity.atRisk, delta: atRiskDelta !== null ? -atRiskDelta : null,
              sub: "0 тр. за 30д, 1–60 дней", color: "#c2410c", bg: "#fff7ed", ring: "#fed7aa",
            },
            {
              label: "Отток",  value: activity.lapsed, delta: null,
              sub: ">60 дней без тр.", color: "#dc2626", bg: "#fef2f2", ring: "#fecaca",
            },
            {
              label: "Не начали",  value: activity.neverActive, delta: null,
              sub: "Ни одной транзакции", color: "#6b7280", bg: "#f9fafb", ring: "#e5e7eb",
            },
          ] as const).map(({ label, value, sub, color, bg, ring, delta }) => {
            const pct = totalClients > 0 ? Math.round((value / totalClients) * 100) : 0;
            return (
              <div
                key={label}
                className="rounded-xl border p-3 flex flex-col gap-1"
                style={{ background: bg, borderColor: ring }}
              >
                <div className="text-xs text-gray-500 font-medium">{label}</div>
                <div className="text-2xl font-bold tabular-nums" style={{ color }}>
                  {value.toLocaleString("ru")}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-gray-400">{sub}</span>
                  <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
                </div>
                {delta !== null && (
                  <Delta value={delta} unit=" vs пред." />
                )}
              </div>
            );
          })}
        </div>

        {/* Stacked bar */}
        <div>
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {[
              { value: activity.active,      color: "var(--mbank-green)" },
              { value: activity.lowActive,   color: "#f59e0b" },
              { value: activity.atRisk,      color: "#f97316" },
              { value: activity.lapsed,      color: "#ef4444" },
              { value: activity.neverActive, color: "#e5e7eb" },
            ].map(({ value, color }, i) => {
              const pct = totalClients > 0 ? (value / totalClients) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={i}
                  className="h-full transition-all"
                  style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? 2 : 0 }}
                  title={`${Math.round(pct)}%`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2">
            {[
              { label: "Активные",     color: "var(--mbank-green)" },
              { label: "Мало транз.",  color: "#f59e0b" },
              { label: "Под риском",   color: "#f97316" },
              { label: "Отток",        color: "#ef4444" },
              { label: "Не начали",    color: "#9ca3af" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[10px] text-gray-500">{label}</span>
              </div>
            ))}
            <div className="ml-auto text-[10px] text-gray-400">
              Итого: {anyActive.toLocaleString("ru")} транзачащих клиентов
            </div>
          </div>
        </div>
      </div>

      {/* ── Тренды ── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Weekly activity trend */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Взаимодействия по неделям</h3>
              <p className="text-xs text-gray-400 mt-0.5">Количество контактов с клиентами (8 недель)</p>
            </div>
            {activitiesWoWDelta !== null && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                WoW: <Delta value={activitiesWoWDelta} />
              </div>
            )}
          </div>
          <WeeklyBars data={weeklyActivityTrend} height={72} />
        </div>

        {/* Weekly activations trend */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Активации по неделям</h3>
              <p className="text-xs text-gray-400 mt-0.5">Переводы в стадию ACTIVATE (8 недель)</p>
            </div>
          </div>
          <WeeklyBars data={weeklyActivationsTrend} color="#d97706" height={72} />
        </div>

        {/* Activation rate trend from snapshots */}
        {snapRates.length >= 3 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Процент активации — динамика</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  По данным CLM-снимков · {snapshotHistory.length} точек
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold" style={{ color: activationRate >= 50 ? "var(--mbank-green)" : "#d97706" }}>
                  {activationRate}%
                </div>
                {activationDelta !== null && <Delta value={activationDelta} unit="pp" />}
              </div>
            </div>
            {/* Larger sparkline chart */}
            <div className="w-full">
              <Sparkline data={snapRates} width={400} height={56} />
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
              <span>{format(snapshotHistory[0].date, "dd MMM", { locale: ru })}</span>
              <span>Цель: 60%</span>
              <span>{format(snapshotHistory[snapshotHistory.length - 1].date, "dd MMM", { locale: ru })}</span>
            </div>
          </div>
        )}

        {/* Activity trend from snapshots */}
        {snapActivations.length >= 3 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Активность команды — динамика</h3>
                <p className="text-xs text-gray-400 mt-0.5">Взаимодействий за 7 дней (исторически)</p>
              </div>
            </div>
            <Sparkline data={snapActivations} color="#6366f1" width={400} height={56} />
            <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
              <span>{format(snapshotHistory[0].date, "dd MMM", { locale: ru })}</span>
              <span>{format(snapshotHistory[snapshotHistory.length - 1].date, "dd MMM", { locale: ru })}</span>
            </div>
          </div>
        )}

      </div>

      <div className="grid grid-cols-3 gap-5">

        {/* ── CLM Funnel ── */}
        <div className="col-span-1 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">CLM Воронка</h3>
            <Link
              href="/clients"
              className="text-xs hover:underline"
              style={{ color: "var(--mbank-green)" }}
            >
              Все клиенты →
            </Link>
          </div>
          <div className="space-y-2.5">
            {stageFunnel.map(({ stage, count }) => {
              const col = STAGE_FUNNEL_COLORS[stage as CLMStage];
              const pct = Math.round((count / maxStage) * 100);
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-600">
                      {STAGE_LABELS[stage as CLMStage]}
                    </span>
                    <span className="font-bold" style={{ color: col.text }}>{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: col.text }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Cohort Distribution ── */}
        <div className="col-span-1 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Когорты</h3>
          <div className="space-y-3">
            {cohortMap.map(({ cohort, count }) => {
              const col = COHORT_COLORS[cohort] ?? COHORT_COLORS.NEVER_ACTIVE;
              const pct = Math.round((count / totalClients) * 100);
              return (
                <div key={cohort}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-600">{COHORT_LABELS[cohort]}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{pct}%</span>
                      <span className="font-bold text-gray-700">{count}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.round((count / maxCohort) * 100)}%`, background: col.bar }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Activation rate */}
          <div
            className="mt-4 rounded-lg px-3 py-2.5 flex items-center justify-between"
            style={{ background: "var(--mbank-green-pale)" }}
          >
            <span className="text-xs font-medium text-gray-600">Активация клиентов</span>
            <span className="text-sm font-bold" style={{ color: "var(--mbank-green)" }}>
              {totalClients > 0
                ? `${Math.round(((cohortMap.find((c) => c.cohort === "ACTIVE")?.count ?? 0) / totalClients) * 100)}%`
                : "—"}
            </span>
          </div>
        </div>

        {/* ── Recent changes ── */}
        <div className="col-span-1 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Последние переводы стадий</h3>
          {recentChangelogs.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">Нет изменений</p>
          ) : (
            <div className="space-y-3">
              {recentChangelogs.map((c) => (
                <div key={c.id} className="text-xs">
                  <div className="flex items-center justify-between text-gray-400 mb-0.5">
                    <Link
                      href={`/clients/${c.client.id}`}
                      className="font-medium text-gray-700 hover:underline truncate max-w-[120px]"
                    >
                      {c.client.name}
                    </Link>
                    <span>{formatDistanceToNow(new Date(c.changedAt), { locale: ru, addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <span className="line-through text-gray-300">
                      {STAGE_LABELS[c.oldVal as CLMStage] ?? c.oldVal ?? "—"}
                    </span>
                    <span>→</span>
                    <span className="font-medium" style={{ color: "var(--mbank-green)" }}>
                      {STAGE_LABELS[c.newVal as CLMStage] ?? c.newVal ?? "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── At-Risk Clients ── */}
      {topRiskClients.length > 0 && (
        <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">
                🚨 Клиенты под риском оттока
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Не ACQUIRE-стадия + &gt;30 дней без транзакций — требуют срочного контакта
              </p>
            </div>
            <Link
              href="/clients?stage=REACTIVATE"
              className="text-xs hover:underline shrink-0"
              style={{ color: "var(--mbank-green)" }}
            >
              Все реактивации →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {topRiskClients.map((c) => {
              const urgency =
                c.daysSinceLastTxn > 90 ? { color: "#dc2626", bg: "#fef2f2", label: "Критично" }
                : c.daysSinceLastTxn > 60 ? { color: "#c2410c", bg: "#fff7ed", label: "Высокий" }
                : { color: "#d97706", bg: "#fffbeb", label: "Средний" };
              return (
                <div key={c.id} className="flex items-center gap-4 py-3">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ color: urgency.color, background: urgency.bg }}
                  >
                    {urgency.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/clients/${c.id}`}
                      className="text-sm font-medium text-gray-800 hover:underline truncate block"
                    >
                      {c.name}
                    </Link>
                    <span className="text-xs text-gray-400">{c.inn}</span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 hidden sm:block">
                    {STAGE_LABELS[c.clmStage as CLMStage] ?? c.clmStage}
                  </span>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tabular-nums" style={{ color: urgency.color }}>
                      {c.daysSinceLastTxn}д
                    </div>
                    <div className="text-[10px] text-gray-400">без тр.</div>
                  </div>
                  <div className="text-right shrink-0 hidden md:block">
                    <div className="text-xs font-medium text-gray-600 tabular-nums">
                      {fmtAmount(c.gmv30d ?? 0)}
                    </div>
                    <div className="text-[10px] text-gray-400">GMV 30д</div>
                  </div>
                  {c.manager && (
                    <span className="text-xs text-gray-400 shrink-0 hidden lg:block max-w-[100px] truncate">
                      {c.manager.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Branch Stats ── */}
      {branchStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Активация по филиалам</h3>
              <p className="text-xs text-gray-400 mt-0.5">% активных клиентов vs целевой показатель</p>
            </div>
          </div>
          <div className="space-y-3">
            {branchStats.map((b) => (
              <div key={b.id}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-gray-700 w-48 truncate">{b.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">{`${b.active}/${b.total}`} клиентов</span>
                    <span className={`font-bold tabular-nums w-10 text-right ${
                      b.pct >= b.targetPct ? "text-emerald-600"
                      : b.pct >= b.targetPct * 0.8 ? "text-amber-600"
                      : "text-red-600"
                    }`}>
                      {b.pct}%
                    </span>
                    <span className={`text-[10px] font-medium w-12 text-right ${
                      b.gap >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}>
                      {b.gap >= 0 ? `+${b.gap}` : b.gap}pp
                    </span>
                  </div>
                </div>
                <div className="relative h-2.5 rounded-full bg-gray-100 overflow-visible">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${b.pct}%`,
                      background: b.pct >= b.targetPct ? "var(--mbank-green)"
                                : b.pct >= b.targetPct * 0.8 ? "#f59e0b"
                                : "#ef4444",
                    }}
                  />
                  <div
                    className="absolute top-0 h-full w-0.5 bg-gray-400 rounded-full"
                    style={{ left: `${b.targetPct}%` }}
                    title={`Цель: ${b.targetPct}%`}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">
            Вертикальная линия = целевой показатель по филиалу. pp = разница в процентных пунктах.
          </p>
        </div>
      )}

      {/* ── Product Adoption ── */}
      {productAdoption.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Проникновение продуктов</h3>
              <p className="text-xs text-gray-400 mt-0.5">% клиентов с подключённым продуктом</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
            {productAdoption.map((p) => (
              <div key={p.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">{p.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 tabular-nums">{p.count}</span>
                    <span className="font-semibold tabular-nums w-8 text-right" style={{
                      color: p.pct >= 60 ? "var(--mbank-green)"
                           : p.pct >= 30 ? "#d97706"
                           : "#6b7280",
                    }}>
                      {p.pct}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${p.pct}%`,
                      background: p.pct >= 60 ? "var(--mbank-green)"
                                : p.pct >= 30 ? "#f59e0b"
                                : "#94a3b8",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Activity Feed ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Последние взаимодействия</h3>
        </div>
        {recentActivities.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Нет активностей</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {recentActivities.map((a) => (
              <div key={a.id} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="text-lg shrink-0 mt-0.5">{ACTIVITY_ICON[a.type] ?? "📋"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/clients/${a.client.id}`}
                      className="text-sm font-medium text-gray-800 hover:underline truncate"
                    >
                      {a.client.name}
                    </Link>
                    <span className="text-xs text-gray-400 shrink-0">
                      {format(new Date(a.performedAt), "dd.MM")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{a.result}</p>
                  <p className="text-xs text-gray-400">{a.user.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
