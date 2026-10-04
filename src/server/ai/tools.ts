import "server-only";

import { tool } from "ai";
import { and, asc, desc, eq, ilike, inArray, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

import { ACTIVE_PROJECT_STATUSES } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import type { AppContext } from "@/server/auth/session";
import { activityLogs, clients, invoices, milestones, profiles, projects, tasks } from "@/server/db/schema";

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Tools the assistant can call. Each one runs through `ctx.db`, i.e. under row
 * level security as the signed-in user — the model can never read data the
 * user couldn't open themselves. Financial tools are only registered for roles
 * allowed to see invoices.
 */
export function workspaceTools(ctx: AppContext, today: string) {
  const ws = ctx.workspace.id;
  const money = (n: number) => formatMoney(n, { currency: ctx.workspace.currency });

  const base = {
    searchWorkspace: tool({
      description: "Find clients and projects by (partial) name. Use this first to resolve names the user mentions.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Name or keyword, e.g. 'Acme' or 'website'"),
      }),
      execute: async ({ query }) =>
        ctx.db(async (tx) => {
          const [clientRows, projectRows] = await Promise.all([
            can(ctx.role, "client:view")
              ? tx
                  .select({
                    id: clients.id,
                    company: clients.company,
                    contact: clients.name,
                    status: clients.status,
                  })
                  .from(clients)
                  .where(
                    and(eq(clients.workspaceId, ws), or(ilike(clients.company, like(query)), ilike(clients.name, like(query)))),
                  )
                  .limit(5)
              : [],
            tx
              .select({
                id: projects.id,
                name: projects.name,
                status: projects.status,
              })
              .from(projects)
              .where(and(eq(projects.workspaceId, ws), ilike(projects.name, like(query))))
              .limit(5),
          ]);
          return { clients: clientRows, projects: projectRows };
        }),
    }),

    getProjectStatus: tool({
      description: "Detailed status of one project: progress, dates, milestones, open and overdue tasks, recent activity.",
      inputSchema: z.object({ projectId: z.string().uuid() }),
      execute: async ({ projectId }) =>
        ctx.db(async (tx) => {
          const [project] = await tx
            .select({ p: projects, client: clients.company })
            .from(projects)
            .leftJoin(clients, eq(clients.id, projects.clientId))
            .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ws)))
            .limit(1);
          if (!project) return { error: "Project not found or not accessible." };
          const [ms, openTasks, recent] = await Promise.all([
            tx
              .select({
                title: milestones.title,
                status: milestones.status,
                due: milestones.dueDate,
                approval: milestones.approvalStatus,
              })
              .from(milestones)
              .where(eq(milestones.projectId, projectId))
              .orderBy(asc(milestones.position)),
            tx
              .select({
                title: tasks.title,
                status: tasks.status,
                priority: tasks.priority,
                due: tasks.dueDate,
                assignee: profiles.fullName,
              })
              .from(tasks)
              .leftJoin(profiles, eq(profiles.id, tasks.assigneeId))
              .where(and(eq(tasks.projectId, projectId), ne(tasks.status, "DONE")))
              .orderBy(asc(tasks.dueDate))
              .limit(25),
            tx
              .select({
                action: activityLogs.action,
                label: activityLogs.entityLabel,
                at: activityLogs.createdAt,
              })
              .from(activityLogs)
              .where(eq(activityLogs.projectId, projectId))
              .orderBy(desc(activityLogs.createdAt))
              .limit(8),
          ]);
          const p = project.p;
          return {
            name: p.name,
            client: project.client,
            status: p.status,
            priority: p.priority,
            progressPercent: p.progress,
            startDate: p.startDate,
            dueDate: p.dueDate,
            isOverdue: !!p.dueDate && p.dueDate < today && !["COMPLETED", "CANCELLED"].includes(p.status),
            budget: can(ctx.role, "invoice:view") && p.budget ? money(p.budget) : undefined,
            milestones: ms,
            openTasks: openTasks.map((t) => ({
              ...t,
              overdue: !!t.due && t.due < today,
            })),
            recentActivity: recent.map((r) => ({
              action: r.action,
              item: r.label,
              at: r.at.toISOString().slice(0, 10),
            })),
          };
        }),
    }),

    listProjects: tool({
      description: "List projects, optionally only active ones, with progress and due dates.",
      inputSchema: z.object({ activeOnly: z.boolean().default(true) }),
      execute: async ({ activeOnly }) =>
        ctx.db((tx) =>
          tx
            .select({
              id: projects.id,
              name: projects.name,
              status: projects.status,
              progress: projects.progress,
              dueDate: projects.dueDate,
              client: clients.company,
            })
            .from(projects)
            .leftJoin(clients, eq(clients.id, projects.clientId))
            .where(and(eq(projects.workspaceId, ws), activeOnly ? inArray(projects.status, ACTIVE_PROJECT_STATUSES) : undefined))
            .orderBy(sql`${projects.dueDate} asc nulls last`)
            .limit(40),
        ),
    }),

    findDelayedProjects: tool({
      description:
        "Projects that look delayed: past their due date, or behind schedule (low progress relative to elapsed time), or with many overdue tasks.",
      inputSchema: z.object({}),
      execute: async () =>
        ctx.db(async (tx) => {
          const rows = await tx
            .select({
              id: projects.id,
              name: projects.name,
              status: projects.status,
              progress: projects.progress,
              startDate: projects.startDate,
              dueDate: projects.dueDate,
              client: clients.company,
              overdueTasks:
                sql<number>`(select count(*) from tasks t where t.project_id = "projects"."id" and t.status <> 'DONE' and t.due_date < ${today}::date)`.mapWith(
                  Number,
                ),
            })
            .from(projects)
            .leftJoin(clients, eq(clients.id, projects.clientId))
            .where(and(eq(projects.workspaceId, ws), inArray(projects.status, ACTIVE_PROJECT_STATUSES)));
          return rows
            .map((p) => {
              const start = p.startDate ? Date.parse(p.startDate) : null;
              const due = p.dueDate ? Date.parse(p.dueDate) : null;
              const now = Date.parse(today);
              const expected =
                start && due && due > start
                  ? Math.min(100, Math.max(0, Math.round(((now - start) / (due - start)) * 100)))
                  : null;
              const reasons = [
                p.dueDate && p.dueDate < today ? `past due date (${p.dueDate})` : null,
                expected !== null && expected - p.progress >= 25
                  ? `progress ${p.progress}% vs ~${expected}% expected by now`
                  : null,
                p.overdueTasks >= 2 ? `${p.overdueTasks} overdue tasks` : null,
              ].filter(Boolean);
              return { ...p, reasons };
            })
            .filter((p) => p.reasons.length > 0);
        }),
    }),

    listMyTasks: tool({
      description: "Open tasks assigned to the current user, soonest due first.",
      inputSchema: z.object({}),
      execute: async () =>
        ctx.db((tx) =>
          tx
            .select({
              title: tasks.title,
              status: tasks.status,
              priority: tasks.priority,
              due: tasks.dueDate,
              project: projects.name,
            })
            .from(tasks)
            .leftJoin(projects, eq(projects.id, tasks.projectId))
            .where(and(eq(tasks.workspaceId, ws), eq(tasks.assigneeId, ctx.profile.id), ne(tasks.status, "DONE")))
            .orderBy(sql`${tasks.dueDate} asc nulls last`)
            .limit(30),
        ),
    }),
  };

  if (!can(ctx.role, "invoice:view")) return base;

  return {
    ...base,
    getClientSummary: tool({
      description: "Everything about one client: contact details, notes, projects, invoices and payments, recent activity.",
      inputSchema: z.object({ clientId: z.string().uuid() }),
      execute: async ({ clientId }) => loadClientSnapshot(ctx, clientId, today),
    }),

    getFinancialOverview: tool({
      description:
        "Revenue collected (this year and last 30 days), outstanding and overdue invoice balances, and the overdue invoices.",
      inputSchema: z.object({}),
      execute: async () =>
        ctx.db(async (tx) => {
          const [summary] = await tx.execute<{
            ytd: string;
            last30: string;
            outstanding: string;
          }>(sql`
            select
              coalesce((select sum(amount) from payments where workspace_id = ${ws} and status = 'COMPLETED' and paid_on >= date_trunc('year', ${today}::date)), 0) as ytd,
              coalesce((select sum(amount) from payments where workspace_id = ${ws} and status = 'COMPLETED' and paid_on > ${today}::date - 30), 0) as last30,
              coalesce((select sum(total - amount_paid) from invoices where workspace_id = ${ws} and status in ('SENT', 'OVERDUE')), 0) as outstanding
          `);
          const overdue = await tx
            .select({
              number: invoices.number,
              client: clients.company,
              balance: sql<number>`${invoices.total} - ${invoices.amountPaid}`.mapWith(Number),
              dueDate: invoices.dueDate,
            })
            .from(invoices)
            .innerJoin(clients, eq(clients.id, invoices.clientId))
            .where(and(eq(invoices.workspaceId, ws), inArray(invoices.status, ["SENT", "OVERDUE"]), lt(invoices.dueDate, today)))
            .orderBy(asc(invoices.dueDate));
          return {
            revenueThisYear: money(Number(summary.ytd)),
            collectedLast30Days: money(Number(summary.last30)),
            outstanding: money(Number(summary.outstanding)),
            overdueInvoices: overdue.map((o) => ({
              ...o,
              balance: money(o.balance),
            })),
          };
        }),
    }),
  };
}

