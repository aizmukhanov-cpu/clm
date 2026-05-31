"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
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
  productDepthPct: number;
  branch:  { name: string } | null;
  manager: { name: string } | null;
  kam:     { id: string; name: string } | null;
  tasks:   { dueDate: Date; action: string }[];
  _count:  { activities: number };
};

type KAM = { id: string; name: string };

const COHORT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE:       { bg: "var(--mbank-green-pale)", text: "var(--mbank-green)",  label: "Активный" },
  LOW_ACTIVE:   { bg: "#fffbeb",                 text: "#d97706",             label: "Низкая акт." },
  NEVER_ACTIVE: { bg: "#f3f4f6",                 text: "#6b7280",             label: "Нет акт." },
  LAPSED:       { bg: "#fef2f2",                 text: "#dc2626",             label: "Отток" },
  LAPSED_DEEP:  { bg: "#fee2e2",                 text: "#991b1b",             label: "Глуб. отток" },
};

function fmtGmv(v: number) {
  if (!v) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

export function KAMTable({
  clients,
  total,
  pages,
  kams,
}: {
  clients: Client[];
  total: number;
  pages: number;
  kams: KAM[];
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
          value={sp.get("cohort") ?? "ALL"}
          onChange={(e) => push({ cohort: e.target.value })}
          className="h-8 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
        >
          <option value="ALL">Все когорты</option>
          <option value="ACTIVE">Активные</option>
          <option value="LOW_ACTIVE">Низкая активность</option>
          <option value="NEVER_ACTIVE">Нет активности</option>
          <option value="LAPSED">Отток</option>
          <option value="LAPSED_DEEP">Глубокий отток</option>
        </select>
        {kams.length > 0 && (
          <select
            value={sp.get("kamId") ?? "ALL"}
            onChange={(e) => push({ kamId: e.target.value })}
            className="h-8 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
          >
            <option value="ALL">Все KAM</option>
            {kams.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
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
              {["Клиент", "KAM", "Стадия CLM", "Когорта", "GMV 30д", "Дней без тр.", "Продукты", "Задача"].map((h) => (
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
              const cohortStyle = COHORT_STYLE[c.clmCohort] ?? COHORT_STYLE.NEVER_ACTIVE;
              const hasOverdueTask = c.tasks[0] && new Date(c.tasks[0].dueDate) < new Date();

              return (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium text-gray-900 hover:underline block truncate max-w-[180px]">
                      {c.name}
                    </Link>
                    <span className="text-xs text-gray-400 font-mono">{c.inn}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.kam?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600">
                      {STAGE_LABELS[c.clmStage as CLMStage] ?? c.clmStage}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: cohortStyle.bg, color: cohortStyle.text }}
                    >
                      {cohortStyle.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-700">{fmtGmv(c.gmv30d)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${c.daysSinceLastTxn > 60 ? "text-red-600" : c.daysSinceLastTxn > 30 ? "text-orange-500" : "text-gray-700"}`}>
                      {c.daysSinceLastTxn > 0 ? `${c.daysSinceLastTxn} дн.` : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.productDepthPct}%`, background: "var(--mbank-green)" }} />
                      </div>
                      <span className="text-xs text-gray-400">{c.productDepthPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.tasks[0] ? (
                      <div>
                        <span className={`text-xs font-medium ${hasOverdueTask ? "text-red-600" : "text-gray-600"}`}>
                          {format(new Date(c.tasks[0].dueDate), "dd.MM")}
                          {hasOverdueTask && " ⚠"}
                        </span>
                        <p className="text-[11px] text-gray-400 truncate max-w-[120px]">{c.tasks[0].action}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
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
                p === currentPage
                  ? "text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
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
