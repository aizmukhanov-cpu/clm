import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getReactivationList, ReactivationFilters } from "@/lib/actions/reactivation";
import { ReactivationTable } from "./ReactivationTable";

type SearchParams = Promise<Record<string, string>>;

async function ReactivationContent({ sp }: { sp: Record<string, string> }) {
  const filters: ReactivationFilters = {
    search:     sp.search,
    minDays:    sp.minDays ? Number(sp.minDays) : undefined,
    managerId:  sp.managerId,
    page:       sp.page ? Number(sp.page) : 1,
  };

  const { clients, total, pages, managers, stats = { total: 0, over90: 0, noContact: 0 } } = await getReactivationList(filters);

  return (
    <ReactivationTable
      clients={clients as Parameters<typeof ReactivationTable>[0]["clients"]}
      total={total}
      pages={pages}
      managers={managers}
      stats={stats}
    />
  );
}

// Реактивация видна аналитике/руководству + VB-команде
const REACTIVATION_ROLES = ["ADMIN", "DIRECTOR", "ANALYST", "TEAM_LEAD", "SUPERVISOR"];

export default async function ReactivationPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!REACTIVATION_ROLES.includes(session.role) && session.team !== "VB") {
    redirect("/my-portfolio");
  }

  const sp = await searchParams;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Реактивация</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Клиенты в стадии Реактивация или когорте Отток — приоритизированы по сроку
        </p>
      </div>

      <Suspense fallback={<div className="text-sm text-gray-400 py-8 text-center">Загружаю...</div>}>
        <ReactivationContent sp={sp} />
      </Suspense>
    </div>
  );
}
