import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { UserRole } from "@/generated/prisma/client";
import { getAllPermissions } from "@/lib/permissions";
import { PermissionMatrix } from "./PermissionMatrix";
import { AdminTabBar } from "../AdminTabBar";

export default async function PermissionsPage() {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) notFound();

  const matrix = await getAllPermissions();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Управление доступом</h2>
        <p className="text-sm text-gray-400 mt-0.5">Сотрудники системы и настройки прав доступа</p>
      </div>

      <AdminTabBar active="/admin/permissions" />

      <div>
        <p className="text-sm text-gray-500 mb-4">
          Управление видимостью чувствительных данных по ролям.{" "}
          <span className="font-medium text-gray-700">ADMIN</span> всегда имеет полный доступ.
        </p>
        <PermissionMatrix initialMatrix={matrix} />
      </div>
    </div>
  );
}
