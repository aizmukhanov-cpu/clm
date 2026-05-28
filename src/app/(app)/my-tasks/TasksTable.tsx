"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { completeTask } from "@/lib/actions/tasks";
import { taskLabel, TASK_PRIORITY_LABEL } from "@/lib/task-labels";
import { STAGE_LABELS } from "@/lib/clm-config";
import type { CLMStage } from "@/generated/prisma/client";
import type { MyTaskRow } from "@/lib/actions/portfolio";

const PRIORITY_STYLE: Record<string, { bg: string; text: string }> = {
  P1: { bg: "#fef2f2", text: "#dc2626" },
  P2: { bg: "#fffbeb", text: "#d97706" },
  P3: { bg: "var(--mbank-green-pale)", text: "var(--mbank-green)" },
};

/* ── Модалка выполнения ─────────────────────────────────── */
function CompleteModal({ task, onClose }: { task: MyTaskRow; onClose: () => void }) {
  const [result, setResult] = useState("");
  const [addActivity, setAddActivity] = useState(true);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!result.trim()) return;
    startTransition(async () => {
      await completeTask(task.id, task.client.id, result, addActivity);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Выполнить задачу</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              <Link href={`/clients/${task.client.id}`} className="hover:underline font-medium text-gray-700">
                {task.client.name}
              </Link>
              {" · "}{taskLabel(task.triggerDay)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5">×</button>
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 mb-4">
          {task.action}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Результат / комментарий <span className="text-red-400">*</span>
            </label>
            <textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="Позвонил клиенту, договорились о встрече..."
              rows={3}
              autoFocus
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={addActivity}
              onChange={(e) => setAddActivity(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--mbank-green)]"
            />
            <span className="text-sm text-gray-600">Записать как контакт с клиентом</span>
          </label>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleSubmit}
            disabled={pending || !result.trim()}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--mbank-green)" }}
          >
            {pending ? "Сохраняю..." : "Выполнено ✓"}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Основная таблица ───────────────────────────────────── */
export function TasksTable({
  tasks,
  stats,
}: {
  tasks: MyTaskRow[];
  stats: { open: number; overdue: number; p1: number };
}) {
  const sp     = useSearchParams();
  const router = useRouter();
  const [activeTask, setActiveTask] = useState<MyTaskRow | null>(null);

  function push(updates: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "ALL" || v === "") params.delete(k);
      else params.set(k, v);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Открытых задач</div>
          <div className="text-2xl font-bold text-gray-900">{stats.open}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">Просрочено</div>
          <div className={`text-2xl font-bold ${stats.overdue > 0 ? "text-red-600" : "text-gray-900"}`}>
            {stats.overdue}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-400 mb-1">P1 Срочно</div>
          <div className={`text-2xl font-bold ${stats.p1 > 0 ? "text-red-600" : "text-gray-900"}`}>
            {stats.p1}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={sp.get("priority") ?? "ALL"}
            onChange={(e) => push({ priority: e.target.value })}
            className="h-8 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
          >
            <option value="ALL">Все приоритеты</option>
            <option value="P1">P1 Срочно</option>
            <option value="P2">P2 Важно</option>
            <option value="P3">P3 Плановая</option>
          </select>

          <select
            value={sp.get("status") ?? "ALL"}
            onChange={(e) => push({ status: e.target.value })}
            className="h-8 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
          >
            <option value="ALL">Открытые</option>
            <option value="OVERDUE">Просроченные</option>
            <option value="TODAY">На сегодня</option>
            <option value="DONE">Выполненные</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {tasks.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            {(sp.get("status") === "DONE") ? "Нет выполненных задач" : "Задач нет 🎉"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Приоритет", "Клиент", "Стадия", "Задача", "Срок", "Статус", ""].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const overdue = new Date(t.dueDate) < new Date() && t.status !== "DONE";
                const style   = PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE.P3;
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-gray-50 last:border-0 transition-colors ${
                      t.status === "DONE" ? "opacity-60 bg-gray-50/30" : "hover:bg-gray-50/50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: style.bg, color: style.text }}
                      >
                        {TASK_PRIORITY_LABEL[t.priority] ?? t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/clients/${t.client.id}`} className="font-medium text-gray-900 hover:underline block truncate max-w-[180px]">
                        {t.client.name}
                      </Link>
                      <span className="text-xs text-gray-400 font-mono">{t.client.inn}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {STAGE_LABELS[t.client.clmStage as CLMStage] ?? t.client.clmStage}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 max-w-[220px]">
                      <div className="font-medium text-gray-600 mb-0.5">{taskLabel(t.triggerDay)}</div>
                      <div className="truncate text-gray-500">{t.action}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-medium ${overdue ? "text-red-600" : "text-gray-600"}`}>
                        {format(new Date(t.dueDate), "dd.MM.yyyy")}
                        {overdue && " ⚠"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.status === "DONE" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          ✓ Выполнено
                        </span>
                      ) : overdue ? (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                          Просрочено
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                          Открыта
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.status !== "DONE" && (
                        <button
                          onClick={() => setActiveTask(t)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-200 text-gray-600 hover:border-[var(--mbank-green)] hover:text-[var(--mbank-green)] transition-colors whitespace-nowrap"
                        >
                          Выполнить →
                        </button>
                      )}
                      {t.status === "DONE" && t.result && (
                        <span className="text-xs text-gray-400 italic truncate block max-w-[140px]" title={t.result}>
                          {t.result}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {activeTask && (
        <CompleteModal task={activeTask} onClose={() => setActiveTask(null)} />
      )}
    </div>
  );
}
