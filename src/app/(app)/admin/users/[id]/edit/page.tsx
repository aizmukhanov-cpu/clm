import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateUser } from "@/lib/actions/admin-users";
import { UserForm } from "../../UserForm";

type Params = Promise<{ id: string }>;

export default async function EditUserPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;

  const [user, branches, supervisors] = await Promise.all([
    db.user.findUnique({
      where:  { id },
      select: { id: true, name: true, email: true, role: true, team: true, branchId: true, supervisorId: true, planMonthly: true, telegramChatId: true },
    }),
    db.branch.findMany({ select: { id: true, name: true, region: true }, orderBy: { name: "asc" } }),
    db.user.findMany({
      where:   { role: { in: ["TEAM_LEAD", "SUPERVISOR"] }, NOT: { id } },
      select:  { id: true, name: true, team: true },
      orderBy: [{ team: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!user) notFound();

  // Bind userId into the action
  const action = updateUser.bind(null, user.id);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link href="/admin/users" className="hover:text-gray-600 transition-colors">Сотрудники</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{user.name}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Редактировать сотрудника</h2>
        <UserForm
          action={action}
          isEdit
          initialValues={{
            name:          user.name,
            email:         user.email,
            role:          user.role,
            team:          user.team,
            branchId:      user.branchId,
            supervisorId:  user.supervisorId,
            planMonthly:   user.planMonthly,
            telegramChatId: user.telegramChatId,
          }}
          branches={branches}
          supervisors={supervisors}
        />
      </div>
    </div>
  );
}
