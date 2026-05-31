import dotenv from "dotenv";
// .env.local overrides .env (Next.js convention)
dotenv.config({ path: ".env.local" });
dotenv.config();
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx ./prisma/seed.ts",
  },
  datasource: {
    // DIRECT_URL (port 5432, session pooler) — обязателен для migrate
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
