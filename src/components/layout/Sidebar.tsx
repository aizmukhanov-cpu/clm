"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, CheckSquare, TrendingUp,
  RotateCcw, Briefcase, ChevronDown, Settings,
  Zap, FolderKanban, BarChart2, Bell, Building2, ClipboardList, Box,
} from "lucide-react";
import { MeridianWordmark } from "@/components/ui/MeridianLogo";
import { useState } from "react";

/* ─── Типы ─────────────────────────────────────────────── */

type NavChild = { label: string; href: string };

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  children?: NavChild[];
};

/* ─── Вспомогательный nav для специалиста/супервайзера ─── */

function getSpecialistNav(team: string, portfolioLabel: string): NavItem[] {
  const tasks: NavItem = { label: "Мои задачи", href: "/my-tasks", icon: ClipboardList };

  if (team === "B2B") {
    return [
      { label: portfolioLabel,    href: "/my-portfolio",    icon: FolderKanban },
      tasks,
      { label: "Pipeline B2B",    href: "/pipeline/b2b",    icon: TrendingUp },
      { label: "Activation Desk", href: "/activation-desk", icon: CheckSquare },
      { label: "KPI",             href: "/kpi",             icon: BarChart2 },
    ];
  }
  if (team === "KM") {
    return [
      { label: portfolioLabel,    href: "/my-portfolio",    icon: FolderKanban },
      tasks,
      {
        label: "Pipeline КМ", href: "/pipeline/km", icon: TrendingUp,
        children: [
          { label: "Воронка КМ",  href: "/pipeline/km"           },
          { label: "Шаблоны КП",  href: "/pipeline/km/templates" },
        ],
      },
      { label: "Activation Desk", href: "/activation-desk", icon: CheckSquare },
      { label: "KPI",             href: "/kpi",             icon: BarChart2 },
    ];
  }
  if (team === "KAM") {
    return [
      { label: portfolioLabel,    href: "/my-portfolio",    icon: FolderKanban },
      tasks,
      { label: "KAM Портфель",    href: "/kam",             icon: Briefcase },
      { label: "Activation Desk", href: "/activation-desk", icon: CheckSquare },
      { label: "KPI",             href: "/kpi",             icon: BarChart2 },
    ];
  }
  if (team === "BRANCH") {
    return [
      { label: portfolioLabel,    href: "/my-portfolio",    icon: FolderKanban },
      tasks,
      { label: "Pipeline",        href: "/pipeline/branch", icon: TrendingUp },
      { label: "Цели филиала",    href: "/branches",        icon: Building2 },
      { label: "Activation Desk", href: "/activation-desk", icon: CheckSquare },
      { label: "KPI",             href: "/kpi",             icon: BarChart2 },
    ];
  }
  if (team === "VB") {
    return [
      { label: portfolioLabel,    href: "/my-portfolio",    icon: FolderKanban },
      tasks,
      { label: "Activation Desk", href: "/activation-desk", icon: CheckSquare },
      { label: "Реактивация",     href: "/reactivation",    icon: RotateCcw },
      { label: "KPI",             href: "/kpi",             icon: BarChart2 },
    ];
  }
  return [
    { label: portfolioLabel, href: "/my-portfolio", icon: FolderKanban },
    tasks,
    {
      label: "KPI", href: "/kpi", icon: BarChart2,
      children: [
        { label: "Мой KPI",        href: "/kpi"             },
        { label: "🏆 Достижения",  href: "/kpi/leaderboard" },
      ],
    },
  ];
}

/* ─── Навигация по роли ─────────────────────────────────── */

