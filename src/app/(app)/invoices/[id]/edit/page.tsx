import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { clientOptions } from "@/features/clients/queries";
import { InvoiceEditor } from "@/features/invoices/components/invoice-editor";
import { getInvoice } from "@/features/invoices/queries";
import { requirePagePermission, requireStaffContext } from "@/server/auth/session";
import { projects } from "@/server/db/schema";
import { features } from "@/server/env";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  const ctx = await requireStaffContext();
  requirePagePermission(ctx, "invoice:manage");
  const { id } = await params;

  const data = await ctx.db(async (tx) => {
    const details = await getInvoice(tx, ctx.workspace.id, id).catch(() => null);
    if (!details) return null;
    const [clients, projectRows] = await Promise.all([
      clientOptions(tx, ctx.workspace.id),
      tx
        .select({ id: projects.id, label: projects.name, clientId: projects.clientId })
        .from(projects)
        .where(eq(projects.workspaceId, ctx.workspace.id))
        .orderBy(asc(projects.name)),
    ]);
    return { details, clients, projectRows };
  });
  if (!data) notFound();
  const { invoice, items } = data.details;
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") redirect(`/invoices/${id}`);

  return (
    <>
      <PageHeader
        title={`Edit ${invoice.number}`}
        breadcrumbs={[
          { label: "Invoices", href: "/invoices" },
          { label: invoice.number, href: `/invoices/${id}` },
          { label: "Edit" },
        ]}
      />
      <InvoiceEditor
        invoiceId={id}
        clients={data.clients}
        projects={data.projectRows}
        currency={invoice.currency}
        numberPreview={invoice.number}
        aiEnabled={features.ai()}
        initial={{
          clientId: invoice.clientId,
          projectId: invoice.projectId,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          notes: invoice.notes ?? "",
          discountType: invoice.discountType,
          discountValue: invoice.discountValue,
          taxRate: invoice.taxRate,
          items: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
        }}
      />
    </>
  );
}
