"use server";

import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { addDaysISO, todayISO } from "@/lib/dates";
import { calculateInvoiceTotals } from "@/lib/invoice-math";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";
import { idSchema, invoiceSchema, paymentSchema } from "@/lib/validation";
import { createAction } from "@/server/actions/safe-action";
import type { AppContext } from "@/server/auth/session";
import type { Tx } from "@/server/db";
import { clients, invoiceItems, invoices, payments, projects, workspaceMembers } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/errors";
import { logActivity, notify } from "@/server/services/activity";
import { nextInvoiceNumber, refreshInvoicePaymentState } from "@/server/services/invoices";

type InvoiceInput = z.output<typeof invoiceSchema>;

function revalidateInvoice(id?: string, clientId?: string) {
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/invoices/${id}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/portal", "layout");
}

const today = (ctx: AppContext) => todayISO(ctx.workspace.timezone);

/** Validate links and compute totals on the server — browser totals are never used. */
async function prepare(tx: Tx, ctx: AppContext, input: InvoiceInput) {
  const client = await tx.query.clients.findFirst({
    where: and(eq(clients.id, input.clientId), eq(clients.workspaceId, ctx.workspace.id)),
  });
  if (!client) throw new NotFoundError("Client");
  if (input.projectId) {
    const project = await tx.query.projects.findFirst({
      where: and(eq(projects.id, input.projectId), eq(projects.workspaceId, ctx.workspace.id)),
    });
    if (!project) throw new NotFoundError("Project");
    if (project.clientId && project.clientId !== input.clientId)
      throw new UserFacingError("That project belongs to a different client.");
  }
  const totals = calculateInvoiceTotals(input);
  return { client, totals };
}

async function writeItems(tx: Tx, ctx: AppContext, invoiceId: string, input: InvoiceInput, lineAmounts: number[]) {
  await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  await tx.insert(invoiceItems).values(
    input.items.map((item, i) => ({
      workspaceId: ctx.workspace.id,
      invoiceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: lineAmounts[i],
      position: i,
    })),
  );
}

async function clientPortalUsers(tx: Tx, ctx: AppContext, clientId: string) {
  const rows = await tx
    .select({ id: workspaceMembers.profileId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, ctx.workspace.id), eq(workspaceMembers.clientId, clientId)));
  return rows.map((r) => r.id);
}

export const createInvoice = createAction(
  { schema: invoiceSchema.safeExtend({ send: z.boolean().default(false) }), permission: "invoice:manage" },
  async ({ send, ...input }, ctx) => {
    const invoice = await ctx.db(async (tx) => {
      const { totals } = await prepare(tx, ctx, input);
      const number = await nextInvoiceNumber(tx, ctx.workspace.id);
      const [row] = await tx
        .insert(invoices)
        .values({
          workspaceId: ctx.workspace.id,
          clientId: input.clientId,
          projectId: input.projectId,
          number,
          status: send ? "SENT" : "DRAFT",
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          currency: ctx.workspace.currency,
          notes: input.notes,
          discountType: input.discountType,
          discountValue: input.discountValue,
          taxRate: input.taxRate,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          sentAt: send ? new Date() : null,
          createdById: ctx.profile.id,
        })
        .returning();
      await writeItems(tx, ctx, row.id, input, totals.lineAmounts);
      await logActivity(tx, ctx, {
        action: "invoice.created",
        entityType: "invoice",
        entityId: row.id,
        entityLabel: number,
        clientId: row.clientId,
        projectId: row.projectId,
      });
      if (send) await afterSend(tx, ctx, row);
      return row;
    });
    revalidateInvoice(invoice.id, invoice.clientId);
    return { id: invoice.id, number: invoice.number };
  },
);