function getNav(role: string, team: string): NavItem[] {

  // ── ADMIN → всё ─────────────────────────────────────────
  if (role === "ADMIN") {
    return [
      { label: "Мой портфель",    href: "/my-portfolio",    icon: FolderKanban },
      { label: "Дашборд",         href: "/dashboard",       icon: LayoutDashboard },
      { label: "Клиенты",         href: "/clients",         icon: Users },
      { label: "Activation Desk", href: "/activation-desk", icon: CheckSquare },
      {
        label: "Pipeline", href: "/pipeline", icon: TrendingUp,
        children: [
          { label: "B2B (Микро/ИП)",  href: "/pipeline/b2b"          },
          { label: "КМ (МСБ)",        href: "/pipeline/km"           },
          { label: "Филиалы",         href: "/pipeline/branch"       },
          { label: "Шаблоны КП",      href: "/pipeline/km/templates" },
        ],
      },
      { label: "KAM Портфель",    href: "/kam",             icon: Briefcase },
      { label: "Реактивация",     href: "/reactivation",    icon: RotateCcw },
      { label: "Филиалы",         href: "/branches",        icon: Building2 },
      {
        label: "KPI", href: "/kpi", icon: BarChart2,
        children: [
          { label: "Обзор команд",   href: "/kpi"              },
          { label: "Воронка",        href: "/kpi/funnel"        },
          { label: "🏆 Рейтинг",    href: "/kpi/leaderboard"  },
        ],
      },
    ];
  }

  // ── DIRECTOR → всё read-only, без admin-панели ───────────
  if (role === "DIRECTOR") {
    return [
      { label: "Дашборд",         href: "/dashboard",    icon: LayoutDashboard },
      { label: "Клиенты",         href: "/clients",      icon: Users },
      { label: "KAM Портфель",    href: "/kam",          icon: Briefcase },
      { label: "Реактивация",     href: "/reactivation", icon: RotateCcw },
      { label: "Филиалы",         href: "/branches",     icon: Building2 },
      {
        label: "KPI", href: "/kpi", icon: BarChart2,
        children: [
          { label: "Обзор команд",  href: "/kpi"             },
          { label: "Воронка",       href: "/kpi/funnel"       },
          { label: "🏆 Рейтинг",   href: "/kpi/leaderboard" },
        ],
      },
    ];
  }

  // ── ANALYST ──────────────────────────────────────────────
  if (role === "ANALYST") {
    return [
      { label: "Дашборд",         href: "/dashboard",       icon: LayoutDashboard },
      { label: "Клиенты",         href: "/clients",         icon: Users },
      { label: "Activation Desk", href: "/activation-desk", icon: CheckSquare },
      { label: "Реактивация",     href: "/reactivation",    icon: RotateCcw },
      { label: "Филиалы",         href: "/branches",        icon: Building2 },
      {
        label: "KPI", href: "/kpi", icon: BarChart2,
        children: [
          { label: "Обзор",          href: "/kpi"             },
          { label: "Воронка",        href: "/kpi/funnel"       },
          { label: "🏆 Рейтинг",   href: "/kpi/leaderboard" },
        ],
      },
    ];
  }

  // ── TEAM_LEAD — по команде ───────────────────────────────
  if (role === "TEAM_LEAD") {
    const base: NavItem[] = [
      { label: "Портфель команды", href: "/my-portfolio",    icon: FolderKanban },
      { label: "Дашборд",          href: "/dashboard",       icon: LayoutDashboard },
      { label: "Activation Desk",  href: "/activation-desk", icon: CheckSquare },
      { label: "KPI",              href: "/kpi",             icon: BarChart2 },
    ];
    if (team === "B2B") {
      base.splice(2, 0, { label: "Pipeline B2B",   href: "/pipeline/b2b",    icon: TrendingUp });
    } else if (team === "KM") {
      base.splice(2, 0, {
        label: "Pipeline КМ", href: "/pipeline/km", icon: TrendingUp,
        children: [
          { label: "Воронка КМ",  href: "/pipeline/km"           },
          { label: "Шаблоны КП",  href: "/pipeline/km/templates" },
        ],
      });
    } else if (team === "KAM") {
      base.splice(2, 0, { label: "KAM Портфель",   href: "/kam",             icon: Briefcase });
    } else if (team === "BRANCH") {
      base.splice(2, 0, { label: "Pipeline",        href: "/pipeline/branch", icon: TrendingUp });
      base.splice(3, 0, { label: "Цели филиала",    href: "/branches",        icon: Building2 });
    } else if (team === "VB") {
      base.splice(2, 0, { label: "Реактивация",     href: "/reactivation",    icon: RotateCcw });
    }
    return base;
  }

  // ── SUPERVISOR — те же экраны что специалист, но шире ───
  if (role === "SUPERVISOR") {
    return getSpecialistNav(team, "Портфель группы");
  }

  // ── KAM ─────────────────────────────────────────────────
  if (role === "KAM") {
    return [
      { label: "Мой портфель",    href: "/my-portfolio",    icon: FolderKanban },
      { label: "Мои задачи",      href: "/my-tasks",        icon: ClipboardList },
      { label: "KAM Портфель",    href: "/kam",             icon: Briefcase },
      { label: "Activation Desk", href: "/activation-desk", icon: CheckSquare },
      {
        label: "KPI", href: "/kpi", icon: BarChart2,
        children: [
          { label: "Мой KPI",        href: "/kpi"             },
          { label: "🏆 Достижения",  href: "/kpi/leaderboard" },
        ],
      },
    ];
  }

  // ── SPECIALIST — по команде ──────────────────────────────
  if (role === "SPECIALIST") {
    return getSpecialistNav(team, "Мой портфель");
  }

  // fallback
  return [
    { label: "Мой портфель", href: "/my-portfolio", icon: FolderKanban },
    { label: "KPI",          href: "/kpi",           icon: BarChart2 },
  ];
}

