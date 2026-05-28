import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeleteUserButton } from "./DeleteUserButton";
import { AdminTabBar } from "../AdminTabBar";

const ROLE_LABEL: Record<string, string> = {
  ADMIN:      "Admin",
  DIRECTOR:   "Директор",
  ANALYST:    "Аналитик",
  TEAM_LEAD:  "Рук. команды",
  SUPERVISOR: "Супервайзер",
  SPECIALIST: "Специалист",
  KAM:        "KAM",
};

const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  ADMIN:      { bg: "#fef2f2", text: "#dc2626" },
  DIRECTOR:   { bg: "#faf5ff", text: "#7c3aed" },
  ANALYST:    { bg: "#eff6ff", text: "#1d4ed8" },
  TEAM_LEAD:  { bg: "var(--mbank-green-pale)", text: "var(--mbank-green)" },
  SUPERVISOR: { bg: "#fff7ed", text: "#c2410c" },
  SPECIALIST: { bg: "#f0fdf4", text: "#15803d" },
  KAM:        { bg: "#fefce8", text: "#92400e" },
};

const TEAM_COLOR: Record<string, { bg: string; text: string }> = {
  B2B:    { bg: "#eff6ff", text: "#1d4ed8" },
  KM:     { bg: "#f0fdf4", text: "#15803d" },
  KAM:    { bg: "#faf5ff", text: "#7c3aed" },
  VB:     { bg: "#fff7ed", text: "#c2410c" },
  BRANCH: { bg: "#f0fdfa", text: "#0f766e" },
};

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/dashboard");

  const users = await db.user.findMany({
    include: {
      branch:     { select: { name: true } },
      supervisor: { select: { name: true } },
      _count:     { select: { managedClients: true, kamClients: true } },
    },
    orderBy: [{ team: "asc" }, { role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Управление доступом</h2>
        <p className="text-sm text-gray-400 mt-0.5">Сотрудники системы и настройки прав доступа</p>
      </div>

      <div className="flex items-center justify-between">
        <AdminTabBar active="/admin/users" />
        <Link
          href="/admin/users/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--mbank-green)" }}
        >
          + Добавить сотрудника
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {["Имя / Email", "Роль", "Команда", "Филиал", "Руководитель", "Клиентов", ""].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const roleCol = ROLE_COLOR[u.role] ?? { bg: "#f3f4f6", text: "#374151" };
              const teamCol = TEAM_COLOR[u.team] ?? { bg: "#f3f4f6", text: "#374151" };
              const clients = u._count.managedClients + u._count.kamClients;
              const isMe    = u.id === session.id;
              return (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 flex items-center gap-1.5">
                      {u.name}
                      {isMe && (
                        <span className="text-[10px] font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">вы</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: roleCol.bg, color: roleCol.text }}
                    >
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: teamCol.bg, color: teamCol.text }}
                    >
                      {u.team}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{u.branch.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{u.supervisor?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {clients > 0 ? (
                      <span className="text-xs font-medium text-gray-600">{clients}</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/admin/users/${u.id}/edit`}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[var(--mbank-green)] hover:text-[var(--mbank-green)] transition-colors"
                      >
                        Изменить
                      </Link>
                      {!isMe && (
                        <DeleteUserButton userId={u.id} userName={u.name} clientCount={clients} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
