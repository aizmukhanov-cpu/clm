"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useRef } from "react";
import type { MyClientRow } from "@/lib/actions/portfolio";

const STAGE_STYLE: Record<string, { bg: string; text: string }> = {
  ACQUIRE:    { bg: "#f3f4f6", text: "#374151" },
  ONBOARD:    { bg: "#eff6ff", text: "#1d4ed8" },
  ACTIVATE:   { bg: "#fffbeb", text: "#d97706" },
  GROW:       { bg: "var(--mbank-green-pale)", text: "var(--mbank-green)" },
  REACTIVATE: { bg: "#fff7ed", text: "#c2410c" },
};

const STAGE_LABEL: Record<string, string> = {
  ACQUIRE:    "Привлечение",
  ONBOARD:    "Онбординг",
  ACTIVATE:   "Активация",
  GROW:       "Развитие",
  REACTIVATE: "Реактивация",
};

const SIZE_STYLE: Record<string, { bg: string; text: string }> = {
  SMALL:  { bg: "#f3f4f6", text: "#6b7280" },
  MEDIUM: { bg: "#eff6ff", text: "#2563eb" },
  LARGE:  { bg: "#faf5ff", text: "#7c3aed" },
};

const SIZE_LABEL: Record<string, string> = {
  SMALL:  "до 10М",
  MEDIUM: "10–100М",
  LARGE:  "100М+",
};

const STAGES = [
  { value: "ALL",        label: "Все стадии" },
  { value: "ACQUIRE",    label: "Привлечение" },
  { value: "ONBOARD",    label: "Онбординг" },
  { value: "ACTIVATE",   label: "Активация" },
  { value: "GROW",       label: "Развитие" },
  { value: "REACTIVATE", label: "Реактивация" },
];

export function MyClientsTable({
  clients,
  total,
  pages,
  page,
}: {
  clients: MyClientRow[];
  total: number;
  pages: number;
  page: number;
}) {
  const sp     = useSearchParams();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  function push(updates: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "ALL" || v === "") params.delete(k);
      else params.set(k, v);
    }
    // Reset to page 1 on filter change
    if (!("page" in updates)) params.delete("page");
    router.push(`?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    push({ search: searchRef.current?.value ?? null });
  }

  const currentSearch = sp.get("search") ?? "";
  const currentStage  = sp.get("stage")  ?? "ALL";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mr-auto">
          Мои клиенты
          <span className="ml-2 text-xs font-normal text-gray-400">
            {total.toLocaleString("ru")} всего
          </span>
        </h3>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            ref={searchRef}
            defaultValue={currentSearch}
            placeholder="Поиск по имени или ИНН…"
            className="h-8 rounded-lg border border-gray-200 px-3 text-sm w-52 focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
          />
          <button
            type="submit"
            className="h-8 px-3 rounded-lg text-sm text-white"
            style={{ background: "var(--mbank-green)" }}
          >
            Найти
          </button>
          {currentSearch && (
            <button
              type="button"
              onClick={() => { push({ search: null }); if (searchRef.current) searchRef.current.value = ""; }}
              className="h-8 px-2 rounded-lg text-sm text-gray-400 border border-gray-200 hover:bg-gray-50"
            >
              ✕
            </button>
          )}
        </form>

        {/* Stage filter */}
        <select
          value={currentStage}
          onChange={(e) => push({ stage: e.target.value })}
          className="h-8 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {clients.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">
          {currentSearch || currentStage !== "ALL"
            ? "Нет клиентов по заданным фильтрам"
            : "Клиентов пока нет"}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {["Клиент", "Стадия", "Сегмент", "Транзакций 30д", "Без транзакций", "Задачи", ""].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const stageStyle = STAGE_STYLE[c.clmStage] ?? { bg: "#f3f4f6", text: "#374151" };
              const sizeStyle  = c.sizeCategory ? SIZE_STYLE[c.sizeCategory] : null;
              const daysWarn   = c.daysSinceLastTxn > 60 ? "text-red-600 font-semibold"
                               : c.daysSinceLastTxn > 30 ? "text-orange-500 font-medium"
                               : "text-gray-600";
              return (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-medium text-gray-900 hover:underline block truncate max-w-[200px]"
                    >
                      {c.name}
                    </Link>
                    <span className="text-xs text-gray-400 font-mono">{c.inn}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: stageStyle.bg, color: stageStyle.text }}
                    >
                      {STAGE_LABEL[c.clmStage] ?? c.clmStage}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {sizeStyle ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: sizeStyle.bg, color: sizeStyle.text }}
                      >
                        {SIZE_LABEL[c.sizeCategory!]}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-gray-700">
                    {c.txnCount30d}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm tabular-nums ${daysWarn}`}>
                      {c.daysSinceLastTxn > 0 ? `${c.daysSinceLastTxn} дн.` : "сегодня"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.openTasks > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                        {c.openTasks} открытых
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-200 text-gray-500 hover:border-[var(--mbank-green)] hover:text-[var(--mbank-green)] transition-colors whitespace-nowrap"
                    >
                      Открыть →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            Страница {page} из {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <button
                onClick={() => push({ page: String(page - 1) })}
                className="h-7 px-3 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                ← Назад
              </button>
            )}
            {page < pages && (
              <button
                onClick={() => push({ page: String(page + 1) })}
                className="h-7 px-3 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Вперёд →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
