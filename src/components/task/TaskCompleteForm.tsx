"use client";

/**
 * Форма завершения задачи.
 * Используется в DeskTable, TaskCard и TasksTable.
 *
 * Уровень 1: активность в истории клиента создаётся ВСЕГДА (обязательно).
 * Уровень 2: исход выбирается из структурированного списка по типу триггера.
 */

import { useState, useTransition } from "react";
import { completeTask } from "@/lib/actions/tasks";
import { getOutcomes, type TaskOutcome } from "@/lib/task-outcomes";
import { taskLabel } from "@/lib/task-labels";

type Props = {
  taskId:     string;
  clientId:   string;
  clientName: string;
  triggerDay: string | null;
  action:     string;
  onDone:     () => void;
  /** inline = встроенная форма в TaskCard; modal = всплывающая модалка */
  variant?:   "inline" | "modal";
};

export function TaskCompleteForm({
  taskId, clientId, clientName, triggerDay, action, onDone, variant = "modal",
}: Props) {
  const outcomes: TaskOutcome[] = getOutcomes(triggerDay);

  const [outcome,      setOutcome]      = useState<string>("");
  const [comment,      setComment]      = useState<string>("");
  const [touched,      setTouched]      = useState(false);
  const [pending,      startTransition] = useTransition();

  const selectedLabel = outcomes.find((o) => o.value === outcome)?.label ?? "";
  const canSubmit     = outcome !== "" && !pending;

  function handleSubmit() {
    setTouched(true);
    if (!outcome) return;
    startTransition(async () => {
      await completeTask(taskId, clientId, outcome, selectedLabel, comment);
      onDone();
    });
  }

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent bg-white";
  const isModal  = variant === "modal";

  const formContent = (
    <div className={isModal ? "space-y-4" : "space-y-2 mt-2"}>
      {/* Task description */}
      <div className={`rounded-lg bg-gray-50 px-3 py-2 ${isModal ? "text-xs" : "text-[11px]"} text-gray-600`}>
        {action}
      </div>

      {/* Outcome select */}
      <div>
        <label className={`block font-medium text-gray-500 mb-1 ${isModal ? "text-xs" : "text-[11px]"}`}>
          Исход <span className="text-red-400">*</span>
        </label>
        <select
          value={outcome}
          onChange={(e) => { setOutcome(e.target.value); setTouched(false); }}
          className={`${inputCls} ${touched && !outcome ? "border-red-300 focus:ring-red-200" : ""} ${isModal ? "text-sm" : "text-xs"}`}
          autoFocus={isModal}
        >
          <option value="">— выберите исход —</option>
          {outcomes.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {touched && !outcome && (
          <p className="text-[10px] text-red-500 mt-0.5">Выберите исход задачи</p>
        )}
      </div>

      {/* Comment (optional) */}
      <div>
        <label className={`block font-medium text-gray-500 mb-1 ${isModal ? "text-xs" : "text-[11px]"}`}>
          Комментарий{" "}
          <span className="text-gray-400 font-normal">(необязательно)</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Детали звонка, договорённости, следующий шаг..."
          rows={isModal ? 3 : 2}
          className={`${inputCls} resize-none ${isModal ? "text-sm" : "text-xs"}`}
        />
      </div>

      {/* Notice: activity is always logged */}
      <div className={`flex items-center gap-1.5 ${isModal ? "text-xs" : "text-[10px]"} text-gray-400`}>
        <span>📋</span>
        <span>Запись автоматически добавится в историю контактов клиента</span>
      </div>

      {/* Actions */}
      <div className={`flex gap-2 ${isModal ? "pt-1" : ""}`}>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`flex-1 rounded-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${
            isModal ? "py-2.5 text-sm" : "py-1.5 text-[11px]"
          }`}
          style={{ background: "var(--mbank-green)" }}
        >
          {pending ? "Сохраняю..." : "✓ Закрыть задачу"}
        </button>
        <button
          onClick={onDone}
          disabled={pending}
          className={`rounded-lg text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 ${
            isModal ? "px-5 py-2.5 text-sm" : "px-3 py-1.5 text-[11px]"
          }`}
        >
          Отмена
        </button>
      </div>
    </div>
  );

  if (variant === "inline") {
    return formContent;
  }

  // Modal variant
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Выполнить задачу</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="font-medium text-gray-700">{clientName}</span>
              {" · "}{taskLabel(triggerDay)}
            </p>
          </div>
          <button
            onClick={onDone}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5"
          >
            ×
          </button>
        </div>
        {formContent}
      </div>
    </div>
  );
}
