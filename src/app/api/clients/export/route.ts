/**
 * CSV Export — GET /api/clients/export
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

function esc(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const stage  = sp.get("stage")  || undefined;
  const cohort = sp.get("cohort") || undefined;
  const team   = sp.get("team")   || undefined;
  const search = sp.get("search") || undefined;

  const roleFilter: Record<string, unknown> = {};
  if (session.role === "SPECIALIST") roleFilter.managerId = session.id;
  if (session.role === "KAM")        roleFilter.kamId     = session.id;
  if (session.role === "SUPERVISOR") {
    // Supervisor exports own + subordinates' clients
    roleFilter.OR = [
      { managerId: session.id },
      { manager: { supervisorId: session.id } },
    ];
  }

  const where: Record<string, unknown> = {
    ...roleFilter, isArchived: false,
    ...(stage  ? { clmStage:  stage }  : {}),
    ...(cohort ? { clmCohort: cohort } : {}),
    ...(team   ? { manager: { team } } : {}),
    ...(search ? { OR: [
      { name: { contains: search, mode: "insensitive" } },
      { inn:  { contains: search } },
    ] } : {}),
  };

  const clients = await db.client.findMany({
    where: where as never,
    include: { branch: { select: { name: true } }, manager: { select: { name: true, team: true } }, kam: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const STAGE_LABEL: Record<string, string> = { ACQUIRE:"Привлечение", ONBOARD:"Онбординг", ACTIVATE:"Активация", GROW:"Рост", REACTIVATE:"Реактивация" };
  const COHORT_LABEL: Record<string, string> = { NEVER_ACTIVE:"Нет активности", LOW_ACTIVE:"Низкая активность", ACTIVE:"Активный", LAPSED:"Отток" };

  const headers = ["ИНН","Название","Тип","Филиал","Команда","Менеджер","KAM","CLM Стадия","Когорта","Транзакций 30д","Дней без тр.","GMV 30д (сом)","Продуктов","MBusiness","MKassa POS","MKassa QR","Эквайринг","ЗП-проект","Зарплата","Корп.карта","Кредит","Депозит","Торг.фин."];

  const rows = clients.map((c) => {
    const n = [c.hasMBusiness,c.hasMKassaPos,c.hasMKassaQr,c.hasAcquiring,c.hasSalaryProject,c.hasPayroll,c.hasCorporateCard,c.hasCredit,c.hasDeposit,c.hasTradeFinance].filter(Boolean).length;
    return [c.inn,c.name,c.type==="YL"?"Юр.лицо":"ИП",c.branch?.name??"",c.manager?.team??"",c.manager?.name??"",c.kam?.name??"",STAGE_LABEL[c.clmStage]??c.clmStage,COHORT_LABEL[c.clmCohort]??c.clmCohort,c.txnCount30d,c.daysSinceLastTxn,c.gmv30d,n,c.hasMBusiness?"Да":"",c.hasMKassaPos?"Да":"",c.hasMKassaQr?"Да":"",c.hasAcquiring?"Да":"",c.hasSalaryProject?"Да":"",c.hasPayroll?"Да":"",c.hasCorporateCard?"Да":"",c.hasCredit?"Да":"",c.hasDeposit?"Да":"",c.hasTradeFinance?"Да":""].map(esc).join(",");
  });

  const csv = "﻿" + [headers.map(esc).join(","), ...rows].join("\r\n");
  const date = new Date().toISOString().slice(0,10);
  return new NextResponse(csv, { headers: { "Content-Type":"text/csv; charset=utf-8", "Content-Disposition":`attachment; filename="clm-clients-${date}.csv"` } });
}
