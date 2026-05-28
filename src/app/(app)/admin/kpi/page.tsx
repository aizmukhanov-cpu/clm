import { redirect } from "next/navigation";

// Перенесено в /kpi — доступно всем ролям
export default function AdminKPIRedirect() {
  redirect("/kpi");
}
