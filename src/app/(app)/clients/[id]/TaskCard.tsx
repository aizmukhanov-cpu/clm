"use client";

import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { taskLabel, TASK_PRIORITY_LABEL } from "@/lib/task-labels";
import { TaskCompleteForm } from "@/components/task/TaskCompleteForm";

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
  const [expanded, setExpanded] = useState(false);
  const expandRef = useRef<HTMLDivElement>(null);

  const overdue   = new Date(task.dueDate) < new Date();
  const escalated = task.status === "ESCALATED";

  // Скролл к форме при раскрытии
  useEffect(() => {
    if (expanded) expandRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [expanded]);

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
                🚨 Эскалировано
              </span>
            )}
            {task.priority && (
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${PRIORITY_STYLE[task.priority] ?? ""}`}>
                {TASK_PRIORITY_LABEL[task.priority] ?? task.priority}
              </span>
            )}
            <span
              className="font-semibold truncate"
              style={escalated ? { color: "#7c3aed" } : !overdue ? { color: "var(--mbank-green)" } : { color: "#dc2626" }}
            >
              {taskLabel(task.triggerDay)}
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
          ref={expandRef}
          className="border-t px-2.5 pb-2.5 pt-2"
          style={{ borderColor: overdue ? "#fecaca" : "#bbf7d0" }}
        >
          <TaskCompleteForm
            variant="inline"
            taskId={task.id}
            clientId={clientId}
            clientName=""
            triggerDay={task.triggerDay}
            action={task.action}
            onDone={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  );
}
