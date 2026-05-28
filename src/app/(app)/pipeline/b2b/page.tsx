import { getDeals } from "@/lib/actions/pipeline";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";
import { PipelineBoardB2B } from "../PipelineBoardB2B";

export default async function B2BPipelinePage() {
  const [{ deals, stageStats, wonCount, owners }, session] = await Promise.all([
    getDeals("B2B"),
    getSession(),
  ]);

  const isAdmin =
    session?.role === UserRole.ADMIN || session?.role === "ANALYST";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Pipeline B2B</h2>
        <p className="text-sm text-gray-400 mt-0.5">Микро и ИП — полевые продажи</p>
      </div>

      <PipelineBoardB2B
        deals={deals as Parameters<typeof PipelineBoardB2B>[0]["deals"]}
        stageStats={stageStats ?? []}
        wonCount={wonCount ?? 0}
        owners={owners}
        isAdmin={isAdmin}
      />
    </div>
  );
}
