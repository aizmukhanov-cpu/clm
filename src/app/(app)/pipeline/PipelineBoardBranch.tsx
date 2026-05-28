"use client";

import { useState, useTransition, useActionState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { moveDealStage, closeDeal, createDeal } from "@/lib/actions/pipeline";
import {
  BRANCH_STAGES,
  BRANCH_STAGE_LABELS,
  BRANCH_STAGE_COLORS,
  BRANCH_PRODUCTS,
  nextBranchStage,
  BranchStage,
} from "@/lib/pipeline-config";

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

function fmtAmount(v: number | null) {
  if (!v) return null;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

/* ─── Deal Card ─────────────────────────────────────────── */

function DealCard({ deal }: { deal: Deal }) {
  const [pending, startTransition] = useTransition();
  const [closing, setClosing]  = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [wonClientId, setWonClientId] = useState<string | null>(null);

  const next  = nextBranchStage(deal.stage as BranchStage);
  const title = deal.client?.name ?? deal.leadName ?? "—";

  function handleMove() {
    if (!next) return;
    startTransition(async () => { await moveDealStage(deal.id, next, "BRANCH"); });
  }

  function handleClose(outcome: "WON" | "LOST") {
    startTransition(async () => {
      const result = await closeDeal(deal.id, outcome, outcome === "LOST" ? lostReason || null : null, "BRANCH");
      if (outcome === "WON" && result?.clientId) setWonClientId(result.clientId);
    });
  }

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 text-xs space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {deal.client ? (
            <Link href={`/clients/${deal.client.id}`} className="font-semibold text-gray-900 hover:underline block truncate">
              {title}
            </Link>
          ) : (
            <span className="font-semibold text-gray-900 block truncate">{title}</span>
          )}
          {deal.productName && (
            <span className="text-gray-400">{deal.productName}</span>
          )}
        </div>
        {deal.amount && (
          <span className="font-bold shrink-0" style={{ color: "var(--mbank-green)" }}>
            {fmtAmount(deal.amount)} сом
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-gray-400">
        {deal.probability != null && <span>{deal.probability}%</span>}
        {deal.expectedClose && <span>до {format(new Date(deal.expectedClose), "dd.MM")}</span>}
        <span className="ml-auto">{deal.owner.name.split(" ")[0]}</span>
      </div>

      {/* Won banner */}
      {wonClientId && (
        <div className="pt-1 border-t border-emerald-100 bg-emerald-50 -mx-3 -mb-3 px-3 pb-3 rounded-b-lg">
          <p className="text-[11px] text-emerald-700 font-medium mb-1">🎉 Сделка закрыта!</p>
          <Link href={`/clients/${wonClientId}`} className="text-[11px] underline text-emerald-700">
            → Карточка клиента
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
              {pending ? "..." : `→ ${BRANCH_STAGE_LABELS[next]}`}
            </button>
          )}
          <button
            onClick={() => handleClose("WON")}
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
            className="w-full rounded border border-gray-200 px-2 py-1 text-[11px] focus:outline-none"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => handleClose("LOST")}
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

/* ─── New Deal Form ─────────────────────────────────────── */

function NewDealForm({
  owners,
  isAdmin,
  onClose,
}: {
  owners: Owner[];
  isAdmin: boolean;
  onClose: () => void;
}) {
  const action = createDeal.bind(null, "BRANCH");
  const [error, formAction, pending] = useActionState(action, null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Новая сделка (Филиал)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form action={formAction} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Название / компания</label>
            <input
              name="leadName"
              placeholder="ОсОО «Альфа»..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">ИНН (если клиент есть в базе — привяжется автоматически)</label>
            <input
              name="inn"
              placeholder="12345678901234"
              maxLength={14}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Продукт</label>
            <select
              name="product"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
            >
              <option value="">— выберите —</option>
              {BRANCH_PRODUCTS.map((p) => (
                <option key={p.key} value={p.label}>{p.icon} {p.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Сумма (тыс. сом)</label>
              <input
                type="number"
                name="amount"
                placeholder="500"
                min={0}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Вероятность %</label>
              <input
                type="number"
                name="probability"
                defaultValue={30}
                min={0}
                max={100}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Контактное лицо</label>
            <input
              name="contact"
              placeholder="Иванов Иван"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Ожидаемое закрытие</label>
            <input
              type="date"
              name="expectedClose"
              defaultValue={today}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
            />
          </div>

          {isAdmin && owners.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Менеджер</label>
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

          <div>
            <label className="block text-xs text-gray-500 mb-1">Заметки</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--mbank-green)]"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded px-3 py-2">{error}</p>
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

/* ─── Board ─────────────────────────────────────────────── */

export function PipelineBoardBranch({
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
        {BRANCH_STAGES.map((stage) => {
          const col      = BRANCH_STAGE_COLORS[stage];
          const stat     = stageStats.find((s) => s.stage === stage);
          const colDeals = deals.filter((d) => d.stage === stage);

          return (
            <div key={stage} className="flex flex-col gap-3">
              <div
                className="rounded-lg px-3 py-2 flex items-center justify-between"
                style={{ background: col.bg, border: `1px solid ${col.border}` }}
              >
                <span className="text-xs font-semibold" style={{ color: col.text }}>
                  {BRANCH_STAGE_LABELS[stage]}
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
        <NewDealForm owners={owners} isAdmin={isAdmin} onClose={() => setShowNew(false)} />
      )}
    </div>
  );
}
