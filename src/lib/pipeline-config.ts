// ─── KM Pipeline (МСБ — менеджеры КМ) ───────────────────
export type PipelineStage =
  | "QUALIFY"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "CLOSE";

export const PIPELINE_STAGES: PipelineStage[] = [
  "QUALIFY",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSE",
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  QUALIFY:     "Квалификация",
  PROPOSAL:    "КП отправлено",
  NEGOTIATION: "Переговоры",
  CLOSE:       "Финализация",
};

export const STAGE_COLORS: Record<PipelineStage, { bg: string; text: string; border: string }> = {
  QUALIFY:     { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" },
  PROPOSAL:    { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  NEGOTIATION: { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  CLOSE:       { bg: "var(--mbank-green-pale)", text: "var(--mbank-green)", border: "#86efac" },
};

export function nextStage(stage: PipelineStage): PipelineStage | null {
  const idx = PIPELINE_STAGES.indexOf(stage);
  return idx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[idx + 1] : null;
}

// ─── B2B Pipeline (Микро и ИП — полевые продажи) ────────
// Нет КП — встречаются на точке, сразу подают документы
export type B2BStage = "QUALIFY" | "VISIT" | "DOCS" | "CLOSE";

export const B2B_STAGES: B2BStage[] = ["QUALIFY", "VISIT", "DOCS", "CLOSE"];

export const B2B_STAGE_LABELS: Record<B2BStage, string> = {
  QUALIFY: "Квалификация",
  VISIT:   "Встреча",
  DOCS:    "Документы",
  CLOSE:   "Финализация",
};

export const B2B_STAGE_COLORS: Record<B2BStage, { bg: string; text: string; border: string }> = {
  QUALIFY: { bg: "#f3f4f6", text: "#374151",               border: "#e5e7eb" },
  VISIT:   { bg: "#f0fdf4", text: "#15803d",               border: "#bbf7d0" },
  DOCS:    { bg: "#fffbeb", text: "#d97706",               border: "#fde68a" },
  CLOSE:   { bg: "var(--mbank-green-pale)", text: "var(--mbank-green)", border: "#86efac" },
};

export function nextB2BStage(stage: B2BStage): B2BStage | null {
  const idx = B2B_STAGES.indexOf(stage);
  return idx < B2B_STAGES.length - 1 ? B2B_STAGES[idx + 1] : null;
}

// ─── B2B Products (продукты для Микро/ИП) ───────────────
export type B2BProduct = {
  key: string;
  label: string;
  icon: string;
};

export const B2B_PRODUCTS: B2BProduct[] = [
  { key: "rko",      label: "Расч. счёт",   icon: "🏦" },
  { key: "mbiz",     label: "МБизнес",       icon: "📱" },
  { key: "pos",      label: "МКасса POS",    icon: "💳" },
  { key: "qr",       label: "МКасса QR",     icon: "📷" },
  { key: "acquiring",label: "Эквайринг",     icon: "💰" },
  { key: "credit",   label: "Кредит",        icon: "📋" },
  { key: "salary",   label: "ЗП-проект",     icon: "👥" },
  { key: "card",     label: "Корп. карта",   icon: "🪪" },
];

// ─── KM Products (продукты для МСБ — сложные корпоративные) ─
export type KMProduct = {
  key: string;
  label: string;
  icon: string;
  category: "rko" | "credit" | "trade" | "cash" | "other";
};

export const KM_PRODUCTS: KMProduct[] = [
  // РКО / базовое
  { key: "rko",          label: "РКО / Счёт",          icon: "🏦", category: "rko"    },
  { key: "mbiz",         label: "МБизнес",              icon: "📱", category: "rko"    },
  // Кредитные продукты
  { key: "credit_line",  label: "Кредитная линия",      icon: "📊", category: "credit" },
  { key: "overdraft",    label: "Овердрафт",            icon: "⚡", category: "credit" },
  { key: "invest",       label: "Инвест. кредит",       icon: "📋", category: "credit" },
  { key: "leasing",      label: "Лизинг",               icon: "🚛", category: "credit" },
  { key: "factoring",    label: "Факторинг",             icon: "🔄", category: "credit" },
  // Trade Finance
  { key: "guarantee",    label: "Банк. гарантия",       icon: "🛡️", category: "trade"  },
  { key: "accreditive",  label: "Аккредитив",           icon: "📄", category: "trade"  },
  // Cash management
  { key: "salary",       label: "ЗП-проект",            icon: "👥", category: "cash"   },
  { key: "acquiring",    label: "Эквайринг",            icon: "💳", category: "cash"   },
  { key: "deposit",      label: "Депозит",              icon: "💰", category: "cash"   },
];

export const KM_CATEGORY_LABELS: Record<string, string> = {
  rko:    "РКО",
  credit: "Кредиты",
  trade:  "Trade Finance",
  cash:   "Расчёты",
  other:  "Прочее",
};

// ─── Branch Pipeline (Филиалы — продуктовые сделки) ─────
// Клиенты приходят в офис или менеджер активно кросс-продаёт

export type BranchStage = "CONTACT" | "CONSULT" | "APPLICATION" | "CLOSE";

export const BRANCH_STAGES: BranchStage[] = [
  "CONTACT",
  "CONSULT",
  "APPLICATION",
  "CLOSE",
];

export const BRANCH_STAGE_LABELS: Record<BranchStage, string> = {
  CONTACT:     "Контакт",
  CONSULT:     "Консультация",
  APPLICATION: "Заявка",
  CLOSE:       "Финализация",
};

export const BRANCH_STAGE_COLORS: Record<BranchStage, { bg: string; text: string; border: string }> = {
  CONTACT:     { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" },
  CONSULT:     { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  APPLICATION: { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  CLOSE:       { bg: "var(--mbank-green-pale)", text: "var(--mbank-green)", border: "#86efac" },
};

export function nextBranchStage(stage: BranchStage): BranchStage | null {
  const idx = BRANCH_STAGES.indexOf(stage);
  return idx < BRANCH_STAGES.length - 1 ? BRANCH_STAGES[idx + 1] : null;
}

// ─── Branch Products ─────────────────────────────────────
export const BRANCH_PRODUCTS = [
  { key: "mbusiness",      label: "MBusiness",      icon: "📱" },
  { key: "mkassa_pos",     label: "MKassa POS",      icon: "💳" },
  { key: "mkassa_qr",      label: "MKassa QR",       icon: "📷" },
  { key: "salary_project", label: "Зарплатный пр.",  icon: "👥" },
  { key: "acquiring",      label: "Эквайринг",       icon: "💰" },
  { key: "credit",         label: "Кредит",          icon: "📋" },
  { key: "deposit",        label: "Депозит",         icon: "🏦" },
  { key: "trade_finance",  label: "Торг. финансир.", icon: "🔄" },
  { key: "payroll",        label: "Payroll",         icon: "💼" },
  { key: "corporate_card", label: "Корп. карта",     icon: "🪪" },
];

export const TEAM_LABELS: Record<string, string> = {
  B2B:    "B2B — Микро и ИП",
  KM:     "KM — МСБ",
  BRANCH: "Филиал",
};
