"use client";

import { useActionState, useState, useTransition } from "react";
import { saveProduct, deleteProduct } from "@/lib/actions/admin-products";
import type { ProductRow } from "@/lib/actions/admin-products";

/* ─── Inline form for add / edit ─────────────────────────── */

function ProductForm({
  product,
  onDone,
}: {
  product?: ProductRow;
  onDone: () => void;
}) {
  const [error, formAction, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const err = await saveProduct(prev, fd);
      if (!err) onDone();
      return err;
    },
    null,
  );

  return (
    <form action={formAction} className="bg-[var(--mbank-green-pale)] border border-[var(--mbank-green)]/20 rounded-xl p-4">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid grid-cols-[80px_1fr_2fr_80px_60px] gap-3 items-end">
        {/* Icon */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Иконка</label>
          <input
            type="text"
            name="icon"
            defaultValue={product?.icon ?? "📦"}
            maxLength={4}
            placeholder="📦"
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-center text-lg focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
          />
        </div>

        {/* Code */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Код (LATIN_CAPS)</label>
          <input
            type="text"
            name="code"
            defaultValue={product?.code ?? ""}
            placeholder="NEW_PRODUCT"
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
            required
            readOnly={!!product}
            style={product ? { background: "#f3f4f6", color: "#9ca3af" } : {}}
          />
        </div>

        {/* Label */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Название</label>
          <input
            type="text"
            name="label"
            defaultValue={product?.label ?? ""}
            placeholder="Название продукта"
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
            required
          />
        </div>

        {/* Sort order */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Порядок</label>
          <input
            type="number"
            name="sortOrder"
            defaultValue={product?.sortOrder ?? 99}
            min="0"
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
          />
        </div>

        {/* Active */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Активен</label>
          <select
            name="active"
            defaultValue={product?.active !== false ? "true" : "false"}
            className="w-full rounded-lg border border-gray-200 px-1.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
          >
            <option value="true">Да</option>
            <option value="false">Нет</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-1.5">{error}</p>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--mbank-green)" }}
        >
          {pending ? "Сохраняю..." : product ? "Сохранить" : "Добавить продукт"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-1.5 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

/* ─── Delete button ──────────────────────────────────────── */

function DeleteBtn({ product }: { product: ProductRow }) {
  const [pending, start] = useTransition();
  const [asked, setAsked] = useState(false);

  if (!asked) {
    return (
      <button
        onClick={() => setAsked(true)}
        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
      >
        Удалить
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <span className="text-xs text-red-600">Удалить «{product.label}»?</span>
      <button
        onClick={() => {
          start(async () => {
            await deleteProduct(product.id);
          });
        }}
        disabled={pending}
        className="text-xs px-2.5 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
      >
        {pending ? "..." : "Да"}
      </button>
      <button
        onClick={() => setAsked(false)}
        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
      >
        Нет
      </button>
    </span>
  );
}

/* ─── Main section ───────────────────────────────────────── */

export function ProductCatalogSection({ products }: { products: ProductRow[] }) {
  const [adding, setAdding]       = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Add form */}
      {adding ? (
        <ProductForm onDone={() => setAdding(false)} />
      ) : (
        <div className="flex justify-end">
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--mbank-green)" }}
          >
            + Добавить продукт
          </button>
        </div>
      )}

      {/* Products table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Иконка</th>
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Код</th>
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Название</th>
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Порядок</th>
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Статус</th>
              <th className="text-right text-xs font-medium text-gray-400 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.flatMap((p) => {
              const rows = [
                <tr
                  key={p.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors"
                >
                  <td className="px-4 py-3 text-xl">{p.icon}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.code}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.label}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{p.sortOrder}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={
                        p.active
                          ? { background: "var(--mbank-green-pale)", color: "var(--mbank-green)" }
                          : { background: "#f3f4f6", color: "#9ca3af" }
                      }
                    >
                      {p.active ? "Активен" : "Скрыт"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditingId(editingId === p.id ? null : p.id)}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-[var(--mbank-green)] hover:text-[var(--mbank-green)] transition-colors"
                      >
                        {editingId === p.id ? "Скрыть" : "Изменить"}
                      </button>
                      <DeleteBtn product={p} />
                    </div>
                  </td>
                </tr>,
              ];
              if (editingId === p.id) {
                rows.push(
                  <tr key={p.id + "_edit"} className="border-b border-gray-50">
                    <td colSpan={6} className="px-4 pb-4">
                      <ProductForm product={p} onDone={() => setEditingId(null)} />
                    </td>
                  </tr>,
                );
              }
              return rows;
            })}
          </tbody>
        </table>

        {products.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            Продукты не найдены. Добавьте первый продукт.
          </div>
        )}
      </div>
    </div>
  );
}
