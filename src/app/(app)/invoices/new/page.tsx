import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";

import { PageHeader } from "@/components/shared/page-header";
import { clientOptions } from "@/features/clients/queries";
import { InvoiceEditor } from "@/features/invoices/components/invoice-editor";
import { addDaysISO, todayISO } from "@/lib/dates";
import { formatInvoiceNumber } from "@/lib/invoice-math";
import { assertCan } from "@/lib/permissions";
import { requireStaffContext } from "@/server/auth/session";
import { projects } from "@/server/db/schema";
import { features } from "@/server/env";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const ctx = await requireStaffContext();
  assertCan(ctx.role, "invoice:manage");
  const sp = await searchParams;
  const today = todayISO(ctx.workspace.timezone);

  const [clients, projectRows] = await ctx.db((tx) =>
    Promise.all([
      clientOptions(tx, ctx.workspace.id),
      tx
        .select({ id: projects.id, label: projects.name, clientId: projects.clientId })
        .from(projects)
        .where(eq(projects.workspaceId, ctx.workspace.id))
        .orderBy(asc(projects.name)),
    ]),
  );
  const presetClient = typeof sp.client === "string" && clients.some((c) => c.id === sp.client) ? sp.client : "";
  const presetProject = typeof sp.project === "string" ? projectRows.find((p) => p.id === sp.project) : undefined;

  return (
    <>
      <PageHeader title="New invoice" breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "New" }]} />
      <InvoiceEditor
        clients={clients}
        projects={projectRows}
        currency={ctx.workspace.currency}
        numberPreview={`${formatInvoiceNumber(ctx.workspace.invoicePrefix, ctx.workspace.nextInvoiceNumber)} (provisional)`}
        aiEnabled={features.ai()}
        initial={{
          clientId: presetProject?.clientId ?? presetClient,
          projectId: presetProject?.id ?? null,
          issueDate: today,
          dueDate: addDaysISO(today, 14),
          notes: "",
          discountType: "PERCENT",
          discountValue: 0,
          taxRate: ctx.workspace.defaultTaxRate,
          items: [{ description: "", quantity: 1, unitPrice: 0 }],
        }}
      />
    </>
  );
}
