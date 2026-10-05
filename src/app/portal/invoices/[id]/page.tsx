import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { Panel } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";
import { InvoiceDocument } from "@/features/invoices/components/invoice-document";
import { PaymentList } from "@/features/invoices/components/payment-list";
import { toDocumentData } from "@/features/invoices/document-data";
import { getInvoice } from "@/features/invoices/queries";
import { formatMoney } from "@/lib/money";
import { requireClientContext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Invoice" };

export default async function PortalInvoicePage({ params }: PageProps<"/portal/invoices/[id]">) {
  const ctx = await requireClientContext();
  const { id } = await params;
  const details = await ctx.db((tx) => getInvoice(tx, ctx.workspace.id, id).catch(() => null));
  if (!details) notFound();
  const { invoice } = details;
  const balance = Math.max(0, invoice.total - invoice.amountPaid);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/portal/invoices" className="text-xs text-muted-foreground hover:text-foreground">
          ← All invoices
        </Link>
        <Button asChild>
          <a href={`/api/invoices/${id}/pdf`} download>
            <Download /> Download PDF
          </a>
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
        <InvoiceDocument data={toDocumentData(details, ctx.workspace)} />
        <div className="space-y-4">
          <Panel className="p-5">
            <p className="text-xs text-muted-foreground">
              {balance > 0 && invoice.status !== "CANCELLED" ? "Balance due" : "Status"}
            </p>
            <p className="tabular mt-1 text-2xl font-semibold">
              {balance > 0 && invoice.status !== "CANCELLED"
                ? formatMoney(balance, { currency: invoice.currency })
                : invoice.status === "PAID"
                  ? "Paid in full"
                  : "Cancelled"}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Pay using the instructions on the invoice. Your payment will show here once {ctx.workspace.name} records it.
            </p>
          </Panel>
          <Panel className="p-5">
            <p className="mb-3 text-sm font-semibold">Payments</p>
            <PaymentList payments={details.payments} currency={invoice.currency} readOnly />
          </Panel>
        </div>
      </div>
    </div>
  );
}
