// No Prisma imports — safe for client components

export const ALLOWED: Record<string, string[]> = {
  ACQUIRE:    ["ONBOARD"],
  ONBOARD:    ["ACTIVATE", "REACTIVATE"], // REACTIVATE: клиент завис без транзакций
  ACTIVATE:   ["GROW", "REACTIVATE"],     // REACTIVATE: клиент ушёл из активации
  GROW:       ["REACTIVATE"],
  REACTIVATE: ["ACTIVATE"],
};

export const STAGE_LABELS: Record<string, string> = {
  ACQUIRE:    "Привлечение",
  ONBOARD:    "Онбординг",
  ACTIVATE:   "Активация",
  GROW:       "Рост",
  REACTIVATE: "Реактивация",
};

export const STAGE_COLORS: Record<string, string> = {
  ACQUIRE:    "bg-gray-100 text-gray-700",
  ONBOARD:    "bg-blue-50 text-blue-700",
  ACTIVATE:   "bg-amber-50 text-amber-700",
  GROW:       "text-white",
  REACTIVATE: "bg-orange-50 text-orange-700",
};
