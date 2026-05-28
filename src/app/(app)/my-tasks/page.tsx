import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMyTasks } from "@/lib/actions/portfolio";
import { getSession } from "@/lib/auth";
import { TasksTable } from "./TasksTable";
import Link from "next/link";

type SearchParams = Promise<Record<string, string>>;

export default async function MyTasksPage({ searchParams }: { searchParams: SearchParams }) {
  const sp      = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await getMyTasks({
    priority:   sp.priority,
    triggerDay: sp.triggerDay,
    status:     sp.status,
    page:       sp.page ? Number(sp.page) : 1,
  });

  if (!data) redirect("/login");

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Мои задачи</h2>
          <p className="text-sm text-gray-400 mt-0.5">{session.name}</p>
        </div>
        <Link
          href="/my-portfolio"
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          ← Мой портфель
        </Link>
      </div>

      <Suspense fallback={<div className="h-64 bg-white rounded-xl animate-pulse" />}>
        <TasksTable tasks={data.tasks} stats={data.stats} />
      </Suspense>

    </div>
  );
}
