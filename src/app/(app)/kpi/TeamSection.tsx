"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TeamKPI, ManagerKPI } from "@/lib/actions/kpi";

/* ─── Цвета команд ──────────────────────────────────────── */

const TEAM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  B2B:    { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  KM:     { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  KAM:    { bg: "#faf5ff", text: "#7c3aed", border: "#ddd6fe" },
  VB:     { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  BRANCH: { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4" },
};

/* ─── Один столбец статистики ───────────────────────────── */

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="text-right w-20 shrink-0">
      <div className="text-[10px] text-gray-400 leading-tight mb-0.5 truncate">{label}</div>
      <div className={`text-base font-bold tabular-nums ${color ?? "text-gray-800"}`}>
        {value}
      </div>
    </div>
  );
}

/* ─── Строка менеджера ──────────────────────────────────── */

function ManagerRow({ m }: { m: ManagerKPI }) {
  const actColor =
    m.activationRate >= 50 ? "text-emerald-600"
    : m.activationRate >= 30 ? "text-amber-600"
    : "text-red-500";

  return (
    <tr className="hover:bg-gray-50/60 transition-colors text-xs divide-x divide-gray-50">
      <td className="px-4 py-2.5 font-medium text-gray-800 w-40">{m.manager.name}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{m.totalClients}</td>
      <td className="px-3 py-2.5 text-right tabular-nums font-medium" style={{ color: "var(--mbank-green)" }}>
        {m.activeClients}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        <span className={`font-semibold ${actColor}`}>{m.activationRate}%</span>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{m.activitiesMonth}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{m.openTasks}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {m.overdueTasks > 0
          ? <span className="font-bold text-red-600">{m.overdueTasks}</span>
          : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {m.activations > 0
          ? <span className="font-bold text-emerald-600">{m.activations}</span>
          : <span className="text-gray-300">—</span>}
      </td>
    </tr>
  );
}

/* ─── Секция команды ────────────────────────────────────── */

export function TeamSection({
  team,
  defaultOpen = false,
}: {
  team: TeamKPI;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const col = TEAM_COLORS[team.team] ?? { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" };
  const hasManagers = team.managers.length > 0;

  const actRateColor =
    team.activationRate >= 50 ? "text-emerald-600"
    : team.activationRate >= 30 ? "text-amber-500"
    : "text-red-500";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

      {/* ── Уровень 1: шапка команды ── */}
      <button
        className={`w-full text-left transition-colors ${hasManagers ? "hover:bg-gray-50/50" : ""}`}
        onClick={() => hasManagers && setOpen((o) => !o)}
        disabled={!hasManagers}
      >
        <div className="flex items-center gap-4 px-5 py-4">

          {/* Бейдж команды */}
          <div
            className="shrink-0 text-center px-3 py-1 rounded-lg text-xs font-bold"
            style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}` }}
          >
            {team.team}
          </div>

          {/* Название + кол-во менеджеров */}
          <div className="min-w-0 w-44 shrink-0">
            <div className="text-sm font-semibold text-gray-800 truncate">{team.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {team.managerCount} менедж.
            </div>
          </div>

          {/* Статистика — фиксированные колонки */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <Stat label="Клиентов"    value={team.totalClients} />
            <Stat label="Активных"    value={team.activeClients} color="text-emerald-600" />
            <Stat label="% актив."    value={`${team.activationRate}%`} color={actRateColor} />
            <Stat label="Активностей" value={team.activitiesMonth} />
            <Stat label="Откр. задач" value={team.openTasks} color={team.openTasks > 0 ? "text-gray-700" : "text-gray-300"} />
            <Stat label="Просроч."    value={team.overdueTasks || "—"} color={team.overdueTasks > 0 ? "text-red-600" : "text-gray-300"} />
            <Stat label="Активаций"   value={team.activations || "—"} color={team.activations > 0 ? "text-emerald-600" : "text-gray-300"} />
          </div>

          {/* Chevron */}
          {hasManagers && (
            <ChevronDown
              className="shrink-0 h-4 w-4 text-gray-400 transition-transform ml-2"
              style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          )}
        </div>
      </button>

      {/* ── Уровень 2: разбивка по менеджерам ── */}
      {open && hasManagers && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2 font-medium w-40">Менеджер</th>
                <th className="text-right px-3 py-2 font-medium">Клиентов</th>
                <th className="text-right px-3 py-2 font-medium">Активных</th>
                <th className="text-right px-3 py-2 font-medium">% актив.</th>
                <th className="text-right px-3 py-2 font-medium">Активностей</th>
                <th className="text-right px-3 py-2 font-medium">Задач откр.</th>
                <th className="text-right px-3 py-2 font-medium text-red-400">Просроч.</th>
                <th className="text-right px-4 py-2 font-medium text-emerald-600">Активаций</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {team.managers.map((m) => (
                <ManagerRow key={m.manager.id} m={m} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
