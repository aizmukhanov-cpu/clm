"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Branch  = { id: string; name: string; region: string };
type Supervisor = { id: string; name: string; team: string };

type Props = {
  action: (prev: string | null, fd: FormData) => Promise<string | null>;
  initialValues?: {
    name?: string;
    email?: string;
    role?: string;
    team?: string;
    branchId?: string;
    supervisorId?: string | null;
  };
  isEdit?: boolean;
  branches: Branch[];
  supervisors: Supervisor[];
};

const ROLES = [
  { value: "SPECIALIST",  label: "Специалист",     desc: "Видит только своих клиентов" },
  { value: "SUPERVISOR",  label: "Супервайзер",     desc: "Видит своих + подчинённых" },
  { value: "KAM",         label: "KAM",             desc: "КАМ-портфель крупных клиентов" },
  { value: "TEAM_LEAD",   label: "Рук. команды",    desc: "Вся команда целиком" },
  { value: "ANALYST",     label: "Аналитик",        desc: "Read-only по своей команде" },
  { value: "DIRECTOR",    label: "Директор",        desc: "Read-only по всем командам" },
  { value: "ADMIN",       label: "Администратор",   desc: "Полный доступ + настройки" },
];

const TEAMS = [
  { value: "B2B",    label: "B2B — Микро / ИП" },
  { value: "KM",     label: "КМ — МСБ" },
  { value: "KAM",    label: "KAM — Крупный бизнес" },
  { value: "VB",     label: "Virtual Branch" },
  { value: "BRANCH", label: "Филиалы" },
];

export function UserForm({ action, initialValues = {}, isEdit = false, branches, supervisors }: Props) {
  const router = useRouter();
  const [error, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      {/* Имя + Email */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Полное имя <span className="text-red-400">*</span>
          </label>
          <input
            name="name"
            required
            defaultValue={initialValues.name}
            placeholder="Иванов Иван Иванович"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            defaultValue={initialValues.email}
            placeholder="ivanov@mbank.kg"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
          />
        </div>
      </div>

      {/* Пароль */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Пароль {isEdit ? <span className="text-gray-400 font-normal">(оставьте пустым чтобы не менять)</span> : <span className="text-red-400">*</span>}
        </label>
        <input
          name="password"
          type="password"
          required={!isEdit}
          minLength={6}
          placeholder={isEdit ? "••••••• (новый пароль)" : "Минимум 6 символов"}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
        />
      </div>

      {/* Роль */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Роль <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <label
              key={r.value}
              className="flex items-start gap-2.5 rounded-lg border border-gray-200 px-3 py-2.5 cursor-pointer has-[:checked]:border-[var(--mbank-green)] has-[:checked]:bg-[var(--mbank-green-pale)] transition-colors"
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                required
                defaultChecked={initialValues.role === r.value}
                className="mt-0.5 accent-[var(--mbank-green)]"
              />
              <div>
                <div className="text-sm font-medium text-gray-800">{r.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{r.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Команда + Филиал */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Команда <span className="text-red-400">*</span>
          </label>
          <select
            name="team"
            required
            defaultValue={initialValues.team ?? ""}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
          >
            <option value="" disabled>Выберите команду</option>
            {TEAMS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Филиал <span className="text-red-400">*</span>
          </label>
          <select
            name="branchId"
            required
            defaultValue={initialValues.branchId ?? ""}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
          >
            <option value="" disabled>Выберите филиал</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} — {b.region}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Руководитель (supervisor) */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Непосредственный руководитель
          <span className="text-gray-400 font-normal ml-1">(для специалистов и супервайзеров)</span>
        </label>
        <select
          name="supervisorId"
          defaultValue={initialValues.supervisorId ?? ""}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
        >
          <option value="">— не указан —</option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.team})
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--mbank-green)" }}
        >
          {pending ? "Сохраняю..." : isEdit ? "Сохранить изменения" : "Создать сотрудника"}
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
  );
}
