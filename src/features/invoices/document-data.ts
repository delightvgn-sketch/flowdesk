import type { Workspace } from "@/server/db/schema";

import type { InvoiceDocumentData } from "./components/invoice-document";
import type { InvoiceWithDetails } from "./queries";

/** Shape an invoice + workspace into the data both the HTML and PDF documents render. */
export function toDocumentData(
  d: InvoiceWithDetails,
  workspace: Pick<Workspace, "name" | "email" | "phone" | "address">,
): InvoiceDocumentData {
  const { invoice, client, items, project } = d;
  return {
    number: invoice.number,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    notes: invoice.notes,
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    discountType: invoice.discountType,
    discountValue: invoice.discountValue,
    taxRate: invoice.taxRate,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    from: { name: workspace.name, email: workspace.email, phone: workspace.phone, address: workspace.address },
    to: { company: client.company, name: client.name, email: client.email, phone: client.phone, address: client.address },
    projectName: project?.name ?? null,
    items: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, amount: i.amount })),
  };
}
