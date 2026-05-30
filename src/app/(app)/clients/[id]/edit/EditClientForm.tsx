"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateClient } from "@/lib/actions/clients";

type Branch  = { id: string; name: string };
type Manager = { id: string; name: string; team: string };
type KAM     = { id: string; name: string };

type Client = {
  id: string;
  inn: string;
  name: string;
  type: "YL" | "IP";
  okved: string | null;
  accountOpenedAt: Date | null;
  branchId: string;
  managerId: string | null;
  kamId: string | null;
};

type Props = {
  client: Client;
  branches: Branch[];
  managers: Manager[];
  kams: KAM[];
};

export function EditClientForm({ client, branches, managers, kams }: Props) {
  const boundAction = updateClient.bind(null, client.id);
  const [error, formAction, pending] = useActionState(boundAction, null);

  const defaultDate = client.accountOpenedAt
    ? new Date(client.accountOpenedAt).toISOString().slice(0, 10)
    : "";

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link href="/clients" className="hover:text-gray-600 transition-colors">Клиенты</Link>
        <span>/</span>
        <Link href={`/clients/${client.id}`} className="hover:text-gray-600 transition-colors truncate max-w-xs">
          {client.name}
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Редактировать</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Редактировать клиента</h2>

        <form action={formAction} className="space-y-5">

          {/* ИНН + Тип */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                ИНН <span className="text-red-400">*</span>
              </label>
              <input
                name="inn"
                required
                maxLength={14}
                defaultValue={client.inn}
                placeholder="1234567890123"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Тип <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                {[
                  { value: "YL", label: "ОсОО" },
                  { value: "IP", label: "ИП" },
                ].map((t) => (
                  <label
                    key={t.value}
                    className="flex-1 flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm cursor-pointer has-[:checked]:border-[var(--mbank-green)] has-[:checked]:bg-[var(--mbank-green-pale)] has-[:checked]:text-[var(--mbank-green)] transition-colors"
                  >
                    <input
                      type="radio"
                      name="type"
                      value={t.value}
                      required
                      defaultChecked={client.type === t.value}
                      className="sr-only"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Название */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Название <span className="text-red-400">*</span>
            </label>
            <input
              name="name"
              required
              maxLength={300}
              defaultValue={client.name}
              placeholder="ОсОО «Альфа», ИП Иванов Иван..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
            />
          </div>

          {/* Филиал + Дата открытия счёта */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Филиал <span className="text-red-400">*</span>
              </label>
              <select
                name="branchId"
                required
                defaultValue={client.branchId}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
              >
                <option value="">Выберите филиал...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Дата открытия счёта</label>
              <input
                type="date"
                name="accountOpenedAt"
                defaultValue={defaultDate}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
              />
            </div>
          </div>

          {/* Менеджер + KAM */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Менеджер</label>
              <select
                name="managerId"
                defaultValue={client.managerId ?? ""}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
              >
                <option value="">Не назначен</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.team})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">KAM</label>
              <select
                name="kamId"
                defaultValue={client.kamId ?? ""}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
              >
                <option value="">Не назначен</option>
                {kams.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ОКВЭД */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">ОКВЭД</label>
            <input
              name="okved"
              maxLength={10}
              defaultValue={client.okved ?? ""}
              placeholder="47.11"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "var(--mbank-green)" }}
            >
              {pending ? "Сохраняю..." : "Сохранить изменения"}
            </button>
            <Link
              href={`/clients/${client.id}`}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors text-center"
            >
              Отмена
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
