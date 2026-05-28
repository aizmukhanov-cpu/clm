import { NextRequest, NextResponse } from "next/server";
import { runRFMSync } from "@/lib/rfm-sync";
import { sendNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runRFMSync();

  if (result.stageShifts > 0) {
    await sendNotification(
      `🔄 <b>RFM Sync</b>: обновлено ${result.updated} клиентов, ` +
      `${result.stageShifts} авто-переходов по CLM-стадиям`
    );
  }

  return NextResponse.json(result);
}
