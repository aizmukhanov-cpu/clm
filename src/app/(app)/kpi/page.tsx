import { redirect } from "next/navigation";
import { getKPIData } from "@/lib/actions/kpi";
import { getSession } from "@/lib/auth";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { TeamSection } from "./TeamSection";
import type { ActivationTrendPoint } from "@/lib/actions/kpi";

/* ─── Sparkline (server-side SVG) ─────────────────────── */
function Sparkline({
  data, color = "var(--mbank-green)", width = 80, height = 24,
}: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => [
    Number(((i / (data.length - 1)) * width).toFixed(1)),
    Number((height - ((v - min) / range) * (height - 2) - 1).toFixed(1)),
  ]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

function TrendPanel({ trend }: { trend: ActivationTrendPoint[] }) {
  if (trend.length < 2) return null;
  const rates  = trend.map((t) => t.activationRate);
  const first  = trend[0];
  const last   = trend[trend.length - 1];
  const delta  = Math.round((last.activationRate - first.activationRate) * 10) / 10;
  const color  = last.activationRate >= 50 ? "var(--mbank-green)" : last.activationRate >= 30 ? "#d97706" : "#ef4444";
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Динамика активации</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {format(first.date, "dd MMM", { locale: ru })} — {format(last.date, "dd MMM", { locale: ru })}
            {" · "}{trend.length} снимков
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color }}>
            {last.activationRate.toFixed(1)}%
          </div>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ color: delta >= 0 ? "var(--mbank-green)" : "#dc2626", background: delta >= 0 ? "var(--mbank-green-pale)" : "#fef2f2" }}
          >
            {delta >= 0 ? "+" : ""}{delta}pp
          </span>
        </div>
      </div>
      <Sparkline data={rates} width={360} height={48} color={color} />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{first.activationRate.toFixed(1)}%</span>
        <span className="font-medium text-gray-500">Цель: 60%</span>
        <span>{last.activationRate.toFixed(1)}%</span>
      </div>
    </div>
  );
}

const TEAM_COLORS: Record<string, { bg: string; text: string }> = {
  B2B:    { bg: "#eff6ff", text: "#1d4ed8" },
  KM:     { bg: "#f0fdf4", text: "#15803d" },
  KAM:    { bg: "#faf5ff", text: "#7c3aed" },
  VB:     { bg: "#fff7ed", text: "#c2410c" },
  BRANCH: { bg: "#f0fdfa", text: "#0f766e" },
};

