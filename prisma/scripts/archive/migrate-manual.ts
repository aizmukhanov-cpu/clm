import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;

async function main() {
  const db = new Client({ connectionString });
  await db.connect();
  console.log("✓ Connected");

  // 1. Добавить ESCALATED в enum TaskStatus
  // В PostgreSQL нельзя изменить enum напрямую в транзакции, используем ALTER TYPE
  const { rows: existingVals } = await db.query(`
    SELECT enumlabel FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'TaskStatus'
  `);
  const existing = existingVals.map(r => r.enumlabel);
  console.log("Текущие значения TaskStatus:", existing);

  if (!existing.includes("ESCALATED")) {
    await db.query(`ALTER TYPE "TaskStatus" ADD VALUE 'ESCALATED'`);
    console.log("✓ ESCALATED добавлен в TaskStatus");
  } else {
    console.log("  ESCALATED уже есть");
  }

  // 2. Создать таблицу proposal_templates (если нет)
  const { rows: tableExists } = await db.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'proposal_templates'
  `);

  if (tableExists.length === 0) {
    await db.query(`
      CREATE TABLE proposal_templates (
        id           TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title        TEXT         NOT NULL,
        team         "TeamType"   NOT NULL,
        product_name TEXT         NOT NULL,
        body         TEXT         NOT NULL,
        tags         TEXT,
        created_by   TEXT         NOT NULL,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✓ Таблица proposal_templates создана");
  } else {
    console.log("  proposal_templates уже существует");
  }

  // 3. Засеять 3 стартовых шаблона КП
  const { rows: templateCount } = await db.query(`SELECT COUNT(*) FROM proposal_templates WHERE team = 'KM'`);
  if (Number(templateCount[0].count) === 0) {
    await db.query(`
      INSERT INTO proposal_templates (id, title, team, product_name, body, tags, created_by)
      VALUES
        (gen_random_uuid()::text, 'КП — Подключение МБизнес', 'KM', 'MBusiness',
         'Уважаемый [Имя клиента],

Команда MBank предлагает Вашей компании подключить платформу MBusiness — полноценный интернет-банк для юридических лиц.

Что вы получите:
• Онлайн-управление счётами 24/7
• Платёжные поручения и зарплатный проект
• Мгновенные переводы внутри MBank
• Выписки и отчёты в один клик
• Мобильное приложение для руководителя

Подключение бесплатно. Готовы организовать демонстрацию в удобное для вас время.

С уважением,
[Менеджер]
MBank — Корпоративный сегмент',
         'мсб,онбординг,mbusiness', 'user-admin'),

        (gen_random_uuid()::text, 'КП — Торговое финансирование', 'KM', 'Торговое финансирование',
         'Уважаемый [Имя клиента],

MBank предлагает финансирование внешнеторговых операций Вашей компании.

Наши продукты:
• Аккредитивы (импортные / экспортные)
• Банковские гарантии
• Документарное инкассо
• Факторинг и предэкспортное финансирование

Ставки от 14% годовых. Срок рассмотрения — 3 рабочих дня.
Лимит до 50 млн сом без залогового обеспечения.

Готовы обсудить детали на встрече.

С уважением,
[Менеджер]',
         'торговое финансирование,импорт,экспорт', 'user-admin'),

        (gen_random_uuid()::text, 'КП — Зарплатный проект', 'KM', 'Зарплатный проект',
         'Уважаемый [Имя клиента],

Предлагаем Вашей компании перевести зарплатные выплаты на зарплатный проект MBank.

Преимущества:
• Бесплатный выпуск карт для сотрудников
• Автоматическое зачисление в день выплаты
• Кэшбэк 1% на покупки по зарплатной карте
• Льготные условия потребительского кредитования для сотрудников
• Выплата в валюте (USD, EUR) для внешних партнёров

Тариф: 0 сом в месяц при обороте по картам от 500 000 сом.

[Менеджер]
MBank',
         'зарплатный проект,hr,выплаты', 'user-admin')
    `);
    console.log("✓ 3 стартовых шаблона КП добавлены");
  }

  await db.end();
  console.log("\nDone! ✅");
}

main().catch(e => { console.error(e); process.exit(1); });
