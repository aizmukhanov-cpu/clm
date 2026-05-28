import { NextRequest, NextResponse } from "next/server";
import { runHunterHandoff } from "@/lib/hunter-handoff";
import { sendNotification } from "@/lib/notifications";

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

  const result = await runHunterHandoff();

  if (result.skipped > 0 && result.transferred === 0) {
    await sendNotification(
      `⚠️ <b>Hunter Handoff</b>: ${result.skipped} клиентов ожидают передачи, но нет доступных менеджеров-фермеров. Назначьте менеджеров в командах BRANCH / VB / KAM.`
    );
  }

  return NextResponse.json(result);
}
