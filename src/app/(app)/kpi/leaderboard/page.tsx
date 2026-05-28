import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getLeaderboard, getMyAchievements } from "@/lib/actions/gamification";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const TEAM_COLORS: Record<string, { bg: string; text: string }> = {
  B2B:    { bg: "#eff6ff", text: "#1d4ed8" },
  KM:     { bg: "#f0fdf4", text: "#15803d" },
  KAM:    { bg: "#faf5ff", text: "#7c3aed" },
  VB:     { bg: "#fff7ed", text: "#c2410c" },
  BRANCH: { bg: "#f0fdfa", text: "#0f766e" },
};

const TIER_STYLES = {
  bronze: { bg: "#fef3c7", text: "#92400e", border: "#d97706" },
  silver: { bg: "#f1f5f9", text: "#475569", border: "#94a3b8" },
  gold:   { bg: "#fef9c3", text: "#713f12", border: "#eab308" },
};

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [entries, achievements] = await Promise.all([
    getLeaderboard(),
    getMyAchievements(),
  ]);

  const month = format(new Date(), "LLLL yyyy", { locale: ru });

  const canSeeLeaderboard = entries !== null;
  const myAchievements    = achievements ?? [];
  const earned   = myAchievements.filter(a => a.earned);
  const unearned = myAchievements.filter(a => !a.earned);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/kpi" className="hover:text-gray-600">KPI</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Геймификация</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900">🏆 Рейтинг и достижения</h2>
        <p className="text-sm text-gray-400 mt-0.5">{month} · очки = активации×10 + контакты + % активации×0.5</p>
      </div>

      {/* My Achievements */}
      {myAchievements.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">🎖️ Мои достижения</h3>
            <span className="text-xs text-gray-400">
              {earned.length} / {myAchievements.length} получено
            </span>
          </div>
          <div className="p-4">
            {/* Earned */}
            {earned.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Получено
                </div>
                <div className="flex flex-wrap gap-2">
                  {earned.map(a => {
                    const tier = TIER_STYLES[a.tier];
                    return (
                      <div
                        key={a.id}
                        title={a.description}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
                        style={{ background: tier.bg, color: tier.text, borderColor: tier.border }}
                      >
                        <span>{a.icon}</span>
                        <span>{a.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Locked */}
            {unearned.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Ещё не получено
                </div>
                <div className="flex flex-wrap gap-2">
                  {unearned.map(a => (
                    <div
                      key={a.id}
                      title={a.description}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-gray-200 text-gray-400 bg-gray-50"
                    >
                      <span className="grayscale opacity-50">{a.icon}</span>
                      <span>{a.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {canSeeLeaderboard && entries && entries.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">📊 Рейтинг менеджеров</h3>
            <p className="text-xs text-gray-400 mt-0.5">{month} · топ по составному очку</p>
          </div>

          {/* Top 3 podium */}
          {entries.length >= 3 && (
            <div className="flex items-end justify-center gap-4 px-6 py-6 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
              {/* 2nd */}
              <div className="flex flex-col items-center gap-1 mb-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg"
                  style={{ background: "#94a3b8" }}>
                  {entries[1].name.charAt(0)}
                </div>
                <div className="text-xs font-semibold text-gray-700">{entries[1].name.split(" ")[0]}</div>
                <div className="text-[11px] text-gray-400">{entries[1].score} очков</div>
                <div className="text-2xl">🥈</div>
              </div>

              {/* 1st */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-white text-xl ring-2 ring-yellow-400"
                  style={{ background: "var(--mbank-gold, #C5962E)" }}>
                  {entries[0].name.charAt(0)}
                </div>
                <div className="text-sm font-bold text-gray-800">{entries[0].name.split(" ")[0]}</div>
                <div className="text-[11px] text-gray-500">{entries[0].score} очков</div>
                <div className="text-3xl">🥇</div>
              </div>

              {/* 3rd */}
              <div className="flex flex-col items-center gap-1 mb-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg"
                  style={{ background: "#d97706" }}>
                  {entries[2].name.charAt(0)}
                </div>
                <div className="text-xs font-semibold text-gray-700">{entries[2].name.split(" ")[0]}</div>
                <div className="text-[11px] text-gray-400">{entries[2].score} очков</div>
                <div className="text-2xl">🥉</div>
              </div>
            </div>
          )}

          {/* Full table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                {["#", "Менеджер", "Команда", "Активаций", "Контактов", "% активации", "Очки", "Тренд"].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const isMe  = e.userId === session.id;
                const col   = TEAM_COLORS[e.team] ?? { bg: "#f3f4f6", text: "#374151" };
                return (
                  <tr
                    key={e.userId}
                    className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors ${isMe ? "bg-[var(--mbank-green-pale)]/30" : ""}`}
                  >
                    <td className="px-4 py-3 font-bold text-gray-500">
                      {e.medal ?? `${e.rank}`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: e.rank <= 3 ? (e.rank === 1 ? "#eab308" : e.rank === 2 ? "#94a3b8" : "#d97706") : "var(--mbank-green)" }}
                        >
                          {e.name.charAt(0)}
                        </div>
                        <span className={`font-medium text-gray-900 ${isMe ? "underline underline-offset-2" : ""}`}>
                          {e.name}
                          {isMe && <span className="text-[10px] text-gray-400 ml-1 no-underline">(вы)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: col.bg, color: col.text }}>
                        {e.team}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${e.activations > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                        {e.activations}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{e.activities}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: e.activationRate >= 50 ? "#16a34a" : e.activationRate >= 30 ? "#d97706" : "#dc2626" }}
                      >
                        {e.activationRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900">{e.score}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-base" title={e.trend === "up" ? "Рост vs прошлый месяц" : e.trend === "down" ? "Снижение" : "Без изменений"}>
                        {e.trend === "up" ? "↑" : e.trend === "down" ? "↓" : "→"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : canSeeLeaderboard ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
          Нет данных для рейтинга
        </div>
      ) : null}
    </div>
  );
}
