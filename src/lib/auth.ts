import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE = "clm-token";
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-me"
);

/** После скольки секунд сессия перепроверяется по БД */
const SESSION_RECHECK_SECONDS = 60 * 60; // 1 час

export type SessionUser = {
  id:             string;
  name:           string;
  email:          string;
  role:           string;
  team:           string;
  branchId:       string;
  sessionVersion: number;
};

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("4h")   // уменьшено с 8h до 4h
    .setIssuedAt()
    .sign(secret);
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4, // 4 hours — синхронизировано с JWT TTL
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const session = payload as unknown as SessionUser & { iat?: number };

    // Перепроверяем по БД если токен старше SESSION_RECHECK_SECONDS
    // (ловим: смену роли/пароля администратором, удаление пользователя)
    const ageSeconds = Math.floor(Date.now() / 1000) - (session.iat ?? 0);
    if (ageSeconds > SESSION_RECHECK_SECONDS) {
      const fresh = await db.user.findUnique({
        where:  { id: session.id },
        select: { id: true, sessionVersion: true },
      });
      // Пользователь удалён или sessionVersion изменился (смена роли/пароля)
      if (!fresh || fresh.sessionVersion !== (session.sessionVersion ?? 0)) {
        return null;
      }
    }

    return session;
  } catch {
    return null;
  }
}

// Полный объект пользователя из БД (с веткой и т.д.)
export async function getUser() {
  const session = await getSession();
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.id },
    include: { branch: true },
  });
}