export const updateInvoice = createAction(
  { schema: invoiceSchema.safeExtend({ id: z.uuid() }), permission: "invoice:manage" },
  async ({ id, ...input }, ctx) => {
    const invoice = await ctx.db(async (tx) => {
      const existing = await tx.query.invoices.findFirst({
        where: and(eq(invoices.id, id), eq(invoices.workspaceId, ctx.workspace.id)),
      });
      if (!existing) throw new NotFoundError("Invoice");
      if (existing.status === "PAID" || existing.status === "CANCELLED") {
        throw new UserFacingError(
          `${existing.status === "PAID" ? "Paid" : "Cancelled"} invoices can't be edited. Duplicate it instead.`,
        );
      }
      const { totals } = await prepare(tx, ctx, input);
      const [row] = await tx
        .update(invoices)
        .set({
          clientId: input.clientId,
          projectId: input.projectId,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          notes: input.notes,
          discountType: input.discountType,
          discountValue: input.discountValue,
          taxRate: input.taxRate,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
        })
        .where(eq(invoices.id, id))
        .returning();
      await writeItems(tx, ctx, id, input, totals.lineAmounts);
      // Totals or due date changed: re-derive paid/overdue state.
      await refreshInvoicePaymentState(tx, id, today(ctx));
      return row;
    });
    revalidateInvoice(id, invoice.clientId);
  },
);

async function afterSend(tx: Tx, ctx: AppContext, row: typeof invoices.$inferSelect) {
  await logActivity(tx, ctx, {
    action: "invoice.sent",
    entityType: "invoice",
    entityId: row.id,
    entityLabel: row.number,
    clientId: row.clientId,
    projectId: row.projectId,
  });
  await notify(tx, ctx, {
    recipientIds: await clientPortalUsers(tx, ctx, row.clientId),
    category: "invoices",
    type: "invoice.sent",
    title: `New invoice ${row.number} from ${ctx.workspace.name}`,
    body: `${formatMoney(row.total, { currency: row.currency })} due ${row.dueDate}`,
    href: `/portal/invoices/${row.id}`,
  });
}

/**
 * Mark as sent. Delivery is simulated in this portfolio build: the client sees
 * the invoice in their portal (and gets a notification); a share link can be
 * copied for email/WhatsApp.
 */
export const sendInvoice = createAction({ schema: idSchema, permission: "invoice:manage" }, async ({ id }, ctx) => {
  const row = await ctx.db(async (tx) => {
    const existing = await tx.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.workspaceId, ctx.workspace.id)),
    });
    if (!existing) throw new NotFoundError("Invoice");
    if (existing.status !== "DRAFT") throw new UserFacingError("Only draft invoices can be sent.");
    const [updated] = await tx
      .update(invoices)
      .set({ status: "SENT", sentAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    await refreshInvoicePaymentState(tx, id, today(ctx));
    await afterSend(tx, ctx, updated);
    return updated;
  });
  revalidateInvoice(id, row.clientId);
});

/** Mark paid = record a completed payment for the outstanding balance. */
export const markInvoicePaid = createAction(
  {
    schema: idSchema.extend({
      method: z.enum(PAYMENT_METHODS),
      paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reference: z.string().trim().max(80).optional(),
    }),
    permission: "payment:manage",
  },
  async ({ id, method, paidOn, reference }, ctx) => {
    const row = await ctx.db(async (tx) => {
      const existing = await tx.query.invoices.findFirst({
        where: and(eq(invoices.id, id), eq(invoices.workspaceId, ctx.workspace.id)),
      });
      if (!existing) throw new NotFoundError("Invoice");
      if (existing.status === "DRAFT" || existing.status === "CANCELLED")
        throw new UserFacingError("Send the invoice before marking it paid.");
      const balance = Math.round((existing.total - existing.amountPaid) * 100) / 100;
      if (balance <= 0) throw new UserFacingError("This invoice is already fully paid.");
      await tx.insert(payments).values({
        workspaceId: ctx.workspace.id,
        invoiceId: id,
        amount: balance,
        method,
        status: "COMPLETED",
        paidOn,
        reference: reference || null,
        recordedById: ctx.profile.id,
      });
      const state = await refreshInvoicePaymentState(tx, id, today(ctx));
      await logActivity(tx, ctx, {
        action: "payment.recorded",
        entityType: "payment",
        entityId: id,
        entityLabel: existing.number,
        clientId: existing.clientId,
        projectId: existing.projectId,
        metadata: { amount: balance },
      });
      await logActivity(tx, ctx, {
        action: "invoice.paid",
        entityType: "invoice",
        entityId: id,
        entityLabel: existing.number,
        clientId: existing.clientId,
        projectId: existing.projectId,
      });
      return state!.after;
    });
    revalidateInvoice(id, row.clientId);
  },
);

