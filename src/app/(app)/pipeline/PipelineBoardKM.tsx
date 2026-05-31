"use client";

import { useState, useTransition, useActionState, useRef } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { moveDealStage, closeDeal, createDeal, lookupClientByInn } from "@/lib/actions/pipeline";
import {
  PIPELINE_STAGES, STAGE_LABELS, STAGE_COLORS, nextStage, PipelineStage,
  KM_PRODUCTS, KM_CATEGORY_LABELS,
} from "@/lib/pipeline-config";

// ─── Types ──────────────────────────────────────────────────

type Deal = {
  id: string;
  stage: string;
  leadName: string | null;
  productName: string | null;
  amount: number | null;
  probability: number | null;
  expectedClose: Date | null;
  notes: string | null;
  client: { id: string; name: string; inn: string } | null;
  owner: { id: string; name: string };
};

type StageStats = { stage: string; count: number; amount: number };
type Owner = { id: string; name: string };

// ─── Utils ──────────────────────────────────────────────────

function fmtAmount(v: number | null) {
  if (!v) return null;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

/** Парсит структурированные заметки: "inn:…|contact:…|phone:…|note:…" */
function parseMeta(notes: string | null): Record<string, string> {
  if (!notes) return {};
  const meta: Record<string, string> = {};
  notes.split("|").forEach((part) => {
    const idx = part.indexOf(":");
    if (idx > 0) meta[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return meta;
}

// ─── Product tags ────────────────────────────────────────────

const PRODUCT_CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  rko:    { bg: "#eff6ff", text: "#1d4ed8" },
  credit: { bg: "#fef3c7", text: "#d97706" },
  trade:  { bg: "#f0fdf4", text: "#15803d" },
  cash:   { bg: "#faf5ff", text: "#7c3aed" },
  other:  { bg: "#f3f4f6", text: "#374151" },
};

function ProductTags({ productStr }: { productStr: string | null }) {
  if (!productStr) return null;
  const keys = productStr.split(",").map((k) => k.trim());
  const products = keys
    .map((k) => KM_PRODUCTS.find((p) => p.key === k))
    .filter(Boolean) as typeof KM_PRODUCTS;

  if (products.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {products.map((p) => {
        const color = PRODUCT_CATEGORY_COLORS[p.category] ?? PRODUCT_CATEGORY_COLORS.other;
        return (
          <span
            key={p.key}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: color.bg, color: color.text }}
          >
            {p.icon} {p.label}
          </span>
        );
      })}
    </div>
  );
}

// ─── Deal Card ──────────────────────────────────────────────

function DealCard({ deal }: { deal: Deal }) {
  const [pending, startTransition] = useTransition();
  const [closing, setClosing] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [wonClientId, setWonClientId] = useState<string | null>(null);

  const next  = nextStage(deal.stage as PipelineStage);
  const meta  = parseMeta(deal.notes);
  const inn   = deal.client?.inn ?? meta["inn"] ?? null;
  const title = deal.client?.name ?? deal.leadName ?? "—";
  const isLinked = !!deal.client;

  function handleMove() {
    if (!next) return;
    startTransition(async () => { await moveDealStage(deal.id, next, "KM"); });
  }

  function handleWon() {
    startTransition(async () => {
      const result = await closeDeal(deal.id, "WON", null, "KM");
      if (result?.clientId) setWonClientId(result.clientId);
    });
  }

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 text-xs space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isLinked ? (
            <Link
              href={`/clients/${deal.client!.id}`}
              className="font-semibold text-gray-900 hover:underline block truncate"
            >
              {title}
            </Link>
          ) : (
            <span className="font-semibold text-gray-900 block truncate">{title}</span>
          )}
          {inn && (
            <span className="font-mono text-[10px] text-gray-400">{inn}</span>
          )}
          {isLinked && (
            <span className="ml-1 text-[10px] text-emerald-600 font-medium">● в базе</span>
          )}
        </div>
        {deal.amount && (
          <span className="font-bold shrink-0 text-sm tabular-nums" style={{ color: "var(--mbank-green)" }}>
            {fmtAmount(deal.amount)} сом
          </span>
        )}
      </div>

      {/* Products */}
      <ProductTags productStr={deal.productName} />

      {/* Contact */}
      {(meta["contact"] || meta["phone"]) && (
        <div className="text-[10px] text-gray-400 space-y-0.5">
          {meta["contact"] && <div>👤 {meta["contact"]}</div>}
          {meta["phone"]   && <div>📞 {meta["phone"]}</div>}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 text-gray-400">
        {deal.probability != null && (
          <span className={`font-medium ${deal.probability >= 60 ? "text-emerald-600" : deal.probability >= 30 ? "text-amber-600" : ""}`}>
            {deal.probability}%
          </span>
        )}
        {deal.expectedClose && (
          <span>до {format(new Date(deal.expectedClose), "dd.MM.yy")}</span>
        )}
        <span className="ml-auto">{deal.owner.name.split(" ")[0]}</span>
      </div>

      {/* Won banner */}
      {wonClientId && (
        <div className="pt-1 border-t border-emerald-100 bg-emerald-50 -mx-3 -mb-3 px-3 pb-3 rounded-b-lg">
          <p className="text-[11px] text-emerald-700 font-medium mb-1">🎉 Сделка закрыта! Клиент переведён в ONBOARD</p>
          <Link
            href={`/clients/${wonClientId}`}
            className="text-[11px] underline text-emerald-700 hover:text-emerald-900"
          >
            → Перейти к карточке клиента
          </Link>
        </div>
      )}

      {/* Actions */}
      {!wonClientId && !closing ? (
        <div className="flex items-center gap-1.5 pt-1 border-t border-gray-50">
          {next && (
            <button
              onClick={handleMove}
              disabled={pending}
              className="flex-1 py-1 rounded text-[11px] font-medium border transition-colors disabled:opacity-40"
              style={{ borderColor: "var(--mbank-green)", color: "var(--mbank-green)" }}
            >
              {pending ? "..." : `→ ${STAGE_LABELS[next]}`}
            </button>
          )}
          <button
            onClick={handleWon}
            disabled={pending}
            className="py-1 px-2 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 disabled:opacity-40"
          >
            {pending ? "..." : "✓ Won"}
          </button>
          <button
            onClick={() => setClosing(true)}
            disabled={pending}
            className="py-1 px-2 rounded text-[11px] font-medium bg-red-50 text-red-600 border border-red-200 disabled:opacity-40"
          >
            ✗ Lost
          </button>
        </div>
      ) : !wonClientId && closing ? (
        <div className="pt-1 border-t border-gray-50 space-y-1.5">
          <input
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Причина отказа (необяз.)"
            className="w-full rounded border border-gray-200 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-red-300"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => startTransition(async () => {
                await closeDeal(deal.id, "LOST", lostReason || null, "KM");
              })}
              disabled={pending}
              className="flex-1 py-1 rounded text-[11px] font-medium bg-red-50 text-red-600 border border-red-200 disabled:opacity-40"
            >
              {pending ? "..." : "Подтвердить"}
            </button>
            <button
              onClick={() => setClosing(false)}
              className="px-3 py-1 rounded text-[11px] text-gray-500 border border-gray-200"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── INN status types ────────────────────────────────────────

type InnStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "found";  id: string; name: string }
  | { state: "new" };

// ─── New Deal Form ───────────────────────────────────────────

function NewDealForm({
  owners,
  isAdmin,
  onClose,
}: {
  owners: Owner[];
  isAdmin: boolean;
  onClose: () => void;
}) {
  const action = createDeal.bind(null, "KM");
  const [error, formAction, pending] = useActionState(action, null);

  const [innStatus, setInnStatus] = useState<InnStatus>({ state: "idle" });
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const innRef = useRef<HTMLInputElement>(null);
  const today  = new Date().toISOString().slice(0, 10);

  async function lookupInn() {
    const inn = innRef.current?.value.trim() ?? "";
    if (!inn) { setInnStatus({ state: "idle" }); return; }
    setInnStatus({ state: "loading" });
    const result = await lookupClientByInn(inn);
    if (result) {
      setInnStatus({ state: "found", id: result.id, name: result.name });
    } else {
      setInnStatus({ state: "new" });
    }
  }

  function toggleProduct(key: string) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Group products by category
  const categories = ["rko", "credit", "trade", "cash"] as const;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 my-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-gray-900">Новая сделка КМ</h3>
            <p className="text-xs text-gray-400 mt-0.5">МСБ — корпоративные продукты</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form
          action={async (fd) => {
            // Inline INN lookup if not yet resolved
            if (innStatus.state === "idle" && innRef.current?.value.trim()) {
              const inn = innRef.current.value.trim();
              const result = await lookupClientByInn(inn);
              if (result) {
                setInnStatus({ state: "found", id: result.id, name: result.name });
                return;
              } else {
                setInnStatus({ state: "new" });
              }
            }
            // Inject products string
            fd.set("product", Array.from(selectedProducts).join(","));
            // Inject clientId if found
            if (innStatus.state === "found") {
              fd.set("clientId", innStatus.id);
            }
            return formAction(fd);
          }}
          className="space-y-4 text-sm"
        >
          {/* ── ИНН ── */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              ИНН компании <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                ref={innRef}
                name="inn"
                placeholder="1234567890"
                maxLength={14}
                onBlur={lookupInn}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 transition-colors ${
                  innStatus.state === "found" ? "border-emerald-400 focus:ring-emerald-200 bg-emerald-50/30"
                  : innStatus.state === "new"  ? "border-amber-300 focus:ring-amber-200 bg-amber-50/30"
                  : "border-gray-200 focus:ring-[var(--mbank-green)]"
                }`}
              />
              {innStatus.state === "loading" && (
                <span className="absolute right-3 top-2.5 text-xs text-gray-400 animate-pulse">поиск...</span>
              )}
            </div>

            {/* INN status feedback */}
            {innStatus.state === "found" && (
              <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                <span className="text-emerald-600 text-sm">✓</span>
                <div>
                  <p className="text-xs font-semibold text-emerald-800">{innStatus.name}</p>
                  <p className="text-[10px] text-emerald-600">Клиент в базе — сделка будет привязана</p>
                </div>
                <input type="hidden" name="clientId" value={innStatus.id} />
              </div>
            )}
            {innStatus.state === "new" && (
              <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <span className="text-amber-500 text-sm">◎</span>
                <p className="text-xs text-amber-700">Новый лид — не в базе. Введите название ниже.</p>
              </div>
            )}
          </div>

          {/* ── Тип клиента + название (только для нового лида) ── */}
          {(innStatus.state === "new" || innStatus.state === "idle") && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Тип клиента</label>
                <div className="flex gap-2">
                  {([{ value: "YL", label: "ОсОО" }, { value: "IP", label: "ИП" }] as const).map((t) => (
                    <label
                      key={t.value}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-sm cursor-pointer has-[:checked]:border-[var(--mbank-green)] has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-800 transition-colors"
                    >
                      <input type="radio" name="clientType" value={t.value} defaultChecked={t.value === "YL"} className="sr-only" />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Название компании {innStatus.state === "new" && <span className="text-red-400">*</span>}
                </label>
                <input
                  name="leadName"
                  placeholder="ОсОО «МегаТрейд», ИП Алиев..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
                />
              </div>
            </>
          )}

          {/* ── Контактное лицо ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Контактное лицо</label>
              <input
                name="contact"
                placeholder="Иванов Иван Иванович"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Телефон</label>
              <input
                name="phone"
                placeholder="+996 700 000 000"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
              />
            </div>
          </div>

          {/* ── Продукты ── */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Продукты {selectedProducts.size > 0 && <span className="text-[var(--mbank-green)] font-semibold">({selectedProducts.size} выбрано)</span>}
            </label>
            <div className="space-y-2">
              {categories.map((cat) => {
                const catProducts = KM_PRODUCTS.filter((p) => p.category === cat);
                return (
                  <div key={cat}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                      {KM_CATEGORY_LABELS[cat]}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {catProducts.map((p) => {
                        const active = selectedProducts.has(p.key);
                        const color  = PRODUCT_CATEGORY_COLORS[cat];
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => toggleProduct(p.key)}
                            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all"
                            style={active
                              ? { background: color.bg, color: color.text, borderColor: color.text + "60" }
                              : { background: "#f9fafb", color: "#9ca3af", borderColor: "#e5e7eb" }
                            }
                          >
                            <span>{p.icon}</span>
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Hidden input for products */}
            <input type="hidden" name="product" value={Array.from(selectedProducts).join(",")} />
          </div>

          {/* ── Сумма и параметры сделки ── */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Сумма (тыс. сом)</label>
              <input
                type="number"
                name="amount"
                placeholder="5 000"
                min={0}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Вероятность %</label>
              <input
                type="number"
                name="probability"
                defaultValue={20}
                min={0} max={100}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Закрытие</label>
              <input
                type="date"
                name="expectedClose"
                defaultValue={today}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
              />
            </div>
          </div>

          {/* ── Менеджер (admin) ── */}
          {isAdmin && owners.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Менеджер</label>
              <select
                name="ownerId"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
              >
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* ── Заметки ── */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Заметки</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Детали по сделке, КП, договорённости..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "var(--mbank-green)" }}
            >
              {pending ? "Создаю..." : "Создать сделку"}
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─── Board ──────────────────────────────────────────────────

export function PipelineBoardKM({
  deals,
  stageStats,
  wonCount,
  owners,
  isAdmin,
}: {
  deals: Deal[];
  stageStats: StageStats[];
  wonCount: number;
  owners: Owner[];
  isAdmin: boolean;
}) {
  const [showNew, setShowNew] = useState(false);

  const totalAmount = stageStats.reduce((s, st) => s + st.amount, 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <div>
            <div className="text-xs text-gray-400">Всего сделок</div>
            <div className="text-xl font-bold text-gray-900">
              {stageStats.reduce((s, st) => s + st.count, 0)}
            </div>
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div>
            <div className="text-xs text-gray-400">Сумма pipeline</div>
            <div className="text-xl font-bold" style={{ color: "var(--mbank-green)" }}>
              {fmtAmount(totalAmount) ?? "—"} сом
            </div>
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div>
            <div className="text-xs text-gray-400">Won (месяц)</div>
            <div className="text-xl font-bold text-emerald-600">{wonCount}</div>
          </div>
        </div>

        <button
          onClick={() => setShowNew(true)}
          className="ml-auto h-10 px-4 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--mbank-green)" }}
        >
          + Новая сделка
        </button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-4 gap-4">
        {PIPELINE_STAGES.map((stage) => {
          const col      = STAGE_COLORS[stage];
          const stat     = stageStats.find((s) => s.stage === stage);
          const colDeals = deals.filter((d) => d.stage === stage);

          return (
            <div key={stage} className="flex flex-col gap-3">
              <div
                className="rounded-lg px-3 py-2 flex items-center justify-between"
                style={{ background: col.bg, border: `1px solid ${col.border}` }}
              >
                <span className="text-xs font-semibold" style={{ color: col.text }}>
                  {STAGE_LABELS[stage]}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: col.text }}>
                    {stat?.count ?? 0}
                  </span>
                  {stat?.amount ? (
                    <span className="text-[10px]" style={{ color: col.text, opacity: 0.7 }}>
                      {fmtAmount(stat.amount)}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2.5 min-h-[120px]">
                {colDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
                {colDeals.length === 0 && (
                  <div className="text-xs text-gray-300 text-center pt-6">Нет сделок</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showNew && (
        <NewDealForm
          owners={owners}
          isAdmin={isAdmin}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
