"use client";

import { useActionState, useState } from "react";
import { saveProductTargets } from "@/lib/actions/admin-products";

type Branch  = { id: string; name: string; region: string };
type Product = { code: string; label: string; icon: string };

type Props = {
  branches:  Branch[];
  products:  Product[];
  targetMap: Record<string, Record<string, number>>;
  year:      number;
  month:     number;
};

const MONTH_LABELS = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

export function ProductTargetsForm({ branches, products, targetMap, year, month }: Props) {
  const [saved, setSaved] = useState(false);
  const [error, formAction, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await saveProductTargets(prev, fd);
      if (!result) setSaved(true);
      return result;
    },
    null,
  );

  function branchTotal(branchId: string) {
    return products.reduce((sum, p) => sum + (targetMap[branchId]?.[p.code] ?? 0), 0);
  }

  // Split products into rows of 5 for grid
  const COLS = 5;
  const productRows: Product[][] = [];
  for (let i = 0; i < products.length; i += COLS) {
    productRows.push(products.slice(i, i + COLS));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="year"  value={year}  />
      <input type="hidden" name="month" value={month} />

      {branches.map((branch) => (
        <div key={branch.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Branch header */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ background: "var(--mbank-green-dark)" }}
          >
            <div>
              <span className="font-semibold text-white text-sm">{branch.name}</span>
              <span className="text-white/50 text-xs ml-2">{branch.region}</span>
            </div>
            <span className="text-white/60 text-xs">
              Итого план:{" "}
              <span className="text-white font-semibold">{branchTotal(branch.id)}</span>
            </span>
          </div>

          {/* Products grid — rows of 5 */}
          <div className="p-4 space-y-3">
            {productRows.map((row, ri) => (
              <div key={ri} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                {row.map((product) => {
                  const current = targetMap[branch.id]?.[product.code] ?? 0;
                  return (
                    <div key={product.code} className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-gray-500 truncate">
                        {product.icon} {product.label}
                      </label>
                      <input
                        type="number"
                        name={`t_${branch.id}_${product.code}`}
                        defaultValue={current || ""}
                        min="0"
                        step="1"
                        placeholder="0"
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
                      />
                    </div>
                  );
                })}
                {/* Fill empty cells in last row */}
                {row.length < COLS &&
                  Array.from({ length: COLS - row.length }).map((_, i) => (
                    <div key={"empty_" + i} />
                  ))}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Summary row */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="text-xs font-medium text-gray-500 mb-3">
          Итого по всем филиалам — {MONTH_LABELS[month - 1]} {year}
        </div>
        <div className="space-y-3">
          {productRows.map((row, ri) => (
            <div key={ri} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
              {row.map((product) => {
                const total = branches.reduce(
                  (sum, b) => sum + (targetMap[b.id]?.[product.code] ?? 0),
                  0,
                );
                return (
                  <div key={product.code} className="text-center">
                    <div className="text-[11px] text-gray-400 truncate mb-1">
                      {product.icon} {product.label}
                    </div>
                    <div
                      className="text-base font-bold tabular-nums"
                      style={{ color: total > 0 ? "var(--mbank-green)" : "#d1d5db" }}
                    >
                      {total}
                    </div>
                  </div>
                );
              })}
              {row.length < COLS &&
                Array.from({ length: COLS - row.length }).map((_, i) => (
                  <div key={"empty_" + i} />
                ))}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">{error}</p>
      )}
      {saved && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2.5">
          ✓ Плановые показатели сохранены ({MONTH_LABELS[month - 1]} {year})
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="px-8 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--mbank-green)" }}
        >
          {pending ? "Сохраняю..." : `Сохранить план — ${MONTH_LABELS[month - 1]} ${year}`}
        </button>
        <p className="text-xs text-gray-400">
          Изменения применяются только к выбранному месяцу
        </p>
      </div>
    </form>
  );
}
