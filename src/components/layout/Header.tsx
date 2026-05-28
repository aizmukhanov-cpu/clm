import { getSession } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Админ",
  ANALYST: "Аналитик",
  MANAGER: "Менеджер",
  KAM_ROLE: "KAM",
};

const TEAM_COLORS: Record<string, string> = {
  VB:  "bg-blue-50 text-blue-700 border-blue-200",
  B2B: "bg-amber-50 text-amber-700 border-amber-200",
  KM:  "bg-purple-50 text-purple-700 border-purple-200",
  KAM: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const TEAM_LABELS: Record<string, string> = {
  VB: "Virtual Branch",
  B2B: "B2B",
  KM: "КМ",
  KAM: "KAM",
};

export async function Header({ title }: { title?: string }) {
  const session = await getSession();

  return (
    <header
      className="h-14 flex items-center justify-between px-6 shrink-0 bg-white"
      style={{ borderBottom: "1px solid #E8F2EC" }}
    >
      {/* Left: page title or breadcrumb */}
      <div className="flex items-center gap-2">
        <div
          className="w-1 h-5 rounded-full"
          style={{ background: "var(--mbank-green)" }}
        />
        <span className="text-sm font-medium text-gray-500">
          {title ?? "MBank CLM"}
        </span>
      </div>

      {/* Right: user info */}
      {session && (
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full border ${TEAM_COLORS[session.team] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
          >
            {TEAM_LABELS[session.team] ?? session.team}
          </span>

          <div className="flex items-center gap-1.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ background: "var(--mbank-green)" }}
            >
              {session.name.charAt(0).toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="text-xs font-medium text-gray-800">{session.name}</div>
              <div className="text-[10px] text-gray-400">{ROLE_LABELS[session.role] ?? session.role}</div>
            </div>
          </div>

          <LogoutButton />
        </div>
      )}
    </header>
  );
}
