import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCLMStats } from "@/lib/actions/clm-sync";
import { STAGE_RULES, THRESHOLDS } from "@/lib/clm-rules";
import { SyncPanel } from "./SyncPanel";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Zap, Users, TrendingUp } from "lucide-react";

// ─── Labels ────────────────────────────────────────────────

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
  ACQUIRE:    "bg-slate-100 text-slate-700 border-slate-200",
  ONBOARD:    "bg-blue-100 text-blue-700 border-blue-200",
  ACTIVATE:   "bg-amber-100 text-amber-700 border-amber-200",
  GROW:       "bg-emerald-100 text-emerald-700 border-emerald-200",
  REACTIVATE: "bg-orange-100 text-orange-700 border-orange-200",
};

function StagePill({ stage }: { stage: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STAGE_COLORS[stage] ?? "bg-gray-100 text-gray-700"}`}
    >
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────

export default async function CLMRulesPage() {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "ANALYST")) {
    notFound();
  }

  const stats = await getCLMStats();

  const ALL_STAGES = ["ACQUIRE", "ONBOARD", "ACTIVATE", "GROW", "REACTIVATE"];
  const ALL_COHORTS = ["NEVER_ACTIVE", "LOW_ACTIVE", "ACTIVE", "LAPSED", "LAPSED_DEEP"];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CLM-автоматизация</h1>
        <p className="text-muted-foreground mt-1">
          Правила автоматического перехода стадий и присвоения когорт по транзакционным данным
        </p>
      </div>

      {/* Current distribution */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Stage distribution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#1A5C38]" />
                Распределение по стадиям
              </CardTitle>
              <CardDescription>Всего клиентов: {stats.total}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {ALL_STAGES.map((s) => {
                const count = (stats.stageCounts as Record<string, number>)[s] ?? 0;
                const pct   = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <StagePill stage={s} />
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#1A5C38]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Cohort distribution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-[#C6903A]" />
                Распределение по когортам
              </CardTitle>
              <CardDescription>RFM-D когорты по транзакционной активности</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {ALL_COHORTS.map((c) => {
                const count = (stats.cohortCounts as Record<string, number>)[c] ?? 0;
                const pct   = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                const cohortColors: Record<string, string> = {
                  NEVER_ACTIVE: "bg-slate-400",
                  LOW_ACTIVE:   "bg-yellow-400",
                  ACTIVE:       "bg-emerald-500",
                  LAPSED:       "bg-red-400",
                  LAPSED_DEEP:  "bg-red-700",
                };
                return (
                  <div key={c} className="flex items-center gap-3">
                    <span className="w-28 text-xs font-medium text-foreground shrink-0">
                      {COHORT_LABELS[c]}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cohortColors[c]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Automation rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#C6903A]" />
            Правила автоматических переходов
          </CardTitle>
          <CardDescription>
            Применяются при каждой синхронизации. Стадия ACQUIRE не затрагивается — только ручной переход.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="pl-6">Из стадии</TableHead>
                <TableHead></TableHead>
                <TableHead>В стадию</TableHead>
                <TableHead>Условие</TableHead>
                <TableHead className="pr-6">Комментарий</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STAGE_RULES.map((rule) => {
                const fromStages = Array.isArray(rule.from) ? rule.from : [rule.from];
                return (
                  <TableRow key={rule.id}>
                    <TableCell className="pl-6">
                      <div className="flex flex-wrap gap-1">
                        {fromStages.map((s) => (
                          <StagePill key={s} stage={s} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground px-1">
                      <ArrowRight className="h-4 w-4" />
                    </TableCell>
                    <TableCell>
                      <StagePill stage={rule.to} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px]">
                      {rule.trigger}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground pr-6 max-w-[200px]">
                      {rule.note ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Thresholds reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пороговые значения</CardTitle>
          <CardDescription>
            Константы, используемые в правилах. Вынос в UI-редактор — в следующей версии.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ["Мин. транзакций → ACTIVE когорта",     THRESHOLDS.ACTIVE_TXN_MIN,   "транз./30д"],
                ["Дней без тр. → LAPSED когорта",        THRESHOLDS.LAPSED_DAYS,      "дней"],
                ["Дней без тр. → LAPSED_DEEP когорта",   THRESHOLDS.LAPSED_DEEP_DAYS, "дней"],
                ["Транзакций → выход из ONBOARD",        THRESHOLDS.ONBOARD_TXN,     "транз."],
                ["Мин. транзакций → GROW",               THRESHOLDS.GROW_TXN_MIN,    "транз./30д"],
                ["Мин. GMV → GROW",                      THRESHOLDS.GROW_GMV_MIN / 1000, "тыс. сом/30д"],
                ["Дней без тр. → REACTIVATE",            THRESHOLDS.DORMANT_DAYS,    "дней"],
              ] as [string, number, string][]
            ).map(([label, value, unit]) => (
              <div key={label} className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  {value.toLocaleString("ru-RU")}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sync panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ручной запуск синхронизации</CardTitle>
          <CardDescription>
            В production синхронизация запускается ночным cron-заданием.
            Здесь можно запустить вручную для тестирования или внеплановой актуализации.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SyncPanel />
        </CardContent>
      </Card>
    </div>
  );
}
