import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BellRing, FileText, FolderKanban } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Panel, PanelHeader, ProgressBar } from "@/components/shared/misc";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileList } from "@/features/files/components/file-list";
import { listFiles } from "@/features/files/queries";
import { pendingApprovals, portalInvoices, portalProjects } from "@/features/portal/queries";
import { dueLabel, formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireClientContext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Client portal" };

export default async function PortalHome() {
  const ctx = await requireClientContext();
  const today = todayISO(ctx.workspace.timezone);
  const [projects, invoices, approvals, files] = await ctx.db((tx) =>
    Promise.all([
      portalProjects(tx, ctx.workspace.id),
      portalInvoices(tx, ctx.workspace.id),
      pendingApprovals(tx, ctx.workspace.id),
      listFiles(tx, ctx.workspace.id, { limit: 5 }),
    ]),
  );
  const open = invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE");
  const balance = open.reduce((s, i) => s + i.total - i.amountPaid, 0);
  const overdue = open.filter((i) => i.dueDate < today);
  const active = projects.filter((p) => !["COMPLETED", "CANCELLED"].includes(p.status));

  return (
    <div className="space-y-8">
      <header>
        <p className="font-display text-lg text-primary italic">Welcome back</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Hi {ctx.profile.fullName.split(" ")[0]}, here&apos;s where things stand
        </h1>
      </header>

      {approvals.length > 0 && (
        <section className="rounded-xl border border-warning/30 bg-warning-soft/50 p-4 sm:p-5" aria-labelledby="approvals-h">
          <h2 id="approvals-h" className="flex items-center gap-2 text-sm font-semibold">
            <BellRing className="size-4 text-warning" aria-hidden /> Waiting for your approval
          </h2>
          <ul className="mt-3 space-y-2">
            {approvals.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/portal/projects/${a.projectId}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2.5 shadow-xs hover:shadow-sm"
                >
                  <span className="text-sm">
                    <span className="font-medium">{a.title}</span>{" "}
                    <span className="text-muted-foreground">· {a.projectName}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active projects" value={active.length} href="/portal/projects" />
        <StatCard
          label="Balance due"
          value={formatMoney(balance, { currency: ctx.workspace.currency })}
          href="/portal/invoices"
          tone={overdue.length ? "danger" : "default"}
          hint={overdue.length ? `${overdue.length} overdue` : open.length ? `${open.length} open invoices` : "All paid up"}
        />
        <StatCard label="Shared files" value={files.length} href="/portal/files" />
        <StatCard label="Approvals pending" value={approvals.length} tone={approvals.length ? "warning" : "default"} />
      </div>

      <section aria-labelledby="projects-h">
        <h2 id="projects-h" className="mb-3 text-sm font-semibold">
          Your projects
        </h2>
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description={`${ctx.workspace.name} hasn't shared a project with you yet.`}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((p) => {
              const current =
                p.milestones.find((m) => m.status === "CURRENT") ?? p.milestones.find((m) => m.status === "UPCOMING");
              const due = dueLabel(p.dueDate, today);
              return (
                <Link
                  key={p.id}
                  href={`/portal/projects/${p.id}`}
                  className="rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{p.name}</p>
                    <StatusBadge kind="project" value={p.status} />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <ProgressBar
                      value={p.progress}
                      label={`${p.name} progress`}
                      tone={p.status === "COMPLETED" ? "success" : "brand"}
                    />
                    <span className="tabular text-sm font-medium">{p.progress}%</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {current ? (
                      <>
                        Now: <span className="font-medium text-foreground">{current.title}</span>
                      </>
                    ) : p.status === "COMPLETED" ? (
                      "Delivered"
                    ) : (
                      "Getting started"
                    )}
                    {p.dueDate && p.status !== "COMPLETED" && (
                      <span className={cn(due.overdue && "text-danger")}> · {due.text}</span>
                    )}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Invoices"
            action={
              <Link href="/portal/invoices" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            }
          />
          {invoices.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <ul className="divide-y">
              {invoices.slice(0, 5).map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`/portal/invoices/${inv.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 sm:px-5"
                  >
                    <FileText className="size-4 text-subtle-foreground" aria-hidden />
                    <span className="tabular flex-1 text-sm font-medium">{inv.number}</span>
                    <span className="hidden text-xs text-muted-foreground sm:block">due {formatDate(inv.dueDate, "d MMM")}</span>
                    <StatusBadge kind="invoice" value={inv.status} />
                    <span className="tabular w-28 text-right text-sm">{formatMoney(inv.total, { currency: inv.currency })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent files</h2>
            <Link href="/portal/files" className="text-xs font-medium text-primary hover:underline">
              All files
            </Link>
          </div>
          <FileList
            files={files}
            currentProfileId={ctx.profile.id}
            canOrganize={false}
            canDeleteAny={false}
            showProject={false}
            emptyTitle="No files shared yet"
            emptyDescription="Files your team shares with you will appear here."
          />
        </section>
      </div>
    </div>
  );
}
