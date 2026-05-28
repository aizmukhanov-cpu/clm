"use client";

import { useState } from "react";
import { createProposalTemplate, deleteProposalTemplate } from "@/lib/actions/proposals";
import { useRouter } from "next/navigation";

type Template = {
  id:          string;
  title:       string;
  team:        string;
  productName: string;
  body:        string;
  tags:        string | null;
  createdAt:   Date;
};

const PRODUCTS = [
  "RKO", "MBusiness", "Эквайринг (POS)", "Эквайринг (QR)", "Кредит",
  "Овердрафт", "Торговое финансирование", "Зарплатный проект",
  "Депозит", "Корпоративная карта",
];

export function TemplatesClient({
  templates,
  canEdit,
  team,
}: {
  templates: Template[];
  canEdit: boolean;
  team: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm]   = useState(false);
  const [preview, setPreview]     = useState<Template | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({
    title: "", productName: PRODUCTS[0], body: "", tags: "",
  });

  async function handleCreate() {
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    await createProposalTemplate({ ...form, team });
    setForm({ title: "", productName: PRODUCTS[0], body: "", tags: "" });
    setShowForm(false);
    setSaving(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await deleteProposalTemplate(id);
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(s => !s)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--mbank-green)" }}
          >
            {showForm ? "Отмена" : "+ Новый шаблон"}
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm">Новый шаблон КП</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">Название шаблона</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Напр.: КП на МБизнес для МСБ"
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">Продукт</label>
              <select
                value={form.productName}
                onChange={e => setForm(f => ({ ...f, productName: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-green-600 bg-white"
              >
                {PRODUCTS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">Теги (через запятую)</label>
            <input
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="мсб, кредит, новый клиент"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">Текст КП</label>
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Уважаемый [Имя клиента],&#10;&#10;Предлагаем Вашей компании подключить…"
              rows={10}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-green-600 font-mono resize-y"
            />
            <p className="text-[10px] text-gray-400">Поддерживаются переменные: [Имя клиента], [ИНН], [Менеджер]</p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Отмена
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ background: "var(--mbank-green)" }}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </div>
      )}

      {/* Templates grid */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm">
          Шаблонов ещё нет. Создайте первый.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {templates.map(t => (
            <div
              key={t.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm">{t.title}</h4>
                  <span
                    className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1"
                    style={{ background: "var(--mbank-green)", color: "#fff" }}
                  >
                    {t.productName}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setPreview(t)}
                    className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50"
                  >
                    Просмотр
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleting === t.id}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                    >
                      {deleting === t.id ? "…" : "Удалить"}
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{t.body}</p>

              {t.tags && (
                <div className="flex flex-wrap gap-1">
                  {t.tags.split(",").map(tag => (
                    <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">{preview.title}</h3>
                <span
                  className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1"
                  style={{ background: "var(--mbank-green)", color: "#fff" }}
                >
                  {preview.productName}
                </span>
              </div>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 rounded-lg p-4">
              {preview.body}
            </pre>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(preview.body); }}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Скопировать текст
              </button>
              <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "var(--mbank-green)" }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
