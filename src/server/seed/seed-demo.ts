import type { SupabaseClient } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { addDaysISO, todayISO } from "@/lib/dates";
import { calculateInvoiceTotals, formatInvoiceNumber } from "@/lib/invoice-math";
import * as s from "@/server/db/schema";
import {
  DEMO_CLIENTS,
  DEMO_EVENTS,
  DEMO_FILES,
  DEMO_INTERNAL_TASKS,
  DEMO_INVOICES,
  DEMO_LABELS,
  DEMO_MESSAGES,
  DEMO_PEOPLE,
  DEMO_PROJECTS,
  DEMO_WORKSPACE,
  type DemoPersonKey,
} from "./demo-data";

type Db = PostgresJsDatabase<typeof s>;

export const STORAGE_BUCKET = "workspace-files";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);
/** Midday on a date offset from today — keeps seeded timestamps in working hours. */
const atDay = (offset: number, hour = 10) => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return new Date(d.getTime() + offset * DAY);
};

/**
 * Rebuild the demo workspace from scratch. Idempotent: the previous demo
 * workspace (and everything in it, via cascading FKs) is deleted first.
 * Demo profiles are upserted by email so existing Clerk links survive a reset.
 */
export async function seedDemo(db: Db, opts: { storage?: SupabaseClient | null; log?: (msg: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  const today = todayISO();
  const day = (offset: number) => addDaysISO(today, offset);

  // Remove old storage objects before the rows that reference them disappear.
  const old = await db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, DEMO_WORKSPACE.slug) });
  if (old && opts.storage) {
    const oldFiles = await db.select({ path: s.files.storagePath }).from(s.files).where(eq(s.files.workspaceId, old.id));
    if (oldFiles.length) await opts.storage.storage.from(STORAGE_BUCKET).remove(oldFiles.map((f) => f.path));
  }

  return db.transaction(async (tx) => {
    if (old) await tx.delete(s.workspaces).where(eq(s.workspaces.id, old.id));

    /* ------------------------------ people ------------------------------ */
    const people = {} as Record<DemoPersonKey, string>;
    for (const [key, p] of Object.entries(DEMO_PEOPLE) as [DemoPersonKey, (typeof DEMO_PEOPLE)[DemoPersonKey]][]) {
      const existing = await tx.query.profiles.findFirst({ where: sql`lower(${s.profiles.email}) = ${p.email}` });
      if (existing) {
        await tx.update(s.profiles).set({ fullName: p.fullName }).where(eq(s.profiles.id, existing.id));
        people[key] = existing.id;
      } else {
        const [row] = await tx.insert(s.profiles).values({ email: p.email, fullName: p.fullName }).returning({ id: s.profiles.id });
        people[key] = row.id;
      }
    }
    log(`profiles: ${Object.keys(people).length}`);

    /* ----------------------------- workspace ---------------------------- */
    const invoiceCount = DEMO_INVOICES.length;
    const [ws] = await tx
      .insert(s.workspaces)
      .values({ ...DEMO_WORKSPACE, isDemo: true, nextInvoiceNumber: invoiceCount + 1, defaultTaxRate: 16 })
      .returning();
    const workspaceId = ws.id;

    /* ------------------------------ clients ----------------------------- */
    const clients = {} as Record<string, { id: string; company: string }>;
    for (const c of DEMO_CLIENTS) {
      const createdAt = ago(c.createdDaysAgo * DAY);
      const [row] = await tx
        .insert(s.clients)
        .values({
          workspaceId,
          name: c.name,
          company: c.company,
          email: c.email,
          phone: c.phone,
          website: c.website ?? null,
          address: c.address ?? null,
          notes: c.notes ?? null,
          status: c.status,
          tags: c.tags,
          createdById: people.victor,
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: s.clients.id });
      clients[c.key] = { id: row.id, company: c.company };
      await tx.insert(s.clientContacts).values([
        { workspaceId, clientId: row.id, name: c.name, email: c.email, phone: c.phone, isPrimary: true, jobTitle: c.key === "northstar" ? "Marketing Director" : "Owner" },
        ...(c.contacts ?? []).map((ct) => ({ workspaceId, clientId: row.id, name: ct.name, email: ct.email, phone: ct.phone ?? null, jobTitle: ct.jobTitle })),
      ]);
    }
    log(`clients: ${DEMO_CLIENTS.length}`);

    /* ------------------------------ members ----------------------------- */
    await tx.insert(s.workspaceMembers).values(
      (Object.entries(DEMO_PEOPLE) as [DemoPersonKey, (typeof DEMO_PEOPLE)[DemoPersonKey]][]).map(([key, p], i) => ({
        workspaceId,
        profileId: people[key],
        role: p.role,
        title: p.title,
        clientId: p.client ? clients[p.client].id : null,
        createdAt: ago((300 - i * 20) * DAY),
      })),
    );

    /* ------------------------------ labels ------------------------------ */
    const labelRows = await tx
      .insert(s.labels)
      .values(DEMO_LABELS.map((l) => ({ workspaceId, name: l.name, color: l.color })))
      .returning({ id: s.labels.id, name: s.labels.name });
    const labelIds = Object.fromEntries(labelRows.map((l) => [l.name, l.id]));

    /* -------------------------- projects & tasks ------------------------ */
    const projects = {} as Record<string, { id: string; name: string; clientId: string | null }>;
    const activity: (typeof s.activityLogs.$inferInsert)[] = [];
    const act = (a: Omit<typeof s.activityLogs.$inferInsert, "workspaceId">) => activity.push({ workspaceId, ...a });
    const taskIdsByTitle: Record<string, string> = {};

    let taskCount = 0;
    for (const p of DEMO_PROJECTS) {
      const clientId = p.client ? clients[p.client].id : null;
      const doneCount = p.tasks.filter((t) => t.status === "DONE").length;
      const progress =
        p.status === "COMPLETED" ? 100 : p.tasks.length ? Math.round((doneCount / p.tasks.length) * 100) : 0;
      const createdAt = atDay(Math.min(p.startOffset, 0) - 3, 9);

      const [project] = await tx
        .insert(s.projects)
        .values({
          workspaceId,
          clientId,
          name: p.name,
          description: p.description,
          status: p.status,
          priority: p.priority,
          startDate: day(p.startOffset),
          dueDate: day(p.dueOffset),
          budget: p.budget,
          progress,
          createdById: people.victor,
          completedAt: p.status === "COMPLETED" ? atDay(p.dueOffset, 16) : null,
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: s.projects.id });
      projects[p.key] = { id: project.id, name: p.name, clientId };
      act({ actorId: people.victor, action: "project.created", entityType: "project", entityId: project.id, entityLabel: p.name, clientId, projectId: project.id, createdAt });

      if (p.team.length) {
        await tx.insert(s.projectMembers).values(p.team.map((k) => ({ workspaceId, projectId: project.id, profileId: people[k] })));
      }

      if (p.milestones?.length) {
        await tx.insert(s.milestones).values(
          p.milestones.map((m, i) => ({
            workspaceId,
            projectId: project.id,
            title: m.title,
            description: m.description ?? null,
            dueDate: day(m.dueOffset),
            status: m.status,
            position: i,
            approvalStatus: m.approval ?? "NOT_REQUIRED",
            // Only Northstar has a portal user in the demo; other approvals were given offline.
            approvedById: p.client === "northstar" && (m.approval === "APPROVED" || m.approval === "CHANGES_REQUESTED") ? people.grace : null,
            approvedAt: m.approval === "APPROVED" || m.approval === "CHANGES_REQUESTED" ? atDay(m.dueOffset + 1, 15) : null,
            approvalNote: m.approval === "CHANGES_REQUESTED" ? "Please swap the hero image on the About page and tighten the intro copy." : null,
          })),
        );
      }

      for (const [i, t] of p.tasks.entries()) {
        const taskCreated = atDay(Math.max(p.startOffset, (t.dueOffset ?? 0) - 14), 9 + (i % 6));
        const [task] = await tx
          .insert(s.tasks)
          .values({
            workspaceId,
            projectId: project.id,
            title: t.title,
            description: t.description ?? null,
            status: t.status,
            priority: t.priority ?? "MEDIUM",
            assigneeId: t.assignee ? people[t.assignee] : null,
            dueDate: t.dueOffset !== undefined ? day(t.dueOffset) : null,
            position: (i + 1) * 1000,
            completedAt: t.status === "DONE" ? atDay(Math.min((t.dueOffset ?? 0) - 1, 0), 16) : null,
            createdById: people.sarah,
            createdAt: taskCreated,
            updatedAt: taskCreated,
          })
          .returning({ id: s.tasks.id });
        taskCount++;
        taskIdsByTitle[t.title] = task.id;

        if (t.labels?.length) {
          await tx.insert(s.taskLabels).values(t.labels.map((l) => ({ workspaceId, taskId: task.id, labelId: labelIds[l] })));
        }
        for (const c of t.comments ?? []) {
          const createdAt = ago(c.hoursAgo * HOUR);
          await tx.insert(s.taskComments).values({ workspaceId, taskId: task.id, authorId: people[c.author], body: c.body, createdAt });
          act({ actorId: people[c.author], action: "comment.posted", entityType: "task", entityId: task.id, entityLabel: t.title, clientId, projectId: project.id, createdAt });
        }
        if (t.status === "DONE" && t.assignee) {
          act({ actorId: people[t.assignee], action: "task.completed", entityType: "task", entityId: task.id, entityLabel: t.title, clientId, projectId: project.id, createdAt: atDay(Math.min((t.dueOffset ?? 0) - 1, 0), 16) });
        }
      }
    }

    for (const [i, t] of DEMO_INTERNAL_TASKS.entries()) {
      const createdAt = ago((10 - i) * DAY);
      const [task] = await tx
        .insert(s.tasks)
        .values({
          workspaceId,
          title: t.title,
          status: t.status,
          priority: t.priority ?? "MEDIUM",
          assigneeId: t.assignee ? people[t.assignee] : null,
          dueDate: t.dueOffset !== undefined ? day(t.dueOffset) : null,
          position: (i + 1) * 1000,
          createdById: people.victor,
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: s.tasks.id });
      if (t.labels?.length) {
        await tx.insert(s.taskLabels).values(t.labels.map((l) => ({ workspaceId, taskId: task.id, labelId: labelIds[l] })));
      }
      taskCount++;
    }
    log(`projects: ${DEMO_PROJECTS.length}, tasks: ${taskCount}`);

    /* ---------------------------- invoices ------------------------------ */
    const sortedInvoices = [...DEMO_INVOICES].sort((a, b) => a.issueOffset - b.issueOffset);
    const invoiceNumbers: Record<string, { id: string; number: string; client: string; total: number }> = {};
    for (const [i, inv] of sortedInvoices.entries()) {
      const number = formatInvoiceNumber("INV", i + 1);
      const taxRate = inv.taxRate ?? 16;
      const discount = inv.discount ?? { type: "PERCENT" as const, value: 0 };
      const totals = calculateInvoiceTotals({ items: inv.items, discountType: discount.type, discountValue: discount.value, taxRate });
      const issueDate = day(inv.issueOffset);
      const clientId = clients[inv.client].id;
      const projectId = inv.project ? projects[inv.project].id : null;
      const paymentRows = (inv.payments ?? []).map((p) => ({
        amount: Math.round(totals.total * p.amountFraction * 100) / 100,
        method: p.method,
        reference: p.reference,
        paidOn: day(inv.issueOffset + p.daysAfterIssue),
      }));
      // Make sure fractional payments on fully paid invoices add up exactly.
      if (inv.status === "PAID" && paymentRows.length) {
        const sumOthers = paymentRows.slice(0, -1).reduce((sum, p) => sum + p.amount, 0);
        paymentRows[paymentRows.length - 1].amount = Math.round((totals.total - sumOthers) * 100) / 100;
      }
      const amountPaid = paymentRows.reduce((sum, p) => sum + p.amount, 0);
      const createdAt = atDay(inv.issueOffset, 9);
      const lastPayment = paymentRows.at(-1);

      const [row] = await tx
        .insert(s.invoices)
        .values({
          workspaceId,
          clientId,
          projectId,
          number,
          status: inv.status,
          issueDate,
          dueDate: day(inv.issueOffset + inv.termsDays),
          notes: inv.notes ?? "Payment via M-Pesa Paybill 522522, Account 1234567, or bank transfer to Equity Bank, Westlands branch.",
          discountType: discount.type,
          discountValue: discount.value,
          taxRate,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          amountPaid,
          sentAt: inv.status === "DRAFT" ? null : createdAt,
          paidAt: inv.status === "PAID" && lastPayment ? atDay(inv.issueOffset + (inv.payments?.at(-1)?.daysAfterIssue ?? 0), 14) : null,
          createdById: people.sarah,
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: s.invoices.id });
      invoiceNumbers[number] = { id: row.id, number, client: inv.client, total: totals.total };

      await tx.insert(s.invoiceItems).values(
        inv.items.map((item, idx) => ({
          workspaceId,
          invoiceId: row.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: totals.lineAmounts[idx],
          position: idx,
        })),
      );
      act({ actorId: people.sarah, action: "invoice.created", entityType: "invoice", entityId: row.id, entityLabel: number, clientId, projectId, createdAt });
      if (inv.status !== "DRAFT") {
        act({ actorId: people.sarah, action: "invoice.sent", entityType: "invoice", entityId: row.id, entityLabel: number, clientId, projectId, createdAt: new Date(createdAt.getTime() + HOUR) });
      }

      for (const [pi, p] of paymentRows.entries()) {
        const paidAt = atDay(inv.issueOffset + (inv.payments?.[pi].daysAfterIssue ?? 0), 14);
        await tx.insert(s.payments).values({
          workspaceId,
          invoiceId: row.id,
          amount: p.amount,
          method: p.method,
          status: "COMPLETED",
          paidOn: p.paidOn,
          reference: p.reference,
          recordedById: people.sarah,
          createdAt: paidAt,
        });
        act({ actorId: people.sarah, action: "payment.recorded", entityType: "payment", entityId: row.id, entityLabel: number, clientId, projectId, metadata: { amount: p.amount }, createdAt: paidAt });
      }
      if (inv.status === "PAID") {
        act({ actorId: people.sarah, action: "invoice.paid", entityType: "invoice", entityId: row.id, entityLabel: number, clientId, projectId, createdAt: atDay(inv.issueOffset + (inv.payments?.at(-1)?.daysAfterIssue ?? 0), 14) });
      }
    }
    log(`invoices: ${sortedInvoices.length}`);

    /* ---------------------------- messages ------------------------------ */
    await tx.insert(s.messages).values(
      DEMO_MESSAGES.map((m) => ({
        workspaceId,
        projectId: m.project ? projects[m.project].id : null,
        clientId: m.client ? clients[m.client].id : null,
        authorId: people[m.author],
        body: m.body,
        internal: m.internal ?? false,
        createdAt: ago(m.hoursAgo * HOUR),
      })),
    );

    /* ----------------------------- events ------------------------------- */
    await tx.insert(s.calendarEvents).values(
      DEMO_EVENTS.map((e) => {
        const [h, min] = (e.time ?? "00:00").split(":").map(Number);
        const start = atDay(e.dayOffset, 0);
        start.setHours(h, min, 0, 0);
        return {
          workspaceId,
          title: e.title,
          description: e.description ?? null,
          type: e.type,
          startsAt: start,
          endsAt: e.durationMin ? new Date(start.getTime() + e.durationMin * 60_000) : null,
          allDay: !e.time,
          location: e.location ?? null,
          projectId: e.project ? projects[e.project].id : null,
          clientId: e.client ? clients[e.client].id : null,
          createdById: people.sarah,
        };
      }),
    );

    /* ------------------------------ files ------------------------------- */
    if (opts.storage) {
      const folderIds: Record<string, string> = {};
      for (const name of [...new Set(DEMO_FILES.map((f) => f.folder).filter(Boolean))] as string[]) {
        const [folder] = await tx.insert(s.folders).values({ workspaceId, name, createdById: people.victor }).returning({ id: s.folders.id });
        folderIds[name] = folder.id;
      }
      for (const f of DEMO_FILES) {
        const path = `${workspaceId}/${crypto.randomUUID()}/${f.name}`;
        const body = new Blob([f.content], { type: f.mimeType });
        const { error } = await opts.storage.storage.from(STORAGE_BUCKET).upload(path, body, { contentType: f.mimeType });
        if (error) {
          log(`  ! skipped ${f.name}: ${error.message}`);
          continue;
        }
        const createdAt = ago(f.daysAgo * DAY);
        const projectId = f.project ? projects[f.project].id : null;
        const clientId = f.client ? clients[f.client].id : null;
        const [file] = await tx
          .insert(s.files)
          .values({
            workspaceId,
            folderId: f.folder ? folderIds[f.folder] : null,
            projectId,
            clientId,
            name: f.name,
            storagePath: path,
            mimeType: f.mimeType,
            sizeBytes: body.size,
            sharedWithClient: f.shared ?? false,
            uploadedById: people[f.uploader],
            createdAt,
          })
          .returning({ id: s.files.id });
        act({ actorId: people[f.uploader], action: "file.uploaded", entityType: "file", entityId: file.id, entityLabel: f.name, clientId, projectId, createdAt });
      }
      log(`files: ${DEMO_FILES.length}`);
    } else {
      log("files: skipped (storage not configured)");
    }

    /* ----------------------- activity: clients etc ----------------------- */
    for (const c of DEMO_CLIENTS) {
      act({ actorId: people.victor, action: "client.created", entityType: "client", entityId: clients[c.key].id, entityLabel: c.company, clientId: clients[c.key].id, createdAt: ago(c.createdDaysAgo * DAY) });
    }
    act({ actorId: people.grace, action: "milestone.approved", entityType: "milestone", entityLabel: "Design", clientId: clients.northstar.id, projectId: projects.ecommerce.id, createdAt: atDay(-29, 15) });
    act({ actorId: people.sarah, action: "project.status_changed", entityType: "project", entityId: projects["nova-site"].id, entityLabel: "Brand Website", clientId: clients.nova.id, projectId: projects["nova-site"].id, metadata: { to: "REVIEW" }, createdAt: ago(5 * DAY) });
    await tx.insert(s.activityLogs).values(activity);
    log(`activity: ${activity.length}`);

    /* -------------------------- notifications --------------------------- */
    const overdue = Object.values(invoiceNumbers).filter((i) => sortedInvoices[Number(i.number.slice(4)) - 1].status === "OVERDUE");
    const sentToGrace = Object.values(invoiceNumbers).filter((i) => i.client === "northstar" && sortedInvoices[Number(i.number.slice(4)) - 1].status === "SENT");

    const n = (recipient: DemoPersonKey, actor: DemoPersonKey | null, type: string, title: string, href: string, hoursAgo: number, read = false, body?: string) => ({
      workspaceId,
      recipientId: people[recipient],
      actorId: actor ? people[actor] : null,
      type,
      title,
      body: body ?? null,
      href,
      readAt: read ? ago((hoursAgo - 1) * HOUR) : null,
      createdAt: ago(hoursAgo * HOUR),
    });

    await tx.insert(s.notifications).values([
      ...overdue.map((o, i) => n("victor", null, "invoice.overdue", `Invoice ${o.number} is overdue`, `/invoices/${o.id}`, 3 + i)),
      ...overdue.map((o, i) => n("sarah", null, "invoice.overdue", `Invoice ${o.number} is overdue`, `/invoices/${o.id}`, 3 + i)),
      n("victor", "grace", "message.created", "Grace Achieng sent a message in E-commerce Redesign", `/projects/${projects.ecommerce.id}?tab=messages`, 8, false, "Could we also move the newsletter sign-up above the footer on mobile?"),
      n("victor", "brian", "comment.created", "Brian Kiprop commented on “Second channel manager integration”", `/tasks?task=${taskIdsByTitle["Second channel manager integration"]}`, 26),
      n("victor", null, "project.deadline", "Restaurant Ordering System is due in 9 days", `/projects/${projects.ordering.id}`, 12),
      n("victor", "david", "file.uploaded", "David Mutua uploaded UAT checklist.md", `/projects/${projects.ecommerce.id}?tab=files`, 48, true),
      n("victor", null, "milestone.changes_requested", "Nova Interiors requested changes on “Client review”", `/projects/${projects["nova-site"].id}?tab=timeline`, 70, true),
      n("brian", "sarah", "task.assigned", "You were assigned “Fix cart total rounding on discounts”", `/tasks?task=${taskIdsByTitle["Fix cart total rounding on discounts"]}`, 30),
      n("brian", "victor", "comment.created", "Victor Otieno commented on “Second channel manager integration”", `/tasks?task=${taskIdsByTitle["Second channel manager integration"]}`, 30),
      n("brian", null, "task.overdue", "“Kitchen display real-time updates” is overdue", `/tasks?task=${taskIdsByTitle["Kitchen display real-time updates"]}`, 4),
      ...sentToGrace.map((o, i) => n("grace", "sarah", "invoice.sent", `New invoice ${o.number} from Mwangaza Studio`, `/portal/invoices/${o.id}`, 90 - i * 60)),
      n("grace", "victor", "milestone.pending", "“Testing” is ready for your approval", `/portal/projects/${projects.ecommerce.id}`, 20),
      n("grace", "aisha", "message.created", "Aisha Mohamed replied in E-commerce Redesign", `/portal/projects/${projects.ecommerce.id}`, 6),
    ]);

    // Keep the sequence in step with the seeded invoices.
    await tx.update(s.workspaces).set({ nextInvoiceNumber: sortedInvoices.length + 1 }).where(eq(s.workspaces.id, workspaceId));

    log("done");
    return { workspaceId, people };
  });
}
