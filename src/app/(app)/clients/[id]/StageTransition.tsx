"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeStage } from "@/lib/actions/clients";
import { ALLOWED, STAGE_LABELS } from "@/lib/clm-config";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STAGE_COLORS: Record<string, string> = {
  ACQUIRE:    "bg-gray-100 text-gray-700",
  ONBOARD:    "bg-blue-50 text-blue-700",
  ACTIVATE:   "bg-amber-50 text-amber-700",
  GROW:       "text-white",
  REACTIVATE: "bg-orange-50 text-orange-700",
};

type Props = {
  clientId: string;
  currentStage: string;
  canEdit: boolean;
  compact?: boolean;
};

export function StageTransition({ clientId, currentStage, canEdit, compact = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allowed = ALLOWED[currentStage] ?? [];

  const isGrow = currentStage === "GROW";
  const stageBg = isGrow ? { background: "var(--mbank-green)" } : {};

  async function handleChange(newStage: string | null) {
    if (!newStage) return;
    setError(null);
    startTransition(async () => {
      const res = await changeStage(clientId, newStage as import("@/generated/prisma/client").CLMStage);
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  if (compact) {
    // Compact variant: just the select dropdown for banners
    if (!canEdit || allowed.length === 0) return null;
    return (
      <div className="flex items-center gap-2 shrink-0">
        {pending && <span className="text-xs text-gray-400">сохраняю...</span>}
        <Select onValueChange={handleChange} disabled={pending}>
          <SelectTrigger className="h-8 w-44 text-sm border-amber-300 bg-white text-amber-700">
            <SelectValue placeholder="Перевести в..." />
          </SelectTrigger>
          <SelectContent>
            {allowed.map((s) => (
              <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">Стадия CLM</span>
        {pending && (
          <span className="text-xs text-gray-400">сохраняю...</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Текущая стадия */}
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${STAGE_COLORS[currentStage] ?? ""}`}
          style={stageBg}
        >
          {STAGE_LABELS[currentStage]}
        </span>

        {/* Dropdown следующей стадии — только для admin/analyst */}
        {canEdit && allowed.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-sm">→</span>
            <Select onValueChange={handleChange} disabled={pending}>
              <SelectTrigger
                className="h-8 w-44 text-sm border-dashed border-gray-300 text-gray-500"
              >
                <SelectValue placeholder="Перевести в..." />
              </SelectTrigger>
              <SelectContent>
                {allowed.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* Подсказка при переходе в ONBOARD */}
      {canEdit && allowed.includes("ONBOARD") && (
        <p className="text-xs text-blue-500">
          При переводе в Онбординг автоматически создадутся задачи D+1/D+3/D+7/D+14
        </p>
      )}
    </div>
  );
}
