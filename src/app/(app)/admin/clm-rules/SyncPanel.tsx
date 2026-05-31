"use client";

import { useState } from "react";
import { runCLMSync } from "@/lib/actions/clm-sync";
import type { SyncResult, SyncDetail } from "@/lib/actions/clm-sync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  ACQUIRE:    "Привлечение",
  ONBOARD:    "Онбординг",
  ACTIVATE:   "Активация",
  GROW:       "Рост",
  REACTIVATE: "Реактивация",
};

const COHORT_LABELS: Record<string, string> = {
  NEVER_ACTIVE: "Неактивный",
  LOW_ACTIVE:   "Слабый",
  ACTIVE:       "Активный",
  LAPSED:       "Потерянный",
  LAPSED_DEEP:  "Глуб. отток",
};

const STAGE_COLORS: Record<string, string> = {
  ACQUIRE:    "bg-slate-100 text-slate-700",
  ONBOARD:    "bg-blue-100 text-blue-700",
  ACTIVATE:   "bg-amber-100 text-amber-700",
  GROW:       "bg-emerald-100 text-emerald-700",
  REACTIVATE: "bg-orange-100 text-orange-700",
};

function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[stage] ?? "bg-gray-100 text-gray-700"}`}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

function CohortBadge({ cohort }: { cohort: string }) {
  const colors: Record<string, string> = {
    NEVER_ACTIVE: "bg-slate-100 text-slate-600",
    LOW_ACTIVE:   "bg-yellow-100 text-yellow-700",
    ACTIVE:       "bg-green-100 text-green-700",
    LAPSED:       "bg-red-100 text-red-700",
    LAPSED_DEEP:  "bg-red-200 text-red-900",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[cohort] ?? "bg-gray-100 text-gray-700"}`}>
      {COHORT_LABELS[cohort] ?? cohort}
    </span>
  );
}

export function SyncPanel() {
  const [running, setRunning]   = useState(false);
  const [result,  setResult]    = useState<SyncResult | null>(null);
  const [showAll, setShowAll]   = useState(false);

  async function handleSync() {
    setRunning(true);
    setResult(null);
    try {
      const res = await runCLMSync();
      setResult(res);
    } finally {
      setRunning(false);
    }
  }

  const visibleDetails = showAll
    ? result?.details ?? []
    : (result?.details ?? []).slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Run button */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleSync}
          disabled={running}
          className="bg-[#1A5C38] hover:bg-[#236B45] text-white gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Синхронизация..." : "Запустить синхронизацию"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Пересчитывает когорты и стадии по транзакционным данным для всех активных клиентов
        </p>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {result.error ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {result.error}
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Готово за <strong>{result.durationMs}мс</strong>&nbsp;·&nbsp;
                  Всего клиентов: <strong>{result.total}</strong>&nbsp;·&nbsp;
                  Стадий обновлено: <strong>{result.stageUpdated}</strong>&nbsp;·&nbsp;
                  Когорт обновлено: <strong>{result.cohortUpdated}</strong>&nbsp;·&nbsp;
                  Без изменений: <strong>{result.skipped}</strong>
                </span>
              </div>

              {/* Details table */}
              {result.details.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    Изменённые клиенты ({result.details.length})
                  </h3>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-32">ИНН</TableHead>
                          <TableHead>Клиент</TableHead>
                          <TableHead>Стадия</TableHead>
                          <TableHead>Когорта</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleDetails.map((d: SyncDetail) => (
                          <TableRow key={d.clientId}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {d.inn}
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {d.clientName}
                            </TableCell>
                            <TableCell>
                              {d.stageFrom && d.stageTo ? (
                                <span className="flex items-center gap-1.5">
                                  <StageBadge stage={d.stageFrom} />
                                  <span className="text-muted-foreground text-xs">→</span>
                                  <StageBadge stage={d.stageTo} />
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {d.cohortFrom && d.cohortTo ? (
                                <span className="flex items-center gap-1.5">
                                  <CohortBadge cohort={d.cohortFrom} />
                                  <span className="text-muted-foreground text-xs">→</span>
                                  <CohortBadge cohort={d.cohortTo} />
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {result.details.length > 20 && (
                    <button
                      onClick={() => setShowAll((v) => !v)}
                      className="mt-2 text-xs text-[#1A5C38] hover:underline"
                    >
                      {showAll
                        ? "Свернуть"
                        : `Показать все ${result.details.length} записей`}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Все клиенты уже в актуальных стадиях — изменений нет.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
