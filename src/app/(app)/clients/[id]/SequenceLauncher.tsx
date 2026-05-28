"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { launchSequence } from "@/lib/actions/sequences";
import { SEQUENCE_TEMPLATES, type SequenceTemplate } from "@/lib/sequences";

type ActiveSeq = {
  sequenceId:   string;
  sequenceName: string;
  total:    number;
  done:     number;
  pending:  number;
};

type Props = {
  clientId:       string;
  clientStage:    string;
  activeSequences: ActiveSeq[];
};

export function SequenceLauncher({ clientId, clientStage, activeSequences }: Props) {
  const router  = useRouter();
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<string | null>(null);

  // Show recommended first, then the rest
  const recommended = SEQUENCE_TEMPLATES.filter(
    s => !s.forStage || s.forStage.includes(clientStage)
  );
  const others = SEQUENCE_TEMPLATES.filter(
    s => s.forStage && !s.forStage.includes(clientStage)
  );

  const alreadyActive = new Set(activeSequences.map(s => s.sequenceId));

  const handleLaunch = async (seq: SequenceTemplate) => {
    if (!confirm(`Запустить последовательность "${seq.name}"?\n\nБудет создано ${seq.steps.length} задач.`)) return;
    setLoading(true);
    setMsg(null);
    const res = await launchSequence(clientId, seq.id);
    if (res.error) {
      setMsg(`❌ ${res.error}`);
    } else {
      setMsg(`✅ Запущено: "${res.sequenceName}" — ${res.tasksCreated} задач создано`);
      router.refresh();
    }
    setLoading(false);
    setOpen(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Автоматические последовательности</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Запустите цепочку задач по шаблону</p>
        </div>
        <button
          onClick={() => { setOpen(!open); setMsg(null); }}
          className="h-8 px-3 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--mbank-green)" }}
        >
          {open ? "Закрыть" : "+ Запустить"}
        </button>
      </div>

      {/* Active sequences progress */}
      {activeSequences.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Активные последовательности</p>
          {activeSequences.map((s) => {
            const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <div key={s.sequenceId} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-gray-700">{s.sequenceName}</span>
                    <span className="text-[10px] text-gray-400 tabular-nums">
                      {s.done}/{s.total} выполнено
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: pct === 100 ? "var(--mbank-green)" : "#f59e0b",
                      }}
                    />
                  </div>
                </div>
                {pct === 100 && (
                  <span className="text-[10px] font-bold text-emerald-600">✅</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Msg */}
      {msg && (
        <div className="text-xs text-gray-600 mb-3 px-3 py-2 bg-gray-50 rounded-lg">{msg}</div>
      )}

      {/* Template picker */}
      {open && (
        <div className="space-y-3 mt-2 border-t border-gray-100 pt-4">
          {recommended.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Рекомендовано для этой стадии
              </p>
              {recommended.map((seq) => (
                <SequenceCard
                  key={seq.id}
                  seq={seq}
                  active={alreadyActive.has(seq.id)}
                  loading={loading}
                  onLaunch={handleLaunch}
                  recommended
                />
              ))}
            </>
          )}
          {others.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mt-3">
                Другие последовательности
              </p>
              {others.map((seq) => (
                <SequenceCard
                  key={seq.id}
                  seq={seq}
                  active={alreadyActive.has(seq.id)}
                  loading={loading}
                  onLaunch={handleLaunch}
                  recommended={false}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Single template card ─────────────────────────────────── */
function SequenceCard({
  seq, active, loading, onLaunch, recommended,
}: {
  seq:         SequenceTemplate;
  active:      boolean;
  loading:     boolean;
  onLaunch:    (s: SequenceTemplate) => void;
  recommended: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const PRIORITY_COLOR: Record<string, string> = {
    P1: "#dc2626",
    P2: "#f59e0b",
    P3: "#94a3b8",
  };

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        recommended
          ? "border-green-200 bg-green-50/40"
          : "border-gray-100 bg-gray-50/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{seq.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{seq.name}</span>
            {active && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Активен
              </span>
            )}
            {recommended && !active && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--mbank-green-pale)", color: "var(--mbank-green)" }}>
                Рекомендован
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">{seq.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-400">{seq.steps.length} шагов</span>
            <span className="text-gray-300">·</span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
            >
              {expanded ? "Скрыть шаги ↑" : "Посмотреть шаги ↓"}
            </button>
          </div>
        </div>
        <button
          onClick={() => onLaunch(seq)}
          disabled={loading}
          className="shrink-0 h-7 px-3 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: active ? "#f59e0b" : "var(--mbank-green)" }}
        >
          {active ? "Повторить" : "Запустить"}
        </button>
      </div>

      {/* Step list */}
      {expanded && (
        <div className="mt-3 space-y-1.5 border-t border-dashed border-gray-200 pt-3">
          {seq.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white mt-0.5"
                style={{ background: PRIORITY_COLOR[step.priority] }}
              >
                {i + 1}
              </span>
              <div>
                <span className="text-[10px] text-gray-400">Д+{step.dayOffset}: </span>
                <span className="text-[11px] text-gray-700">{step.action}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
