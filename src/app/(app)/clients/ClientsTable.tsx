"use client";

import React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition, useState } from "react";
import { archiveClient, unarchiveClient } from "@/lib/actions/clients";
import { getHealthScore } from "@/lib/health-score";
import { getChurnRisk } from "@/lib/churn-risk";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ─── Types ─────────────────────────────────────────────── */
type Client = {
  id: string;
  inn: string;
  name: string;
  type: string;
  clmStage: string;
  clmCohort: string;
  sizeCategory:     string | null;
  activatedAt:      Date | string | null;
  handoffDoneAt:    Date | string | null;
  txnCount30d:      number | null;
  daysSinceLastTxn: number | null;
  gmv30d:           number | null;
  productDepthPct:  number;
  // individual product flags
  hasMBusiness:     boolean;
  hasMKassaPos:     boolean;
  hasMKassaQr:      boolean;
  hasSalaryProject: boolean;
  hasAcquiring:     boolean;
  hasCredit:        boolean;
  hasDeposit:       boolean;
  hasTradeFinance:  boolean;
  hasPayroll:       boolean;
  hasCorporateCard: boolean;
  branch:   { name: string } | null;
  manager:  { name: string; team: string } | null;
  kam:      { name: string } | null;
};

type Branch = { id: string; name: string };

type Props = {
  clients:         Client[];
  branches:        Branch[];
  total:           number;
  pages:           number;
  currentPage:     number;
  showTxnMetrics?: boolean;
  showFinancials?: boolean;
  showArchived?:   boolean;
  canArchive?:     boolean;
};

/* ─── Badge helpers ─────────────────────────────────────── */
const STAGE_STYLE: Record<string, string> = {
  ACQUIRE:    "bg-gray-100 text-gray-600",
  ONBOARD:    "bg-blue-50 text-blue-700",
  ACTIVATE:   "bg-amber-50 text-amber-700",
  GROW:       "text-white",
  REACTIVATE: "bg-orange-50 text-orange-700",
};
const STAGE_LABEL: Record<string, string> = {
  ACQUIRE:    "Привлечение",
  ONBOARD:    "Онбординг",
  ACTIVATE:   "Активация",
  GROW:       "Рост",
  REACTIVATE: "Реактивация",
};
const COHORT_STYLE: Record<string, string> = {
  NEVER_ACTIVE: "bg-gray-100 text-gray-500",
  LOW_ACTIVE:   "bg-yellow-50 text-yellow-700",
  ACTIVE:       "text-white",
  LAPSED:       "bg-red-50 text-red-600",
};
const COHORT_LABEL: Record<string, string> = {
  NEVER_ACTIVE: "Нет актив.",
  LOW_ACTIVE:   "Низк. акт.",
  ACTIVE:       "Активный",
  LAPSED:       "Отток",
};

function StageBadge({ stage }: { stage: string }) {
  const style = stage === "GROW"
    ? { background: "var(--mbank-green)", color: "#fff" }
    : {};
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STAGE_STYLE[stage] ?? ""}`}
      style={style}
    >
      {STAGE_LABEL[stage] ?? stage}
    </span>
  );
}

function CohortBadge({ cohort }: { cohort: string }) {
  const style = cohort === "ACTIVE"
    ? { background: "var(--mbank-green-mid)", color: "#fff" }
    : {};
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${COHORT_STYLE[cohort] ?? ""}`}
      style={style}
    >
      {COHORT_LABEL[cohort] ?? cohort}
    </span>
  );
}

const SIZE_STYLE: Record<string, { cls: string; style?: React.CSSProperties }> = {
  SMALL:  { cls: "bg-blue-50 text-blue-600" },
  MEDIUM: { cls: "bg-amber-50 text-amber-700" },
  LARGE:  { cls: "text-white", style: { background: "var(--mbank-green)" } },
};
const SIZE_LABEL: Record<string, string> = {
  SMALL:  "Small",
  MEDIUM: "Medium",
  LARGE:  "Large",
};