export const recordPayment = createAction({ schema: paymentSchema, permission: "payment:manage" }, async (input, ctx) => {
  const row = await ctx.db(async (tx) => {
    const invoice = await tx.query.invoices.findFirst({
      where: and(eq(invoices.id, input.invoiceId), eq(invoices.workspaceId, ctx.workspace.id)),
    });
    if (!invoice) throw new NotFoundError("Invoice");
    if (invoice.status === "DRAFT" || invoice.status === "CANCELLED")
      throw new UserFacingError("Payments can only be recorded against sent invoices.");
    const balance = Math.round((invoice.total - invoice.amountPaid) * 100) / 100;
    if (input.status === "COMPLETED" && input.amount > balance + 0.001) {
      throw new UserFacingError(
        `That's more than the outstanding balance of ${formatMoney(balance, { currency: invoice.currency })}.`,
      );
    }
    await tx.insert(payments).values({ ...input, workspaceId: ctx.workspace.id, recordedById: ctx.profile.id });
    const state = await refreshInvoicePaymentState(tx, invoice.id, today(ctx));
    await logActivity(tx, ctx, {
      action: "payment.recorded",
      entityType: "payment",
      entityId: invoice.id,
      entityLabel: invoice.number,
      clientId: invoice.clientId,
      projectId: invoice.projectId,
      metadata: { amount: input.amount },
    });
    if (state?.before.status !== "PAID" && state?.after.status === "PAID") {
      await logActivity(tx, ctx, {
        action: "invoice.paid",
        entityType: "invoice",
        entityId: invoice.id,
        entityLabel: invoice.number,
        clientId: invoice.clientId,
        projectId: invoice.projectId,
      });
    }
    return invoice;
  });
  revalidateInvoice(row.id, row.clientId);
});

export const updatePaymentStatus = createAction(
  { schema: idSchema.extend({ status: z.enum(PAYMENT_STATUSES) }), permission: "payment:manage" },
  async ({ id, status }, ctx) => {
    const invoiceId = await ctx.db(async (tx) => {
      const [payment] = await tx
        .update(payments)
        .set({ status })
        .where(and(eq(payments.id, id), eq(payments.workspaceId, ctx.workspace.id)))
        .returning();
      if (!payment) throw new NotFoundError("Payment");
      await refreshInvoicePaymentState(tx, payment.invoiceId, today(ctx));
      return payment.invoiceId;
    });
    revalidateInvoice(invoiceId);
  },
);

export const deletePayment = createAction({ schema: idSchema, permission: "payment:manage" }, async ({ id }, ctx) => {
  const invoiceId = await ctx.db(async (tx) => {
    const [payment] = await tx
      .delete(payments)
      .where(and(eq(payments.id, id), eq(payments.workspaceId, ctx.workspace.id)))
      .returning();
    if (!payment) throw new NotFoundError("Payment");
    await refreshInvoicePaymentState(tx, payment.invoiceId, today(ctx));
    return payment.invoiceId;
  });
  revalidateInvoice(invoiceId);
});

