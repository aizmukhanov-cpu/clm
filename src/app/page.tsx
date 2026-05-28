import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // MANAGER и KAM_ROLE → персональный портфель
  // ADMIN и ANALYST   → общий дашборд
  const home =
    session.role === "MANAGER" || session.role === "KAM_ROLE"
      ? "/my-portfolio"
      : "/dashboard";

  redirect(home);
}
