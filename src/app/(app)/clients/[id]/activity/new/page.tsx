"use client";

import { useActionState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createActivity } from "@/lib/actions/activities";
import { ActivityType } from "@/generated/prisma/client";

const TYPE_LABELS: Record<ActivityType, string> = {
  CALL:    "📞 Звонок",
  MEETING: "🤝 Встреча",
  EMAIL:   "✉️ Письмо",
};

export default function NewActivityPage() {
  const { id: clientId } = useParams<{ id: string }>();
  const router = useRouter();

  const action = createActivity.bind(null, clientId);
  const [error, formAction, pending] = useActionState(action, null);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link href="/clients" className="hover:text-gray-600 transition-colors">Клиенты</Link>
        <span>/</span>
        <Link href={`/clients/${clientId}`} className="hover:text-gray-600 transition-colors">Карточка</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Добавить контакт</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Новый контакт</h2>

        <form action={formAction} className="space-y-4">
          {/* Тип */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Тип контакта</label>
            <div className="flex gap-2">
              {(Object.keys(TYPE_LABELS) as ActivityType[]).map((t) => (
                <label
                  key={t}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm cursor-pointer has-[:checked]:border-[var(--mbank-green)] has-[:checked]:bg-[var(--mbank-green-pale)] has-[:checked]:text-[var(--mbank-green)] transition-colors"
                >
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    className="sr-only"
                    required
                    defaultChecked={t === "CALL"}
                  />
                  {TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </div>

          {/* Дата */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Дата контакта</label>
            <input
              type="date"
              name="date"
              defaultValue={today}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
            />
          </div>

          {/* Результат */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Результат <span className="text-gray-400">(кратко)</span>
            </label>
            <input
              type="text"
              name="result"
              placeholder="Договорились о встрече, отправили КП..."
              required
              maxLength={200}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
            />
          </div>

          {/* Заметки */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Детали <span className="text-gray-400">(необязательно)</span>
            </label>
            <textarea
              name="notes"
              placeholder="Обсудили подключение MBusiness, клиент заинтересован..."
              rows={3}
              maxLength={1000}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "var(--mbank-green)" }}
            >
              {pending ? "Сохраняю..." : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