function SizeBadge({ size }: { size: string | null }) {
  if (!size) return <span className="text-gray-300 text-[10px]">—</span>;
  const s = SIZE_STYLE[size];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${s?.cls ?? ""}`}
      style={s?.style}
    >
      {SIZE_LABEL[size] ?? size}
    </span>
  );
}

function DaysBadge({ days }: { days: number }) {
  if (days === 0) return <span className="text-gray-300 text-xs">—</span>;
  const color = days > 60 ? "text-red-600 font-semibold" : days > 30 ? "text-orange-600" : "text-gray-700";
  return <span className={`text-xs tabular-nums ${color}`}>{days}д</span>;
}

function TxnBadge({ count }: { count: number }) {
  if (count === 0) return <span className="text-gray-300 text-xs">—</span>;
  const color = count >= 5 ? "text-emerald-700 font-semibold" : count >= 1 ? "text-amber-700" : "text-gray-500";
  return <span className={`text-xs tabular-nums ${color}`}>{count}</span>;
}

function fmtGmv(v: number) {
  if (!v) return <span className="text-gray-300">—</span>;
  if (v >= 1_000_000) return <span className="text-xs tabular-nums">{(v / 1_000_000).toFixed(1)}M</span>;
  if (v >= 1_000)     return <span className="text-xs tabular-nums">{(v / 1_000).toFixed(0)}K</span>;
  return <span className="text-xs tabular-nums">{v}</span>;
}

/* ─── Product depth cell ─────────────────────────────────── */

const PRODUCT_KEYS = [
  { key: "hasMBusiness",     short: "MB"  },
  { key: "hasMKassaPos",     short: "POS" },
  { key: "hasMKassaQr",      short: "QR"  },
  { key: "hasSalaryProject", short: "ЗП"  },
  { key: "hasAcquiring",     short: "Экв" },
  { key: "hasCredit",        short: "Кр"  },
  { key: "hasDeposit",       short: "Деп" },
  { key: "hasTradeFinance",  short: "ТФ"  },
  { key: "hasPayroll",       short: "Зар" },
  { key: "hasCorporateCard", short: "КК"  },
] as const;

function ProductDepthCell({ client }: { client: Client }) {
  const active = PRODUCT_KEYS.filter((p) => client[p.key]).map((p) => p.short);
  const total  = PRODUCT_KEYS.length;
  const count  = active.length;

  if (count === 0) {
    return <span className="text-gray-300 text-xs">—</span>;
  }

  const pct = Math.round((count / total) * 100);
  const barColor =
    pct >= 60 ? "var(--mbank-green)" :
    pct >= 30 ? "#f59e0b" : "#94a3b8";

  return (
    <div className="flex items-center gap-2 min-w-[72px]">
      {/* Mini bar */}
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden" style={{ minWidth: 28 }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      {/* Count */}
      <span className="text-xs font-medium tabular-nums" style={{ color: barColor }}>
        {`${count}/${total}`}
      </span>
    </div>
  );
}

/* ─── Health + Churn combined cell ──────────────────────── */
function HealthRiskCell({ client }: { client: Client }) {
  const activeCount = PRODUCT_KEYS.filter((p) => client[p.key]).length;

  const h = getHealthScore({
    daysSinceLastTxn:  client.daysSinceLastTxn  ?? 999,
    txnCount30d:       client.txnCount30d        ?? 0,
    gmv30d:            client.gmv30d             ?? 0,
    productDepthPct:   (activeCount / PRODUCT_KEYS.length) * 100,
    activitiesLast30d: 0, // not available in table view
  });

  const churn = getChurnRisk({
    clmStage:         client.clmStage,
    clmCohort:        client.clmCohort,
    daysSinceLastTxn: client.daysSinceLastTxn  ?? 999,
    txnCount30d:      client.txnCount30d        ?? 0,
    gmv30d:           client.gmv30d             ?? 0,
    lastActivityDays: null,
  });

  return (
    <div className="flex flex-col gap-1 min-w-[52px]">
      {/* Health score mini bar */}
      <div className="flex items-center gap-1.5">
        <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden shrink-0">
          <div
            className="h-full rounded-full"
            style={{ width: `${h.score}%`, background: h.color }}
          />
        </div>
        <span className="text-[10px] tabular-nums font-semibold" style={{ color: h.color }}>
          {h.score}
        </span>
      </div>
      {/* Churn risk dot */}
      <div className="flex items-center gap-1">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: churn.color }}
        />
        <span className="text-[10px] text-gray-400">{churn.probability}%</span>
      </div>
    </div>
  );
}

/* ─── Restricted column cell ─────────────────────────────── */
function RestrictedValue() {
  return <span className="text-gray-300 text-xs">🔒</span>;
}

/* ─── Main component ─────────────────────────────────────── */
export function ClientsTable({
  clients, branches, total, pages, currentPage,
  showTxnMetrics = true,
  showFinancials = true,
  showArchived   = false,
  canArchive     = false,
}: Props) {
  const router = useRouter();
  const sp     = useSearchParams();
  const path   = usePathname();
  const [, startTransition]  = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const p = (key: string): string => sp.get(key) ?? "";

  const push = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(sp.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (!v || v === "ALL") params.delete(k);
        else params.set(k, v);
      });
      if (!("page" in updates)) params.delete("page");
      startTransition(() => router.push(`${path}?${params.toString()}`));
    },
    [sp, path, router]
  );

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === clients.length) setSelected(new Set());
    else setSelected(new Set(clients.map(c => c.id)));
  };

  // Column span for empty row (checkbox + INN + name + type + branch + manager + stage + cohort + txn + days + gmv + products + health = 13 base)
  const colCount = 10 + (showTxnMetrics ? 2 : 0) + (showFinancials ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <Input
          placeholder="Поиск по ИНН или названию..."
          defaultValue={sp.get("search") ?? ""}
          onChange={(e) => push({ search: e.target.value })}
          className="h-9 w-64 text-sm border-gray-200"
        />

        <Select value={p("stage")} onValueChange={(v) => push({ stage: v })}>
          <SelectTrigger className="h-9 w-44 text-sm border-gray-200">
            <SelectValue placeholder="Стадия CLM" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все стадии</SelectItem>
            {Object.entries(STAGE_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={p("cohort")} onValueChange={(v) => push({ cohort: v })}>
          <SelectTrigger className="h-9 w-44 text-sm border-gray-200">
            <SelectValue placeholder="Когорта" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все когорты</SelectItem>
            {Object.entries(COHORT_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={p("branch")} onValueChange={(v) => push({ branch: v })}>
          <SelectTrigger className="h-9 w-44 text-sm border-gray-200">
            <SelectValue placeholder="Филиал" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все филиалы</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={p("team")} onValueChange={(v) => push({ team: v })}>
          <SelectTrigger className="h-9 w-36 text-sm border-gray-200">
            <SelectValue placeholder="Команда" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все команды</SelectItem>
            <SelectItem value="B2B">B2B</SelectItem>
            <SelectItem value="KM">КМ</SelectItem>
            <SelectItem value="KAM">KAM</SelectItem>
          </SelectContent>
        </Select>

        <Select value={p("size")} onValueChange={(v) => push({ size: v })}>
          <SelectTrigger className="h-9 w-36 text-sm border-gray-200">
            <SelectValue placeholder="Сегмент" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все сегменты</SelectItem>
            <SelectItem value="SMALL">Small (&lt;10M)</SelectItem>
            <SelectItem value="MEDIUM">Medium (10–100M)</SelectItem>
            <SelectItem value="LARGE">Large (100M+)</SelectItem>
          </SelectContent>
        </Select>

        {/* Архивные клиенты */}
        {canArchive && (
          <button
            onClick={() => push({ archived: showArchived ? null : "1", page: null })}
            className={`h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${
              showArchived
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-gray-200 text-gray-500 hover:text-gray-700"
            }`}
          >
            {showArchived ? "📦 Архив (скрыть)" : "📦 Показать архив"}
          </button>
        )}

        {["search","stage","cohort","branch","team","size"].some(k => sp.get(k)) && (
          <button
            onClick={() => router.push(path)}
            className="h-9 px-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Сбросить
          </button>
        )}

        {/* CSV Export */}
        <a
          href={`/api/clients/export?${sp.toString()}`}
          className="ml-auto h-9 px-3 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          title="Экспорт текущего списка в CSV (Excel)"
        >
          ↓ CSV
        </a>
      </div>

      {/* ── Selection info bar (archive only) ── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <span className="text-sm font-medium text-gray-700">
            Выбрано: <b>{selected.size}</b>
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600"
          >
            Снять выделение
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100 bg-gray-50/60">
              <TableHead className="w-8 pl-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 w-3.5 h-3.5 cursor-pointer"
                  checked={selected.size === clients.length && clients.length > 0}
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead className="text-[11px] text-gray-400 font-medium w-32">ИНН</TableHead>
              <TableHead className="text-[11px] text-gray-400 font-medium">Название</TableHead>
              <TableHead className="text-[11px] text-gray-400 font-medium w-10">Тип</TableHead>
              <TableHead className="text-[11px] text-gray-400 font-medium">Филиал</TableHead>
              <TableHead className="text-[11px] text-gray-400 font-medium">Менеджер</TableHead>
              <TableHead className="text-[11px] text-gray-400 font-medium">Стадия</TableHead>
              <TableHead className="text-[11px] text-gray-400 font-medium">Когорта</TableHead>
              {/* RFM-D metrics */}
              {showTxnMetrics
                ? <TableHead className="text-[11px] text-gray-400 font-medium text-right w-16" title="Транзакций за 30 дней">Транз.</TableHead>
                : <TableHead className="text-[11px] text-gray-400 font-medium text-right w-16">Транз.</TableHead>
              }
              {showTxnMetrics
                ? <TableHead className="text-[11px] text-gray-400 font-medium text-right w-16" title="Дней без транзакций">Без тр.</TableHead>
                : <TableHead className="text-[11px] text-gray-400 font-medium text-right w-16">Без тр.</TableHead>
              }
              {showFinancials
                ? <TableHead className="text-[11px] text-gray-400 font-medium text-right w-16">GMV 30д</TableHead>
                : <TableHead className="text-[11px] text-gray-400 font-medium text-right w-16">GMV 30д</TableHead>
              }
              {/* Products */}
              <TableHead className="text-[11px] text-gray-400 font-medium w-28">Продукты</TableHead>
              {/* Health / Risk */}
              <TableHead className="text-[11px] text-gray-400 font-medium w-20" title="Health Score / Churn Risk">Health/Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-gray-400 text-sm py-12">
                  Клиенты не найдены
                </TableCell>
              </TableRow>
            ) : (
              clients.map((c) => (
                <TableRow
                  key={c.id}
                  className="border-gray-50 cursor-pointer hover:bg-gray-50/80 transition-colors"
                  onClick={() => router.push(`/clients/${c.id}`)}
                >
                  <TableCell className="pl-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 w-3.5 h-3.5 cursor-pointer"
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-400">{c.inn}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm text-gray-900 truncate max-w-[200px]">{c.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {c.manager && (
                        <span className="text-[10px] text-gray-400">{c.manager.team}</span>
                      )}
                      <SizeBadge size={c.sizeCategory} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${c.type === "YL" ? "text-indigo-600" : "text-teal-600"}`}>
                      {c.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 max-w-[100px] truncate">
                    {c.branch?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">
                    {c.manager?.name ?? c.kam?.name ?? "—"}
                  </TableCell>
                  <TableCell><StageBadge stage={c.clmStage} /></TableCell>
                  <TableCell><CohortBadge cohort={c.clmCohort} /></TableCell>
                  {/* Frequency */}
                  <TableCell className="text-right">
                    {c.txnCount30d !== null
                      ? <TxnBadge count={c.txnCount30d} />
                      : <RestrictedValue />
                    }
                  </TableCell>
                  {/* Recency */}
                  <TableCell className="text-right">
                    {c.daysSinceLastTxn !== null
                      ? <DaysBadge days={c.daysSinceLastTxn} />
                      : <RestrictedValue />
                    }
                  </TableCell>
                  {/* Monetary */}
                  <TableCell className="text-right">
                    {c.gmv30d !== null
                      ? fmtGmv(c.gmv30d)
                      : <RestrictedValue />
                    }
                  </TableCell>
                  {/* Products */}
                  <TableCell>
                    <ProductDepthCell client={c} />
                  </TableCell>
                  {/* Health / Risk */}
                  <TableCell>
                    <HealthRiskCell client={c} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Показано {Math.min((currentPage - 1) * 50 + 1, total)}–{Math.min(currentPage * 50, total)} из {total.toLocaleString("ru")}
          </p>
          <div className="flex gap-1">
            {currentPage > 1 && (
              <button
                onClick={() => push({ page: String(currentPage - 1) })}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                ← Назад
              </button>
            )}
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
              const pg = i + 1;
              const active = pg === currentPage;
              return (
                <button
                  key={pg}
                  onClick={() => push({ page: String(pg) })}
                  className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                  style={active
                    ? { background: "var(--mbank-green)", color: "#fff" }
                    : { color: "#6b7280", border: "1px solid #e5e7eb" }
                  }
                >
                  {pg}
                </button>
              );
            })}
            {currentPage < pages && (
              <button
                onClick={() => push({ page: String(currentPage + 1) })}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Вперёд →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
