"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import Link from "next/link";
import { moveDealStage, closeDeal, createDeal, lookupClientByInn } from "@/lib/actions/pipeline";
import {
  B2B_STAGES,
  B2B_STAGE_LABELS,
  B2B_STAGE_COLORS,
  B2B_PRODUCTS,
  nextB2BStage,
  type B2BStage,
} from "@/lib/pipeline-config";

type Deal = {
  id: string;
  stage: string;
  leadName: string | null;
  productName: string | null;
  amount: number | null;
  notes: string | null;
  client: { id: string; name: string; inn: string } | null;
  owner: { id: string; name: string };
};

type StageStats = { stage: string; count: number; amount: number };
type Owner = { id: string; name: string };

function fmtAmount(v: number | null) {
  if (!v) return null;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

// Parse product keys from stored string "rko,mbiz,pos"
function parseProducts(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/* ── Deal card ─────────────────────────────────────────── */
function DealCard({ deal }: { deal: Deal }) {
  const [pending, startTransition] = useTransition();
  const [closing, setClosing] = useState(false);
  const [lostReason, setLostReason] = useState("");

  const stage = deal.stage as B2BStage;
  const next  = nextB2BStage(stage);
  const title = deal.client?.name ?? deal.leadName ?? "—";
  const products = parseProducts(deal.productName);

  // Parse structured notes: "inn:…|contact:…|phone:…|addr:…|note:…"
  const notesRaw = deal.notes ?? "";
  const meta: Record<string, string> = {};
  notesRaw.split("|").forEach((part) => {
    const [k, ...v] = part.split(":");
    if (k && v.length) meta[k.trim()] = v.join(":").trim();
  });
  const freeNote = meta["note"] ?? (!notesRaw.includes(":") ? notesRaw : "");
  const inn = meta["inn"] ?? (deal.client ? null : null); // INN only shown for non-linked clients

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 text-xs space-y-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {deal.client ? (
            <Link href={`/clients/${deal.client.id}`} className="font-semibold text-gray-900 hover:underline block truncate">
              {title}
            </Link>
          ) : (
            <span className="font-semibold text-gray-900 block truncate">{title}</span>
          )}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {deal.client?.inn && (
              <span className="font-mono text-[10px] text-gray-400">{deal.client.inn}</span>
            )}
            {!deal.client && inn && (
              <span className="font-mono text-[10px] text-gray-400">{inn}</span>
            )}
            {deal.client && (
              <span
                className="text-[9px] font-medium px-1 py-0.5 rounded"
                style={{ background: "var(--mbank-green-pale)", color: "var(--mbank-green)" }}
              >
                в реестре
              </span>
            )}
          </div>
          {meta["contact"] && (
            <div className="text-gray-400 truncate mt-0.5">{meta["contact"]}</div>
          )}
          {meta["addr"] && (
            <div className="text-gray-400 truncate text-[10px] mt-0.5">📍 {meta["addr"]}</div>
          )}
        </div>
        {deal.amount && (
          <span className="font-bold shrink-0 text-[11px]" style={{ color: "var(--mbank-green)" }}>
            {fmtAmount(deal.amount)}К
          </span>
        )}
      </div>

      {/* Products */}
      {products.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {products.map((key) => {
            const prod = B2B_PRODUCTS.find((p) => p.key === key);
            if (!prod) return null;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ background: "var(--mbank-green-pale)", color: "var(--mbank-green)" }}
              >
                {prod.icon} {prod.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Note */}
      {freeNote && (
        <p className="text-gray-400 text-[10px] line-clamp-2">{freeNote}</p>
      )}

      {/* Meta */}
      <div className="text-gray-400 text-[10px]">
        {meta["phone"] && <span>{meta["phone"]} · </span>}
        <span>{deal.owner.name.split(" ")[0]}</span>
      </div>

      {/* Actions */}
      {!closing ? (
        <div className="flex items-center gap-1.5 pt-1 border-t border-gray-50">
          {next && (
            <button
              onClick={() => startTransition(async () => { await moveDealStage(deal.id, next, "B2B"); })}
              disabled={pending}
              className="flex-1 py-1 rounded text-[11px] font-medium border transition-colors disabled:opacity-40"
              style={{ borderColor: "var(--mbank-green)", color: "var(--mbank-green)" }}
            >
              {pending ? "..." : `→ ${B2B_STAGE_LABELS[next]}`}
            </button>
          )}
          <button
            onClick={() => startTransition(async () => { await closeDeal(deal.id, "WON", null, "B2B"); })}
            disabled={pending}
            className="py-1 px-2 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 disabled:opacity-40"
          >
            ✓ Открыт
          </button>
          <button
            onClick={() => setClosing(true)}
            disabled={pending}
            className="py-1 px-2 rounded text-[11px] font-medium bg-red-50 text-red-600 border border-red-200 disabled:opacity-40"
          >
            ✗ Отказ
          </button>
        </div>
      ) : (
        <div className="pt-1 border-t border-gray-50 space-y-1.5">
          <input
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Причина отказа (необяз.)"
            className="w-full rounded border border-gray-200 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-red-300"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => startTransition(async () => { await closeDeal(deal.id, "LOST", lostReason || null, "B2B"); })}
              disabled={pending}
              className="flex-1 py-1 rounded text-[11px] font-medium bg-red-50 text-red-600 border border-red-200 disabled:opacity-40"
            >
              {pending ? "..." : "Подтвердить"}
            </button>
            <button onClick={() => setClosing(false)} className="px-3 py-1 rounded text-[11px] text-gray-500 border border-gray-200">
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── New lead form ─────────────────────────────────────── */
type InnStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "found";    clientId: string; clientName: string }
  | { state: "new" };

function NewLeadForm({
  owners,
  isAdmin,
  onClose,
}: {
  owners: Owner[];
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [innStatus, setInnStatus] = useState<InnStatus>({ state: "idle" });
  const [companyName, setCompanyName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function toggleProduct(key: string) {
    setSelectedProducts((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const handleInnBlur = useCallback(async (e: React.FocusEvent<HTMLInputElement>) => {
    const inn = e.target.value.trim();
    if (!inn) { setInnStatus({ state: "idle" }); return; }

    setInnStatus({ state: "loading" });
    const result = await lookupClientByInn(inn);
    if (result) {
      setInnStatus({ state: "found", clientId: result.id, clientName: result.name });
      // Подставляем название если поле пустое
      if (!companyName) setCompanyName(result.name);
    } else {
      setInnStatus({ state: "new" });
    }
  }, [companyName]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Блокируем если ИНН уже в базе
    if (innStatus.state === "found") {
      setError(`Клиент «${innStatus.clientName}» уже есть в базе. B2B пайплайн — только для новых клиентов.`);
      return;
    }

    // Если ещё не проверили ИНН (пользователь не убрал фокус) — проверяем сейчас
    const innValue = (e.currentTarget.elements.namedItem("inn") as HTMLInputElement)?.value?.trim();
    if (innValue && innStatus.state === "idle") {
      setPending(true);
      const result = await lookupClientByInn(innValue);
      if (result) {
        setInnStatus({ state: "found", clientId: result.id, clientName: result.name });
        setError(`Клиент «${result.name}» уже есть в базе. B2B пайплайн — только для новых клиентов.`);
        setPending(false);
        return;
      }
      setInnStatus({ state: "new" });
    }

    setPending(true);

    const fd = new FormData(e.currentTarget);

    // Build structured notes: "contact:…|phone:…|addr:…|note:…"
    const parts: string[] = [];
    const contact = (fd.get("contact")  as string)?.trim();
    const phone   = (fd.get("phone")    as string)?.trim();
    const addr    = (fd.get("addr")     as string)?.trim();
    const note    = (fd.get("freeNote") as string)?.trim();
    if (contact) parts.push(`contact:${contact}`);
    if (phone)   parts.push(`phone:${phone}`);
    if (addr)    parts.push(`addr:${addr}`);
    if (note)    parts.push(`note:${note}`);

    fd.delete("contact");
    fd.delete("phone");
    fd.delete("addr");
    fd.delete("freeNote");
    fd.set("notes", parts.join("|"));
    fd.set("product", selectedProducts.join(","));

    const err = await createDeal("B2B", null, fd);
    setPending(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-gray-900">Новый лид — B2B</h3>
            <p className="text-xs text-gray-400 mt-0.5">Полевая встреча / первый контакт</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 text-sm">

          {/* INN — first field, with lookup */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              ИНН <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                name="inn"
                required
                maxLength={14}
                placeholder="1234567890"
                onBlur={handleInnBlur}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
                style={{
                  borderColor:
                    innStatus.state === "found" ? "#f87171" :   // red — duplicate
                    innStatus.state === "new"   ? "#86efac" :   // green — new client ok
                    "#e5e7eb",
                }}
              />
              {/* Status indicator */}
              {innStatus.state === "loading" && (
                <span className="absolute right-3 top-2.5 text-xs text-gray-400 animate-pulse">проверяю...</span>
              )}
              {innStatus.state === "found" && (
                <span className="absolute right-3 top-2.5 text-xs font-medium text-red-500">
                  ✗ уже в базе
                </span>
              )}
              {innStatus.state === "new" && (
                <span className="absolute right-3 top-2.5 text-xs font-medium" style={{ color: "var(--mbank-green)" }}>
                  ✓ новый клиент
                </span>
              )}
            </div>
            {/* Duplicate warning */}
            {innStatus.state === "found" && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100">
                <span>⛔</span>
                <div>
                  <span className="font-medium text-red-700">{innStatus.clientName}</span>
                  <span className="text-red-500 ml-1">уже в реестре клиентов.</span>
                  <span className="text-red-400 ml-1">B2B пайплайн — только для новых клиентов.</span>
                </div>
              </div>
            )}
          </div>

          {/* Company name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Название компании / ИП
            </label>
            <input
              name="leadName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder='ОсОО "Альфа", ИП Иванов...'
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
            />
          </div>

          {/* Contact + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Контактное лицо</label>
              <input
                name="contact"
                placeholder="Иван Петров"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Телефон</label>
              <input
                name="phone"
                placeholder="+996 700 000 000"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Адрес / точка</label>
            <input
              name="addr"
              placeholder="ул. Манаса 40, бутик №7, базар Дордой..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
            />
          </div>

          {/* Products */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Продукты интереса
              {selectedProducts.length > 0 && (
                <span
                  className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ background: "var(--mbank-green)" }}
                >
                  {selectedProducts.length}
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {B2B_PRODUCTS.map((p) => {
                const active = selectedProducts.includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => toggleProduct(p.key)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                    style={
                      active
                        ? {
                            background: "var(--mbank-green)",
                            color: "#fff",
                            borderColor: "var(--mbank-green)",
                            transform: "scale(1.02)",
                          }
                        : {
                            background: "#fff",
                            color: "#6b7280",
                            borderColor: "#e5e7eb",
                          }
                    }
                  >
                    <span>{p.icon}</span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Ожидаемый оборот/сумма (тыс. сом)
            </label>
            <input
              type="number"
              name="amount"
              placeholder="500"
              min={0}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
            />
          </div>

          {/* Owner (admin only) */}
          {isAdmin && owners.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Менеджер</label>
              <select
                name="ownerId"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
              >
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Заметки</label>
            <textarea
              name="freeNote"
              rows={2}
              placeholder="Доп. информация о клиенте..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)] focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "var(--mbank-green)" }}
            >
              {pending ? "Создаю..." : "Добавить лида"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Board ─────────────────────────────────────────────── */
export function PipelineBoardB2B({
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

  const totalAmount = stageStats
    .filter((s) => B2B_STAGES.includes(s.stage as B2BStage))
    .reduce((sum, s) => sum + s.amount, 0);

  const totalDeals = stageStats
    .filter((s) => B2B_STAGES.includes(s.stage as B2BStage))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <div>
            <div className="text-xs text-gray-400">Всего лидов</div>
            <div className="text-xl font-bold text-gray-900">{totalDeals}</div>
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div>
            <div className="text-xs text-gray-400">Pipeline</div>
            <div className="text-xl font-bold" style={{ color: "var(--mbank-green)" }}>
              {fmtAmount(totalAmount) ?? "—"} тыс.
            </div>
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div>
            <div className="text-xs text-gray-400">Открыто счётов</div>
            <div className="text-xl font-bold text-emerald-600">{wonCount}</div>
          </div>
        </div>

        <button
          onClick={() => setShowNew(true)}
          className="ml-auto h-10 px-4 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--mbank-green)" }}
        >
          + Новый лид
        </button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-4 gap-4">
        {B2B_STAGES.map((stage) => {
          const col      = B2B_STAGE_COLORS[stage];
          const stat     = stageStats.find((s) => s.stage === stage);
          const colDeals = deals.filter((d) => d.stage === stage);

          return (
            <div key={stage} className="flex flex-col gap-3">
              {/* Column header */}
              <div
                className="rounded-lg px-3 py-2 flex items-center justify-between"
                style={{ background: col.bg, border: `1px solid ${col.border}` }}
              >
                <span className="text-xs font-semibold" style={{ color: col.text }}>
                  {B2B_STAGE_LABELS[stage]}
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

              {/* Cards */}
              <div className="space-y-2.5 min-h-[120px]">
                {colDeals.map((d) => (
                  <DealCard key={d.id} deal={d} />
                ))}
                {colDeals.length === 0 && (
                  <div className="text-xs text-gray-300 text-center pt-6">Нет лидов</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showNew && (
        <NewLeadForm
          owners={owners}
          isAdmin={isAdmin}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
