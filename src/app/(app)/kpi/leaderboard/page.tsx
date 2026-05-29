import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  getTeamLeaderboards,
  getBranchLeaderboard,
  getMyAchievements,
  type LeaderboardEntry,
  type BranchLeaderboardEntry,
} from "@/lib/actions/gamification";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

// ─── constants ───────────────────────────────────────────────────────────────

const TEAM_ORDER  = ["B2B", "KM", "KAM", "VB", "BRANCH"] as const;
const TEAM_LABELS: Record<string, string> = {
  B2B:    "B2B",
  KM:     "КМ",
  KAM:    "KAM",
  VB:     "ВБ",
  BRANCH: "Сеть",
};

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

// ─── sub-components ──────────────────────────────────────────────────────────

function Podium({ top3 }: { top3: LeaderboardEntry[] }) {
  const [first, second, third] = top3;
  const rankColor = (r: number) =>
    r === 1 ? "#eab308" : r === 2 ? "#94a3b8" : "#d97706";

  return (
    <div className="flex items-end justify-center gap-4 px-6 py-5 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
      {/* 2nd */}
      <div className="flex flex-col items-center gap-1 mb-2">
        <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-base"
          style={{ background: rankColor(2) }}>
          {second.name.charAt(0)}
        </div>
        <div className="text-xs font-semibold text-gray-700">{second.name.split(" ")[0]}</div>
        <div className="text-[11px] text-gray-400">{second.score} оч.</div>
        <div className="text-xl">🥈</div>
      </div>

      {/* 1st */}
      <div className="flex flex-col items-center gap-1">
        <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-lg ring-2 ring-yellow-400"
          style={{ background: rankColor(1) }}>
          {first.name.charAt(0)}
        </div>
        <div className="text-sm font-bold text-gray-800">{first.name.split(" ")[0]}</div>
        <div className="text-[11px] text-gray-500">{first.score} оч.</div>
        <div className="text-2xl">🥇</div>
      </div>

      {/* 3rd */}
      {third && (
        <div className="flex flex-col items-center gap-1 mb-2">
          <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-base"
            style={{ background: rankColor(3) }}>
            {third.name.charAt(0)}
          </div>
          <div className="text-xs font-semibold text-gray-700">{third.name.split(" ")[0]}</div>
          <div className="text-[11px] text-gray-400">{third.score} оч.</div>
          <div className="text-xl">🥉</div>
        </div>
      )}
    </div>
  );
}

