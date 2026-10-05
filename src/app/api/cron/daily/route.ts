import { timingSafeEqual } from "node:crypto";

import { and, eq, inArray, lt } from "drizzle-orm";

import { addDaysISO, todayISO } from "@/lib/dates";
import { adminDb } from "@/server/db";
import { invoices, notifications, projectMembers, projects, workspaceMembers, workspaces } from "@/server/db/schema";
import { env } from "@/server/env";
import { seedDemo } from "@/server/seed/seed-demo";
import { storageAdmin } from "@/server/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = env.cronSecret();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Daily housekeeping, triggered by Vercel Cron (see vercel.json):
 *  1. flip unpaid invoices past their due date to OVERDUE and notify managers,
 *  2. remind project teams three days before a project deadline,
 *  3. reset the public demo workspace so every visitor gets a clean demo.
 * Runs on the privileged connection because it spans all workspaces.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const summary = { overdue: 0, reminders: 0, demoReset: false };
  const allWorkspaces = await adminDb.select().from(workspaces);

  for (const ws of allWorkspaces) {
    if (ws.isDemo) continue;
    const today = todayISO(ws.timezone);

    const newlyOverdue = await adminDb
      .update(invoices)
      .set({ status: "OVERDUE" })
      .where(and(eq(invoices.workspaceId, ws.id), eq(invoices.status, "SENT"), lt(invoices.dueDate, today)))
      .returning({ id: invoices.id, number: invoices.number });
    if (newlyOverdue.length) {
      const managers = await adminDb
        .select({ id: workspaceMembers.profileId })
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, ws.id), inArray(workspaceMembers.role, ["OWNER", "ADMIN"])));
      const rows = newlyOverdue.flatMap((inv) =>
        managers.map((m) => ({ workspaceId: ws.id, recipientId: m.id, type: "invoice.overdue", title: `Invoice ${inv.number} is overdue`, href: `/invoices/${inv.id}` })),
      );
      if (rows.length) await adminDb.insert(notifications).values(rows);
      summary.overdue += newlyOverdue.length;
    }

    const dueSoon = await adminDb
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.workspaceId, ws.id), eq(projects.dueDate, addDaysISO(today, 3)), inArray(projects.status, ["PLANNING", "IN_PROGRESS", "REVIEW"])));
    for (const p of dueSoon) {
      const team = await adminDb.select({ id: projectMembers.profileId }).from(projectMembers).where(eq(projectMembers.projectId, p.id));
      if (team.length) {
        await adminDb.insert(notifications).values(
          team.map((t) => ({ workspaceId: ws.id, recipientId: t.id, type: "project.deadline", title: `${p.name} is due in 3 days`, href: `/projects/${p.id}` })),
        );
        summary.reminders += team.length;
      }
    }
  }

  if (env.demoEnabled() && process.env.DEMO_DAILY_RESET !== "false") {
    await seedDemo(adminDb, { storage: storageAdmin() });
    summary.demoReset = true;
  }

  return Response.json({ ok: true, ...summary });
}
