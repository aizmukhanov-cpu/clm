"use client";

import { useState, useTransition } from "react";
import { toggleClientProduct } from "@/lib/actions/clients";

const PRODUCTS = [
  { key: "hasMBusiness",     label: "MBusiness",     icon: "📱", category: "digital" },
  { key: "hasMKassaPos",     label: "MKassa POS",    icon: "💳", category: "acquiring" },
  { key: "hasMKassaQr",      label: "MKassa QR",     icon: "📷", category: "acquiring" },
  { key: "hasAcquiring",     label: "Эквайринг",     icon: "💰", category: "acquiring" },
  { key: "hasSalaryProject", label: "ЗП-проект",     icon: "👥", category: "payroll" },
  { key: "hasPayroll",       label: "Зарплата",      icon: "💼", category: "payroll" },
  { key: "hasCorporateCard", label: "Корп. карта",   icon: "🪪", category: "card" },
  { key: "hasCredit",        label: "Кредит",        icon: "📋", category: "credit" },
  { key: "hasDeposit",       label: "Депозит",       icon: "🏦", category: "credit" },
  { key: "hasTradeFinance",  label: "Торг. финанс.", icon: "📦", category: "trade" },
] as const;

type ProductKey = (typeof PRODUCTS)[number]["key"];

type InitialState = Record<ProductKey, boolean>;

type Props = {
  clientId: string;
  initial: InitialState;
};

export function ProductEditor({ clientId, initial }: Props) {
  const [state, setState] = useState<InitialState>(initial);
  const [pending, startTransition] = useTransition();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const activeCount = PRODUCTS.filter((p) => state[p.key]).length;

  function handleToggle(key: ProductKey) {
    const newVal = !state[key];
    setLoadingKey(key);
    setState((prev) => ({ ...prev, [key]: newVal }));
    startTransition(async () => {
      await toggleClientProduct(clientId, key, newVal);
      setLoadingKey(null);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Продуктовая карта</h3>
        <div className="flex items-center gap-2.5">
          <div className="h-1.5 w-28 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(activeCount / 10) * 100}%`,
                background:
                  activeCount >= 6
                    ? "var(--mbank-green)"
                    : activeCount >= 3
                    ? "#f59e0b"
                    : "#94a3b8",
              }}
            />
          </div>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{
              color:
                activeCount >= 6
                  ? "var(--mbank-green)"
                  : activeCount >= 3
                  ? "#d97706"
                  : "#94a3b8",
            }}
          >
            {activeCount}/10
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {PRODUCTS.map((p) => {
          const active  = state[p.key];
          const loading = loadingKey === p.key;
          return (
            <button
              key={p.key}
              type="button"
              disabled={pending}
              onClick={() => handleToggle(p.key)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all text-left cursor-pointer select-none border ${
                active
                  ? "border-transparent"
                  : "border-gray-200 hover:border-gray-300"
              } ${loading ? "opacity-60" : ""}`}
              style={
                active
                  ? { background: "var(--mbank-green-pale)", color: "var(--mbank-green)" }
                  : { background: "#f9fafb", color: "#6b7280" }
              }
            >
              <span className="text-base leading-none shrink-0">{p.icon}</span>
              <span className={`text-xs font-medium flex-1 ${active ? "" : "text-gray-400"}`}>
                {p.label}
              </span>
              {loading ? (
                <span className="ml-auto text-[10px] animate-spin">⟳</span>
              ) : active ? (
                <span className="ml-auto text-[10px] font-bold" style={{ color: "var(--mbank-green)" }}>✓</span>
              ) : (
                <span className="ml-auto text-[10px] text-gray-300">+</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 mt-2.5">
        Нажмите на продукт, чтобы включить или отключить. Изменения сохраняются автоматически.
      </p>
    </div>
  );
}
