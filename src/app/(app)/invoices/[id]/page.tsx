import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetailRow, Panel } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActivityFeed } from "@/features/activity/activity-feed";
import { listActivity } from "@/features/activity/queries";
import { InvoiceActions, SharePanel } from "@/features/invoices/components/invoice-actions";
import { InvoiceDocument } from "@/features/invoices/components/invoice-document";
import { PaymentList } from "@/features/invoices/components/payment-list";
import { toDocumentData } from "@/features/invoices/document-data";
import { getInvoice } from "@/features/invoices/queries";
import { dueLabel, formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { assertCan } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { requireStaffContext } from "@/server/auth/session";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const ctx = await requireStaffContext();
  assertCan(ctx.role, "invoice:view");
  const { id } = await params;
  const today = todayISO(ctx.workspace.timezone);

  const data = await ctx.db(async (tx) => {
    const details = await getInvoice(tx, ctx.workspace.id, id).catch(() => null);
    if (!details) return null;
    const activity = await listActivity(tx, ctx.workspace.id, { clientId: details.invoice.clientId, limit: 40 });
    return { details, activity: activity.filter((a) => a.entityId === id).slice(0, 8) };
  });
  if (!data) notFound();
  const { invoice, client, payments } = data.details;
  const balance = Math.max(0, Math.round((invoice.total - invoice.amountPaid) * 100) / 100);
  const isOpen = invoice.status === "SENT" || invoice.status === "OVERDUE";
  const due = dueLabel(invoice.dueDate, today);

  return (
    <>
      <PageHeader
        title={invoice.number}
        meta={<StatusBadge kind="invoice" value={invoice.status} />}
        breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: invoice.number }]}
        description={
          <>
            Billed to{" "}
            <Link href={`/clients/${client.id}`} className="font-medium text-foreground hover:underline">
              {client.company ?? client.name}
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <InvoiceDocument data={toDocumentData(data.details, ctx.workspace)} />

        <aside className="space-y-4 lg:sticky lg:top-20">
          <Panel className="p-4 sm:p-5">
            <p className="text-xs text-muted-foreground">{isOpen ? "Balance due" : invoice.status === "PAID" ? "Paid in full" : "Total"}</p>
            <p className="tabular mt-1 text-3xl font-semibold tracking-tight">
              {formatMoney(isOpen ? balance : invoice.total, { currency: invoice.currency })}
            </p>
            {isOpen && <p className={cn("mt-1 text-sm", due.overdue ? "font-medium text-danger" : "text-muted-foreground")}>{due.text}</p>}
            {invoice.status === "PAID" && invoice.paidAt && <p className="mt-1 text-sm text-success">Paid {formatDate(invoice.paidAt)}</p>}
            <dl className="mt-4 divide-y border-t">
              <DetailRow label="Issued">{formatDate(invoice.issueDate)}</DetailRow>
              <DetailRow label="Due">{formatDate(invoice.dueDate)}</DetailRow>
              {invoice.sentAt && <DetailRow label="Sent">{formatDate(invoice.sentAt)}</DetailRow>}
              <DetailRow label="Paid so far">{formatMoney(invoice.amountPaid, { currency: invoice.currency })}</DetailRow>
            </dl>
            <div className="mt-4">
              <InvoiceActions
                id={invoice.id}
                number={invoice.number}
                status={invoice.status}
                balance={balance}
                currency={invoice.currency}
                shareToken={invoice.shareToken}
                appUrl={env.appUrl()}
                today={today}
              />
            </div>
          </Panel>

          <Panel className="p-4 sm:p-5">
            <SharePanel id={invoice.id} status={invoice.status} shareToken={invoice.shareToken} appUrl={env.appUrl()} />
          </Panel>

          <Panel className="p-4 sm:p-5">
            <p className="mb-3 text-sm font-semibold">Payments</p>
            <PaymentList payments={payments} currency={invoice.currency} />
          </Panel>

          {data.activity.length > 0 && (
            <Panel className="p-4 sm:p-5">
              <p className="mb-4 text-sm font-semibold">History</p>
              <ActivityFeed items={data.activity} />
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
