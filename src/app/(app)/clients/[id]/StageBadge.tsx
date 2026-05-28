/**
 * StageBadge — read-only CLM stage display.
 *
 * Manual stage changes are disabled; stages are assigned automatically
 * by the nightly RFM-D sync (POST /api/cron/rfm-sync).
 *
 * ACQUIRE → ONBOARD happens on account opening (accountOpenedAt is set).
 * All subsequent transitions are fully automatic.
 */

const STAGE_COLORS: Record<string, string> = {
  ACQUIRE:    "bg-gray-100 text-gray-700",
  ONBOARD:    "bg-blue-50 text-blue-700",
  ACTIVATE:   "bg-amber-50 text-amber-700",
  GROW:       "text-white",
  REACTIVATE: "bg-orange-50 text-orange-700",
};

const STAGE_LABELS: Record<string, string> = {
  ACQUIRE:    "Привлечение",
  ONBOARD:    "Онбординг",
  ACTIVATE:   "Активация",
  GROW:       "Рост",
  REACTIVATE: "Реактивация",
};

type Props = {
  stage: string;
  showLabel?: boolean;   // show "Стадия CLM" prefix
};

export function StageBadge({ stage, showLabel = true }: Props) {
  const isGrow = stage === "GROW";

  return (
    <div className="space-y-1">
      {showLabel && (
        <p className="text-xs text-gray-500 font-medium">Стадия CLM</p>
      )}
      <span
        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${STAGE_COLORS[stage] ?? "bg-gray-100 text-gray-700"}`}
        style={isGrow ? { background: "var(--mbank-green)" } : {}}
        title="Стадия назначается автоматически системой RFM-D Sync"
      >
        {STAGE_LABELS[stage] ?? stage}
      </span>
      <p className="text-[10px] text-gray-400">авто·RFM-D</p>
    </div>
  );
}
