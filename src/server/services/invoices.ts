import "server-only";

import { and, eq, lt, sql } from "drizzle-orm";

import { deriveInvoiceStatus, formatInvoiceNumber, sumCompletedPayments } from "@/lib/invoice-math";
import type { Tx } from "@/server/db";
import { invoices, payments, workspaces } from "@/server/db/schema";

/**
 * Reserve the next invoice number. The UPDATE … RETURNING takes a row lock on
 * the workspace, so concurrent invoice creation can never hand out the same
 * number (and the unique index would reject it anyway).
 */
export async function nextInvoiceNumber(tx: Tx, workspaceId: string): Promise<string> {
  const [row] = await tx
    .update(workspaces)
    .set({ nextInvoiceNumber: sql`${workspaces.nextInvoiceNumber} + 1` })
    .where(eq(workspaces.id, workspaceId))
    .returning({ prefix: workspaces.invoicePrefix, next: workspaces.nextInvoiceNumber });
  if (!row) throw new Error("Workspace not found");
  return formatInvoiceNumber(row.prefix, row.next - 1);
}

/**
 * Recalculate amount paid, status and paid date from the payment records.
 * Payments are the source of truth; the invoice columns are a cache.
 */
export async function refreshInvoicePaymentState(tx: Tx, invoiceId: string, today: string) {
  const invoice = await tx.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
  if (!invoice) return null;
  const rows = await tx
    .select({ amount: payments.amount, status: payments.status, paidOn: payments.paidOn })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));
  const amountPaid = sumCompletedPayments(rows);
  const status = deriveInvoiceStatus({
    current: invoice.status,
    total: invoice.total,
    amountPaid,
    dueDate: invoice.dueDate,
    today,
  });
  const [updated] = await tx
    .update(invoices)
    .set({
      amountPaid,
      status,
      paidAt: status === "PAID" ? (invoice.paidAt ?? new Date()) : null,
    })
    .where(eq(invoices.id, invoiceId))
    .returning();
  return { before: invoice, after: updated };
}

/** Flip sent invoices past their due date to OVERDUE. Cheap single UPDATE. */
export async function syncOverdueInvoices(tx: Tx, workspaceId: string, today: string) {
  return tx
    .update(invoices)
    .set({ status: "OVERDUE" })
    .where(and(eq(invoices.workspaceId, workspaceId), eq(invoices.status, "SENT"), lt(invoices.dueDate, today)))
    .returning({ id: invoices.id, number: invoices.number, clientId: invoices.clientId });
}
