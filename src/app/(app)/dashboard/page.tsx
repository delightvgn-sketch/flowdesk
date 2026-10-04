import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  CircleDollarSign,
  FileClock,
  FolderKanban,
  Plus,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { BarList } from "@/components/charts/bar-list";
import { CHART_COLORS } from "@/components/charts/colors";
import { ColumnChart } from "@/components/charts/column-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { Panel, PanelHeader, ProgressBar } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/features/activity/activity-feed";
import { listActivity } from "@/features/activity/queries";
import { UpcomingList } from "@/features/dashboard/upcoming-list";
import {
  getActiveProjects,
  getBusinessSummary,
  getFinancialSummary,
  getInvoiceStatusBreakdown,
  getRevenueByMonth,
  getTaskTrend,
  getUpcoming,
  workspaceToday,
} from "@/features/dashboard/queries";
import { INVOICE_STATUS_META } from "@/lib/constants";
import { dueLabel, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { cn, pluralize } from "@/lib/utils";
import { requireStaffContext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

const STATUS_BAR: Record<string, string> = {
  PAID: "bg-success",
  SENT: "bg-info",
  OVERDUE: "bg-danger",
  DRAFT: "bg-subtle-foreground",
  CANCELLED: "bg-border-strong",
};

function greeting(timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const ctx = await requireStaffContext();
  const today = workspaceToday(ctx);
  const ws = ctx.workspace.id;
  const finance = can(ctx.role, "invoice:view");

  const data = await ctx.db(async (tx) => {
    const [business, activeProjects, taskTrend, activity, upcoming] = await Promise.all([
      getBusinessSummary(tx, ws, today),
      getActiveProjects(tx, ws),
      getTaskTrend(tx, ws, today),
      listActivity(tx, ws, { limit: 10 }),
      getUpcoming(tx, ctx, today),
    ]);
    const [financial, revenue, invoiceStatus] = finance
      ? await Promise.all([getFinancialSummary(tx, ws, today), getRevenueByMonth(tx, ws, today), getInvoiceStatusBreakdown(tx, ws, today)])
      : [null, [], []];
    return { business, activeProjects, taskTrend, activity, upcoming, financial, revenue, invoiceStatus };
  });

  const { business, financial } = data;
  const monthDelta =
    financial && financial.previous30 > 0 ? Math.round(((financial.last30 - financial.previous30) / financial.previous30) * 100) : null;
  const statusOrder = ["PAID", "SENT", "OVERDUE", "DRAFT", "CANCELLED"];

  return (
    <>
      <PageHeader
        title={`${greeting(ctx.workspace.timezone)}, ${ctx.profile.fullName.split(" ")[0]}`}
        description={`Here's what's happening at ${ctx.workspace.name} today, ${formatDate(today, "EEEE d MMMM")}.`}
        actions={
          <>
            {can(ctx.role, "project:create") && (
              <Button variant="outline" asChild>
                <Link href="/projects?new=1">
                  <Plus /> Project
                </Link>
              </Button>
            )}
            {can(ctx.role, "invoice:manage") ? (
              <Button asChild>
                <Link href="/invoices/new">
                  <Plus /> Invoice
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/tasks?new=1">
                  <Plus /> Task
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-6">
        {financial && (
          <section aria-labelledby="finance-heading">
            <h2 id="finance-heading" className="sr-only">
              Financial overview
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Revenue this year"
                value={formatMoney(financial.ytd)}
                icon={TrendingUp}
                hint="Collected payments"
                href="/analytics"
              />
              <StatCard
                label="Collected, last 30 days"
                value={formatMoney(financial.last30)}
                icon={Wallet}
                tone="success"
                href="/payments"
                hint={
                  monthDelta === null ? (
                    "No payments in the prior 30 days"
                  ) : (
                    <span className={monthDelta >= 0 ? "text-success" : "text-danger"}>
                      {monthDelta >= 0 ? "▲" : "▼"} {Math.abs(monthDelta)}% vs prior 30 days
                    </span>
                  )
                }
              />
              <StatCard
                label="Outstanding"
                value={formatMoney(financial.outstanding)}
                icon={CircleDollarSign}
                hint={pluralize(financial.outstandingCount, "unpaid invoice")}
                href="/invoices?status=SENT"
              />
              <StatCard
                label="Overdue"
                value={formatMoney(financial.overdue)}
                icon={AlertTriangle}
                tone={financial.overdueCount ? "danger" : "default"}
                hint={financial.overdueCount ? pluralize(financial.overdueCount, "invoice") + " past due" : "Nothing overdue"}
                href="/invoices?status=OVERDUE"
              />
            </div>
          </section>
        )}

        <section aria-labelledby="business-heading">
          <h2 id="business-heading" className="sr-only">
            Business overview
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {can(ctx.role, "client:view") && (
              <StatCard label="Active clients" value={business.activeClients} icon={Users} href="/clients?status=ACTIVE" />
            )}
            <StatCard label="Active projects" value={business.activeProjects} icon={FolderKanban} href="/projects" />
            <StatCard
              label="Open tasks"
              value={business.openTasks}
              icon={CheckSquare}
              hint={business.overdueTasks ? <span className="text-danger">{business.overdueTasks} overdue</span> : "None overdue"}
              href="/tasks"
            />
            {finance ? (
              <StatCard
                label="Pending invoices"
                value={business.pendingInvoices}
                icon={FileClock}
                hint={pluralize(business.draftInvoices, "draft")}
                href="/invoices"
              />
            ) : (
              <StatCard label="Upcoming deadlines" value={data.upcoming.filter((u) => u.kind !== "meeting").length} icon={CalendarClock} hint="Next 14 days" href="/calendar" />
            )}
          </div>
        </section>

        {finance && (
          <div className="grid gap-6 lg:grid-cols-3">
            <ColumnChart
              className="lg:col-span-2"
              title="Revenue"
              description="Invoiced vs collected, last 6 months"
              data={data.revenue}
              xKey="label"
              money
              series={[
                { key: "invoiced", label: "Invoiced", color: CHART_COLORS[2] },
                { key: "collected", label: "Collected", color: CHART_COLORS[0] },
              ]}
            />
            <Panel>
              <PanelHeader title="Invoice status" description="Balance by status" action={<Receipt className="size-4 text-subtle-foreground" aria-hidden />} />
              <div className="p-4 sm:p-5">
                <BarList
                  items={statusOrder
                    .map((s) => data.invoiceStatus.find((r) => r.status === s))
                    .filter((r): r is NonNullable<typeof r> => !!r)
                    .map((r) => ({
                      label: INVOICE_STATUS_META[r.status].label,
                      value: r.amount,
                      display: formatMoney(r.amount, { compact: r.amount >= 1_000_000 }),
                      hint: `· ${r.count}`,
                      barClass: STATUS_BAR[r.status],
                      href: `/invoices?status=${r.status}`,
                    }))}
                  emptyLabel="No invoices yet."
                />
              </div>
            </Panel>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader
              title="Project progress"
              description="Active projects by deadline"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/projects">View all</Link>
                </Button>
              }
            />
            {data.activeProjects.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={FolderKanban}
                  title="No active projects"
                  description="Projects you start will show their progress here."
                  compact
                />
              </div>
            ) : (
              <ul className="divide-y">
                {data.activeProjects.map((p) => {
                  const due = dueLabel(p.dueDate, today);
                  return (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="grid gap-2 px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[1fr_160px_110px] sm:items-center sm:gap-4 sm:px-5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.clientName ?? "Internal"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ProgressBar value={p.progress} label={`${p.name} progress`} tone={due.overdue ? "danger" : "brand"} />
                          <span className="tabular w-9 text-right text-xs text-muted-foreground">{p.progress}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                          <StatusBadge kind="project" value={p.status} className="sm:hidden" />
                          <span className={cn("text-xs", due.overdue ? "font-medium text-danger" : "text-muted-foreground")}>{due.text}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <TrendChart
            title="Task completion"
            description="Created vs completed per week"
            data={data.taskTrend}
            xKey="label"
            height={220}
            series={[
              { key: "created", label: "Created", color: CHART_COLORS[2] },
              { key: "completed", label: "Completed", color: CHART_COLORS[0] },
            ]}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader title="Recent activity" description="Across your workspace" />
            <div className="p-4 sm:p-5">
              <ActivityFeed items={data.activity} />
            </div>
          </Panel>
          <Panel>
            <PanelHeader
              title="Upcoming"
              description="Next 14 days"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/calendar">Calendar</Link>
                </Button>
              }
            />
            <UpcomingList items={data.upcoming} today={today} />
          </Panel>
        </div>
      </div>
    </>
  );
}

