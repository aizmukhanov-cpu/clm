"use client";

import { useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
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
  clientId:        string;
  initial:         InitialState;
  productSyncedAt: Date | null;
};

// АБС синк считается актуальным если был < 3 дней назад
const SYNC_FRESH_DAYS = 3;

function isSyncFresh(syncedAt: Date | null): boolean {
  if (!syncedAt) return false;
  const days = (Date.now() - new Date(syncedAt).getTime()) / 86_400_000;
  return days <= SYNC_FRESH_DAYS;
}

export function ProductEditor({ clientId, initial, productSyncedAt }: Props) {
  const [state,       setState]      = useState<InitialState>(initial);
  const [pending,     startTransition] = useTransition();
  const [loadingKey,  setLoadingKey] = useState<string | null>(null);
  // confirmKey — ключ продукта, ожидающий ручного подтверждения при наличии АБС-синка
  const [confirmKey,  setConfirmKey] = useState<{ key: ProductKey; newVal: boolean } | null>(null);

  const activeCount = PRODUCTS.filter((p) => state[p.key]).length;
  const synced      = isSyncFresh(productSyncedAt);

  function applyToggle(key: ProductKey, newVal: boolean) {
    setLoadingKey(key);
    setState((prev) => ({ ...prev, [key]: newVal }));
    startTransition(async () => {
      await toggleClientProduct(clientId, key, newVal);
      setLoadingKey(null);
    });
  }

  function handleToggle(key: ProductKey) {
    const newVal = !state[key];
    // Если данные из АБС актуальны — запрашиваем подтверждение
    if (synced) {
      setConfirmKey({ key, newVal });
    } else {
      applyToggle(key, newVal);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Продуктовая карта</h3>
        <div className="flex items-center gap-2.5">
          <div className="h-1.5 w-28 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(activeCount / 10) * 100}%`,
                background:
                  activeCount >= 6 ? "var(--mbank-green)" :
                  activeCount >= 3 ? "#f59e0b" : "#94a3b8",
              }}
            />
          </div>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{
              color: activeCount >= 6 ? "var(--mbank-green)" :
                     activeCount >= 3 ? "#d97706" : "#94a3b8",
            }}
          >
            {activeCount}/10
          </span>
        </div>
      </div>

      {/* АБС статус */}
      {productSyncedAt ? (
        <div
          className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg mb-3 ${
            synced
              ? "bg-blue-50 text-blue-700 border border-blue-100"
              : "bg-amber-50 text-amber-700 border border-amber-100"
          }`}
        >
          <span>{synced ? "🏦" : "⚠️"}</span>
          <span>
            {synced
              ? `Данные из АБС актуальны — ${formatDistanceToNow(new Date(productSyncedAt), { locale: ru, addSuffix: true })}`
              : `АБС-синк устарел: ${format(new Date(productSyncedAt), "dd.MM.yyyy")} — данные могут быть неточными`}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg mb-3 bg-gray-50 text-gray-500 border border-gray-100">
          <span>📋</span>
          <span>Нет данных из АБС — продукты заполнены вручную</span>
        </div>
      )}

      {/* Product grid */}
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

      {synced ? (
        <p className="text-[10px] text-blue-500 mt-2.5">
          ℹ️ Продукты синхронизированы из АБС. Ручное изменение потребует подтверждения.
        </p>
      ) : (
        <p className="text-[10px] text-gray-400 mt-2.5">
          Нажмите на продукт, чтобы включить или отключить. Изменения сохраняются автоматически.
        </p>
      )}

      {/* Диалог подтверждения ручного изменения при актуальном АБС-синке */}
      {confirmKey && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Переопределение данных АБС</h3>
                <p className="text-sm text-gray-600">
                  Продуктовые данные получены из АБС{" "}
                  {formatDistanceToNow(new Date(productSyncedAt!), { locale: ru, addSuffix: true })}.
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Вы хотите вручную{" "}
                  <strong>{confirmKey.newVal ? "включить" : "отключить"}</strong>{" "}
                  <strong>{PRODUCTS.find(p => p.key === confirmKey.key)?.label}</strong>?
                </p>
                <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded px-2 py-1">
                  Изменение будет перезаписано при следующем АБС-синке.
                  Действие записывается в историю изменений.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  applyToggle(confirmKey.key, confirmKey.newVal);
                  setConfirmKey(null);
                }}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors"
              >
                Изменить вручную
              </button>
              <button
                onClick={() => setConfirmKey(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
