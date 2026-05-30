import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const now  = new Date();

  if (body.all) {
    // Отметить все прочитанными
    await db.notification.updateMany({
      where: { userId: session.id, readAt: null },
      data:  { readAt: now },
    });
  } else if (body.id) {
    // Отметить одно уведомление
    await db.notification.updateMany({
      where: { id: body.id, userId: session.id },
      data:  { readAt: now },
    });
  }

  return NextResponse.json({ ok: true });
}
