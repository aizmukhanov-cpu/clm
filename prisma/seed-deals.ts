import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const PRODUCTS = [
  "MBusiness",
  "Эквайринг POS",
  "MKassa QR",
  "ЗП-проект",
  "Кредит МСБ",
  "Торговое финансирование",
  "Депозит",
  "Корпоративная карта",
];

const B2B_LEADS = [
  "ИП Бакытбеков", "ОсОО «Альфа Трейд»", "ИП Токтосунов", "ОсОО «Бета Сервис»",
  "ИП Жумабаев", "ОсОО «Гамма Групп»", "ИП Исаков", "ОсОО «Дельта»",
  "ИП Сатылганов", "ОсОО «Эпсилон»", "ИП Маматов", "ОсОО «Зета Логистик»",
  "ИП Осмонов", "ОсОО «Ита Консалт»", "ИП Асылбеков",
];

const KM_LEADS = [
  "ОАО «КыргызТрейд»", "ЗАО «БишкекСтрой»", "ОсОО «МегаПродукт»",
  "ОАО «АзияЭкспорт»", "ЗАО «ЦентрАзия Лизинг»", "ОсОО «ПримГрупп»",
  "ОАО «КырТелеком»", "ЗАО «СтройМастер»", "ОсОО «АгроИнвест»",
  "ОАО «Манас Ойл»", "ЗАО «НордТрэйд»",
];

const STAGES = ["QUALIFY", "QUALIFY", "PROPOSAL", "PROPOSAL", "NEGOTIATION", "CLOSE"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function futureDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log("Seeding deals...");

  // Get managers for B2B and KM
  const b2bManagers = await db.user.findMany({ where: { team: "B2B" }, select: { id: true } });
  const kmManagers  = await db.user.findMany({ where: { team: "KM"  }, select: { id: true } });

  if (b2bManagers.length === 0 || kmManagers.length === 0) {
    console.log("No managers found. Run seed.ts first.");
    process.exit(1);
  }

  // Clear existing deals
  await db.deal.deleteMany({});
  console.log("Cleared existing deals");

  // B2B deals
  for (const lead of B2B_LEADS) {
    await db.deal.create({
      data: {
        team: "B2B",
        stage: pick(STAGES),
        leadName: lead,
        ownerId: pick(b2bManagers).id,
        productName: pick(PRODUCTS),
        amount: randInt(50, 800) * 1000,
        probability: pick([20, 30, 50, 70, 80, 90]),
        expectedClose: futureDate(randInt(7, 60)),
        notes: null,
      },
    });
  }

  // KM deals
  for (const lead of KM_LEADS) {
    await db.deal.create({
      data: {
        team: "KM",
        stage: pick(STAGES),
        leadName: lead,
        ownerId: pick(kmManagers).id,
        productName: pick(PRODUCTS),
        amount: randInt(500, 10_000) * 1000,
        probability: pick([20, 30, 50, 70, 80, 90]),
        expectedClose: futureDate(randInt(14, 90)),
        notes: null,
      },
    });
  }

  const total = await db.deal.count();
  console.log(`✓ Created ${total} deals`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