function TeamSection({
  team,
  entries,
  myId,
}: {
  team:    string;
  entries: LeaderboardEntry[];
  myId:    string;
}) {
  const col   = TEAM_COLORS[team] ?? { bg: "#f3f4f6", text: "#374151" };
  const top3  = entries.slice(0, 3);
  const label = TEAM_LABELS[team] ?? team;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Team header */}
      <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ background: col.bg, color: col.text }}
        >
          {label}
        </span>
        <span className="text-xs text-gray-400">{entries.length} менеджеров</span>
      </div>

      {/* Podium — only when 2+ members */}
      {top3.length >= 2 && <Podium top3={top3} />}

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50">
            {["#", "Менеджер", "Активаций", "Контактов", "% порт.", "Очки", "Тренд"].map(h => (
              <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(e => {
            const isMe = e.userId === myId;
            return (
              <tr
                key={e.userId}
                className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors ${isMe ? "bg-emerald-50/30" : ""}`}
              >
                <td className="px-4 py-3 font-bold text-gray-500 w-10">
                  {e.medal ?? e.rank}
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
                      {isMe && <span className="text-[10px] text-gray-400 ml-1">(вы)</span>}
                    </span>
                  </div>
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
                <td className="px-4 py-3 font-bold text-gray-900">{e.score}</td>
                <td
                  className="px-4 py-3 text-base"
                  title={e.trend === "up" ? "Рост vs прошлый месяц" : e.trend === "down" ? "Снижение" : "Без изменений"}
                >
                  {e.trend === "up" ? "↑" : e.trend === "down" ? "↓" : "→"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BranchSection({
  branches,
  myBranchId,
}: {
  branches:    BranchLeaderboardEntry[];
  myBranchId:  string;
}) {
  const podiumOrder = [1, 0, 2]; // silver, gold, bronze display order

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">🏢 Рейтинг филиалов</h3>
        <p className="text-xs text-gray-400 mt-0.5">Средний балл менеджеров филиала</p>
      </div>

      {/* Branch podium */}
      {branches.length >= 2 && (
        <div className="flex items-end justify-center gap-6 px-6 py-5 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
          {podiumOrder.slice(0, Math.min(3, branches.length)).map((srcIdx, displayIdx) => {
            const b = branches[srcIdx];
            if (!b) return null;
            const sizes  = ["text-xl mb-2 w-11 h-11", "text-2xl w-14 h-14", "text-xl mb-2 w-11 h-11"];
            const bg     = ["#94a3b8", "#eab308", "#d97706"];
            const medals = ["🥈", "🥇", "🥉"];
            const isBig  = displayIdx === 1;
            return (
              <div key={b.branchId} className="flex flex-col items-center gap-1">
                <div
                  className={`${sizes[displayIdx]} rounded-full flex items-center justify-center font-bold text-white ${isBig ? "ring-2 ring-yellow-400" : ""}`}
                  style={{ background: bg[displayIdx] }}
                >
                  {b.branchName.charAt(0)}
                </div>
                <div className={`${isBig ? "text-sm font-bold text-gray-800" : "text-xs font-semibold text-gray-700"}`}>
                  {b.branchName}
                </div>
                <div className="text-[11px] text-gray-400">~{b.avgScore} оч./мен.</div>
                <div className={medals[displayIdx] === "🥇" ? "text-2xl" : "text-xl"}>{medals[displayIdx]}</div>
              </div>
            );
          })}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50">
            {["#", "Филиал", "Менеджеров", "Активаций", "Контактов", "% порт. (ср.)", "Очки (ср.)"].map(h => (
              <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {branches.map(b => {
            const isMine = b.branchId === myBranchId;
            return (
              <tr
                key={b.branchId}
                className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors ${isMine ? "bg-emerald-50/30" : ""}`}
              >
                <td className="px-4 py-3 font-bold text-gray-500 w-10">{b.medal ?? b.rank}</td>
                <td className="px-4 py-3">
                  <span className={`font-medium text-gray-900 ${isMine ? "underline underline-offset-2" : ""}`}>
                    {b.branchName}
                    {isMine && <span className="text-[10px] text-gray-400 ml-1">(ваш)</span>}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{b.managerCount}</td>
                <td className="px-4 py-3">
                  <span className={`font-bold ${b.totalActivations > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                    {b.totalActivations}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{b.totalActivities}</td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: b.avgActivationRate >= 50 ? "#16a34a" : b.avgActivationRate >= 30 ? "#d97706" : "#dc2626" }}
                  >
                    {b.avgActivationRate}%
                  </span>
                </td>
                <td className="px-4 py-3 font-bold text-gray-900">{b.avgScore}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [teamBoards, branchRanking, achievements] = await Promise.all([
    getTeamLeaderboards(),
    getBranchLeaderboard(),
    getMyAchievements(),
  ]);

  const month        = format(new Date(), "LLLL yyyy", { locale: ru });
  const myAch        = achievements ?? [];
  const earned       = myAch.filter(a => a.earned);
  const unearned     = myAch.filter(a => !a.earned);
  const orderedTeams = TEAM_ORDER.filter(t => teamBoards && t in teamBoards);

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
        <p className="text-sm text-gray-400 mt-0.5">
          {month} · соревнование внутри команды и между филиалами · очки = активации×10 + контакты + % активации×0.5
        </p>
      </div>

      {/* My Achievements */}
      {myAch.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">🎖️ Мои достижения</h3>
            <span className="text-xs text-gray-400">
              {earned.length} / {myAch.length} получено
            </span>
          </div>
          <div className="p-4">
            {earned.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Получено</div>
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
            {unearned.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Ещё не получено</div>
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

      {/* Team leaderboards */}
      {teamBoards && orderedTeams.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-gray-800">📊 Рейтинг внутри команд</h3>
          {orderedTeams.map(team => (
            <TeamSection
              key={team}
              team={team}
              entries={teamBoards[team]}
              myId={session.id}
            />
          ))}
        </div>
      )}

      {/* Branch leaderboard */}
      {branchRanking.length > 0 && (
        <BranchSection branches={branchRanking} myBranchId={session.branchId} />
      )}

      {/* Empty */}
      {(!teamBoards || orderedTeams.length === 0) && branchRanking.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
          Нет данных для рейтинга
        </div>
      )}
    </div>
  );
}
