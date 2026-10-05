import "server-only";

import { and, count, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";

import { PAGE_SIZE } from "@/lib/constants";
import type { Tx } from "@/server/db";
import { clients, invoices, payments, profiles, type PaymentMethod, type PaymentStatus } from "@/server/db/schema";

export async function listPayments(
  tx: Tx,
  workspaceId: string,
  f: { method?: PaymentMethod; status?: PaymentStatus; from?: string; page: number },
) {
  const where: SQL[] = [eq(payments.workspaceId, workspaceId)];
  if (f.method) where.push(eq(payments.method, f.method));
  if (f.status) where.push(eq(payments.status, f.status));
  if (f.from) where.push(gte(payments.paidOn, f.from));

  const [rows, [{ total }], byMethod] = await Promise.all([
    tx
      .select({
        id: payments.id,
        amount: payments.amount,
        method: payments.method,
        status: payments.status,
        paidOn: payments.paidOn,
        reference: payments.reference,
        invoiceId: invoices.id,
        invoiceNumber: invoices.number,
        currency: invoices.currency,
        clientName: sql<string>`coalesce(${clients.company}, ${clients.name})`,
        recordedBy: profiles.fullName,
      })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .leftJoin(profiles, eq(profiles.id, payments.recordedById))
      .where(and(...where))
      .orderBy(desc(payments.paidOn), desc(payments.createdAt))
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    tx
      .select({ total: count() })
      .from(payments)
      .where(and(...where)),
    tx
      .select({ method: payments.method, amount: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number), n: count() })
      .from(payments)
      .where(and(...where, eq(payments.status, "COMPLETED")))
      .groupBy(payments.method),
  ]);
  return { rows, total, byMethod };
}

export async function unpaidInvoiceOptions(tx: Tx, workspaceId: string) {
  const rows = await tx
    .select({
      id: invoices.id,
      number: invoices.number,
      client: sql<string>`coalesce(${clients.company}, ${clients.name})`,
      balance: sql<number>`${invoices.total} - ${invoices.amountPaid}`.mapWith(Number),
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.workspaceId, workspaceId), inArray(invoices.status, ["SENT", "OVERDUE"])))
    .orderBy(desc(invoices.issueDate));
  return rows.map((r) => ({ id: r.id, label: `${r.number} · ${r.client}`, balance: Math.round(r.balance * 100) / 100 }));
}
