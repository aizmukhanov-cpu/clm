import { PrismaClient, TeamType, UserRole } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const PASS = "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0Z9S6YfMp0i"; // password123

async function main() {
  // ─── 1. Новые пользователи ─────────────────────────────

  const newUsers = [
    // B2B команда (+3)
    { id: "user-b2b-2", name: "Улан Асанов",    email: "u.asanov@mbank.kg",   role: UserRole.MANAGER,  team: TeamType.B2B, branchId: "branch-osh"     },
    { id: "user-b2b-3", name: "Жамал Касымова", email: "j.kasymova@mbank.kg", role: UserRole.MANAGER,  team: TeamType.B2B, branchId: "branch-karakol" },
    { id: "user-b2b-4", name: "Эрмек Бакытов",  email: "e.bakytov@mbank.kg",  role: UserRole.MANAGER,  team: TeamType.B2B, branchId: "branch-bishkek" },
    // KM команда (+3)
    { id: "user-km-2",  name: "Айбек Дуйшенов", email: "a.duyshenov@mbank.kg",role: UserRole.MANAGER,  team: TeamType.KM,  branchId: "branch-bishkek" },
    { id: "user-km-3",  name: "Мадина Сейткали",email: "m.seytkali@mbank.kg", role: UserRole.MANAGER,  team: TeamType.KM,  branchId: "branch-osh"     },
    { id: "user-km-4",  name: "Жыргал Токтогул",email: "j.toktogul@mbank.kg", role: UserRole.MANAGER,  team: TeamType.KM,  branchId: "branch-karakol" },
    // KAM команда (+3)
    { id: "user-kam-2", name: "Самат Нурланов", email: "s.nurlanov@mbank.kg", role: UserRole.KAM_ROLE, team: TeamType.KAM, branchId: "branch-bishkek" },
    { id: "user-kam-3", name: "Бурул Акматова", email: "b.akmatova@mbank.kg", role: UserRole.KAM_ROLE, team: TeamType.KAM, branchId: "branch-osh"     },
    { id: "user-kam-4", name: "Акылай Жакшылык",email: "a.jakshylyk@mbank.kg",role: UserRole.KAM_ROLE, team: TeamType.KAM, branchId: "branch-karakol" },
  ];

  for (const u of newUsers) {
    await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash: PASS },
    });
    console.log(`  + ${u.name} (${u.team})`);
  }
  console.log(`✓ ${newUsers.length} новых пользователей добавлено`);

  // ─── 2. Перераспределение клиентов ────────────────────
  //
  //  Адал (user-admin, KAM) → топовые клиенты по GMV (его портфель #1)
  //  Остальные KAM/Manager → равномерно

  const assignments: Record<string, { managerId?: string; kamId?: string | null }> = {
    // Адал берёт ТОП-3 по GMV как KAM — портфель #1
    "11234567890123": { kamId: "user-admin", managerId: "user-km-2"  }, // СевергазКГ    2.1M
    "67890123456789": { kamId: "user-admin", managerId: "user-km-3"  }, // ОшСтрой       1.2M
    "12345678901234": { kamId: "user-admin", managerId: "user-km"    }, // АлтынТрейд    850K
    "01234567890123": { kamId: "user-admin", managerId: "user-km-4"  }, // Мега Дистриб. 750K

    // Остальные KAM клиенты → по новым KAM
    "89012345678901": { kamId: "user-kam-2", managerId: "user-km-2"  }, // Каракол Экспорт 600K
    "45678901234567": { kamId: "user-kam-3", managerId: "user-km-3"  }, // БишкекФуд       320K

    // B2B клиенты → раскидываем по новым B2B менеджерам
    "34567890123456": { managerId: "user-b2b-2" }, // ИП Сатыбалдиев
    "56789012345678": { managerId: "user-b2b-3" }, // ИП Жакыпова
    "78901234567890": { managerId: "user-b2b-4" }, // ИП Токтосунов
    "90123456789012": { managerId: "user-b2b-2" }, // ИП Асанов
    "21234567890123": { managerId: "user-b2b-3" }, // ИП Эргешов

    // KM клиенты → оставшийся
    "23456789012345": { managerId: "user-km-4"  }, // КыргызМаркет
  };

  let updated = 0;
  for (const [inn, data] of Object.entries(assignments)) {
    await db.client.update({
      where: { inn },
      data,
    });
    updated++;
  }
  console.log(`✓ ${updated} клиентов перераспределено`);

  // ─── 3. Проверка портфеля Адала ───────────────────────
  const adalPortfolio = await db.client.findMany({
    where: { kamId: "user-admin" },
    select: { name: true, gmv30d: true },
    orderBy: { gmv30d: "desc" },
  });

  console.log("\n📊 Портфель Адала (KAM):");
  let totalGMV = 0;
  for (const c of adalPortfolio) {
    console.log(`  ${c.name.padEnd(30)} GMV: ${(c.gmv30d / 1000).toFixed(0)}K`);
    totalGMV += c.gmv30d;
  }
  console.log(`  ${"ИТОГО".padEnd(30)} GMV: ${(totalGMV / 1000).toFixed(0)}K`);

  // Сравнение с другими KAM
  const allKams = await db.user.findMany({
    where: { role: UserRole.KAM_ROLE },
    include: { kamClients: { select: { gmv30d: true } } },
  });
  // добавим Адала
  const adalGMV = totalGMV;
  console.log("\n🏆 Рейтинг KAM по GMV:");
  const ranking = [
    { name: "Адал И. (admin)", gmv: adalGMV },
    ...allKams.map(u => ({
      name: u.name,
      gmv: u.kamClients.reduce((s, c) => s + c.gmv30d, 0),
    })),
  ].sort((a, b) => b.gmv - a.gmv);

  ranking.forEach((r, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
    console.log(`  ${medal} ${r.name.padEnd(25)} ${(r.gmv / 1000).toFixed(0)}K`);
  });

  console.log("\nDone! ✅");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
