import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/shared/list-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, param, parsePage } from "@/components/shared/pagination";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clientOptions } from "@/features/clients/queries";
import { invoiceSummary, listInvoices, type InvoiceFilters } from "@/features/invoices/queries";
import { INVOICE_STATUSES, INVOICE_STATUS_META, PAGE_SIZE } from "@/lib/constants";
import { addDaysISO, dueLabel, formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { assertCan } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { requireStaffContext } from "@/server/auth/session";
import type { InvoiceStatus } from "@/server/db/schema";
import { syncOverdueInvoices } from "@/server/services/invoices";

export const metadata: Metadata = { title: "Invoices" };

const PERIODS = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const ctx = await requireStaffContext();
  assertCan(ctx.role, "invoice:view");
  const sp = await searchParams;
  const today = todayISO(ctx.workspace.timezone);
  const status = param(sp.status);
  const period = PERIODS.find((p) => p.value === param(sp.period));
  const filters: InvoiceFilters = {
    q: param(sp.q),
    status: INVOICE_STATUSES.includes(status as InvoiceStatus) ? (status as InvoiceStatus) : undefined,
    clientId: param(sp.client),
    from: period ? addDaysISO(today, -Number(period.value)) : undefined,
    page: parsePage(sp.page),
  };

  const [{ rows, total }, summary, clients] = await ctx.db(async (tx) => {
    await syncOverdueInvoices(tx, ctx.workspace.id, today);
    return Promise.all([listInvoices(tx, ctx.workspace.id, filters), invoiceSummary(tx, ctx.workspace.id, today), clientOptions(tx, ctx.workspace.id)]);
  });
  const filtered = !!(filters.q || filters.status || filters.clientId || filters.from);
  const money = (n: number) => formatMoney(n, { currency: ctx.workspace.currency });

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Create, send and track invoices. Totals are always calculated on the server."
        actions={
          <Button asChild>
            <Link href="/invoices/new">
              <Plus /> New invoice
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Outstanding" value={money(summary.outstanding)} href="/invoices?status=SENT" />
        <StatCard label="Overdue" value={money(summary.overdue)} tone={summary.overdue ? "danger" : "default"} href="/invoices?status=OVERDUE" />
        <StatCard label="Collected, last 30 days" value={money(summary.paid30)} href="/payments" />
        <StatCard label="Drafts" value={summary.drafts} href="/invoices?status=DRAFT" />
      </div>

      <Toolbar>
        <SearchInput placeholder="Search invoices or clients…" />
        <FilterSelect param="status" label="Status" options={INVOICE_STATUSES.map((s) => ({ value: s, label: INVOICE_STATUS_META[s].label }))} />
        <FilterSelect param="client" label="Client" options={clients.map((c) => ({ value: c.id, label: c.label }))} />
        <FilterSelect param="period" label="Issued" options={PERIODS} allLabel="Any time" />
        <ClearFilters keys={["q", "status", "client", "period"]} />
      </Toolbar>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState icon={FileText} title="No invoices match your filters" description="Try a different search or clear the filters." />
        ) : (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Create your first invoice — FlowDesk calculates tax and totals for you and generates a PDF."
            action={
              <Button asChild>
                <Link href="/invoices/new">
                  <Plus /> Create invoice
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="pr-4 text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((inv) => {
                  const balance = inv.total - inv.amountPaid;
                  const isOpen = inv.status === "SENT" || inv.status === "OVERDUE";
                  const due = dueLabel(inv.dueDate, today);
                  return (
                    <TableRow key={inv.id} className="group relative">
                      <TableCell className="pl-4">
                        <Link href={`/invoices/${inv.id}`} className="tabular font-medium after:absolute after:inset-0 group-hover:underline">
                          {inv.number}
                        </Link>
                        {inv.projectName && <span className="block max-w-48 truncate text-xs text-muted-foreground">{inv.projectName}</span>}
                      </TableCell>
                      <TableCell className="max-w-56 truncate">{inv.clientName}</TableCell>
                      <TableCell><StatusBadge kind="invoice" value={inv.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(inv.issueDate)}</TableCell>
                      <TableCell className={cn(isOpen && due.overdue ? "font-medium text-danger" : "text-muted-foreground")}>
                        {isOpen ? due.text : formatDate(inv.dueDate)}
                      </TableCell>
                      <TableCell className="tabular text-right">{formatMoney(inv.total, { currency: inv.currency })}</TableCell>
                      <TableCell className="tabular pr-4 text-right font-medium">{isOpen ? formatMoney(balance, { currency: inv.currency }) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ul className="grid gap-2 md:hidden">
            {rows.map((inv) => (
              <li key={inv.id}>
                <Link href={`/invoices/${inv.id}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-xs active:bg-muted/50">
                  <span className="min-w-0">
                    <span className="tabular block font-medium">{inv.number}</span>
                    <span className="block truncate text-xs text-muted-foreground">{inv.clientName} · due {formatDate(inv.dueDate, "d MMM")}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="tabular text-sm font-semibold">{formatMoney(inv.total, { currency: inv.currency })}</span>
                    <StatusBadge kind="invoice" value={inv.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={filters.page} pageSize={PAGE_SIZE} total={total} searchParams={sp} basePath="/invoices" />
        </>
      )}
    </>
  );
}
