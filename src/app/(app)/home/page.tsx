import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Users, LayoutDashboard, CheckSquare, TrendingUp,
  RotateCcw, Briefcase, FolderKanban, ArrowRight,
  Zap, Shield, BarChart2, Building2,
} from "lucide-react";
import { MeridianLogoMark } from "@/components/ui/MeridianLogo";

/* ─── Данные ───────────────────────────────────────────── */

async function getHomeStats() {
  const [totalClients, totalUsers, stageCounts] = await Promise.all([
    db.client.count({ where: { isArchived: false } }),
    db.user.count(),
    db.client.groupBy({
      by: ["clmStage"],
      where: { isArchived: false },
      _count: true,
    }),
  ]);
  return { totalClients, totalUsers, stageCounts };
}

/* ─── Конфиг стадий ────────────────────────────────────── */

const STAGES = [
  {
    key: "ACQUIRE",
    label: "Привлечение",
    desc: "Потенциальные клиенты, ещё не открывшие РКО или не совершившие транзакции.",
    color: "#6b7280",
    bg: "#f3f4f6",
    icon: "🎯",
    trigger: "Создан вручную или импортирован",
  },
  {
    key: "ONBOARD",
    label: "Онбординг",
    desc: "РКО открыто, идёт подключение к продуктам и первичная настройка.",
    color: "#1d4ed8",
    bg: "#eff6ff",
    icon: "🚀",
    trigger: "Менеджер сменил стадию вручную",
  },
  {
    key: "ACTIVATE",
    label: "Активация",
    desc: "Есть транзакции, но активность ниже целевой. Ключевая фаза — подключить больше продуктов.",
    color: "#d97706",
    bg: "#fffbeb",
    icon: "⚡",
    trigger: "≥1 тр. за 30 дней",
  },
  {
    key: "GROW",
    label: "Рост",
    desc: "Клиент полностью активен. Цель — cross-sell, увеличение оборота и лояльность.",
    color: "#1A5C38",
    bg: "#f0fdf4",
    icon: "📈",
    trigger: "GMV ≥ порога + регулярные тр.",
  },
  {
    key: "REACTIVATE",
    label: "Реактивация",
    desc: "Клиент был активен, но ушёл. Нужно срочное касание и выяснение причины.",
    color: "#c2410c",
    bg: "#fff7ed",
    icon: "🔁",
    trigger: ">90 дней без транзакций",
  },
];

/* ─── Команды ───────────────────────────────────────────── */

const TEAMS = [
  {
    key: "B2B",
    label: "B2B — Микро / ИП",
    desc: "Привлечение и онбординг микробизнеса и индивидуальных предпринимателей. Pipeline: лид → сделка → активация.",
    color: "#1d4ed8",
    bg: "#eff6ff",
  },
  {
    key: "KM",
    label: "КМ — МСБ",
    desc: "Клиентские менеджеры малого и среднего бизнеса. Ведут портфель, отвечают за activation rate и GMV.",
    color: "#1A5C38",
    bg: "#f0fdf4",
  },
  {
    key: "KAM",
    label: "KAM — Крупный бизнес",
    desc: "Key Account Managers. Работают с топ-100 корпоративными клиентами, структурные сделки.",
    color: "#7c3aed",
    bg: "#f5f3ff",
  },
  {
    key: "VB",
    label: "Virtual Branch",
    desc: "Дистанционное обслуживание. Аналитика портфеля, проактивные касания без выезда.",
    color: "#0891b2",
    bg: "#ecfeff",
  },
  {
    key: "Филиалы",
    label: "Филиалы",
    desc: "Розничные точки корп. сегмента. Имеют собственные цели по продуктам (MBusiness, эквайринг, кредиты и др.) и план по активации.",
    color: "#0f766e",
    bg: "#f0fdfa",
  },
];

/* ─── Навигационные карточки ────────────────────────────── */

const QUICK_LINKS = [
  { href: "/my-portfolio", icon: FolderKanban, label: "Мой портфель",    desc: "Личный портфель, задачи, воронка",   color: "#1A5C38" },
  { href: "/dashboard",    icon: LayoutDashboard, label: "Дашборд",      desc: "Аналитика по всему корпоративному сегменту", color: "#1d4ed8" },
  { href: "/clients",      icon: Users,           label: "Реестр клиентов", desc: "Полная база, фильтры, экспорт",    color: "#374151" },
  { href: "/activation-desk", icon: CheckSquare,  label: "Activation Desk", desc: "Задачи по активации клиентов", color: "#d97706" },
  { href: "/pipeline/km",  icon: TrendingUp,      label: "Pipeline КМ",  desc: "Воронка МСБ, КП, шаблоны",          color: "#0891b2" },
  { href: "/pipeline/b2b", icon: TrendingUp,      label: "Pipeline B2B", desc: "Лиды, микро и ИП",                  color: "#7c3aed" },
  { href: "/kam",          icon: Briefcase,       label: "KAM Портфель", desc: "Крупные клиенты, структурные сделки", color: "#be185d" },
  { href: "/reactivation", icon: RotateCcw,       label: "Реактивация",  desc: "Клиенты под риском оттока",          color: "#c2410c" },
  { href: "/branches",    icon: Building2,       label: "Филиалы",      desc: "Цели по продуктам, план/факт",        color: "#0f766e" },
];

