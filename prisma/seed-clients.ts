/**
 * seed-clients.ts — генерирует 200 тестовых клиентов с консистентными RFM-данными.
 *
 * Правила консистентности:
 *   1. daysSinceLastTxn >= 30  →  txnCount30d = 0, gmv30d = 0
 *   2. txnCount30d = 0         →  gmv30d = 0
 *   3. txnCount30d > 0         →  daysSinceLastTxn < 30, gmv30d > 0
 *
 * Когорта обязана соответствовать clm-rules.ts:
 *   txnCount30d >= 3                  → ACTIVE
 *   txnCount30d 1–2                   → LOW_ACTIVE
 *   txnCount30d = 0, days >= 60       → LAPSED
 *   txnCount30d = 0, days < 60        → NEVER_ACTIVE
 *
 * Определение "активного клиента" для дашборда:
 *   txnCount30d >= 1 AND gmv30d > 100 сом
 */

import { PrismaClient, CLMStage, CLMCohort, ClientType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

// ─── Справочники ──────────────────────────────────────────

const YL_NAMES = [
  "АлтынТрейд", "КыргызМаркет", "БишкекФуд", "ОшСтрой", "КаракольЭкспорт",
  "МегаДистрибьюшн", "СевергазКГ", "АзияЛогистик", "ТяньШаньГрупп", "ФрунзеТрейдинг",
  "КыргызТекстиль", "АлаТооФарм", "БишкекАвто", "ОшМеталл", "НарынАгро",
  "ТалассСтрой", "БаткенТрейд", "ИссыкКульФуд", "ЧуйАгроСервис", "КантТекстиль",
  "КарабалтаХим", "ТокмокАвто", "КемпирАбадЛогистик", "ДжалалАбадФуд", "УзгенАгро",
  "КаракульТрейд", "ОшБазарГрупп", "БишкекМедСервис", "АлаАрчаСтрой", "КоктерекЭнерго",
  "КыргызЭкспорт", "МанасТрейдинг", "ЭпкинСервис", "БаткенАгро", "ЛейлекТрейд",
  "КадамджайМеталл", "СулюктаЭнерго", "АйтекеБиТрейд", "КочкорАгро", "АтБашыФуд",
];

const IP_NAMES = [
  "Асанов Р.К.", "Токтосунов М.А.", "Жакыпова Б.Т.", "Сатыбалдиев А.К.", "Эргешов Т.Б.",
  "Мамытбеков С.Д.", "Исаева Г.А.", "Борубаев Н.Т.", "Кадырова З.М.", "Усубалиев А.Э.",
  "Тагаев Б.К.", "Джумалиева Р.С.", "Абдыкалыков М.У.", "Турдубаева А.Б.", "Жунусов К.Т.",
  "Осмонова Г.А.", "Байзаков Э.Н.", "Салиева Н.К.", "Мирзаев А.Т.", "Дооронбекова Г.С.",
  "Молдокматов Б.А.", "Урматова А.Р.", "Шаршенов К.Д.", "Бекова М.Т.", "Назаров С.А.",
  "Иманалиев Т.Б.", "Жолдошева Г.К.", "Акматов Р.А.", "Токторова А.С.", "Калматов Б.Н.",
  "Дуйшенов К.А.", "Айтиева Ж.М.", "Боромбаев Т.К.", "Жээнбекова А.А.", "Кудайбергенов М.С.",
  "Батырканова Г.Т.", "Тилекматов А.Б.", "Исмаилова Р.К.", "Омуров Н.А.", "Сейткалиева Г.Д.",
];

const BRANCHES = ["branch-bishkek", "branch-osh", "branch-karakol"];
const MANAGERS  = { B2B: "user-b2b", KM: "user-km", KAM: "user-kam" };

// ─── Распределение стадий ─────────────────────────────────
// [stage, cohort, weight]
const STAGE_WEIGHTS: [CLMStage, CLMCohort, number][] = [
  [CLMStage.ACQUIRE,    CLMCohort.NEVER_ACTIVE, 15],
  [CLMStage.ONBOARD,    CLMCohort.NEVER_ACTIVE, 10],
  [CLMStage.ACTIVATE,   CLMCohort.NEVER_ACTIVE,  8],
  [CLMStage.ACTIVATE,   CLMCohort.LOW_ACTIVE,   12],
  [CLMStage.ACTIVATE,   CLMCohort.ACTIVE,        5],
  [CLMStage.GROW,       CLMCohort.ACTIVE,        25],
  [CLMStage.GROW,       CLMCohort.LOW_ACTIVE,     8],
  [CLMStage.REACTIVATE, CLMCohort.LAPSED,        17],
];

function weightedPick(weights: [CLMStage, CLMCohort, number][]): [CLMStage, CLMCohort] {
  const total = weights.reduce((s, [, , w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [stage, cohort, w] of weights) {
    r -= w;
    if (r <= 0) return [stage, cohort];
  }
  return [weights[0][0], weights[0][1]];
}

function ri(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Консистентная генерация RFM ──────────────────────────

type RFM = {
  txnCount30d:      number;
  gmv30d:           number;
  daysSinceLastTxn: number;
};

/**
 * Генерирует согласованные RFM-метрики по стадии и когорте.
 *
 * Инварианты:
 *  - Если daysSinceLastTxn >= 30 → txnCount30d = 0 И gmv30d = 0
 *  - Если txnCount30d = 0 → gmv30d = 0
 *  - Когорта вычисляется из txnCount30d/daysSinceLastTxn по правилам clm-rules.ts
 */
function generateRFM(stage: CLMStage, cohort: CLMCohort): RFM {
  switch (cohort) {

    // ── ACTIVE: txnCount ≥ 3, последняя тр. в последние 14 дней ──
    case CLMCohort.ACTIVE: {
      const txnCount30d = stage === CLMStage.GROW ? ri(5, 25) : ri(3, 8);
      // GMV пропорционален транзакциям и стадии
      const perTxn = stage === CLMStage.GROW
        ? ri(50_000, 200_000)   // крупный бизнес
        : ri(5_000, 40_000);    // средний
      const gmv30d          = txnCount30d * perTxn;
      const daysSinceLastTxn = ri(0, 13);
      return { txnCount30d, gmv30d, daysSinceLastTxn };
    }

    // ── LOW_ACTIVE: txnCount 1–2, последняя тр. в последние 25 дней ──
    case CLMCohort.LOW_ACTIVE: {
      const txnCount30d = ri(1, 2);
      const perTxn = stage === CLMStage.GROW
        ? ri(30_000, 120_000)
        : ri(500, 15_000);
      const gmv30d          = txnCount30d * perTxn;
      const daysSinceLastTxn = ri(1, 25);   // должно быть < 30
      return { txnCount30d, gmv30d, daysSinceLastTxn };
    }

    // ── LAPSED: 0 транзакций, > 60 дней без активности ──
    case CLMCohort.LAPSED: {
      return {
        txnCount30d:       0,
        gmv30d:            0,         // последние 30д — ноль
        daysSinceLastTxn:  ri(61, 180),
      };
    }

    // ── NEVER_ACTIVE: 0 транзакций, нет истории ──
    case CLMCohort.NEVER_ACTIVE:
    default: {
      // ONBOARD: счёт открыт недавно, ещё не начал транзачить
      // ACTIVATE: был переведён вручную, ещё не сделал первую тр.
      // ACQUIRE:  ещё не клиент
      const daysSinceLastTxn = stage === CLMStage.ACQUIRE
        ? 0
        : stage === CLMStage.ONBOARD
          ? ri(0, 7)
          : ri(1, 45);   // ACTIVATE с NEVER_ACTIVE — ждём первую тр.
      return {
        txnCount30d:       0,
        gmv30d:            0,
        daysSinceLastTxn,
      };
    }
  }
}

// ─── Продуктовая карта ────────────────────────────────────

const ALL_PRODUCTS = [
  "hasMBusiness", "hasMKassaPos", "hasMKassaQr",
  "hasSalaryProject", "hasAcquiring", "hasCredit",
  "hasDeposit", "hasTradeFinance", "hasPayroll", "hasCorporateCard",
] as const;

type ProductFlags = Record<typeof ALL_PRODUCTS[number], boolean>;

/**
 * Генерирует продуктовые флаги, согласованные со стадией.
 * ACQUIRE/ONBOARD — почти ничего. GROW — богатый профиль.
 * Продукты назначаются детерминированно через набор «профилей»,
 * не случайным порогом, чтобы избежать несогласованного depth%.
 */
function generateProducts(stage: CLMStage, cohort: CLMCohort): ProductFlags & { productDepthPct: number } {
  // Сколько продуктов у клиента
  const maxDepth = ALL_PRODUCTS.length;
  let count: number;

  if (stage === CLMStage.ACQUIRE)    count = 0;
  else if (stage === CLMStage.ONBOARD) count = ri(0, 1);
  else if (stage === CLMStage.ACTIVATE) {
    count = cohort === CLMCohort.NEVER_ACTIVE ? ri(0, 2) : ri(1, 3);
  }
  else if (stage === CLMStage.GROW) {
    count = cohort === CLMCohort.ACTIVE ? ri(4, maxDepth) : ri(2, 5);
  }
  else /* REACTIVATE */ {
    count = ri(1, 4);
  }

  // Перемешиваем продукты и берём первые count
  const shuffled = [...ALL_PRODUCTS].sort(() => Math.random() - 0.5);
  const active   = new Set(shuffled.slice(0, count));

  const flags = Object.fromEntries(
    ALL_PRODUCTS.map((k) => [k, active.has(k)])
  ) as ProductFlags;

  const productDepthPct = Math.round((count / maxDepth) * 100);

  return { ...flags, productDepthPct };
}

// ─── ИНН ─────────────────────────────────────────────────

function genInn(index: number): string {
  const base = (90000000000000 + index * 7919).toString();
  return base.slice(0, 14).padEnd(14, "0");
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log("Генерирую 200 тестовых клиентов с консистентными RFM-данными...\n");

  // Удаляем старых тестовых клиентов (INN начинается с 9)
  const oldClients = await db.client.findMany({
    where:  { inn: { startsWith: "9" } },
    select: { id: true },
  });
  if (oldClients.length > 0) {
    const ids = oldClients.map((c) => c.id);
    await db.task.deleteMany({ where: { clientId: { in: ids } } });
    await db.activity.deleteMany({ where: { clientId: { in: ids } } });
    await db.changelog.deleteMany({ where: { clientId: { in: ids } } });
    await db.deal.deleteMany({ where: { clientId: { in: ids } } });
    await db.client.deleteMany({ where: { id: { in: ids } } });
    console.log(`  ✗ удалено ${oldClients.length} старых тестовых клиентов`);
  }

  let created = 0;
  const onboardIds: string[] = [];
  // id клиента → id KAM (для задач)
  const kamClientMap: { clientId: string; kamId: string; stage: CLMStage; cohort: CLMCohort }[] = [];

  // Статистика для проверки
  const check = {
    rfmViolations: 0,
    segments: { active: 0, lowActive: 0, atRisk: 0, lapsed: 0, never: 0 },
  };

  for (let i = 0; i < 200; i++) {
    const isYL     = Math.random() > 0.45;
    const type     = isYL ? ClientType.YL : ClientType.IP;
    const nameList = isYL ? YL_NAMES : IP_NAMES;
    const baseName = nameList[i % nameList.length];
    const name     = isYL ? `ОсОО "${baseName} ${i + 1}"` : `ИП ${baseName}`;
    const inn      = genInn(i + 1000);

    const [stage, cohort] = weightedPick(STAGE_WEIGHTS);
    const rfm      = generateRFM(stage, cohort);
    const products = generateProducts(stage, cohort);
    const branch   = BRANCHES[i % BRANCHES.length];

    // Проверка инвариантов (для отладки)
    if (rfm.daysSinceLastTxn >= 30 && (rfm.txnCount30d > 0 || rfm.gmv30d > 0)) {
      check.rfmViolations++;
    }
    if (rfm.txnCount30d === 0 && rfm.gmv30d > 0) {
      check.rfmViolations++;
    }

    // Дашборд-сегменты
    if (rfm.txnCount30d >= 1 && rfm.gmv30d > 100)         check.segments.active++;
    else if (rfm.txnCount30d >= 1 && rfm.gmv30d <= 100)   check.segments.lowActive++;
    else if (rfm.txnCount30d === 0 && rfm.daysSinceLastTxn >= 1 && rfm.daysSinceLastTxn <= 60) check.segments.atRisk++;
    else if (rfm.txnCount30d === 0 && rfm.daysSinceLastTxn > 60)  check.segments.lapsed++;
    else                                                           check.segments.never++;

    // KAM только для GROW/REACTIVATE с крупным GMV
    const needsKam = (stage === CLMStage.GROW || stage === CLMStage.REACTIVATE) && rfm.gmv30d > 300_000;
    const managerId = isYL ? MANAGERS.KM : MANAGERS.B2B;
    const kamId     = needsKam ? MANAGERS.KAM : null;

    const accountOpenedAt = new Date(
      Date.now() - ri(30, 730) * 24 * 60 * 60 * 1000
    );

    const client = await db.client.create({
      data: {
        inn,
        name,
        type,
        clmStage:         stage,
        clmCohort:        cohort,
        txnCount30d:      rfm.txnCount30d,
        gmv30d:           rfm.gmv30d,
        daysSinceLastTxn: rfm.daysSinceLastTxn,
        productDepthPct:  products.productDepthPct,
        branchId:         branch,
        managerId,
        kamId,
        accountOpenedAt,
        // Продуктовая карта
        hasMBusiness:     products.hasMBusiness,
        hasMKassaPos:     products.hasMKassaPos,
        hasMKassaQr:      products.hasMKassaQr,
        hasSalaryProject: products.hasSalaryProject,
        hasAcquiring:     products.hasAcquiring,
        hasCredit:        products.hasCredit,
        hasDeposit:       products.hasDeposit,
        hasTradeFinance:  products.hasTradeFinance,
        hasPayroll:       products.hasPayroll,
        hasCorporateCard: products.hasCorporateCard,
      },
    });

    if (stage === CLMStage.ONBOARD) onboardIds.push(client.id);
    if (kamId) kamClientMap.push({ clientId: client.id, kamId, stage, cohort });
    created++;
  }

  console.log(`✓ создано ${created} клиентов`);
  console.log(`  Нарушений RFM-инвариантов: ${check.rfmViolations}`);
  console.log("\nДашборд-сегменты активности:");
  const total = created;
  const seg   = check.segments;
  console.log(`  🟢 Активные        (≥1 тр. >100 сом): ${seg.active.toString().padStart(3)} (${Math.round(seg.active / total * 100)}%)`);
  console.log(`  🟡 Мало транзачат  (≥1 тр. ≤100 сом): ${seg.lowActive.toString().padStart(3)} (${Math.round(seg.lowActive / total * 100)}%)`);
  console.log(`  🟠 Под риском      (0 тр., 1–60 дней): ${seg.atRisk.toString().padStart(3)} (${Math.round(seg.atRisk / total * 100)}%)`);
  console.log(`  🔴 Отток           (0 тр., >60 дней): ${seg.lapsed.toString().padStart(3)} (${Math.round(seg.lapsed / total * 100)}%)`);
  console.log(`  ⚫ Не начали       (нет транзакций):  ${seg.never.toString().padStart(3)} (${Math.round(seg.never / total * 100)}%)`);

  // ── Activation Tasks для ONBOARD клиентов ──
  const vbUser   = "user-analyst";
  const now      = new Date();
  let taskCount  = 0;

  for (const clientId of onboardIds) {
    const tasks = [
      { day: "D+1",  offset: 1,  priority: "P3" as const, action: "Welcome — помочь с настройкой MBusiness" },
      { day: "D+3",  offset: 3,  priority: "P3" as const, action: "Первая транзакция? Позвонить, убрать барьер" },
      { day: "D+7",  offset: 7,  priority: "P2" as const, action: "Нет транзакций — выяснить причину" },
      { day: "D+14", offset: 14, priority: "P1" as const, action: "Эскалация — нет тр. 14 дней, передать в реактивацию" },
    ];
    for (const t of tasks) {
      const due = new Date(now);
      due.setDate(due.getDate() + t.offset);
      await db.task.create({
        data: {
          clientId,
          triggerDay: t.day,
          assignedTo: vbUser,
          dueDate:    due,
          priority:   t.priority,
          action:     t.action,
        },
      });
      taskCount++;
    }
  }

  console.log(`✓ activation tasks: ${taskCount} для ${onboardIds.length} ONBOARD клиентов`);

  // ── KAM Tasks ─────────────────────────────────────────────
  // Шаблоны задач по стадии и когорте

  type TaskTemplate = { priority: "P1"|"P2"|"P3"; action: string; daysOffset: number };

  const KAM_TASK_TEMPLATES: Record<string, TaskTemplate[]> = {
    // GROW + ACTIVE — крупный клиент, нужны регулярные встречи
    "GROW_ACTIVE": [
      { priority: "P2", action: "Квартальный обзор портфеля — подготовить аналитику по продуктам", daysOffset: ri(5, 30) },
      { priority: "P3", action: "Апсейл Trade Finance — отправить КП по аккредитивам",             daysOffset: ri(10, 21) },
      { priority: "P3", action: "Предложить корпоративную карту — демо МБизнес Бизнес Карта",       daysOffset: ri(14, 45) },
    ],
    // GROW + LOW_ACTIVE — было хорошо, сейчас проседает
    "GROW_LOW_ACTIVE": [
      { priority: "P2", action: "Звонок: анализ причин снижения транзакционной активности",        daysOffset: ri(1, 7)  },
      { priority: "P2", action: "Встреча: предложить оптимизацию расчётного обслуживания",         daysOffset: ri(7, 14) },
    ],
    // REACTIVATE + LAPSED — клиент ушёл, нужен срочный контакт
    "REACTIVATE_LAPSED": [
      { priority: "P1", action: "СРОЧНО: реактивационный звонок — выяснить причину ухода",        daysOffset: ri(1, 3)  },
      { priority: "P1", action: "Предложить индивидуальные условия по РКО и эквайрингу",           daysOffset: ri(3, 7)  },
      { priority: "P2", action: "Подготовить retention-оффер: снижение комиссий на 3 месяца",      daysOffset: ri(5, 10) },
    ],
    // ACTIVATE + ACTIVE/LOW_ACTIVE — новый клиент с KAM
    "ACTIVATE_ACTIVE": [
      { priority: "P2", action: "Установочная встреча — презентация корпоративных продуктов",      daysOffset: ri(3, 10) },
      { priority: "P3", action: "Онбординг: помочь с настройкой зарплатного проекта",              daysOffset: ri(7, 21) },
    ],
    "ACTIVATE_LOW_ACTIVE": [
      { priority: "P2", action: "Первый контакт — звонок по активности и барьерам",                daysOffset: ri(1, 5)  },
      { priority: "P2", action: "Демо МБизнес: показать ключевые функции для МСБ",                 daysOffset: ri(5, 14) },
    ],
    "ACTIVATE_NEVER_ACTIVE": [
      { priority: "P1", action: "ПРИОРИТЕТ: клиент не начал транзачить — срочный контакт",         daysOffset: ri(1, 3)  },
      { priority: "P2", action: "Обсудить барьеры к первой транзакции — встреча или звонок",        daysOffset: ri(3, 7)  },
    ],
    // По умолчанию
    "DEFAULT": [
      { priority: "P2", action: "Плановый контакт — обзор потребностей клиента",                   daysOffset: ri(7, 21) },
    ],
  };

  function getTemplateKey(stage: CLMStage, cohort: CLMCohort): string {
    if (stage === CLMStage.GROW      && cohort === CLMCohort.ACTIVE)       return "GROW_ACTIVE";
    if (stage === CLMStage.GROW      && cohort === CLMCohort.LOW_ACTIVE)   return "GROW_LOW_ACTIVE";
    if (stage === CLMStage.REACTIVATE)                                     return "REACTIVATE_LAPSED";
    if (stage === CLMStage.ACTIVATE  && cohort === CLMCohort.ACTIVE)       return "ACTIVATE_ACTIVE";
    if (stage === CLMStage.ACTIVATE  && cohort === CLMCohort.LOW_ACTIVE)   return "ACTIVATE_LOW_ACTIVE";
    if (stage === CLMStage.ACTIVATE  && cohort === CLMCohort.NEVER_ACTIVE) return "ACTIVATE_NEVER_ACTIVE";
    return "DEFAULT";
  }

  let kamTaskCount = 0;

  for (const { clientId, kamId, stage, cohort } of kamClientMap) {
    const key       = getTemplateKey(stage, cohort);
    const templates = KAM_TASK_TEMPLATES[key] ?? KAM_TASK_TEMPLATES["DEFAULT"];

    // Берём 1–2 задачи (не все) чтобы не перегружать список
    const count   = Math.min(templates.length, ri(1, 2));
    const picked  = templates.slice(0, count);

    for (const t of picked) {
      const due = new Date(now);
      due.setDate(due.getDate() + t.daysOffset);
      await db.task.create({
        data: {
          clientId,
          assignedTo: kamId,
          dueDate:    due,
          priority:   t.priority,
          action:     t.action,
          triggerDay: "KAM",
        },
      });
      kamTaskCount++;
    }
  }

  console.log(`✓ KAM tasks: ${kamTaskCount} для ${kamClientMap.length} KAM-клиентов`);

  // ── Итоговая таблица по стадиям ──
  const stats = await db.client.groupBy({
    by:    ["clmStage"],
    _count: { id: true },
    where:  { inn: { startsWith: "9" } },
  });
  console.log("\nРаспределение по CLM-стадиям:");
  stats
    .sort((a, b) => a.clmStage.localeCompare(b.clmStage))
    .forEach((s) => console.log(`  ${s.clmStage.padEnd(12)} ${s._count.id}`));

  console.log("\n✅ Готово!\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
