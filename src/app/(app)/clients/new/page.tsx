import { db } from "@/lib/db";
import { UserRole } from "@/generated/prisma/client";
import { NewClientForm } from "./NewClientForm";

export default async function NewClientPage() {
  const [branches, managers, kams] = await Promise.all([
    db.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({
      where: { role: { in: [UserRole.MANAGER] } },
      select: { id: true, name: true, team: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { role: UserRole.KAM_ROLE },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <NewClientForm
      branches={branches}
      managers={managers}
      kams={kams}
    />
  );
}
