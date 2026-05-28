"use client";

import { useActionState, useState } from "react";
import { updateKYCItem, KYC_ITEMS, type KYCRow } from "@/lib/actions/kyc";

const STATUS_CONFIG = {
  DONE:    { label: "✅ Готово",    bg: "#dcfce7", text: "#15803d" },
  PENDING: { label: "⏳ Ожидает",   bg: "#fefce8", text: "#92400e" },
  N_A:     { label: "—  Н/П",      bg: "#f3f4f6", text: "#6b7280" },
};

type Props = {
  clientId: string;
  rows:     KYCRow[];
};

function KYCItemRow({ clientId, item, row }: { clientId: string; item: string; row: KYCRow }) {
  const [editing, setEditing] = useState(false);
  const action = updateKYCItem.bind(null, clientId);
  const [error, formAction, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const r = await action(prev, fd);
      if (!r) setEditing(false);
      return r;
    },
    null
  );

  const label   = KYC_ITEMS.find(k => k.key === item)?.label ?? item;
  const statusCfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.PENDING;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span
        className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5"
        style={{ background: statusCfg.bg, color: statusCfg.text }}
      >
        {statusCfg.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-800 font-medium">{label}</div>
        {row.note && !editing && (
          <div className="text-xs text-gray-400 mt-0.5 truncate">{row.note}</div>
        )}

        {editing && (
          <form action={formAction} className="mt-2 space-y-2">
            <input type="hidden" name="item" value={item} />
            <select
              name="status"
              defaultValue={row.status}
              className="w-full text-xs rounded border border-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
            >
              <option value="PENDING">⏳ Ожидает</option>
              <option value="DONE">✅ Готово</option>
              <option value="N_A">— Не применимо</option>
            </select>
            <input
              name="note"
              defaultValue={row.note ?? ""}
              placeholder="Комментарий (опционально)"
              className="w-full text-xs rounded border border-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
            />
            {error && <p className="text-[11px] text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="text-xs px-3 py-1 rounded font-medium text-white disabled:opacity-60"
                style={{ background: "var(--mbank-green)" }}
              >
                {pending ? "..." : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs px-3 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>

      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] text-gray-400 hover:text-[var(--mbank-green)] transition-colors shrink-0 mt-0.5"
        >
          Изменить
        </button>
      )}
    </div>
  );
}

export function KYCPanel({ clientId, rows }: Props) {
  const [open, setOpen] = useState(false);

  const doneCount    = rows.filter(r => r.status === "DONE").length;
  const pendingCount = rows.filter(r => r.status === "PENDING").length;
  const total        = rows.length;

  const pct = Math.round((doneCount / total) * 100);
  const allDone = doneCount === total;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-gray-800">📋 KYC Чеклист</span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: allDone ? "#dcfce7" : pendingCount > 0 ? "#fefce8" : "#f3f4f6",
              color:      allDone ? "#15803d" : pendingCount > 0 ? "#92400e" : "#6b7280",
            }}
          >
            {doneCount}/{total} · {pct}%
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-4">
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-gray-100 mb-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width:      `${pct}%`,
                background: allDone ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#ef4444",
              }}
            />
          </div>

          {rows.map(row => (
            <KYCItemRow
              key={row.item}
              clientId={clientId}
              item={row.item}
              row={row}
            />
          ))}
        </div>
      )}
    </div>
  );
}
