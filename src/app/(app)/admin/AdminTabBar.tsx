import Link from "next/link";
import { getSession } from "@/lib/auth";

const TABS = [
  { href: "/admin/users",       label: "👤 Сотрудники"     },
  { href: "/admin/permissions", label: "🔒 Матрица доступа" },
];

export async function AdminTabBar({ active }: { active: "/admin/users" | "/admin/permissions" }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            active === tab.href
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
