import { NextRequest, NextResponse } from "next/server";
import { runEventTriggers } from "@/lib/event-triggers";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runEventTriggers();
  return NextResponse.json(result);
}
