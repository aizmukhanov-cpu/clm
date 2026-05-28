import { PrismaClient, CLMStage, CLMCohort, ClientType, TeamType, UserRole } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding...");

  // Филиалы
  const branches = await Promise.all([
    db.branch.upsert({ where: { id: "branch-bishkek" }, update: {}, create: { id: "branch-bishkek", name: "Бишкек Центральный", region: "Бишкек", targetPct: 60 } }),
    db.branch.upsert({ where: { id: "branch-osh" },     update: {}, create: { id: "branch-osh",     name: "Ош",                region: "Ош",     targetPct: 55 } }),
    db.branch.upsert({ where: { id: "branch-karakol" }, update: {}, create: { id: "branch-karakol", name: "Каракол",           region: "Иссык-Куль", targetPct: 50 } }),
  ]);

  console.log(`✓ ${branches.length} branches`);

  // Пользователи (пароль = "password123" — bcrypt hash для теста)
  const PASS = "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0Z9S6YfMp0i";

  const users = await Promise.all([
    db.user.upsert({ where: { email: "admin@mbank.kg" },   update: { team: TeamType.VB }, create: { id: "user-admin",   name: "Адал И.",        email: "admin@mbank.kg",   role: UserRole.ADMIN,    team: TeamType.VB, branchId: "branch-bishkek", passwordHash: PASS } }),
    db.user.upsert({ where: { email: "analyst@mbank.kg" }, update: {}, create: { id: "user-analyst", name: "Айгуль К.",      email: "analyst@mbank.kg", role: UserRole.ANALYST,  team: TeamType.VB,  branchId: "branch-bishkek", passwordHash: PASS } }),
    db.user.upsert({ where: { email: "b2b@mbank.kg" },     update: {}, create: { id: "user-b2b",     name: "Бекзат М.",      email: "b2b@mbank.kg",     role: UserRole.SPECIALIST,  team: TeamType.B2B, branchId: "branch-osh",     passwordHash: PASS } }),
    db.user.upsert({ where: { email: "km@mbank.kg" },      update: {}, create: { id: "user-km",      name: "Динара Т.",      email: "km@mbank.kg",      role: UserRole.SPECIALIST,  team: TeamType.KM,  branchId: "branch-bishkek", passwordHash: PASS } }),
    db.user.upsert({ where: { email: "kam@mbank.kg" },     update: {}, create: { id: "user-kam",     name: "Нурлан О.",      email: "kam@mbank.kg",     role: UserRole.KAM, team: TeamType.KAM,    branchId: "branch-bishkek", passwordHash: PASS } }),
    db.user.upsert({ where: { email: "branch@mbank.kg" }, update: {}, create: { id: "user-branch", name: "Гүлзат Р.",      email: "branch@mbank.kg",  role: UserRole.SPECIALIST,  team: TeamType.BRANCH, branchId: "branch-karakol", passwordHash: PASS } }),
  ]);

  console.log(`✓ ${users.length} users`);

  // Тестовые клиенты
  const clientsData = [
    { inn: "12345678901234", name: 'ОсОО "АлтынТрейд"',      type: ClientType.YL, stage: CLMStage.GROW,       cohort: CLMCohort.ACTIVE,       days: 3,  gmv: 850000,  depth: 60, managerId: "user-km",  kamId: "user-kam",  branch: "branch-bishkek" },
    { inn: "23456789012345", name: 'ОсОО "КыргызМаркет"',    type: ClientType.YL, stage: CLMStage.ACTIVATE,   cohort: CLMCohort.LOW_ACTIVE,   days: 12, gmv: 120000,  depth: 30, managerId: "user-km",  kamId: null,        branch: "branch-bishkek" },
    { inn: "34567890123456", name: "ИП Сатыбалдиев А.К.",    type: ClientType.IP, stage: CLMStage.ONBOARD,    cohort: CLMCohort.NEVER_ACTIVE, days: 5,  gmv: 0,       depth: 10, managerId: "user-b2b", kamId: null,        branch: "branch-osh"     },
    { inn: "45678901234567", name: 'ОсОО "БишкекФуд"',       type: ClientType.YL, stage: CLMStage.REACTIVATE, cohort: CLMCohort.LAPSED,       days: 75, gmv: 320000,  depth: 40, managerId: "user-km",  kamId: "user-kam",  branch: "branch-bishkek" },
    { inn: "56789012345678", name: "ИП Жакыпова Б.Т.",       type: ClientType.IP, stage: CLMStage.ACQUIRE,    cohort: CLMCohort.NEVER_ACTIVE, days: 0,  gmv: 0,       depth: 0,  managerId: "user-b2b", kamId: null,        branch: "branch-osh"     },
    { inn: "67890123456789", name: 'ОсОО "ОшСтрой"',         type: ClientType.YL, stage: CLMStage.GROW,       cohort: CLMCohort.ACTIVE,       days: 1,  gmv: 1200000, depth: 70, managerId: "user-km",  kamId: "user-kam",  branch: "branch-osh"     },
    { inn: "78901234567890", name: "ИП Токтосунов М.А.",     type: ClientType.IP, stage: CLMStage.ACTIVATE,   cohort: CLMCohort.NEVER_ACTIVE, days: 20, gmv: 45000,   depth: 20, managerId: "user-b2b", kamId: null,        branch: "branch-karakol" },
    { inn: "89012345678901", name: 'ОсОО "Каракол Экспорт"', type: ClientType.YL, stage: CLMStage.GROW,       cohort: CLMCohort.ACTIVE,       days: 7,  gmv: 600000,  depth: 50, managerId: "user-km",  kamId: "user-kam",  branch: "branch-karakol" },
    { inn: "90123456789012", name: "ИП Асанов Р.К.",         type: ClientType.IP, stage: CLMStage.ONBOARD,    cohort: CLMCohort.NEVER_ACTIVE, days: 2,  gmv: 0,       depth: 10, managerId: "user-b2b", kamId: null,        branch: "branch-bishkek" },
    { inn: "01234567890123", name: 'ОсОО "Мега Дистрибьюшн"',  type: ClientType.YL, stage: CLMStage.REACTIVATE, cohort: CLMCohort.LAPSED,       days: 90, gmv: 750000,  depth: 60, managerId: "user-km",     kamId: "user-kam",  branch: "branch-bishkek" },
    { inn: "11234567890123", name: 'ОсОО "СевергазКГ"',        type: ClientType.YL, stage: CLMStage.GROW,       cohort: CLMCohort.ACTIVE,       days: 0,  gmv: 2100000, depth: 80, managerId: "user-km",     kamId: "user-kam",  branch: "branch-bishkek" },
    { inn: "21234567890123", name: "ИП Эргешов Т.Б.",          type: ClientType.IP, stage: CLMStage.ACTIVATE,   cohort: CLMCohort.LOW_ACTIVE,   days: 18, gmv: 88000,   depth: 20, managerId: "user-b2b",    kamId: null,        branch: "branch-osh"     },
    // Клиенты специалиста филиала Каракол
    { inn: "31234567890123", name: 'ОсОО "Иссык-Куль Тур"',   type: ClientType.YL, stage: CLMStage.ONBOARD,    cohort: CLMCohort.NEVER_ACTIVE, days: 4,  gmv: 0,       depth: 10, managerId: "user-branch", kamId: null,        branch: "branch-karakol" },
    { inn: "41234567890123", name: "ИП Молдобаев А.С.",        type: ClientType.IP, stage: CLMStage.ACTIVATE,   cohort: CLMCohort.LOW_ACTIVE,   days: 15, gmv: 65000,   depth: 20, managerId: "user-branch", kamId: null,        branch: "branch-karakol" },
    { inn: "51234567890123", name: 'ОсОО "КаракольАгро"',      type: ClientType.YL, stage: CLMStage.GROW,       cohort: CLMCohort.ACTIVE,       days: 2,  gmv: 420000,  depth: 50, managerId: "user-branch", kamId: null,        branch: "branch-karakol" },
  ];

  let clientCount = 0;
  for (const c of clientsData) {
    await db.client.upsert({
      where: { inn: c.inn },
      update: {},
      create: {
        inn: c.inn,
        name: c.name,
        type: c.type,
        clmStage: c.stage,
        clmCohort: c.cohort,
        daysSinceLastTxn: c.days,
        gmv30d: c.gmv,
        productDepthPct: c.depth,
        branchId: c.branch,
        managerId: c.managerId,
        kamId: c.kamId,
        accountOpenedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        hasMBusiness: c.depth > 30,
        hasMKassaPos: c.depth > 50,
        hasMKassaQr: c.depth > 60,
        hasSalaryProject: c.depth > 70,
      },
    });
    clientCount++;
  }

  console.log(`✓ ${clientCount} clients`);

  // Activation tasks для клиентов в ONBOARD
  const onboardClients = await db.client.findMany({ where: { clmStage: CLMStage.ONBOARD } });
  const vbUser = "user-analyst";
  const now = new Date();

  for (const client of onboardClients) {
    const tasks = [
      { day: "D+1",  dueOffset: 1,  priority: "P3" as const, action: "Welcome — помочь с настройкой MBusiness" },
      { day: "D+3",  dueOffset: 3,  priority: "P3" as const, action: "Первая транзакция? Позвонить, убрать барьер" },
      { day: "D+7",  dueOffset: 7,  priority: "P2" as const, action: "Нет транзакций — выяснить причину" },
      { day: "D+14", dueOffset: 14, priority: "P1" as const, action: "Эскалация — нет тр. 14 дней, передать в реактивацию" },
    ];

    for (const t of tasks) {
      const due = new Date(now);
      due.setDate(due.getDate() + t.dueOffset);
      await db.task.create({
        data: {
          clientId: client.id,
          triggerDay: t.day,
          assignedTo: vbUser,
          dueDate: due,
          priority: t.priority,
          action: t.action,
        },
      });
    }
  }

  console.log(`✓ Activation tasks created for ${onboardClients.length} ONBOARD clients`);

  // ── Цели филиалов по продуктам 2026 ───────────────────────────────
  const YEAR = 2026;
  const branchTargets: { branchId: string; product: string; targetCount: number }[] = [
    // Бишкек Центральный — самый крупный, высокие цели
    { branchId: "branch-bishkek", product: "MBUSINESS",       targetCount: 80 },
    { branchId: "branch-bishkek", product: "MKASSA_POS",      targetCount: 60 },
    { branchId: "branch-bishkek", product: "MKASSA_QR",       targetCount: 70 },
    { branchId: "branch-bishkek", product: "SALARY_PROJECT",  targetCount: 45 },
    { branchId: "branch-bishkek", product: "ACQUIRING",       targetCount: 50 },
    { branchId: "branch-bishkek", product: "CREDIT",          targetCount: 30 },
    { branchId: "branch-bishkek", product: "DEPOSIT",         targetCount: 25 },
    { branchId: "branch-bishkek", product: "TRADE_FINANCE",   targetCount: 15 },
    { branchId: "branch-bishkek", product: "PAYROLL",         targetCount: 40 },
    { branchId: "branch-bishkek", product: "CORPORATE_CARD",  targetCount: 55 },
    // Ош
    { branchId: "branch-osh",     product: "MBUSINESS",       targetCount: 50 },
    { branchId: "branch-osh",     product: "MKASSA_POS",      targetCount: 40 },
    { branchId: "branch-osh",     product: "MKASSA_QR",       targetCount: 45 },
    { branchId: "branch-osh",     product: "SALARY_PROJECT",  targetCount: 25 },
    { branchId: "branch-osh",     product: "ACQUIRING",       targetCount: 30 },
    { branchId: "branch-osh",     product: "CREDIT",          targetCount: 18 },
    { branchId: "branch-osh",     product: "DEPOSIT",         targetCount: 15 },
    { branchId: "branch-osh",     product: "TRADE_FINANCE",   targetCount: 8  },
    { branchId: "branch-osh",     product: "PAYROLL",         targetCount: 22 },
    { branchId: "branch-osh",     product: "CORPORATE_CARD",  targetCount: 30 },
    // Каракол
    { branchId: "branch-karakol", product: "MBUSINESS",       targetCount: 30 },
    { branchId: "branch-karakol", product: "MKASSA_POS",      targetCount: 25 },
    { branchId: "branch-karakol", product: "MKASSA_QR",       targetCount: 28 },
    { branchId: "branch-karakol", product: "SALARY_PROJECT",  targetCount: 15 },
    { branchId: "branch-karakol", product: "ACQUIRING",       targetCount: 18 },
    { branchId: "branch-karakol", product: "CREDIT",          targetCount: 10 },
    { branchId: "branch-karakol", product: "DEPOSIT",         targetCount: 10 },
    { branchId: "branch-karakol", product: "TRADE_FINANCE",   targetCount: 5  },
    { branchId: "branch-karakol", product: "PAYROLL",         targetCount: 12 },
    { branchId: "branch-karakol", product: "CORPORATE_CARD",  targetCount: 18 },
  ];

  for (const t of branchTargets) {
    await db.branchProductTarget.upsert({
      where: { branchId_product_year_month: { branchId: t.branchId, product: t.product, year: YEAR, month: 1 } },
      update: { targetCount: t.targetCount },
      create: { ...t, year: YEAR, month: 1 },
    });
  }
  console.log(`✓ Branch product targets seeded (${branchTargets.length} rows)`);

  console.log("\nDone! 🎉");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
