/** KYC checklist items — plain config, no "use server" */
export const KYC_ITEMS = [
  { key: "INN_CONFIRMED",     label: "ИНН подтверждён" },
  { key: "CHARTER",           label: "Устав / учредительные документы" },
  { key: "PASSPORT_DIRECTOR", label: "Паспорт директора" },
  { key: "BENEFICIAL_OWNER",  label: "Бенефициарный владелец" },
  { key: "TAX_REG",           label: "Свидетельство о налоговой регистрации" },
  { key: "AML_CLEAR",         label: "AML-проверка пройдена" },
  { key: "ADDRESS_CONFIRMED", label: "Юридический адрес подтверждён" },
] as const;

export type KYCItemKey = (typeof KYC_ITEMS)[number]["key"];
