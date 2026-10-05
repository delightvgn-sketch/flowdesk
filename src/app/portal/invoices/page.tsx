import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { portalInvoices } from "@/features/portal/queries";
import { dueLabel, formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireClientContext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Invoices" };

export default async function PortalInvoicesPage() {
  const ctx = await requireClientContext();
  const today = todayISO(ctx.workspace.timezone);
  const invoices = await ctx.db((tx) => portalInvoices(tx, ctx.workspace.id));
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Invoices</h1>
      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description={`Invoices from ${ctx.workspace.name} will appear here.`}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {invoices.map((inv) => {
            const open = inv.status === "SENT" || inv.status === "OVERDUE";
            const due = dueLabel(inv.dueDate, today);
            return (
              <li key={inv.id}>
                <Link
                  href={`/portal/invoices/${inv.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-muted/40"
                >
                  <span className="tabular w-24 font-medium">{inv.number}</span>
                  <span className="flex-1 text-sm text-muted-foreground">Issued {formatDate(inv.issueDate)}</span>
                  <span className={cn("text-sm", open && due.overdue ? "font-medium text-danger" : "text-muted-foreground")}>
                    {open ? due.text : inv.status === "PAID" ? "Paid" : ""}
                  </span>
                  <StatusBadge kind="invoice" value={inv.status} />
                  <span className="tabular w-32 text-right font-medium">
                    {formatMoney(open ? inv.total - inv.amountPaid : inv.total, { currency: inv.currency })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
