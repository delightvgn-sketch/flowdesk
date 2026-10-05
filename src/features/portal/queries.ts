import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { Tx } from "@/server/db";
import { invoices, milestones, projects } from "@/server/db/schema";

/** RLS already limits every query below to the client user's own records. */
export async function portalProjects(tx: Tx, workspaceId: string) {
  const rows = await tx.select().from(projects).where(eq(projects.workspaceId, workspaceId)).orderBy(desc(projects.updatedAt));
  const ms = rows.length
    ? await tx.select().from(milestones).where(inArray(milestones.projectId, rows.map((r) => r.id))).orderBy(asc(milestones.position))
    : [];
  return rows.map((p) => ({ ...p, milestones: ms.filter((m) => m.projectId === p.id) }));
}

export async function portalInvoices(tx: Tx, workspaceId: string) {
  return tx.select().from(invoices).where(eq(invoices.workspaceId, workspaceId)).orderBy(desc(invoices.issueDate));
}

export async function pendingApprovals(tx: Tx, workspaceId: string) {
  return tx
    .select({ id: milestones.id, title: milestones.title, projectId: milestones.projectId, projectName: projects.name, dueDate: milestones.dueDate })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .where(and(eq(milestones.workspaceId, workspaceId), eq(milestones.approvalStatus, "PENDING")));
}
