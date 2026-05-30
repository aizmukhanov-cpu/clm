import { Suspense } from "react";
import { getDeskTasks, DeskFilters } from "@/lib/actions/activation-desk";
import { DeskTable } from "./DeskTable";

type SearchParams = Promise<Record<string, string>>;

async function DeskContent({ sp }: { sp: Record<string, string> }) {
  const filters: DeskFilters = {
    priority:   sp.priority,
    triggerDay: sp.triggerDay,
    assignedTo: sp.assignedTo,
    status:     sp.status,
    clmStage:   sp.clmStage,
  };

  const { tasks, stats, assignees } = await getDeskTasks(filters);

  return <DeskTable tasks={tasks as Parameters<typeof DeskTable>[0]["tasks"]} stats={stats} assignees={assignees ?? []} />;
}

export default async function ActivationDeskPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Activation Desk</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Все активные задачи по клиентам — онбординг, активация, реактивация, кросс-продажи
        </p>
      </div>

      <Suspense fallback={
        <div className="text-sm text-gray-400 py-8 text-center">Загружаю задачи...</div>
      }>
        <DeskContent sp={sp} />
      </Suspense>
    </div>
  );
}
