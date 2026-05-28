"use client";

import { useState, useActionState } from "react";
import { upsertAccountPlan } from "@/lib/actions/accountplan";
import { format } from "date-fns";

type AccountPlan = {
  revenueTarget: number | null;
  revenueActual: number | null;
  nextMeeting: Date | null;
  initiatives: string | null; // JSON string[]
};

type Props = {
  clientId: string;
  plan: AccountPlan | null;
  canEdit: boolean;
};

function fmtM(v: number | null) {
  if (!v) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

export function AccountPlanPanel({ clientId, plan, canEdit }: Props) {
  const [editing, setEditing] = useState(!plan && canEdit);

  const action = upsertAccountPlan.bind(null, clientId);
  const [error, formAction, pending] = useActionState(action, null);

  const initiatives: string[] = plan?.initiatives
    ? (() => { try { return JSON.parse(plan.initiatives); } catch { return []; } })()
    : [];

  const targetKt = plan?.revenueTarget ? plan.revenueTarget / 1000 : null;
  const actualKt = plan?.revenueActual ? plan.revenueActual / 1000 : null;
  const progress = targetKt && actualKt ? Math.min(100, Math.round((actualKt / targetKt) * 100)) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Account Plan</h3>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-2.5 py-1 rounded-lg border border-dashed font-medium hover:bg-gray-50 transition-colors"
            style={{ borderColor: "var(--mbank-green)", color: "var(--mbank-green)" }}
          >
            {plan ? "Изменить" : "+ Создать"}
          </button>
        )}
      </div>

      {editing ? (
        <form
          action={async (fd) => {
            await formAction(fd);
            setEditing(false);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">
                Цель выручки (тыс. сом)
              </label>
              <input
                type="number"
                name="revenueTarget"
                defaultValue={targetKt ?? ""}
                placeholder="5 000"
                min={0}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">
                Факт выручки (тыс. сом)
              </label>
              <input
                type="number"
                name="revenueActual"
                defaultValue={actualKt ?? ""}
                placeholder="2 500"
                min={0}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">
              Следующая встреча
            </label>
            <input
              type="datetime-local"
              name="nextMeeting"
              defaultValue={plan?.nextMeeting
                ? new Date(plan.nextMeeting).toISOString().slice(0, 16)
                : ""}
              className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">
              Ключевые инициативы (каждая с новой строки)
            </label>
            <textarea
              name="initiatives"
              rows={4}
              defaultValue={initiatives.join("\n")}
              placeholder={"Подключить зарплатный проект\nОткрыть депозит на 12 мес.\nВнедрить MKassa POS на 3 торговых точках"}
              className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
            />
          </div>

          {error && (
            <p className="text-[11px] text-red-500 bg-red-50 rounded px-2.5 py-1.5">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--mbank-green)" }}
            >
              {pending ? "Сохраняю..." : "Сохранить план"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 rounded-lg text-[11px] text-gray-500 border border-gray-200 hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </form>
      ) : plan ? (
        <div className="space-y-4">
          {/* Revenue progress */}
          <div>
            <div className="flex items-end justify-between mb-2">
              <div>
                <div className="text-[11px] text-gray-400 mb-0.5">Выручка план / факт</div>
                <div className="text-lg font-bold text-gray-900">
                  {fmtM(plan.revenueActual)}
                  <span className="text-sm font-normal text-gray-400 ml-1">
                    / {fmtM(plan.revenueTarget)} сом
                  </span>
                </div>
              </div>
              {progress !== null && (
                <div
                  className="text-xl font-bold tabular-nums"
                  style={{
                    color: progress >= 100 ? "var(--mbank-green)"
                         : progress >= 60  ? "#d97706"
                         : "#dc2626",
                  }}
                >
                  {progress}%
                </div>
              )}
            </div>
            {progress !== null && (
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progress}%`,
                    background: progress >= 100 ? "var(--mbank-green)"
                               : progress >= 60  ? "#f59e0b"
                               : "#ef4444",
                  }}
                />
              </div>
            )}
          </div>

          {/* Next meeting */}
          {plan.nextMeeting && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">📅 Следующая встреча:</span>
              <span className="font-semibold text-gray-700">
                {format(new Date(plan.nextMeeting), "dd.MM.yyyy HH:mm")}
              </span>
            </div>
          )}

          {/* Initiatives */}
          {initiatives.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-gray-500 mb-2">Ключевые инициативы</div>
              <ul className="space-y-1.5">
                {initiatives.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5"
                      style={{ background: "var(--mbank-green)" }}
                    >
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-4">
          Account Plan не создан
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="ml-2 underline"
              style={{ color: "var(--mbank-green)" }}
            >
              создать
            </button>
          )}
        </p>
      )}
    </div>
  );
}
