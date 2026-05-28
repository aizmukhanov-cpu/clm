"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSequenceById } from "@/lib/sequences";

export type LaunchResult = {
  tasksCreated: number;
  sequenceName: string;
  error?: string;
};

/**
 * Launch a sequence for a client.
 * Creates all steps as tasks assigned to the current user (or overrideAssignTo).
 */
export async function launchSequence(
  clientId: string,
  sequenceId: string,
  overrideAssignTo?: string,
): Promise<LaunchResult> {
  const session = await getSession();
  if (!session) return { tasksCreated: 0, sequenceName: "", error: "Не авторизован" };

  const seq = getSequenceById(sequenceId);
  if (!seq) return { tasksCreated: 0, sequenceName: "", error: "Сиквенс не найден" };

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, managerId: true },
  });
  if (!client) return { tasksCreated: 0, sequenceName: seq.name, error: "Клиент не найден" };

  const assignedTo = overrideAssignTo ?? session.id;

  // Verify the user exists
  const userExists = await db.user.findUnique({
    where: { id: assignedTo },
    select: { id: true },
  });
  if (!userExists) return { tasksCreated: 0, sequenceName: seq.name, error: "Пользователь не найден" };

  const now = new Date();
  let created = 0;

  for (const step of seq.steps) {
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + step.dayOffset);

    await db.task.create({
      data: {
        clientId,
        assignedTo,
        dueDate,
        priority:   step.priority,
        action:     `[${seq.name}] ${step.action}`,
        triggerDay: `seq:${seq.id}:d${step.dayOffset}`,
      },
    });
    created++;
  }

  return { tasksCreated: created, sequenceName: seq.name };
}

/**
 * Get active sequences for a client (tasks that have seq: triggerDay prefix).
 */
export async function getActiveSequences(clientId: string): Promise<{
  sequenceId: string;
  sequenceName: string;
  total:    number;
  done:     number;
  pending:  number;
}[]> {
  const tasks = await db.task.findMany({
    where: {
      clientId,
      triggerDay: { startsWith: "seq:" },
    },
    select: { triggerDay: true, status: true },
  });

  // Group by sequence id
  const map = new Map<string, { total: number; done: number; pending: number }>();
  for (const t of tasks) {
    const parts = t.triggerDay?.split(":") ?? [];
    const seqId = parts[1];
    if (!seqId) continue;
    if (!map.has(seqId)) map.set(seqId, { total: 0, done: 0, pending: 0 });
    const entry = map.get(seqId)!;
    entry.total++;
    if (t.status === "DONE") entry.done++;
    else entry.pending++;
  }

  return Array.from(map.entries()).map(([seqId, stats]) => {
    const seq = getSequenceById(seqId);
    return {
      sequenceId:   seqId,
      sequenceName: seq?.name ?? seqId,
      ...stats,
    };
  });
}
