import "server-only";

import { and, asc, eq, gte, inArray, isNotNull, lte, ne } from "drizzle-orm";

import { can } from "@/lib/permissions";
import type { AppContext } from "@/server/auth/session";
import type { Tx } from "@/server/db";
import { calendarEvents, clients, invoices, milestones, projects, tasks } from "@/server/db/schema";

export type CalendarItem = {
  id: string;
  kind: "event" | "task" | "project" | "milestone" | "invoice";
  type: "MEETING" | "DEADLINE" | "MILESTONE" | "OTHER";
  title: string;
  date: string; // YYYY-MM-DD in workspace timezone
  time: string | null;
  endTime: string | null;
  subtitle: string | null;
  href: string | null;
  editable: boolean;
  location: string | null;
};

/** Everything dated between `from` and `to` (inclusive), merged into one list. */
export async function calendarItems(tx: Tx, ctx: AppContext, from: string, to: string): Promise<CalendarItem[]> {
  const ws = ctx.workspace.id;
  const tz = ctx.workspace.timezone;
  const dateOf = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
  const timeOf = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d);
  const startTs = new Date(`${from}T00:00:00Z`);
  startTs.setUTCDate(startTs.getUTCDate() - 1);
  const endTs = new Date(`${to}T23:59:59Z`);
  endTs.setUTCDate(endTs.getUTCDate() + 1);

  const [events, dueTasks, dueProjects, dueMilestones, dueInvoices] = await Promise.all([
    tx
      .select({ e: calendarEvents, projectName: projects.name })
      .from(calendarEvents)
      .leftJoin(projects, eq(projects.id, calendarEvents.projectId))
      .where(and(eq(calendarEvents.workspaceId, ws), gte(calendarEvents.startsAt, startTs), lte(calendarEvents.startsAt, endTs)))
      .orderBy(asc(calendarEvents.startsAt)),
    tx
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, projectName: projects.name })
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(eq(tasks.workspaceId, ws), ne(tasks.status, "DONE"), isNotNull(tasks.dueDate), gte(tasks.dueDate, from), lte(tasks.dueDate, to))),
    tx
      .select({ id: projects.id, name: projects.name, dueDate: projects.dueDate, client: clients.company })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.clientId))
      .where(and(eq(projects.workspaceId, ws), inArray(projects.status, ["PLANNING", "IN_PROGRESS", "REVIEW", "ON_HOLD"]), gte(projects.dueDate, from), lte(projects.dueDate, to))),
    tx
      .select({ id: milestones.id, title: milestones.title, dueDate: milestones.dueDate, projectId: milestones.projectId, projectName: projects.name })
      .from(milestones)
      .innerJoin(projects, eq(projects.id, milestones.projectId))
      .where(and(eq(milestones.workspaceId, ws), ne(milestones.status, "COMPLETED"), gte(milestones.dueDate, from), lte(milestones.dueDate, to))),
    can(ctx.role, "invoice:view")
      ? tx
          .select({ id: invoices.id, number: invoices.number, dueDate: invoices.dueDate, client: clients.company })
          .from(invoices)
          .innerJoin(clients, eq(clients.id, invoices.clientId))
          .where(and(eq(invoices.workspaceId, ws), inArray(invoices.status, ["SENT", "OVERDUE"]), gte(invoices.dueDate, from), lte(invoices.dueDate, to)))
      : Promise.resolve([]),
  ]);

  const items: CalendarItem[] = [
    ...events
      .map(({ e, projectName }) => ({
        id: e.id,
        kind: "event" as const,
        type: e.type,
        title: e.title,
        date: dateOf(e.startsAt),
        time: e.allDay ? null : timeOf(e.startsAt),
        endTime: e.allDay || !e.endsAt ? null : timeOf(e.endsAt),
        subtitle: [projectName, e.description].filter(Boolean).join(" · ") || null,
        href: e.projectId ? `/projects/${e.projectId}` : null,
        editable: can(ctx.role, "calendar:manage"),
        location: e.location,
      }))
      .filter((i) => i.date >= from && i.date <= to),
    ...dueTasks.map((t) => ({ id: t.id, kind: "task" as const, type: "DEADLINE" as const, title: t.title, date: t.dueDate!, time: null, endTime: null, subtitle: t.projectName ? `Task · ${t.projectName}` : "Task", href: `/tasks?task=${t.id}`, editable: false, location: null })),
    ...dueProjects.map((p) => ({ id: p.id, kind: "project" as const, type: "DEADLINE" as const, title: `${p.name} due`, date: p.dueDate!, time: null, endTime: null, subtitle: p.client ? `Project · ${p.client}` : "Project", href: `/projects/${p.id}`, editable: false, location: null })),
    ...dueMilestones.map((m) => ({ id: m.id, kind: "milestone" as const, type: "MILESTONE" as const, title: m.title, date: m.dueDate!, time: null, endTime: null, subtitle: `Milestone · ${m.projectName}`, href: `/projects/${m.projectId}?tab=timeline`, editable: false, location: null })),
    ...dueInvoices.map((i) => ({ id: i.id, kind: "invoice" as const, type: "DEADLINE" as const, title: `${i.number} payment due`, date: i.dueDate, time: null, endTime: null, subtitle: i.client ? `Invoice · ${i.client}` : "Invoice", href: `/invoices/${i.id}`, editable: false, location: null })),
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "00:00").localeCompare(b.time ?? "00:00"));
}