export const cancelInvoice = createAction({ schema: idSchema, permission: "invoice:manage" }, async ({ id }, ctx) => {
  const row = await ctx.db(async (tx) => {
    const existing = await tx.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.workspaceId, ctx.workspace.id)),
    });
    if (!existing) throw new NotFoundError("Invoice");
    if (existing.status === "PAID") throw new UserFacingError("Paid invoices can't be cancelled. Refund the payment first.");
    const [updated] = await tx
      .update(invoices)
      .set({ status: "CANCELLED", shareToken: null })
      .where(eq(invoices.id, id))
      .returning();
    await logActivity(tx, ctx, {
      action: "invoice.cancelled",
      entityType: "invoice",
      entityId: id,
      entityLabel: existing.number,
      clientId: existing.clientId,
      projectId: existing.projectId,
    });
    return updated;
  });
  revalidateInvoice(id, row.clientId);
});

export const deleteInvoice = createAction({ schema: idSchema, permission: "invoice:manage" }, async ({ id }, ctx) => {
  const row = await ctx.db(async (tx) => {
    const existing = await tx.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.workspaceId, ctx.workspace.id)),
    });
    if (!existing) throw new NotFoundError("Invoice");
    if (existing.status !== "DRAFT")
      throw new UserFacingError("Only drafts can be deleted. Cancel sent invoices to keep the record.");
    await tx.delete(invoices).where(eq(invoices.id, id));
    return existing;
  });
  revalidateInvoice(undefined, row.clientId);
});

export const duplicateInvoice = createAction({ schema: idSchema, permission: "invoice:manage" }, async ({ id }, ctx) => {
  const copy = await ctx.db(async (tx) => {
    const source = await tx.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.workspaceId, ctx.workspace.id)),
    });
    if (!source) throw new NotFoundError("Invoice");
    const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    const issueDate = today(ctx);
    const terms = Math.max(0, Math.round((Date.parse(source.dueDate) - Date.parse(source.issueDate)) / 86_400_000));
    const number = await nextInvoiceNumber(tx, ctx.workspace.id);
    const [row] = await tx
      .insert(invoices)
      .values({
        workspaceId: ctx.workspace.id,
        clientId: source.clientId,
        projectId: source.projectId,
        number,
        status: "DRAFT",
        issueDate,
        dueDate: addDaysISO(issueDate, terms),
        currency: source.currency,
        notes: source.notes,
        discountType: source.discountType,
        discountValue: source.discountValue,
        taxRate: source.taxRate,
        subtotal: source.subtotal,
        discountTotal: source.discountTotal,
        taxTotal: source.taxTotal,
        total: source.total,
        createdById: ctx.profile.id,
      })
      .returning();
    if (items.length) {
      await tx.insert(invoiceItems).values(
        items.map((item) => ({
          workspaceId: item.workspaceId,
          invoiceId: row.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          position: item.position,
        })),
      );
    }
    await logActivity(tx, ctx, {
      action: "invoice.created",
      entityType: "invoice",
      entityId: row.id,
      entityLabel: number,
      clientId: row.clientId,
      projectId: row.projectId,
    });
    return row;
  });
  revalidateInvoice(copy.id, copy.clientId);
  return { id: copy.id };
});

/** Create (or rotate) a public, unguessable share link for the invoice. */
export const createShareLink = createAction({ schema: idSchema, permission: "invoice:manage" }, async ({ id }, ctx) => {
  const token = randomBytes(24).toString("base64url");
  await ctx.db(async (tx) => {
    const existing = await tx.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.workspaceId, ctx.workspace.id)),
    });
    if (!existing) throw new NotFoundError("Invoice");
    if (existing.status === "DRAFT" || existing.status === "CANCELLED")
      throw new UserFacingError("Send the invoice before sharing it.");
    await tx.update(invoices).set({ shareToken: token }).where(eq(invoices.id, id));
  });
  revalidatePath(`/invoices/${id}`);
  return { token };
});

export const revokeShareLink = createAction({ schema: idSchema, permission: "invoice:manage" }, async ({ id }, ctx) => {
  await ctx.db((tx) =>
    tx
      .update(invoices)
      .set({ shareToken: null })
      .where(and(eq(invoices.id, id), eq(invoices.workspaceId, ctx.workspace.id))),
  );
  revalidatePath(`/invoices/${id}`);
});
