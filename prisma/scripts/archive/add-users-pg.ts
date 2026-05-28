import { Client } from "pg";
import * as bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Используем DIRECT_URL (session pooler, port 5432) — стабильнее для скриптов
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("✓ Connected to DB");

  const PASS = "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0Z9S6YfMp0i"; // password123

  // ─── 1. Новые пользователи ─────────────────────────────
  const newUsers = [
    // B2B (+3)
    { id: "user-b2b-2", name: "Улан Асанов",     email: "u.asanov@mbank.kg",    role: "MANAGER",  team: "B2B", branchId: "branch-osh"     },
    { id: "user-b2b-3", name: "Жамал Касымова",  email: "j.kasymova@mbank.kg",  role: "MANAGER",  team: "B2B", branchId: "branch-karakol" },
    { id: "user-b2b-4", name: "Эрмек Бакытов",   email: "e.bakytov@mbank.kg",   role: "MANAGER",  team: "B2B", branchId: "branch-bishkek" },
    // KM (+3)
    { id: "user-km-2",  name: "Айбек Дуйшенов",  email: "a.duyshenov@mbank.kg", role: "MANAGER",  team: "KM",  branchId: "branch-bishkek" },
    { id: "user-km-3",  name: "Мадина Сейткали", email: "m.seytkali@mbank.kg",  role: "MANAGER",  team: "KM",  branchId: "branch-osh"     },
    { id: "user-km-4",  name: "Жыргал Токтогул", email: "j.toktogul@mbank.kg",  role: "MANAGER",  team: "KM",  branchId: "branch-karakol" },
    // KAM (+3)
    { id: "user-kam-2", name: "Самат Нурланов",  email: "s.nurlanov@mbank.kg",  role: "KAM_ROLE", team: "KAM", branchId: "branch-bishkek" },
    { id: "user-kam-3", name: "Бурул Акматова",  email: "b.akmatova@mbank.kg",  role: "KAM_ROLE", team: "KAM", branchId: "branch-osh"     },
    { id: "user-kam-4", name: "Акылай Жакшылык", email: "a.jakshylyk@mbank.kg", role: "KAM_ROLE", team: "KAM", branchId: "branch-karakol" },
  ];

  for (const u of newUsers) {
    await client.query(`
      INSERT INTO users (id, name, email, role, team, branch_id, password_hash, created_at)
      VALUES ($1, $2, $3, $4::\"UserRole\", $5::\"TeamType\", $6, $7, NOW())
      ON CONFLICT (email) DO NOTHING
    `, [u.id, u.name, u.email, u.role, u.team, u.branchId, PASS]);
    console.log(`  + ${u.name} (${u.team})`);
  }
  console.log(`✓ Новые пользователи добавлены`);

  // ─── 2. Перераспределение клиентов ────────────────────
  // Адал (user-admin) — ТОП-4 клиента по GMV как KAM (#1 портфель)
  const assignments: Array<{ inn: string; managerId?: string; kamId?: string | null }> = [
    { inn: "11234567890123", kamId: "user-admin",  managerId: "user-km-2"  }, // СевергазКГ    2.1M
    { inn: "67890123456789", kamId: "user-admin",  managerId: "user-km-3"  }, // ОшСтрой       1.2M
    { inn: "12345678901234", kamId: "user-admin",  managerId: "user-km"    }, // АлтынТрейд    850K
    { inn: "01234567890123", kamId: "user-admin",  managerId: "user-km-4"  }, // Мега Дистриб. 750K
    { inn: "89012345678901", kamId: "user-kam-2",  managerId: "user-km-2"  }, // Каракол Экспорт 600K
    { inn: "45678901234567", kamId: "user-kam-3",  managerId: "user-km-3"  }, // БишкекФуд     320K
    { inn: "34567890123456", managerId: "user-b2b-2"                       }, // ИП Сатыбалдиев
    { inn: "56789012345678", managerId: "user-b2b-3"                       }, // ИП Жакыпова
    { inn: "78901234567890", managerId: "user-b2b-4"                       }, // ИП Токтосунов
    { inn: "90123456789012", managerId: "user-b2b-2"                       }, // ИП Асанов
    { inn: "21234567890123", managerId: "user-b2b-3"                       }, // ИП Эргешов
    { inn: "23456789012345", managerId: "user-km-4"                        }, // КыргызМаркет
  ];

  for (const a of assignments) {
    const sets: string[] = [];
    const vals: string[] = [];
    let i = 1;
    if (a.managerId !== undefined) { sets.push(`manager_id = $${i++}`); vals.push(a.managerId); }
    if (a.kamId !== undefined)     { sets.push(`kam_id = $${i++}`);     vals.push(a.kamId as string); }
    if (sets.length === 0) continue;
    vals.push(a.inn);
    await client.query(
      `UPDATE clients SET ${sets.join(", ")} WHERE inn = $${i}`,
      vals
    );
  }
  console.log(`✓ ${assignments.length} клиентов перераспределено`);

  // ─── 3. Рейтинг KAM по GMV ────────────────────────────
  const res = await client.query(`
    SELECT
      u.name,
      u.team,
      COALESCE(SUM(c.gmv_30d), 0) AS total_gmv,
      COUNT(c.id) AS client_count
    FROM users u
    LEFT JOIN clients c ON c.kam_id = u.id
    WHERE u.team = 'KAM' OR (u.role = 'ADMIN' AND u.id = 'user-admin')
    GROUP BY u.id, u.name, u.team
    ORDER BY total_gmv DESC
  `);

  console.log("\n🏆 Рейтинг KAM по GMV (30д):");
  res.rows.forEach((r, i) => {
    const medals = ["🥇", "🥈", "🥉", "  ", "  "];
    console.log(`  ${medals[i] || "  "} ${r.name.padEnd(22)} ${String(Math.round(r.total_gmv / 1000) + "K").padStart(8)}   (${r.client_count} клиентов)`);
  });

  await client.end();
  console.log("\nDone! ✅");
}

main().catch(e => { console.error(e); process.exit(1); });
