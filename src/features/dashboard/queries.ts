import "server-only";

import { and, asc, count, eq, gte, inArray, isNotNull, lt, lte, ne, sql } from "drizzle-orm";

import { ACTIVE_PROJECT_STATUSES } from "@/lib/constants";
import { addDaysISO, todayISO } from "@/lib/dates";
import { can } from "@/lib/permissions";
import type { AppContext } from "@/server/auth/session";
import type { Tx } from "@/server/db";
import { calendarEvents, clients, invoices, profiles, projects, tasks } from "@/server/db/schema";

const n = (v: unknown) => Number(v ?? 0);

export async function getFinancialSummary(tx: Tx, workspaceId: string, today: string) {
  const [row] = await tx.execute<{
    ytd: string;
    this_month: string;
    last_month: string;
    outstanding: string;
    outstanding_count: string;
    overdue: string;
    overdue_count: string;
  }>(sql`
    select
      coalesce((select sum(amount) from payments where workspace_id = ${workspaceId} and status = 'COMPLETED'
        and paid_on >= date_trunc('year', ${today}::date)), 0) as ytd,
      coalesce((select sum(amount) from payments where workspace_id = ${workspaceId} and status = 'COMPLETED'
        and paid_on > ${today}::date - 30), 0) as this_month,
      coalesce((select sum(amount) from payments where workspace_id = ${workspaceId} and status = 'COMPLETED'
        and paid_on > ${today}::date - 60 and paid_on <= ${today}::date - 30), 0) as last_month,
      coalesce((select sum(total - amount_paid) from invoices where workspace_id = ${workspaceId}
        and status in ('SENT', 'OVERDUE')), 0) as outstanding,
      (select count(*) from invoices where workspace_id = ${workspaceId} and status in ('SENT', 'OVERDUE')) as outstanding_count,
      coalesce((select sum(total - amount_paid) from invoices where workspace_id = ${workspaceId}
        and status in ('SENT', 'OVERDUE') and due_date < ${today}::date), 0) as overdue,
      (select count(*) from invoices where workspace_id = ${workspaceId}
        and status in ('SENT', 'OVERDUE') and due_date < ${today}::date) as overdue_count
  `);
  return {
    ytd: n(row.ytd),
    last30: n(row.this_month),
    previous30: n(row.last_month),
    outstanding: n(row.outstanding),
    outstandingCount: n(row.outstanding_count),
    overdue: n(row.overdue),
    overdueCount: n(row.overdue_count),
  };
}

export async function getBusinessSummary(tx: Tx, workspaceId: string, today: string) {
  const [[activeClients], [activeProjects], [openTasks], [overdueTasks], [pendingInvoices], [drafts]] = await Promise.all([
    tx
      .select({ c: count() })
      .from(clients)
      .where(and(eq(clients.workspaceId, workspaceId), eq(clients.status, "ACTIVE"))),
    tx
      .select({ c: count() })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), inArray(projects.status, ACTIVE_PROJECT_STATUSES))),
    tx
      .select({ c: count() })
      .from(tasks)
      .where(and(eq(tasks.workspaceId, workspaceId), ne(tasks.status, "DONE"))),
    tx
      .select({ c: count() })
      .from(tasks)
      .where(and(eq(tasks.workspaceId, workspaceId), ne(tasks.status, "DONE"), lt(tasks.dueDate, today))),
    tx
      .select({ c: count() })
      .from(invoices)
      .where(and(eq(invoices.workspaceId, workspaceId), inArray(invoices.status, ["SENT", "OVERDUE"]))),
    tx
      .select({ c: count() })
      .from(invoices)
      .where(and(eq(invoices.workspaceId, workspaceId), eq(invoices.status, "DRAFT"))),
  ]);
  return {
    activeClients: activeClients.c,
    activeProjects: activeProjects.c,
    openTasks: openTasks.c,
    overdueTasks: overdueTasks.c,
    pendingInvoices: pendingInvoices.c,
    draftInvoices: drafts.c,
  };
}

/** Collected vs invoiced per month, including empty months. */
export async function getRevenueByMonth(tx: Tx, workspaceId: string, today: string, months = 6) {
  const rows = await tx.execute<{ month: string; label: string; collected: string; invoiced: string }>(sql`
    select to_char(m, 'YYYY-MM') as month, to_char(m, 'Mon') as label,
      coalesce((select sum(p.amount) from payments p where p.workspace_id = ${workspaceId} and p.status = 'COMPLETED'
        and date_trunc('month', p.paid_on) = m), 0) as collected,
      coalesce((select sum(i.total) from invoices i where i.workspace_id = ${workspaceId}
        and i.status not in ('DRAFT', 'CANCELLED') and date_trunc('month', i.issue_date) = m), 0) as invoiced
    from generate_series(
      date_trunc('month', ${today}::date) - make_interval(months => ${months - 1}),
      date_trunc('month', ${today}::date),
      interval '1 month'
    ) as m
    order by m
  `);
  return rows.map((r) => ({ month: r.month, label: r.label, collected: n(r.collected), invoiced: n(r.invoiced) }));
}

export async function getInvoiceStatusBreakdown(tx: Tx, workspaceId: string, today: string) {
  const rows = await tx.execute<{ status: string; count: string; amount: string }>(sql`
    select
      case when status = 'SENT' and due_date < ${today}::date then 'OVERDUE' else status::text end as status,
      count(*) as count,
      coalesce(sum(case when status in ('SENT', 'OVERDUE') then total - amount_paid else total end), 0) as amount
    from invoices where workspace_id = ${workspaceId}
    group by 1
  `);
  return rows.map((r) => ({
    status: r.status as "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED",
    count: n(r.count),
    amount: n(r.amount),
  }));
}

