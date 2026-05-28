"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { STAGE_LABELS } from "@/lib/clm-config";
import type { CLMStage } from "@/generated/prisma/client";

type Client = {
  id: string;
  name: string;
  inn: string;
  clmStage: string;
  clmCohort: string;
  gmv30d: number;
  daysSinceLastTxn: number;
  branch:  { name: string } | null;
  manager: { name: string } | null;
  tasks:   { dueDate: Date; action: string; priority: string }[];
  activities: { performedAt: Date; type: string; result: string }[];
};

type Manager = { id: string; name: string };
type Stats = { total: number; over90: number; noContact: number };

const ACTIVITY_ICON: Record<string, string> = { CALL: "📞", MEETING: "🤝", EMAIL: "✉️" };

const URGENCY = (days: number) => {
  if (days >= 90) return { bg: "#fef2f2", text: "#dc2626", label: "Критично" };
  if (days >= 60) return { bg: "#fff7ed", text: "#c2410c", label: "Высокий" };
  if (days >= 30) return { bg: "#fffbeb", text: "#d97706", label: "Средний" };
  return { bg: "#f3f4f6", text: "#6b7280", label: "Низкий" };
};

export function ReactivationTable({
  clients,
  total,
  pages,
  managers,
  stats,
}: {
  clients: Client[];
  total: number;
  pages: number;
  managers: Manager[];
  stats: Stats;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const currentPage = Number(sp.get("page") ?? 1);

  function push(updates: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "ALL" || v === "") params.delete(k);
      else params.set(k, v);
    }
    if (!updates.page) params.delete("page");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Всего в реактивации</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Нет транзакций 90+ дней</div>
          <div className={`text-2xl font-bold ${stats.over90 > 0 ? "text-red-600" : "text-gray-900"}`}>
            {stats.over90}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Нет ни одного контакта</div>
          <div className={`text-2xl font-bold ${stats.noContact > 0 ? "text-orange-500" : "text-gray-900"}`}>
            {stats.noContact}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <input
          type="search"
          placeholder="Поиск по ИНН / названию"
          defaultValue={sp.get("search") ?? ""}
          onChange={(e) => push({ search: e.target.value || null })}
          className="h-8 rounded-lg border border-gray-200 px-3 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
        />
        <select
          value={sp.get("minDays") ?? "ALL"}
          onChange={(e) => push({ minDays: e.target.value })}
          className="h-8 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
        >
          <option value="ALL">Все сроки</option>
          <option value="30">30+ дней</option>
          <option value="60">60+ дней</option>
          <option value="90">90+ дней</option>
        </select>
        {managers.length > 0 && (
          <select
            value={sp.get("managerId") ?? "ALL"}
            onChange={(e) => push({ managerId: e.target.value })}
            className="h-8 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
          >
            <option value="ALL">Все менеджеры</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        <span className="ml-auto text-xs text-gray-400">{total} клиентов</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {["Клиент", "Стадия", "Срочность", "Дней без тр.", "GMV 30д", "Менеджер", "Последний контакт", "Задача"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-gray-400 text-sm py-12">Нет клиентов</td>
              </tr>
            ) : clients.map((c) => {
              const urgency = URGENCY(c.daysSinceLastTxn);
              const lastActivity = c.activities[0];
              const nextTask = c.tasks[0];
              const taskOverdue = nextTask && new Date(nextTask.dueDate) < new Date();

              return (
                <tr
                  key={c.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium text-gray-900 hover:underline block truncate max-w-[160px]">
                      {c.name}
                    </Link>
                    <span className="text-xs text-gray-400 font-mono">{c.inn}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {STAGE_LABELS[c.clmStage as CLMStage] ?? c.clmStage}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: urgency.bg, color: urgency.text }}
                    >
                      {urgency.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold ${
                      c.daysSinceLastTxn >= 90 ? "text-red-600" :
                      c.daysSinceLastTxn >= 60 ? "text-orange-500" : "text-gray-700"
                    }`}>
                      {c.daysSinceLastTxn > 0 ? c.daysSinceLastTxn : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {c.gmv30d > 0 ? `${Math.round(c.gmv30d / 1000)}K` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.manager?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {lastActivity ? (
                      <div>
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <span>{ACTIVITY_ICON[lastActivity.type]}</span>
                          <span>{formatDistanceToNow(new Date(lastActivity.performedAt), { locale: ru, addSuffix: true })}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate max-w-[120px]">{lastActivity.result}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-red-400 font-medium">Нет контактов</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {nextTask ? (
                      <div>
                        <span className={`text-xs font-medium ${taskOverdue ? "text-red-600" : "text-gray-600"}`}>
                          {format(new Date(nextTask.dueDate), "dd.MM")}
                          {taskOverdue && " ⚠"}
                        </span>
                        <p className="text-[11px] text-gray-400 truncate max-w-[120px]">{nextTask.action}</p>
                      </div>
                    ) : (
                      <Link
                        href={`/clients/${c.id}/activity/new`}
                        className="text-xs font-medium"
                        style={{ color: "var(--mbank-green)" }}
                      >
                        + Контакт
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => push({ page: String(p) })}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                p === currentPage ? "text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
              style={p === currentPage ? { background: "var(--mbank-green)" } : {}}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
