"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type ProposalTemplate = {
  id:          string;
  title:       string;
  team:        string;
  productName: string;
  body:        string;
  tags:        string | null;
  createdBy:   string;
  createdAt:   Date;
  updatedAt:   Date;
};

export async function getProposalTemplates(team?: string): Promise<ProposalTemplate[]> {
  const session = await getSession();
  if (!session) return [];

  if (team) {
    return db.$queryRaw<ProposalTemplate[]>`
      SELECT id, title, team::text, product_name AS "productName", body, tags,
             created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM proposal_templates
      WHERE team = ${team}::"TeamType"
      ORDER BY created_at DESC
    `;
  }

  return db.$queryRaw<ProposalTemplate[]>`
    SELECT id, title, team::text, product_name AS "productName", body, tags,
           created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM proposal_templates
    ORDER BY created_at DESC
  `;
}

export async function createProposalTemplate(data: {
  title:       string;
  team:        string;
  productName: string;
  body:        string;
  tags?:       string;
}) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "ANALYST")) {
    return { error: "Недостаточно прав" };
  }

  const id = `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  await db.$executeRaw`
    INSERT INTO proposal_templates (id, title, team, product_name, body, tags, created_by, created_at, updated_at)
    VALUES (
      ${id},
      ${data.title},
      ${data.team}::"TeamType",
      ${data.productName},
      ${data.body},
      ${data.tags ?? null},
      ${session.id},
      NOW(),
      NOW()
    )
  `;

  revalidatePath("/pipeline/km/templates");
  revalidatePath("/pipeline/b2b/templates");
  return { ok: true };
}

export async function deleteProposalTemplate(id: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Только ADMIN может удалять шаблоны" };
  }

  await db.$executeRaw`DELETE FROM proposal_templates WHERE id = ${id}`;
  revalidatePath("/pipeline/km/templates");
  return { ok: true };
}