/** Tasks created vs completed per week. */
export async function getTaskTrend(tx: Tx, workspaceId: string, today: string, weeks = 8) {
  const rows = await tx.execute<{ week: string; label: string; created: string; completed: string }>(sql`
    select to_char(w, 'YYYY-MM-DD') as week, to_char(w, 'DD Mon') as label,
      (select count(*) from tasks t where t.workspace_id = ${workspaceId}
        and t.created_at >= w and t.created_at < w + interval '7 days') as created,
      (select count(*) from tasks t where t.workspace_id = ${workspaceId}
        and t.completed_at >= w and t.completed_at < w + interval '7 days') as completed
    from generate_series(
      date_trunc('week', ${today}::date) - make_interval(weeks => ${weeks - 1}),
      date_trunc('week', ${today}::date),
      interval '1 week'
    ) as w
    order by w
  `);
  return rows.map((r) => ({ week: r.week, label: r.label, created: n(r.created), completed: n(r.completed) }));
}

export async function getActiveProjects(tx: Tx, workspaceId: string, limit = 6) {
  return tx
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      progress: projects.progress,
      dueDate: projects.dueDate,
      clientName: clients.company,
    })
    .from(projects)
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .where(and(eq(projects.workspaceId, workspaceId), inArray(projects.status, ACTIVE_PROJECT_STATUSES)))
    .orderBy(sql`${projects.dueDate} asc nulls last`)
    .limit(limit);
}

export type UpcomingItem = {
  id: string;
  kind: "meeting" | "task" | "project" | "invoice";
  title: string;
  subtitle: string | null;
  date: string;
  time?: string | null;
  href: string;
  overdue?: boolean;
};

export async function getUpcoming(tx: Tx, ctx: AppContext, today: string): Promise<UpcomingItem[]> {
  const horizon = addDaysISO(today, 14);
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
  const managers = can(ctx.role, "invoice:view");

  const [meetings, dueTasks, dueProjects, overdueInvoices] = await Promise.all([
    tx
      .select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        startsAt: calendarEvents.startsAt,
        location: calendarEvents.location,
        allDay: calendarEvents.allDay,
      })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.workspaceId, ctx.workspace.id),
          gte(calendarEvents.startsAt, now),
          lte(calendarEvents.startsAt, weekAhead),
        ),
      )
      .orderBy(asc(calendarEvents.startsAt))
      .limit(4),
    tx
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        projectName: projects.name,
        assignee: profiles.fullName,
      })
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(profiles, eq(profiles.id, tasks.assigneeId))
      .where(
        and(
          eq(tasks.workspaceId, ctx.workspace.id),
          ne(tasks.status, "DONE"),
          isNotNull(tasks.dueDate),
          lte(tasks.dueDate, horizon),
          managers ? undefined : eq(tasks.assigneeId, ctx.profile.id),
        ),
      )
      .orderBy(asc(tasks.dueDate))
      .limit(6),
    tx
      .select({ id: projects.id, name: projects.name, dueDate: projects.dueDate, clientName: clients.company })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.clientId))
      .where(
        and(
          eq(projects.workspaceId, ctx.workspace.id),
          inArray(projects.status, ACTIVE_PROJECT_STATUSES),
          isNotNull(projects.dueDate),
          lte(projects.dueDate, horizon),
        ),
      )
      .orderBy(asc(projects.dueDate))
      .limit(4),
    managers
      ? tx
          .select({
            id: invoices.id,
            number: invoices.number,
            dueDate: invoices.dueDate,
            clientName: clients.company,
            balance: sql<number>`${invoices.total} - ${invoices.amountPaid}`.mapWith(Number),
          })
          .from(invoices)
          .innerJoin(clients, eq(clients.id, invoices.clientId))
          .where(
            and(
              eq(invoices.workspaceId, ctx.workspace.id),
              inArray(invoices.status, ["SENT", "OVERDUE"]),
              lt(invoices.dueDate, today),
            ),
          )
          .orderBy(asc(invoices.dueDate))
          .limit(4)
      : [],
  ]);

  const tz = ctx.workspace.timezone;
  const fmtTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(d);
  const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);

  return [
    ...meetings.map((m) => ({
      id: m.id,
      kind: "meeting" as const,
      title: m.title,
      subtitle: m.location,
      date: fmtDate(m.startsAt),
      time: m.allDay ? null : fmtTime(m.startsAt),
      href: "/calendar",
    })),
    ...dueProjects.map((p) => ({
      id: p.id,
      kind: "project" as const,
      title: `${p.name} due`,
      subtitle: p.clientName,
      date: p.dueDate!,
      href: `/projects/${p.id}`,
      overdue: p.dueDate! < today,
    })),
    ...dueTasks.map((t) => ({
      id: t.id,
      kind: "task" as const,
      title: t.title,
      subtitle: [t.projectName, managers ? t.assignee : null].filter(Boolean).join(" · ") || null,
      date: t.dueDate!,
      href: `/tasks?task=${t.id}`,
      overdue: t.dueDate! < today,
    })),
    ...overdueInvoices.map((i) => ({
      id: i.id,
      kind: "invoice" as const,
      title: `${i.number} overdue`,
      subtitle: i.clientName,
      date: i.dueDate,
      href: `/invoices/${i.id}`,
      overdue: true,
    })),
  ];
}

export function workspaceToday(ctx: AppContext) {
  return todayISO(ctx.workspace.timezone);
}
