import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Info } from "lucide-react";

import { BarList } from "@/components/charts/bar-list";
import { ClearFilters, FilterSelect, Toolbar } from "@/components/shared/list-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { Panel, PanelHeader } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, param, parsePage } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordPaymentButton } from "@/features/invoices/components/record-payment-button";
import { listPayments, unpaidInvoiceOptions } from "@/features/invoices/payments-queries";
import { PAGE_SIZE, PAYMENT_METHODS, PAYMENT_METHOD_LABEL, PAYMENT_STATUSES, PAYMENT_STATUS_META } from "@/lib/constants";
import { addDaysISO, formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requirePagePermission, requireStaffContext } from "@/server/auth/session";
import type { PaymentMethod, PaymentStatus } from "@/server/db/schema";

export const metadata: Metadata = { title: "Payments" };

const PERIODS = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  const ctx = await requireStaffContext();
  requirePagePermission(ctx, "payment:manage");
  const sp = await searchParams;
  const today = todayISO(ctx.workspace.timezone);
  const method = param(sp.method);
  const status = param(sp.status);
  const period = PERIODS.find((p) => p.value === param(sp.period));
  const filters = {
    method: PAYMENT_METHODS.includes(method as PaymentMethod) ? (method as PaymentMethod) : undefined,
    status: PAYMENT_STATUSES.includes(status as PaymentStatus) ? (status as PaymentStatus) : undefined,
    from: period ? addDaysISO(today, -Number(period.value)) : undefined,
    page: parsePage(sp.page),
  };
  const [{ rows, total, byMethod }, unpaid] = await ctx.db((tx) => Promise.all([listPayments(tx, ctx.workspace.id, filters), unpaidInvoiceOptions(tx, ctx.workspace.id)]));
  const collected = byMethod.reduce((s, m) => s + m.amount, 0);

  return (
    <>
      <PageHeader
        title="Payments"
        description="A ledger of payments received against your invoices."
        actions={<RecordPaymentButton invoices={unpaid} currency={ctx.workspace.currency} today={today} />}
      />

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-info/20 bg-info-soft/60 px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <p>
          These are <strong>payment records</strong>. FlowDesk doesn&apos;t connect to M-Pesa, banks or card processors — you record payments
          you&apos;ve received, and invoice balances and statuses update automatically.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div>
          <Toolbar>
            <FilterSelect param="method" label="Method" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />
            <FilterSelect param="status" label="Status" options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_META[s].label }))} />
            <FilterSelect param="period" label="Period" options={PERIODS} allLabel="All time" />
            <ClearFilters keys={["method", "status", "period"]} />
          </Toolbar>

          {rows.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments recorded" description="When a client pays, record it here or use “Mark as paid” on the invoice." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-4 text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="pl-4 text-muted-foreground">{formatDate(p.paidOn)}</TableCell>
                        <TableCell>
                          <Link href={`/invoices/${p.invoiceId}`} className="tabular font-medium hover:underline">
                            {p.invoiceNumber}
                          </Link>
                          <span className="block max-w-48 truncate text-xs text-muted-foreground">{p.clientName}</span>
                        </TableCell>
                        <TableCell>{PAYMENT_METHOD_LABEL[p.method]}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{p.reference ?? "—"}</TableCell>
                        <TableCell><StatusBadge kind="payment" value={p.status} /></TableCell>
                        <TableCell className="tabular pr-4 text-right font-medium">{formatMoney(p.amount, { currency: p.currency })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={filters.page} pageSize={PAGE_SIZE} total={total} searchParams={sp} basePath="/payments" />
            </>
          )}
        </div>

        <Panel>
          <PanelHeader title="By method" description={`${formatMoney(collected, { currency: ctx.workspace.currency })} completed`} />
          <div className="p-4 sm:p-5">
            <BarList
              items={[...byMethod]
                .sort((a, b) => b.amount - a.amount)
                .map((m) => ({ label: PAYMENT_METHOD_LABEL[m.method], value: m.amount, display: formatMoney(m.amount, { currency: ctx.workspace.currency, compact: m.amount >= 1_000_000 }), hint: `· ${m.n}` }))}
              emptyLabel="No completed payments in this period."
            />
          </div>
        </Panel>
      </div>
    </>
  );
}