/* ─── Admin links ───────────────────────────────────────── */

const ADMIN_LINKS = [
  { href: "/admin/users",         icon: Users,     label: "Сотрудники / доступ" },
  { href: "/admin/products",      icon: Box,       label: "Продукты / планы"    },
  { href: "/admin/clm-rules",     icon: Zap,       label: "CLM-автоматизация"   },
  { href: "/admin/notifications", icon: Bell,      label: "Уведомления"         },
  { href: "/kpi",                 icon: BarChart2, label: "KPI команд"          },
];

/* ─── Role badge label ──────────────────────────────────── */

const ROLE_BADGE: Record<string, string> = {
  ADMIN:      "Admin",
  DIRECTOR:   "Директор",
  ANALYST:    "Аналитик",
  TEAM_LEAD:  "Рук. команды",
  SUPERVISOR: "Супервайзер",
  SPECIALIST: "Специалист",
  KAM:        "KAM",
};

/* ─── NavLink component ─────────────────────────────────── */

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(() => {
    if (item.children) {
      return item.children.some((c) => pathname.startsWith(c.href));
    }
    return false;
  });

  if (item.children) {
    const active = item.children.some((c) => pathname.startsWith(c.href));
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
            active ? "text-white" : "text-white/60 hover:text-white hover:bg-white/8"
          )}
          style={active ? { background: "rgba(255,255,255,0.08)" } : {}}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 opacity-50 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="ml-8 mt-0.5 space-y-0.5">
            {item.children.map((child) => {
              const childActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className="block rounded-md px-2.5 py-1.5 text-sm transition-colors"
                  style={childActive
                    ? { color: "var(--mbank-gold)", background: "rgba(198,144,58,0.12)" }
                    : { color: "rgba(255,255,255,0.55)" }
                  }
                  onMouseEnter={(e) => { if (!childActive) (e.currentTarget as HTMLAnchorElement).style.color = "#fff"; }}
                  onMouseLeave={(e) => { if (!childActive) (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.55)"; }}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const active = item.href === "/dashboard"
    ? pathname === item.href
    : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
      style={active
        ? { color: "var(--mbank-gold)", background: "rgba(198,144,58,0.12)", borderLeft: "2px solid var(--mbank-gold)" }
        : { color: "rgba(255,255,255,0.60)", borderLeft: "2px solid transparent" }
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

/* ─── Sidebar ───────────────────────────────────────────── */

export function Sidebar({ role, team }: { role?: string; team?: string }) {
  const pathname = usePathname();
  const nav = getNav(role ?? "", team ?? "");

  return (
    <aside
      className="w-56 shrink-0 flex flex-col h-screen sticky top-0"
      style={{ background: "var(--mbank-green-dark)" }}
    >
      {/* Logo */}
      <Link
        href="/home"
        className="h-14 flex items-center px-4 hover:opacity-80 transition-opacity"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <MeridianWordmark variant="full" size="sm" />
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      {/* Admin section */}
      {role === "ADMIN" && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} className="px-2 py-2 space-y-0.5">
          <p className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
            Администрирование
          </p>
          {ADMIN_LINKS.map(({ href, icon: Icon, label }) => {
            // /admin/users также подсвечивается при /admin/permissions (объединённый раздел)
            const active =
              pathname === href ||
              pathname.startsWith(href + "/") ||
              (href === "/admin/users" && pathname.startsWith("/admin/permissions"));
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
                style={
                  active
                    ? { color: "var(--mbank-gold)", background: "rgba(198,144,58,0.12)", borderLeft: "2px solid var(--mbank-gold)" }
                    : { color: "rgba(255,255,255,0.45)", borderLeft: "2px solid transparent" }
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div
        className="px-4 py-3 text-[11px]"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}
      >
        MERIDIAN · {ROLE_BADGE[role ?? ""] ?? (team ?? role)} · 2026
      </div>
    </aside>
  );
}
