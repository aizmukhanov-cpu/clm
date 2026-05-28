"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!email || !password) {
    return { error: "Введите email и пароль" };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, team: true, branchId: true, passwordHash: true },
  });

  if (!user) {
    return { error: "Неверный email или пароль" };
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    return { error: "Неверный email или пароль" };
  }

  const token = await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    team: user.team,
    branchId: user.branchId,
  });

  await setSessionCookie(token);
  redirect("/dashboard");
}
