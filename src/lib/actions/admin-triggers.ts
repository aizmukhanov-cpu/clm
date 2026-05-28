"use server";

import { getSession } from "@/lib/auth";
import { runRFMSync } from "@/lib/rfm-sync";
import { runEventTriggers } from "@/lib/event-triggers";
import { runHunterHandoff } from "@/lib/hunter-handoff";

/** Manual RFM sync trigger — ADMIN only */
export async function triggerRFMSync() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Недостаточно прав", updated: 0, stageShifts: 0 };
  }
  const result = await runRFMSync();
  return result;
}

/** Manual event triggers run — ADMIN only */
export async function triggerEventTriggers() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Недостаточно прав", tasksCreated: 0, triggered: [], errors: [] };
  }
  const result = await runEventTriggers();
  return result;
}

/** Manual hunter→farmer handoff — ADMIN only */
export async function triggerHunterHandoff() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Недостаточно прав", transferred: 0, skipped: 0, errors: [], log: [] };
  }
  const result = await runHunterHandoff();
  return result;
}
