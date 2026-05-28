import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await hash("password123", 10);
  const result = await db.user.updateMany({ data: { passwordHash } });
  console.log(`✓ обновлено ${result.count} пользователей (пароль: password123)`);
}

main().catch(console.error).finally(() => db.$disconnect());
