"use server";

import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { can } from "@/lib/permissions";
import { createAction } from "@/server/actions/safe-action";
import { clients, files, invoices, projects, tasks } from "@/server/db/schema";

export type SearchResult = {
  id: string;
  type: "client" | "project" | "task" | "invoice" | "file";
  title: string;
  subtitle: string | null;
  href: string;
};

/** Escape LIKE wildcards so user input is matched literally. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Global search for the ⌘K palette. Queries run under RLS, so a member only
 * finds their own projects and a client only reaches the portal's resources.
 */
export const searchWorkspace = createAction(
  { schema: z.object({ q: z.string().trim().min(1).max(100) }) },
  async ({ q }, ctx): Promise<SearchResult[]> => {
    const pattern = likePattern(q);
    const ws = ctx.workspace.id;
    const isClient = ctx.role === "CLIENT";
    const projectHref = (id: string) => (isClient ? `/portal/projects/${id}` : `/projects/${id}`);

    return ctx.db(async (tx) => {
      const [clientRows, projectRows, taskRows, invoiceRows, fileRows] = await Promise.all([
        can(ctx.role, "client:view")
          ? tx
              .select({ id: clients.id, name: clients.name, company: clients.company })
              .from(clients)
              .where(and(eq(clients.workspaceId, ws), or(ilike(clients.name, pattern), ilike(clients.company, pattern), ilike(clients.email, pattern))))
              .orderBy(desc(clients.updatedAt))
              .limit(5)
          : [],
        tx
          .select({ id: projects.id, name: projects.name, clientName: clients.company })
          .from(projects)
          .leftJoin(clients, eq(clients.id, projects.clientId))
          .where(and(eq(projects.workspaceId, ws), or(ilike(projects.name, pattern), ilike(projects.description, pattern))))
          .orderBy(desc(projects.updatedAt))
          .limit(5),
        isClient
          ? []
          : tx
              .select({ id: tasks.id, title: tasks.title, projectName: projects.name })
              .from(tasks)
              .leftJoin(projects, eq(projects.id, tasks.projectId))
              .where(and(eq(tasks.workspaceId, ws), ilike(tasks.title, pattern)))
              .orderBy(desc(tasks.updatedAt))
              .limit(6),
        can(ctx.role, "invoice:view") || isClient
          ? tx
              .select({ id: invoices.id, number: invoices.number, clientName: clients.company, total: invoices.total })
              .from(invoices)
              .innerJoin(clients, eq(clients.id, invoices.clientId))
              .where(and(eq(invoices.workspaceId, ws), or(ilike(invoices.number, pattern), ilike(clients.company, pattern), ilike(clients.name, pattern))))
              .orderBy(desc(invoices.issueDate))
              .limit(5)
          : [],
        tx
          .select({ id: files.id, name: files.name, projectName: projects.name })
          .from(files)
          .leftJoin(projects, eq(projects.id, files.projectId))
          .where(and(eq(files.workspaceId, ws), ilike(files.name, pattern)))
          .orderBy(desc(files.createdAt))
          .limit(5),
      ]);

      return [
        ...clientRows.map((c) => ({ id: c.id, type: "client" as const, title: c.company ?? c.name, subtitle: c.company ? c.name : null, href: `/clients/${c.id}` })),
        ...projectRows.map((p) => ({ id: p.id, type: "project" as const, title: p.name, subtitle: p.clientName, href: projectHref(p.id) })),
        ...taskRows.map((t) => ({ id: t.id, type: "task" as const, title: t.title, subtitle: t.projectName, href: `/tasks?task=${t.id}` })),
        ...invoiceRows.map((i) => ({
          id: i.id,
          type: "invoice" as const,
          title: i.number,
          subtitle: i.clientName,
          href: isClient ? `/portal/invoices/${i.id}` : `/invoices/${i.id}`,
        })),
        ...fileRows.map((f) => ({ id: f.id, type: "file" as const, title: f.name, subtitle: f.projectName, href: isClient ? `/portal/files` : `/files?highlight=${f.id}` })),
      ];
    });
  },
);

