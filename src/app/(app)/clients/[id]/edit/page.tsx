import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";
import { EditClientForm } from "./EditClientForm";

type Params = Promise<{ id: string }>;

export default async function EditClientPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await getSession();

  // Only ADMIN and ANALYST can edit
  if (!session || (session.role !== UserRole.ADMIN && session.role !== "ANALYST")) {
    notFound();
  }

  const [client, branches, managers, kams] = await Promise.all([
    db.client.findUnique({
      where: { id },
      select: {
        id: true, inn: true, name: true, type: true,
        okved: true, accountOpenedAt: true,
        branchId: true, managerId: true, kamId: true,
      },
    }),
    db.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({
      where: { role: { in: ["SPECIALIST", "SUPERVISOR", "TEAM_LEAD"] } },
      select: { id: true, name: true, team: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { role: "KAM" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!client) notFound();

  return (
    <EditClientForm
      client={client}
      branches={branches}
      managers={managers}
      kams={kams}
    />
  );
}
