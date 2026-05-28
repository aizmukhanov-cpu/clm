import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;

async function main() {
  const db = new Client({ connectionString });
  await db.connect();
  console.log("✓ Connected");

  // Смотрим сколько клиентов у user-kam
  const {rows: kamClients} = await db.query(`
    SELECT id, inn, name, gmv_30d, manager_id
    FROM clients
    WHERE kam_id = 'user-kam' AND is_archived = false
    ORDER BY gmv_30d DESC
  `);
  console.log(`\nУ Нурлана (user-kam) клиентов: ${kamClients.length}`);

  if (kamClients.length === 0) {
    console.log("Нечего перераспределять");
    await db.end();
    return;
  }

  // Стратегия распределения:
  // Адал (user-admin) — ТОП-20% по GMV + уже назначенные 4
  // Остальные KAM равномерно

  const totalClients = kamClients.length;
  const adalShare   = Math.ceil(totalClients * 0.35); // ~35% топовых
  const kamShare2   = Math.floor(totalClients * 0.25);
  const kamShare3   = Math.floor(totalClients * 0.20);
  // остальное Нурлану оставляем или отдаём kam-4

  console.log(`\nРаспределение (из ${totalClients} клиентов Нурлана):`);
  console.log(`  Адал И. (user-admin) → ${adalShare} клиентов (ТОП GMV)`);
  console.log(`  Самат Нурланов (user-kam-2) → ${kamShare2} клиентов`);
  console.log(`  Бурул Акматова (user-kam-3) → ${kamShare3} клиентов`);
  console.log(`  Нурлан О. (user-kam) → ${totalClients - adalShare - kamShare2 - kamShare3} клиентов`);

  // Нарезаем
  const adalBatch  = kamClients.slice(0, adalShare).map(c => c.id);
  const samatBatch = kamClients.slice(adalShare, adalShare + kamShare2).map(c => c.id);
  const burulBatch = kamClients.slice(adalShare + kamShare2, adalShare + kamShare2 + kamShare3).map(c => c.id);

  if (adalBatch.length > 0) {
    await db.query(
      `UPDATE clients SET kam_id = 'user-admin' WHERE id = ANY($1::text[])`,
      [adalBatch]
    );
    console.log(`\n✓ ${adalBatch.length} клиентов → Адал`);
  }

  if (samatBatch.length > 0) {
    await db.query(
      `UPDATE clients SET kam_id = 'user-kam-2' WHERE id = ANY($1::text[])`,
      [samatBatch]
    );
    console.log(`✓ ${samatBatch.length} клиентов → Самат`);
  }

  if (burulBatch.length > 0) {
    await db.query(
      `UPDATE clients SET kam_id = 'user-kam-3' WHERE id = ANY($1::text[])`,
      [burulBatch]
    );
    console.log(`✓ ${burulBatch.length} клиентов → Бурул`);
  }

  // Финальный рейтинг
  const {rows: ranking} = await db.query(`
    SELECT
      CASE u.id WHEN 'user-admin' THEN 'Адал И. (admin)' ELSE u.name END AS name,
      COUNT(c.id) AS clients,
      COALESCE(SUM(c.gmv_30d), 0) AS gmv
    FROM users u
    LEFT JOIN clients c ON c.kam_id = u.id AND c.is_archived = false
    WHERE u.team = 'KAM' OR u.id = 'user-admin'
    GROUP BY u.id, u.name
    ORDER BY gmv DESC
  `);

  console.log("\n🏆 Итоговый рейтинг KAM по GMV (30д):");
  const medals = ["🥇", "🥈", "🥉", "   ", "   "];
  ranking.forEach((r, i) => {
    const gmvM = (Number(r.gmv) / 1_000_000).toFixed(1);
    console.log(`  ${medals[i] || "   "} ${String(r.name).padEnd(25)} ${gmvM.padStart(8)}M   (${r.clients} кл.)`);
  });

  await db.end();
  console.log("\nDone! ✅");
}

main().catch(e => { console.error(e); process.exit(1); });
