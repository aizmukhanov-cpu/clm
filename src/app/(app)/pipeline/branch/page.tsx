import { getDeals } from "@/lib/actions/pipeline";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";
import { PipelineBoardBranch } from "../PipelineBoardBranch";

export default async function BranchPipelinePage() {
  const [{ deals, stageStats, wonCount, owners }, session] = await Promise.all([
    getDeals("BRANCH"),
    getSession(),
  ]);

  const isAdmin =
    session?.role === UserRole.ADMIN || session?.role === "ANALYST";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Pipeline Филиалы</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Продуктовые сделки — входящие и cross-sell по клиентам филиала
          </p>
        </div>
      </div>

      <PipelineBoardBranch
        deals={deals as Parameters<typeof PipelineBoardBranch>[0]["deals"]}
        stageStats={stageStats ?? []}
        wonCount={wonCount ?? 0}
        owners={owners}
        isAdmin={isAdmin}
      />
    </div>
  );
}
