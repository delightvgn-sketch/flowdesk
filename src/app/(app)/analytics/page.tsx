import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { BarList } from "@/components/charts/bar-list";
import { CHART_COLORS } from "@/components/charts/colors";
import { ColumnChart } from "@/components/charts/column-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { Panel, PanelHeader } from "@/components/shared/misc";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { param } from "@/components/shared/pagination";
import { StatCard } from "@/components/shared/stat-card";
import { clientCounts, clientsByMonth, projectHealth, revenueByClient, revenueKpis, taskStats } from "@/features/analytics/queries";
import { getRevenueByMonth, getTaskTrend } from "@/features/dashboard/queries";
import { PROJECT_STATUS_META } from "@/lib/constants";
import { addDaysISO, dueLabel, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { assertCan } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { requireStaffContext } from "@/server/auth/session";
import type { ProjectStatus } from "@/server/db/schema";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = [
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
];

const STATUS_BAR: Record<string, string> = {
  IN_PROGRESS: "bg-primary",
  PLANNING: "bg-subtle-foreground",
  REVIEW: "bg-warning",
  COMPLETED: "bg-success",
  ON_HOLD: "bg-border-strong",
  CANCELLED: "bg-danger",
};

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const ctx = await requireStaffContext();
  assertCan(ctx.role, "analytics:view");
  const sp = await searchParams;
  const months = Number(RANGES.find((r) => r.value === param(sp.range))?.value ?? 6);
  const today = todayISO(ctx.workspace.timezone);
  const from = addDaysISO(today, -months * 30);
  const ws = ctx.workspace.id;
  const money = (v: number, compact = false) => formatMoney(v, { currency: ctx.workspace.currency, compact });

  const d = await ctx.db(async (tx) => {
    const [kpis, revenue, perClient, newClients, counts, projects, tasks, trend] = await Promise.all([
      revenueKpis(tx, ws, from, today),
      getRevenueByMonth(tx, ws, today, months),
      revenueByClient(tx, ws, from),
      clientsByMonth(tx, ws, today, months),
      clientCounts(tx, ws),
      projectHealth(tx, ws, from, today),
      taskStats(tx, ws, from, today),
      getTaskTrend(tx, ws, today, Math.min(26, Math.round((months * 30) / 7))),
    ]);
    return { kpis, revenue, perClient, newClients, counts, projects, tasks, trend };
  });

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How the business is doing — revenue, clients, delivery and workload."
        actions={
          <div className="flex rounded-md border bg-card p-0.5 shadow-xs" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <Link
                key={r.value}
                href={`/analytics?range=${r.value}`}
                aria-current={Number(r.value) === months ? "page" : undefined}
                className={cn("rounded-[5px] px-3 py-1 text-[13px] font-medium", Number(r.value) === months ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="space-y-10">
        <section aria-labelledby="revenue-h">
          <SectionHeader title="Revenue" description={`Last ${months} months`} />
          <h2 id="revenue-h" className="sr-only">Revenue</h2>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Collected" value={money(d.kpis.collected)} hint={`${d.kpis.paidCount} invoices paid`} />
            <StatCard label="Invoiced" value={money(d.kpis.invoiced)} hint={d.kpis.daysToPay ? `Paid in ${d.kpis.daysToPay} days on average` : undefined} />
            <StatCard label="Outstanding (not yet due)" value={money(d.kpis.outstanding)} hint={`${d.kpis.outstandingCount} invoices`} href="/invoices?status=SENT" />
            <StatCard label="Overdue" value={money(d.kpis.overdue)} tone={d.kpis.overdue ? "danger" : "default"} hint={`${d.kpis.overdueCount} invoices`} href="/invoices?status=OVERDUE" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <ColumnChart
              className="lg:col-span-2"
              title="Revenue by month"
              description="Invoiced vs collected"
              data={d.revenue}
              xKey="label"
              money
              height={260}
              series={[
                { key: "invoiced", label: "Invoiced", color: CHART_COLORS[2] },
                { key: "collected", label: "Collected", color: CHART_COLORS[0] },
              ]}
            />
            <Panel>
              <PanelHeader title="Revenue per client" description="Collected in period" />
              <div className="p-4 sm:p-5">
                <BarList items={d.perClient.map((c) => ({ label: c.name, value: c.revenue, display: money(c.revenue, c.revenue >= 1_000_000), href: `/clients/${c.id}` }))} emptyLabel="No payments in this period." />
              </div>
            </Panel>
          </div>
        </section>

        <section aria-labelledby="clients-h">
          <SectionHeader title="Clients" />
          <h2 id="clients-h" className="sr-only">Clients</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <StatCard label="Active clients" value={d.counts.ACTIVE ?? 0} href="/clients?status=ACTIVE" />
              <StatCard label="Open leads" value={d.counts.LEAD ?? 0} href="/clients?status=LEAD" />
              <StatCard label="New in period" value={d.newClients.reduce((s, m) => s + m.added, 0)} className="col-span-2 lg:col-span-1" />
            </div>
            <ColumnChart className="lg:col-span-2" title="New clients" description="Added per month" data={d.newClients} xKey="label" height={220} series={[{ key: "added", label: "New clients", color: CHART_COLORS[0] }]} />
          </div>
        </section>

        <section aria-labelledby="projects-h">
          <SectionHeader title="Projects" />
          <h2 id="projects-h" className="sr-only">Projects</h2>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Active" value={d.projects.active} href="/projects?status=active" />
            <StatCard label="Completed in period" value={d.projects.completed} tone="success" href="/projects?status=COMPLETED" />
            <StatCard label="Delayed" value={d.projects.delayed} tone={d.projects.delayed ? "danger" : "default"} icon={d.projects.delayed ? AlertTriangle : undefined} hint="Past due and not finished" />
            <StatCard label="On hold" value={d.projects.onHold} href="/projects?status=ON_HOLD" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Projects by status" />
              <div className="p-4 sm:p-5">
                <BarList
                  items={d.projects.byStatus
                    .sort((a, b) => b.count - a.count)
                    .map((s) => ({ label: PROJECT_STATUS_META[s.status as ProjectStatus].label, value: s.count, display: String(s.count), barClass: STATUS_BAR[s.status], href: `/projects?status=${s.status}` }))}
                />
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Delayed projects" description="Active projects past their due date" />
              {d.projects.delayedList.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing delayed. Nice.</p>
              ) : (
                <ul className="divide-y">
                  {d.projects.delayedList.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 sm:px-5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{p.client ?? "Internal"} · {p.progress}% done</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-danger">{dueLabel(p.due_date, today).text}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </section>

        <section aria-labelledby="tasks-h">
          <SectionHeader title="Tasks" />
          <h2 id="tasks-h" className="sr-only">Tasks</h2>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Completed in period" value={d.tasks.completed} tone="success" />
            <StatCard label="Open" value={d.tasks.open} href="/tasks" />
            <StatCard label="Overdue" value={d.tasks.overdue} tone={d.tasks.overdue ? "danger" : "default"} />
            <StatCard label="Avg. time to complete" value={`${d.tasks.cycleDays}d`} hint="Created → done" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <TrendChart
              className="lg:col-span-2"
              title="Task throughput"
              description="Created vs completed per week"
              data={d.trend}
              xKey="label"
              height={240}
              series={[
                { key: "created", label: "Created", color: CHART_COLORS[2] },
                { key: "completed", label: "Completed", color: CHART_COLORS[0] },
              ]}
            />
            <Panel>
              <PanelHeader title="Open work by person" description="Open tasks (overdue)" />
              <div className="p-4 sm:p-5">
                <BarList
                  items={d.tasks.workload.map((w) => ({ label: w.name, value: w.open, display: String(w.open), hint: w.overdue ? `(${w.overdue} overdue)` : undefined, barClass: w.overdue ? "bg-warning" : "bg-chart-1" }))}
                  emptyLabel="No open tasks."
                />
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </>
  );
}