/* ─── Страница ──────────────────────────────────────────── */

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { totalClients, totalUsers, stageCounts } = await getHomeStats();

  const stageMap = Object.fromEntries(
    stageCounts.map((s) => [s.clmStage, s._count])
  );

  const isAdmin = session.role === "ADMIN" || session.role === "ANALYST";

  return (
    <div className="space-y-8 max-w-3xl mx-auto">

      {/* ── Hero ── */}
      <div
        className="rounded-2xl p-8 relative overflow-hidden"
        style={{ background: "var(--mbank-green-dark)", color: "white" }}
      >
        {/* Декор */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10"
          style={{ background: "var(--mbank-green-mid)" }} />
        <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full opacity-[0.07]"
          style={{ background: "var(--mbank-gold)" }} />

        <div className="relative z-10 flex items-start justify-between gap-6">
          {/* Левая часть: лого + текст */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(198,144,58,0.12)", border: "1px solid rgba(198,144,58,0.25)" }}
              >
                <MeridianLogoMark size={26} color="#C6903A" />
              </div>
              <div>
                <div className="text-lg font-bold uppercase" style={{ color: "var(--mbank-gold)", letterSpacing: "0.16em" }}>
                  MERIDIAN
                </div>
                <div className="text-[10px] tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
                  MBank · Corporate CLM
                </div>
              </div>
            </div>

            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.60)" }}>
              Единая платформа для команд B2B, КМ, KAM, Virtual Branch и Филиалов.
              CLM-стадии, задачи, pipeline и NBA-рекомендации.
            </p>

            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>Вы вошли как</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)" }}>
                {session.name}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(198,144,58,0.2)", color: "var(--mbank-gold-light)" }}>
                {session.role}
              </span>
            </div>
          </div>

          {/* Правая часть: статы */}
          <div className="shrink-0 grid grid-cols-2 gap-2">
            {[
              { val: totalClients, label: "Клиентов" },
              { val: totalUsers,   label: "Польз." },
              { val: 5,            label: "Стадий" },
              { val: 5,            label: "Команд" },
            ].map(({ val, label }) => (
              <div key={label} className="text-center rounded-xl px-4 py-2.5"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="text-xl font-bold tabular-nums" style={{ color: "var(--mbank-gold)" }}>{val}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Быстрый переход ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Разделы системы</h2>
        <div className="grid grid-cols-3 gap-3">
          {QUICK_LINKS.map(({ href, icon: Icon, label, desc, color }) => (
            <Link key={href} href={href}>
              <div className="group bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer h-full">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${color}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div className="text-sm font-semibold text-gray-800 mb-1 group-hover:text-gray-900">{label}</div>
                <div className="text-xs text-gray-400 leading-snug">{desc}</div>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color }}>
                  Открыть <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── CLM Стадии ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">CLM-стадии</h2>
        <div className="space-y-2">
          {STAGES.map((s, i) => {
            const count = stageMap[s.key] ?? 0;
            return (
              <Link key={s.key} href={`/clients?stage=${s.key}`}>
                <div className="group bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md hover:border-gray-200 transition-all flex items-center gap-5">
                  {/* Номер + иконка */}
                  <div className="shrink-0 flex items-center gap-3">
                    <span className="text-xl w-8 text-center">{s.icon}</span>
                    <div
                      className="h-7 px-3 rounded-full flex items-center text-xs font-bold shrink-0"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {i + 1}. {s.label}
                    </div>
                  </div>

                  {/* Описание */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600 leading-snug">{s.desc}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <span className="font-medium">Триггер:</span> {s.trigger}
                    </p>
                  </div>

                  {/* Кол-во клиентов */}
                  {isAdmin && (
                    <div className="shrink-0 text-right">
                      <div className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{count}</div>
                      <div className="text-xs text-gray-400">клиентов</div>
                    </div>
                  )}

                  <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Команды ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Команды корпоративного сегмента</h2>
        <div className="grid grid-cols-2 gap-4">
          {TEAMS.map((t, i) => (
            <div
              key={t.key}
              className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5${i === TEAMS.length - 1 && TEAMS.length % 2 !== 0 ? " col-span-2" : ""}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="h-6 px-2.5 rounded-full text-xs font-bold flex items-center"
                  style={{ background: t.bg, color: t.color }}
                >
                  {t.key}
                </div>
                <span className="text-sm font-semibold text-gray-800">{t.label}</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Автоматизация (для admin) ── */}
      {isAdmin && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Администрирование</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { href: "/admin/clm-rules",     icon: Zap,      label: "CLM-автоматизация", desc: "Правила стадий, триггеры, cron" },
              { href: "/admin/permissions",    icon: Shield,   label: "Права доступа",     desc: "Роли, фильтрация данных по команде" },
              { href: "/admin/kpi",            icon: BarChart2, label: "KPI менеджеров",  desc: "Цели, факт, план по каждому сотруднику" },
            ].map(({ href, icon: Icon, label, desc }) => (
              <Link key={href} href={href}>
                <div className="group bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
                  <Icon className="h-5 w-5 mb-3" style={{ color: "var(--mbank-green)" }} />
                  <div className="text-sm font-semibold text-gray-800 mb-1">{label}</div>
                  <div className="text-xs text-gray-400">{desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Подвал ── */}
      <div className="text-center py-4 text-xs text-gray-300">
        MERIDIAN · MBank Corporate CLM · v1.0 · 2026
      </div>

    </div>
  );
}
