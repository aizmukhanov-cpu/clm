import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Специалисты и супервайзеры → персональный портфель
  // Руководители и выше → дашборд
  const personalRoles = ["SPECIALIST", "KAM", "SUPERVISOR"];
  const home = personalRoles.includes(session.role) ? "/my-portfolio" : "/dashboard";

  redirect(home);
}
