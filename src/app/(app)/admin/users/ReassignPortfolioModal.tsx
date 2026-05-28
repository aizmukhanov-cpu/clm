"use client";

import { useActionState, useState } from "react";
import { reassignPortfolio } from "@/lib/actions/admin-users";

type User = {
  id: string;
  name: string;
  team: string;
  _count: { managedClients: number; kamClients: number };
};

type Props = { users: User[] };

export function ReassignPortfolioModal({ users }: Props) {
  const [open,        setOpen]        = useState(false);
  const [mode,        setMode]        = useState<"specific" | "auto">("auto");
  const [fromUserId,  setFromUserId]  = useState("");
  const [error, formAction, pending]  = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await reassignPortfolio(prev, fd);
      if (!result) setOpen(false); // success
      return result;
    },
    null
  );

  const fromUser = users.find(u => u.id === fromUserId);
  const clientCount = fromUser
    ? fromUser._count.managedClients + fromUser._count.kamClients
    : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors"
        style={{ borderColor: "#dc2626", color: "#dc2626" }}
      >
        🔄 Перераспределить портфель
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 z-10">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Экстренное перераспределение портфеля
            </h3>
            <p className="text-sm text-gray-400 mb-5">
              Все клиенты менеджера будут переназначены другим менеджерам
            </p>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="mode" value={mode} />

              {/* Источник */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Менеджер-источник <span className="text-red-400">*</span>
                </label>
                <select
                  name="fromUserId"
                  required
                  value={fromUserId}
                  onChange={e => setFromUserId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <option value="" disabled>Выберите менеджера</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.team}) — {u._count.managedClients + u._count.kamClients} клиентов
                    </option>
                  ))}
                </select>
                {fromUser && clientCount > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ {clientCount} клиентов будут переназначены
                  </p>
                )}
              </div>

              {/* Режим */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Режим перераспределения
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "auto",     label: "⚖️ Авто-балансировка",  desc: "Round-robin по менеджерам филиала" },
                    { value: "specific", label: "👤 На конкретного менеджера", desc: "Все клиенты одному человеку" },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                        mode === opt.value ? "border-red-400 bg-red-50" : "border-gray-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="_mode_radio"
                        value={opt.value}
                        checked={mode === opt.value}
                        onChange={() => setMode(opt.value as "specific" | "auto")}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-semibold text-gray-800">{opt.label}</div>
                        <div className="text-[11px] text-gray-400">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Получатель (только в режиме specific) */}
              {mode === "specific" && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Менеджер-получатель <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="toUserId"
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  >
                    <option value="" disabled>Выберите получателя</option>
                    {users
                      .filter(u => u.id !== fromUserId)
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.team}) — {u._count.managedClients + u._count.kamClients} клиентов
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={pending || !fromUserId}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#dc2626" }}
                >
                  {pending ? "Перераспределяю..." : `🔄 Перераспределить ${clientCount > 0 ? `(${clientCount} клиентов)` : ""}`}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
