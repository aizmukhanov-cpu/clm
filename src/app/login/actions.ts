"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";

const MAX_ATTEMPTS    = 5;
const LOCKOUT_MINUTES = 15;

export async function loginAction(_prev: unknown, formData: FormData) {
  const email    = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!email || !password) {
    return { error: "Введите email и пароль" };
  }

  const user = await db.user.findUnique({
    where:  { email },
    select: {
      id: true, name: true, email: true, role: true,
      team: true, branchId: true, passwordHash: true,
      sessionVersion: true, failedLoginAttempts: true, lockedUntil: true,
    },
  });

  // Единое сообщение — не раскрываем, существует ли email
  if (!user) {
    return { error: "Неверный email или пароль" };
  }

  // ── Брутфорс-защита ────────────────────────────────────────────────────────
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return { error: `Слишком много попыток. Повторите через ${minutesLeft} мин.` };
  }

  const valid = await compare(password, user.passwordHash);

  if (!valid) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const shouldLock = attempts >= MAX_ATTEMPTS;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        ...(shouldLock
          ? { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) }
          : {}),
      },
    });

    if (shouldLock) {
      return { error: `Слишком много попыток. Аккаунт заблокирован на ${LOCKOUT_MINUTES} минут.` };
    }
    const remaining = MAX_ATTEMPTS - attempts;
    return { error: `Неверный email или пароль. Осталось попыток: ${remaining}.` };
  }

  // ── Успешный вход — сбрасываем счётчик блокировки ──────────────────────────
  await db.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  const token = await createSession({
    id:             user.id,
    name:           user.name,
    email:          user.email,
    role:           user.role,
    team:           user.team,
    branchId:       user.branchId,
    sessionVersion: user.sessionVersion,
  });

  await setSessionCookie(token);
  redirect("/dashboard");
}
