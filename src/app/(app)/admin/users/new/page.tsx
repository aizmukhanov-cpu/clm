import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createUser } from "@/lib/actions/admin-users";
import { UserForm } from "../UserForm";

export default async function NewUserPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/dashboard");

  const [branches, supervisors] = await Promise.all([
    db.branch.findMany({ select: { id: true, name: true, region: true }, orderBy: { name: "asc" } }),
    db.user.findMany({
      where:   { role: { in: ["TEAM_LEAD", "SUPERVISOR"] } },
      select:  { id: true, name: true, team: true },
      orderBy: [{ team: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link href="/admin/users" className="hover:text-gray-600 transition-colors">Сотрудники</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Новый сотрудник</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Новый сотрудник</h2>
        <UserForm action={createUser} branches={branches} supervisors={supervisors} />
      </div>
    </div>
  );
}
