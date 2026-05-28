import { Suspense } from "react";
import { getClients, getBranches } from "@/lib/actions/clients";
import { getSession } from "@/lib/auth";
import { getPermissionsForRole } from "@/lib/permissions";
import { ClientsTable } from "./ClientsTable";

type SearchParams = Promise<Record<string, string>>;

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await getSession();

  const showArchived = sp.archived === "1";

  const [{ clients, total, pages }, branches, perms] = await Promise.all([
    getClients({
      search:   sp.search,
      stage:    sp.stage,
      cohort:   sp.cohort,
      branchId: sp.branch,
      team:     sp.team,
      page:     sp.page ? Number(sp.page) : 1,
      archived: showArchived,
    }),
    getBranches(),
    getPermissionsForRole(session?.role ?? ""),
  ]);

  // Mask sensitive fields before passing to client component
  const masked = clients.map((c) => ({
    ...c,
    txnCount30d:      perms.txn_metrics ? c.txnCount30d      : null,
    daysSinceLastTxn: perms.txn_metrics ? c.daysSinceLastTxn : null,
    gmv30d:           perms.financials  ? c.gmv30d            : null,
  }));

  const canCreate  = session?.role === "ADMIN" || session?.role === "ANALYST";
  const canArchive = session?.role === "ADMIN" || session?.role === "ANALYST";

  // Build export URL preserving current filters
  const exportParams = new URLSearchParams();
  if (sp.search)   exportParams.set("search", sp.search);
  if (sp.stage)    exportParams.set("stage",  sp.stage);
  if (sp.cohort)   exportParams.set("cohort", sp.cohort);
  if (sp.branch)   exportParams.set("branch", sp.branch);
  if (sp.team)     exportParams.set("team",   sp.team);
  const exportUrl = `/api/clients/export?${exportParams.toString()}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Реестр клиентов</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {total.toLocaleString("ru")} клиентов
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            ⬇ Экспорт CSV
          </a>
          {canCreate && (
            <a
              href="/clients/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--mbank-green)" }}
            >
              + Новый клиент
            </a>
          )}
        </div>
      </div>

      <Suspense fallback={<div className="h-64 bg-white rounded-xl animate-pulse" />}>
        <ClientsTable
          clients={masked as Parameters<typeof ClientsTable>[0]["clients"]}
          branches={branches}
          total={total}
          pages={pages}
          currentPage={sp.page ? Number(sp.page) : 1}
          showTxnMetrics={perms.txn_metrics}
          showFinancials={perms.financials}
          showArchived={showArchived}
          canArchive={canArchive}
        />
      </Suspense>
    </div>
  );
}
