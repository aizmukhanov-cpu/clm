import { getSession } from "@/lib/auth";
import { getProposalTemplates } from "@/lib/actions/proposals";
import { TemplatesClient } from "./TemplatesClient";

export default async function KMTemplatesPage() {
  const session   = await getSession();
  const templates = await getProposalTemplates("KM");
  const canEdit   = session?.role === "ADMIN" || session?.role === "ANALYST";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Шаблоны КП — КМ</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Готовые коммерческие предложения для команды Key Management
          </p>
        </div>
      </div>
      <TemplatesClient templates={templates} canEdit={canEdit} team="KM" />
    </div>
  );
}
