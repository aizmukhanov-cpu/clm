import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Use a version key derived from Prisma schema mtime so hot-reload in dev
// always gets a fresh client after `prisma generate` (fixes stale singleton).
// In production this is a no-op — the key is always the same within a deploy.

let _schemaVersion = "v1";
if (process.env.NODE_ENV !== "production") {
  try {
    // Dynamic require so it's not bundled; only evaluated in Node.js runtime
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path");
    const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
    const stat = fs.statSync(schemaPath);
    _schemaVersion = String(stat.mtimeMs);
  } catch {
    // Fallback — don't crash if fs fails
  }
}

const PRISMA_KEY = `__prisma_${_schemaVersion}` as keyof typeof globalThis;
const g = globalThis as Record<string, unknown>;

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db: PrismaClient =
  (g[PRISMA_KEY] as PrismaClient) ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  g[PRISMA_KEY] = db;
}
