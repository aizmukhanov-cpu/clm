import { getDeals } from "@/lib/actions/pipeline";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";
import { PipelineBoardKM } from "../PipelineBoardKM";

export default async function KMPipelinePage() {
  const [{ deals, stageStats, wonCount, owners }, session] = await Promise.all([
    getDeals("KM"),
    getSession(),
  ]);

  const isAdmin =
    session?.role === UserRole.ADMIN || session?.role === "ANALYST";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Pipeline КМ</h2>
        <p className="text-sm text-gray-400 mt-0.5">МСБ — корпоративные продукты и КП</p>
      </div>

      <PipelineBoardKM
        deals={deals as Parameters<typeof PipelineBoardKM>[0]["deals"]}
        stageStats={stageStats ?? []}
        wonCount={wonCount ?? 0}
        owners={owners}
        isAdmin={isAdmin}
      />
    </div>
  );
}
