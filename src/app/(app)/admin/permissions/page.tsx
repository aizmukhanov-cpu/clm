import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { UserRole } from "@/generated/prisma/client";
import { getAllPermissions } from "@/lib/permissions";
import { PermissionMatrix } from "./PermissionMatrix";

export default async function PermissionsPage() {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) notFound();

  const matrix = await getAllPermissions();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Матрица доступа</h2>
        <p className="text-sm text-gray-400 mt-1">
          Управление видимостью чувствительных данных по ролям.{" "}
          <span className="font-medium text-gray-600">ADMIN</span> всегда имеет полный доступ.
        </p>
      </div>

      <PermissionMatrix initialMatrix={matrix} />
    </div>
  );
}
