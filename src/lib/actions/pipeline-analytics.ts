"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { TeamType } from "@/generated/prisma/client";

export type FunnelStage = {
  stage: string;
  label: string;
  count: number;
  amount: number;
  conversionFromPrev: number | null; // % from previous stage
};

export type TeamFunnel = {
  team: string;
  stages: FunnelStage[];
  wonCount: number;
  lostCount: number;
  wonAmount: number;
};

export type LostReasonStat = {
  reason: string;
  label:  string;
  count:  number;
  pct:    number;
};

const LOST_REASON_LABELS: Record<string, string> = {
  PRICE:          "Цена / тариф",
  COMPETITOR:     "Ушёл к конкуренту",
  NO_NEED:        "Нет потребности",
  TIMING:         "Не готов сейчас",
  NO_BUDGET:      "Нет бюджета",
  DOCS_MISSING:   "Нет документов / KYC",
  AML_DECLINED:   "Отказ AML",
  CONTACT_LOST:   "Ghosting / потеря контакта",
  OTHER:          "Другое",
};

export async function getPipelineFunnel(): Promise<TeamFunnel[] | null> {
  const session = await getSession();
  if (!session) return null;

  const teamFilter: { team?: TeamType } =
    session.role === "SPECIALIST" || session.role === "KAM"
      ? { team: session.team as TeamType }
      : {};

  const [active, won, lost] = await Promise.all([
    db.deal.groupBy({
      by:     ["team", "stage"],
      where:  { status: "ACTIVE", ...teamFilter },
      _count: { id: true },
      _sum:   { amount: true },
    }),
    db.deal.groupBy({
      by:     ["team"],
      where:  { status: "WON", ...teamFilter },
      _count: { id: true },
      _sum:   { amount: true },
    }),
    db.deal.groupBy({
      by:     ["team"],
      where:  { status: "LOST", ...teamFilter },
      _count: { id: true },
    }),
  ]);

  // Define stage orders per team
  const STAGE_ORDERS: Record<string, string[]> = {
    B2B:    ["LEAD", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CONTRACT"],
    KM:     ["LEAD", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CONTRACT"],
    BRANCH: ["LEAD", "QUALIFICATION", "PROPOSAL", "CONTRACT"],
  };

  const STAGE_LABELS: Record<string, string> = {
    LEAD:          "Лид",
    QUALIFICATION: "Квалификация",
    PROPOSAL:      "КП отправлено",
    NEGOTIATION:   "Переговоры",
    CONTRACT:      "Контракт",
  };

  const teams = [...new Set([...active.map(a => a.team), ...won.map(w => w.team)])];

  return teams.map(team => {
    const stageOrder = STAGE_ORDERS[team] ?? ["LEAD", "QUALIFICATION", "PROPOSAL", "CONTRACT"];
    const teamActive = active.filter(a => a.team === team);

    const stages: FunnelStage[] = stageOrder.map((stage, idx) => {
      const row = teamActive.find(a => a.stage === stage);
      const count  = row?._count.id ?? 0;
      const amount = row?._sum.amount ?? 0;

      let conversionFromPrev: number | null = null;
      if (idx > 0) {
        const prevStage = stageOrder[idx - 1];
        const prevRow   = teamActive.find(a => a.stage === prevStage);
        const prevCount = prevRow?._count.id ?? 0;
        conversionFromPrev = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
      }

      return { stage, label: STAGE_LABELS[stage] ?? stage, count, amount, conversionFromPrev };
    });

    const wonRow  = won.find(w => w.team === team);
    const lostRow = lost.find(l => l.team === team);

    return {
      team,
      stages,
      wonCount:  wonRow?._count.id ?? 0,
      lostCount: lostRow?._count.id ?? 0,
      wonAmount: wonRow?._sum.amount ?? 0,
    };
  });
}

export async function getLostReasonStats(): Promise<LostReasonStat[]> {
  const session = await getSession();
  if (!session) return [];

  // Get standardised lost reasons
  const byCode = await db.deal.groupBy({
    by:    ["lostReasonCode"],
    where: { status: "LOST", lostReasonCode: { not: null } },
    _count: { id: true },
  });

  // Also get free-text reasons for older records
  const byText = await db.deal.groupBy({
    by:    ["lostReason"],
    where: { status: "LOST", lostReasonCode: null, lostReason: { not: null } },
    _count: { id: true },
  });

  const total = byCode.reduce((s, r) => s + r._count.id, 0) +
                byText.reduce((s, r) => s + r._count.id, 0);

  const stats: LostReasonStat[] = [
    ...byCode
      .filter(r => r.lostReasonCode)
      .map(r => ({
        reason: r.lostReasonCode!,
        label:  LOST_REASON_LABELS[r.lostReasonCode!] ?? r.lostReasonCode!,
        count:  r._count.id,
        pct:    total > 0 ? Math.round((r._count.id / total) * 100) : 0,
      })),
    ...byText
      .filter(r => r.lostReason)
      .map(r => ({
        reason: "OTHER",
        label:  r.lostReason ?? "Другое",
        count:  r._count.id,
        pct:    total > 0 ? Math.round((r._count.id / total) * 100) : 0,
      })),
  ];

  return stats.sort((a, b) => b.count - a.count).slice(0, 10);
}
