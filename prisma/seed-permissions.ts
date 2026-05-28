import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import path from "path";

// Load env vars from .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const DEFAULTS: Record<string, Record<string, boolean>> = {
  ANALYST:  { financials: true,  credit: true,  txn_metrics: true,  activities: true, tasks: true, changelog: true  },
  MANAGER:  { financials: false, credit: false, txn_metrics: true,  activities: true, tasks: true, changelog: true  },
  KAM_ROLE: { financials: false, credit: false, txn_metrics: false, activities: true, tasks: true, changelog: false },
};

const RESOURCES = ["financials","credit","txn_metrics","activities","tasks","changelog"];

async function main() {
  let count = 0;
  for (const role of Object.keys(DEFAULTS)) {
    for (const resource of RESOURCES) {
      await db.permissionConfig.upsert({
        where: { role_resource: { role, resource } },
        update: {},
        create: { role, resource, canView: DEFAULTS[role][resource] },
      });
      count++;
    }
  }
  console.log(`✓ Seeded ${count} permission configs`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