/** Everything about one client, as the signed-in user may see it (RLS). */
export async function loadClientSnapshot(ctx: AppContext, clientId: string, today: string) {
  const ws = ctx.workspace.id;
  const money = (n: number) => formatMoney(n, { currency: ctx.workspace.currency });
  return ctx.db(async (tx) => {
    const client = await tx.query.clients.findFirst({
      where: and(eq(clients.id, clientId), eq(clients.workspaceId, ws)),
    });
    if (!client) return { error: "Client not found or not accessible." };
    const [clientProjects, clientInvoices, recent] = await Promise.all([
      tx
        .select({
          name: projects.name,
          status: projects.status,
          progress: projects.progress,
          dueDate: projects.dueDate,
        })
        .from(projects)
        .where(eq(projects.clientId, clientId)),
      tx
        .select({
          number: invoices.number,
          status: invoices.status,
          total: invoices.total,
          paid: invoices.amountPaid,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
        })
        .from(invoices)
        .where(eq(invoices.clientId, clientId))
        .orderBy(desc(invoices.issueDate)),
      tx
        .select({
          action: activityLogs.action,
          label: activityLogs.entityLabel,
          at: activityLogs.createdAt,
        })
        .from(activityLogs)
        .where(eq(activityLogs.clientId, clientId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(10),
    ]);
    const paid = clientInvoices.reduce((s, i) => s + i.paid, 0);
    const outstanding = clientInvoices
      .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
      .reduce((s, i) => s + i.total - i.paid, 0);
    return {
      company: client.company,
      contact: client.name,
      email: client.email,
      phone: client.phone,
      status: client.status,
      tags: client.tags,
      notes: client.notes,
      clientSince: client.createdAt.toISOString().slice(0, 10),
      lifetimeRevenue: money(paid),
      outstanding: money(outstanding),
      projects: clientProjects,
      invoices: clientInvoices.map((i) => ({
        ...i,
        total: money(i.total),
        paid: money(i.paid),
        overdue: (i.status === "SENT" || i.status === "OVERDUE") && i.dueDate < today,
      })),
      recentActivity: recent.map((r) => ({
        action: r.action,
        item: r.label,
        at: r.at.toISOString().slice(0, 10),
      })),
    };
  });
}
