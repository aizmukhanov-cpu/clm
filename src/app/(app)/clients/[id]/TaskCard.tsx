"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { format } from "date-fns";
import { completeTask } from "@/lib/actions/tasks";

type Task = {
  id: string;
  triggerDay: string | null;
  dueDate: Date;
  action: string;
  priority: string;
  status: string;
};

type Props = { task: Task; clientId: string };

const PRIORITY_STYLE: Record<string, string> = {
  P1: "bg-red-100 text-red-700",
  P2: "bg-amber-100 text-amber-700",
  P3: "bg-blue-50 text-blue-600",
};

export function TaskCard({ task, clientId }: Props) {
  const [expanded, setExpanded]       = useState(false);
  const [comment,  setComment]        = useState("");
  const [addActivity, setAddActivity] = useState(true);
  const [error,    setError]          = useState(false);
  const [pending,  startTransition]   = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const overdue    = new Date(task.dueDate) < new Date();
  const escalated  = task.status === "ESCALATED";

  // Фокус на textarea при раскрытии
  useEffect(() => {
    if (expanded) textareaRef.current?.focus();
  }, [expanded]);

  function handleSubmit() {
    if (!comment.trim()) {
      setError(true);
      textareaRef.current?.focus();
      return;
    }
    setError(false);
    startTransition(async () => {
      await completeTask(task.id, clientId, comment.trim(), addActivity);
    });
  }

  function handleCancel() {
    setExpanded(false);
    setComment("");
    setError(false);
  }

  const borderColor = escalated ? "border-purple-200" : overdue ? "border-red-100" : "border-emerald-100";
  const bgColor     = escalated ? "#faf5ff"           : overdue ? "#fef2f2"        : "var(--mbank-green-pale)";

  return (
    <div
      className={`rounded-lg border text-xs transition-all ${borderColor}`}
      style={{ background: bgColor }}
    >
      {/* ── Task info ── */}
      <div className="p-2.5">
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {escalated && (
              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                🚨 ESCALATED
              </span>
            )}
            {task.priority && (
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${PRIORITY_STYLE[task.priority] ?? ""}`}>
                {task.priority}
              </span>
            )}
            <span
              className="font-semibold truncate"
              style={escalated ? { color: "#7c3aed" } : !overdue ? { color: "var(--mbank-green)" } : { color: "#dc2626" }}
            >
              {task.triggerDay ?? "Задача"}
            </span>
          </div>
          <span className="text-gray-400 shrink-0">
            {format(new Date(task.dueDate), "dd.MM")}
            {overdue && <span className="ml-1 text-red-500">⚠</span>}
          </span>
        </div>

        <p className="text-gray-600 leading-snug mb-2">{task.action}</p>

        {/* Кнопка «Выполнить» — только когда не раскрыто */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[11px] px-2.5 py-1 rounded font-medium border transition-colors hover:opacity-80"
            style={{
              borderColor: overdue ? "#fca5a5" : "var(--mbank-green)",
              color:        overdue ? "#dc2626" : "var(--mbank-green)",
            }}
          >
            Выполнить →
          </button>
        )}
      </div>

      {/* ── Inline форма закрытия ── */}
      {expanded && (
        <div
          className="border-t px-2.5 pb-2.5 pt-2 space-y-2"
          style={{ borderColor: overdue ? "#fecaca" : "#bbf7d0" }}
        >
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">
              Результат / комментарий <span className="text-red-400">*</span>
            </label>
            <textarea
              ref={textareaRef}
              value={comment}
              onChange={(e) => { setComment(e.target.value); if (e.target.value.trim()) setError(false); }}
              placeholder="Что сделано? Результат звонка, встречи, договорённости..."
              rows={3}
              className={`w-full rounded-lg border px-2.5 py-2 text-xs resize-none bg-white focus:outline-none focus:ring-2 transition-colors ${
                error
                  ? "border-red-300 focus:ring-red-200"
                  : "border-gray-200 focus:ring-[var(--mbank-green)]"
              }`}
            />
            {error && (
              <p className="text-[10px] text-red-500 mt-0.5">Обязательно укажите результат</p>
            )}
          </div>

          {/* Опция: создать запись в активности */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={addActivity}
              onChange={(e) => setAddActivity(e.target.checked)}
              className="rounded border-gray-300 text-[var(--mbank-green)] focus:ring-[var(--mbank-green)]"
            />
            <span className="text-[11px] text-gray-500">Записать в историю контактов</span>
          </label>

          {/* Кнопки */}
          <div className="flex gap-2 pt-0.5">
            <button
              onClick={handleSubmit}
              disabled={pending}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: overdue ? "#dc2626" : "var(--mbank-green)" }}
            >
              {pending ? "Сохраняю..." : "✓ Закрыть задачу"}
            </button>
            <button
              onClick={handleCancel}
              disabled={pending}
              className="px-3 py-1.5 rounded-lg text-[11px] text-gray-500 border border-gray-200 hover:bg-white transition-colors disabled:opacity-60"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