export default async function KPIPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await getKPIData();
  if (!data) redirect("/login");

  const month = format(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    "LLLL yyyy",
    { locale: ru }
  );

  /* ── MANAGER / KAM_ROLE — личный KPI ─────────────────── */
  if (data.kind === "personal") {
    const { kpi, trend } = data;
    const teamCol = TEAM_COLORS[kpi.manager.team] ?? { bg: "#f3f4f6", text: "#374151" };

    return (
      <div className="space-y-5 max-w-3xl">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Мой KPI</h2>
          <p className="text-sm text-gray-400 mt-0.5">{month}</p>
        </div>

        {/* Personal header card */}
        <div
          className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: "var(--mbank-green-dark)" }}
        >
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10"
            style={{ background: "var(--mbank-green-mid)" }} />
          <div className="relative z-10 flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg shrink-0"
              style={{ background: "var(--mbank-gold)" }}
            >
              {kpi.manager.name.charAt(0)}
            </div>
            <div>
              <div className="text-white font-semibold text-lg">{kpi.manager.name}</div>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: teamCol.bg, color: teamCol.text }}
              >
                {kpi.manager.team}
              </span>
            </div>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Клиентов",       value: kpi.totalClients,    note: "в портфеле" },
            { label: "Активных",       value: kpi.activeClients,   note: "≥1 тр. за 30 дней", green: true },
            { label: "% активации",    value: `${kpi.activationRate}%`, note: "от портфеля",
              color: kpi.activationRate >= 50 ? "text-emerald-600" : kpi.activationRate >= 30 ? "text-amber-500" : "text-red-500" },
            { label: "Открытых задач", value: kpi.openTasks,       note: "в работе" },
            { label: "Просрочено",     value: kpi.overdueTasks,    note: "нужно закрыть", danger: kpi.overdueTasks > 0 },
            { label: "Задач закрыто",  value: kpi.doneTasks,       note: "в этом месяце" },
            { label: "Активностей",    value: kpi.activitiesMonth, note: "за месяц", green: true },
            { label: "vs прошлый мес.",
              value: kpi.actDelta !== null ? `${kpi.actDelta >= 0 ? "+" : ""}${kpi.actDelta}%` : "—",
              note: "по активностям",
              color: kpi.actDelta !== null ? (kpi.actDelta >= 0 ? "text-emerald-600" : "text-red-500") : undefined },
            { label: "Активаций",      value: kpi.activations,     note: "переводов в ACTIVATE", green: kpi.activations > 0 },
          ].map(({ label, value, note, green, danger, color }) => (
            <div
              key={label}
              className={`bg-white rounded-xl border shadow-sm p-4 ${danger ? "border-red-100" : "border-gray-100"}`}
            >
              <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{label}</div>
              <div className={`text-3xl font-bold mb-1 ${
                color ?? (danger ? "text-red-600" : green ? "text-emerald-600" : "text-gray-900")
              }`}>
                {value}
              </div>
              <div className="text-[11px] text-gray-400">{note}</div>
            </div>
          ))}
        </div>

        <TrendPanel trend={trend} />

        <p className="text-[11px] text-gray-400">
          * Активные клиенты = ≥1 транзакция {">"} 100 сом за 30 дней.
          Активации = переводы в стадию ACTIVATE за текущий месяц.
        </p>
      </div>
    );
  }

  /* ── ANALYST — своя команда ───────────────────────────── */
  if (data.kind === "team") {
    const { team, trend } = data;
    const col = TEAM_COLORS[team.team] ?? { bg: "#f3f4f6", text: "#374151" };

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">KPI команды</h2>
              <span
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: col.bg, color: col.text }}
              >
                {team.team}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">{month} · {team.label}</p>
          </div>
        </div>

        {/* Team summary */}
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: "Клиентов",       value: team.totalClients },
            { label: "Активных",       value: team.activeClients, green: true },
            { label: "% активации",    value: `${team.activationRate}%`,
              color: team.activationRate >= 50 ? "text-emerald-600" : team.activationRate >= 30 ? "text-amber-500" : "text-red-500" },
            { label: "Открытых задач", value: team.openTasks },
            { label: "Просрочено",     value: team.overdueTasks, danger: team.overdueTasks > 0 },
            { label: "Активаций",      value: team.activations, green: team.activations > 0 },
          ].map(({ label, value, green, danger, color }) => (
            <div key={label} className={`bg-white rounded-xl border shadow-sm p-3 ${danger && (value as number) > 0 ? "border-red-100" : "border-gray-100"}`}>
              <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
              <div className={`text-2xl font-bold ${
                color ?? (danger && (value as number) > 0 ? "text-red-600" : green ? "text-emerald-600" : "text-gray-900")
              }`}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Manager breakdown — always expanded for team view */}
        <TeamSection team={team} defaultOpen={true} />

        <TrendPanel trend={trend} />

        <p className="text-[11px] text-gray-400">
          * Активные = ≥1 тр. {">"} 100 сом за 30 дней. Активации = ACTIVATE за месяц.
        </p>
      </div>
    );
  }

  /* ── ADMIN — все команды ──────────────────────────────── */
  const { teams, trend } = data;

  // Суммарно по всем командам
  const grand = teams.reduce(
    (acc, t) => ({
      clients:     acc.clients     + t.totalClients,
      active:      acc.active      + t.activeClients,
      openTasks:   acc.openTasks   + t.openTasks,
      overdue:     acc.overdue     + t.overdueTasks,
      activities:  acc.activities  + t.activitiesMonth,
      activations: acc.activations + t.activations,
    }),
    { clients: 0, active: 0, openTasks: 0, overdue: 0, activities: 0, activations: 0 }
  );
  const grandActRate = grand.clients > 0 ? Math.round((grand.active / grand.clients) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">KPI команд</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {month} · нажмите на команду чтобы раскрыть менеджеров
          </p>
        </div>
        <a
          href="/kpi/funnel"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:border-[var(--mbank-green)] hover:text-[var(--mbank-green)] transition-colors"
        >
          📊 Воронка Pipeline
        </a>
      </div>

      {/* Grand totals */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: "Клиентов",       value: grand.clients },
          { label: "Активных",       value: grand.active, green: true },
          { label: "% активации",    value: `${grandActRate}%`,
            color: grandActRate >= 50 ? "text-emerald-600" : grandActRate >= 30 ? "text-amber-500" : "text-red-500" },
          { label: "Открытых задач", value: grand.openTasks },
          { label: "Просрочено",     value: grand.overdue, danger: grand.overdue > 0 },
          { label: "Активаций",      value: grand.activations, green: grand.activations > 0 },
        ].map(({ label, value, green, danger, color }) => (
          <div key={label} className={`bg-white rounded-xl border shadow-sm p-3 ${danger && (value as number) > 0 ? "border-red-100" : "border-gray-100"}`}>
            <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
            <div className={`text-2xl font-bold ${
              color ?? (danger && (value as number) > 0 ? "text-red-600" : green ? "text-emerald-600" : "text-gray-900")
            }`}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Per-team sections (Level 1 → Level 2 accordion) */}
      <div className="space-y-3">
        {teams.map((team) => (
          <TeamSection key={team.team} team={team} defaultOpen={false} />
        ))}
      </div>

      <TrendPanel trend={trend} />

      <p className="text-[11px] text-gray-400">
        * Активные = ≥1 тр. {">"} 100 сом за 30 дней. Активации = ACTIVATE за месяц.
        Нажмите на карточку команды чтобы увидеть разбивку по менеджерам.
      </p>
    </div>
  );
}
