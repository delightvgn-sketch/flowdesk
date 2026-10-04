import "server-only";

import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";

import { PAGE_SIZE } from "@/lib/constants";
import type { Tx } from "@/server/db";
import { clients, invoiceItems, invoices, payments, profiles, projects, type InvoiceStatus } from "@/server/db/schema";

export type InvoiceFilters = {
  q?: string;
  status?: InvoiceStatus;
  clientId?: string;
  from?: string;
  to?: string;
  page: number;
};

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listInvoices(tx: Tx, workspaceId: string, f: InvoiceFilters) {
  const where: SQL[] = [eq(invoices.workspaceId, workspaceId)];
  if (f.q) where.push(or(ilike(invoices.number, like(f.q)), ilike(clients.company, like(f.q)), ilike(clients.name, like(f.q)))!);
  if (f.status) where.push(eq(invoices.status, f.status));
  if (f.clientId) where.push(eq(invoices.clientId, f.clientId));
  if (f.from) where.push(gte(invoices.issueDate, f.from));
  if (f.to) where.push(lte(invoices.issueDate, f.to));

  const [rows, [{ total }]] = await Promise.all([
    tx
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        total: invoices.total,
        amountPaid: invoices.amountPaid,
        currency: invoices.currency,
        clientId: invoices.clientId,
        clientName: sql<string>`coalesce(${clients.company}, ${clients.name})`,
        projectName: projects.name,
      })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .leftJoin(projects, eq(projects.id, invoices.projectId))
      .where(and(...where))
      .orderBy(desc(invoices.issueDate), desc(invoices.number))
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    tx
      .select({ total: count() })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(and(...where)),
  ]);
  return { rows, total };
}

export async function invoiceSummary(tx: Tx, workspaceId: string, today: string) {
  const [row] = await tx.execute<{ outstanding: string; overdue: string; paid30: string; drafts: string }>(sql`
    select
      coalesce(sum(total - amount_paid) filter (where status in ('SENT', 'OVERDUE')), 0) as outstanding,
      coalesce(sum(total - amount_paid) filter (where status in ('SENT', 'OVERDUE') and due_date < ${today}::date), 0) as overdue,
      coalesce((select sum(amount) from payments where workspace_id = ${workspaceId} and status = 'COMPLETED' and paid_on > ${today}::date - 30), 0) as paid30,
      count(*) filter (where status = 'DRAFT') as drafts
    from invoices where workspace_id = ${workspaceId}
  `);
  return { outstanding: Number(row.outstanding), overdue: Number(row.overdue), paid30: Number(row.paid30), drafts: Number(row.drafts) };
}

export async function getInvoice(tx: Tx, workspaceId: string, id: string) {
  const invoice = await tx.query.invoices.findFirst({ where: and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)) });
  if (!invoice) return null;
  const [client, items, paymentRows, project] = await Promise.all([
    tx.query.clients.findFirst({ where: eq(clients.id, invoice.clientId) }),
    tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.position)),
    tx
      .select({
        id: payments.id,
        amount: payments.amount,
        method: payments.method,
        status: payments.status,
        paidOn: payments.paidOn,
        reference: payments.reference,
        notes: payments.notes,
        recordedBy: profiles.fullName,
      })
      .from(payments)
      .leftJoin(profiles, eq(profiles.id, payments.recordedById))
      .where(eq(payments.invoiceId, id))
      .orderBy(desc(payments.paidOn), desc(payments.createdAt)),
    invoice.projectId ? tx.query.projects.findFirst({ where: eq(projects.id, invoice.projectId) }) : Promise.resolve(undefined),
  ]);
  if (!client) return null;
  return { invoice, client, items, payments: paymentRows, project: project ?? null };
}

export type InvoiceWithDetails = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;
