// Конфигурация банковских продуктов и команд (shared between client and server)

export const TEAMS = ["B2B", "KM", "KAM", "VB", "BRANCH"] as const;
export type TeamCode = (typeof TEAMS)[number];

export const TEAM_LABELS: Record<TeamCode, string> = {
  B2B:    "B2B (Микро / ИП)",
  KM:     "КМ (МСБ)",
  KAM:    "KAM",
  VB:     "VB (Вирт. банк)",
  BRANCH: "Филиальная сеть",
};

export const PRODUCT_CODES = [
  "MBUSINESS",
  "MKASSA_POS",
  "MKASSA_QR",
  "ACQUIRING",
  "SALARY_PROJECT",
  "PAYROLL",
  "CORPORATE_CARD",
  "CREDIT",
  "DEPOSIT",
  "TRADE_FINANCE",
] as const;

export type ProductCode = (typeof PRODUCT_CODES)[number];

export const PRODUCT_LABELS: Record<ProductCode, string> = {
  MBUSINESS:      "MBusiness",
  MKASSA_POS:     "MKassa POS",
  MKASSA_QR:      "MKassa QR",
  ACQUIRING:      "Эквайринг",
  SALARY_PROJECT: "ЗП-проект",
  PAYROLL:        "Зарплата",
  CORPORATE_CARD: "Корп. карта",
  CREDIT:         "Кредит",
  DEPOSIT:        "Депозит",
  TRADE_FINANCE:  "Торг. финанс.",
};

export const PRODUCT_ICONS: Record<ProductCode, string> = {
  MBUSINESS:      "📱",
  MKASSA_POS:     "💳",
  MKASSA_QR:      "📷",
  ACQUIRING:      "💰",
  SALARY_PROJECT: "👥",
  PAYROLL:        "💼",
  CORPORATE_CARD: "🪪",
  CREDIT:         "📋",
  DEPOSIT:        "🏦",
  TRADE_FINANCE:  "📦",
};
