import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ items: [], unread: 0 }, { status: 401 });

  const items = await db.notification.findMany({
    where:   { userId: session.id },
    orderBy: { createdAt: "desc" },
    take:    25,
    select: {
      id:        true,
      type:      true,
      title:     true,
      body:      true,
      href:      true,
      readAt:    true,
      createdAt: true,
    },
  });

  const unread = items.filter((n) => !n.readAt).length;
  return NextResponse.json({ items, unread });
}
