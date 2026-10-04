import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { FileText, FolderKanban, Globe, Mail, MapPin, MessageSquare, Phone, Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { DetailRow, Panel, PanelHeader, ProgressBar } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlTabs } from "@/components/shared/url-tabs";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/features/activity/activity-feed";
import { listActivity } from "@/features/activity/queries";
import { ClientRowActions, EditClientButton } from "@/features/clients/components/client-buttons";
import { ClientAiSummary, ContactsList } from "@/features/clients/components/client-detail-parts";
import { getClient } from "@/features/clients/queries";
import { FileList } from "@/features/files/components/file-list";
import { FileUploader } from "@/features/files/components/file-uploader";
import { listFiles } from "@/features/files/queries";
import { MessageThread } from "@/features/messages/components/message-thread";
import { listMessages } from "@/features/messages/queries";
import { dueLabel, formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can, isManagerRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { requireStaffContext } from "@/server/auth/session";
import { invoices, projects } from "@/server/db/schema";
import { features } from "@/server/env";

export const metadata: Metadata = { title: "Client" };

const TABS = ["overview", "projects", "invoices", "files", "messages", "activity"] as const;
type Tab = (typeof TABS)[number];

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const ctx = await requireStaffContext();
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "overview";
  const finance = can(ctx.role, "invoice:view");
  const manage = can(ctx.role, "client:manage");
  const today = todayISO(ctx.workspace.timezone);

  const data = await ctx.db(async (tx) => {
    const detail = await getClient(tx, ctx.workspace.id, id).catch(() => null);
    if (!detail) return null;
    const [clientProjects, clientInvoices, activity, clientFiles, msgs] = await Promise.all([
      tx.select().from(projects).where(eq(projects.clientId, id)).orderBy(desc(projects.createdAt)),
      finance ? tx.select().from(invoices).where(eq(invoices.clientId, id)).orderBy(desc(invoices.issueDate)) : Promise.resolve([]),
      tab === "overview" || tab === "activity" ? listActivity(tx, ctx.workspace.id, { clientId: id, limit: tab === "activity" ? 50 : 6 }) : Promise.resolve([]),
      tab === "files" ? listFiles(tx, ctx.workspace.id, { clientId: id }) : Promise.resolve([]),
      tab === "messages" ? listMessages(tx, ctx.workspace.id, { clientId: id }) : Promise.resolve([]),
    ]);
    return { ...detail, clientProjects, clientInvoices, activity, clientFiles, msgs };
  });
  if (!data) notFound();
  const { client, contacts, stats } = data;
  const name = client.company ?? client.name;
  const activeProjects = data.clientProjects.filter((p) => ["PLANNING", "IN_PROGRESS", "REVIEW"].includes(p.status));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: name }]}
        title={
          <span className="flex items-center gap-3">
            <UserAvatar name={name} size="lg" />
            {name}
          </span>
        }
        meta={<StatusBadge kind="client" value={client.status} />}
        description={client.company ? `Primary contact: ${client.name}` : client.email}
        actions={
          manage && (
            <>
              <EditClientButton client={client} />
              <ClientRowActions client={client} redirectOnDelete />
            </>
          )
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {can(ctx.role, "project:create") && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects?new=1&client=${id}`}>
              <FolderKanban /> New project
            </Link>
          </Button>
        )}
        {can(ctx.role, "invoice:manage") && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/invoices/new?client=${id}`}>
              <FileText /> Create invoice
            </Link>
          </Button>
        )}
        {features.storage() && <FileUploader links={{ clientId: id }} label="Upload file" variant="outline" size="sm" />}
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clients/${id}?tab=messages`}>
            <MessageSquare /> Send message
          </Link>
        </Button>
      </div>

      <UrlTabs
        basePath={`/clients/${id}`}
        active={tab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "projects", label: "Projects", count: data.clientProjects.length },
          ...(finance ? [{ key: "invoices", label: "Invoices", count: data.clientInvoices.length }] : []),
          { key: "files", label: "Files" },
          { key: "messages", label: "Messages" },
          { key: "activity", label: "Activity" },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {finance && <StatCard label="Lifetime revenue" value={formatMoney(stats.revenue, { compact: stats.revenue >= 1_000_000 })} />}
              {finance && <StatCard label="Outstanding" value={formatMoney(stats.outstanding, { compact: stats.outstanding >= 1_000_000 })} tone={stats.overdue ? "danger" : "default"} hint={stats.overdue ? `${formatMoney(stats.overdue)} overdue` : undefined} />}
              <StatCard label="Active projects" value={stats.activeProjects} />
              {finance && <StatCard label="Invoices" value={stats.invoiceCount} />}
            </div>

            {features.ai() && finance && (
              <Panel className="p-4 sm:p-5">
                <p className="mb-2 text-sm font-semibold">FlowDesk AI briefing</p>
                <ClientAiSummary clientId={id} />
              </Panel>
            )}

            <Panel>
              <PanelHeader title="Active projects" action={<Link href={`/clients/${id}?tab=projects`} className="text-xs font-medium text-primary hover:underline">All projects</Link>} />
              {activeProjects.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">No active projects.</p>
              ) : (
                <ul className="divide-y">
                  {activeProjects.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 sm:px-5">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                        <span className="hidden w-40 items-center gap-2 sm:flex">
                          <ProgressBar value={p.progress} label={`${p.name} progress`} />
                          <span className="tabular text-xs text-muted-foreground">{p.progress}%</span>
                        </span>
                        <StatusBadge kind="project" value={p.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel>
              <PanelHeader title="Recent activity" />
              <div className="p-4 sm:p-5">
                <ActivityFeed items={data.activity} />
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel className="p-4 sm:p-5">
              <p className="mb-2 text-sm font-semibold">Details</p>
              <ul className="space-y-2.5 text-sm">
                {client.email && <ContactLine icon={Mail} href={`mailto:${client.email}`}>{client.email}</ContactLine>}
                {client.phone && <ContactLine icon={Phone} href={`tel:${client.phone.replace(/\s/g, "")}`}>{client.phone}</ContactLine>}
                {client.website && <ContactLine icon={Globe} href={client.website} external>{client.website.replace(/^https?:\/\//, "")}</ContactLine>}
                {client.address && <ContactLine icon={MapPin}>{client.address}</ContactLine>}
              </ul>
              <dl className="mt-4 divide-y border-t">
                <DetailRow label="Client since">{formatDate(client.createdAt)}</DetailRow>
                <DetailRow label="Tags">
                  {client.tags.length ? (
                    <span className="flex flex-wrap justify-end gap-1">
                      {client.tags.map((t) => (
                        <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal">{t}</span>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )}
                </DetailRow>
              </dl>
            </Panel>
            <Panel className="p-4 sm:p-5">
              <p className="mb-1 text-sm font-semibold">Contacts</p>
              <ContactsList clientId={id} contacts={contacts} canManage={manage} />
            </Panel>
            {client.notes && (
              <Panel className="p-4 sm:p-5">
                <p className="mb-2 text-sm font-semibold">Notes</p>
                <p className="text-sm whitespace-pre-line text-muted-foreground">{client.notes}</p>
              </Panel>
            )}
          </div>
        </div>
      )}

      {tab === "projects" &&
        (data.clientProjects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects for this client yet"
            action={can(ctx.role, "project:create") && <Button asChild><Link href={`/projects?new=1&client=${id}`}><Plus /> New project</Link></Button>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.clientProjects.map((p) => {
              const due = dueLabel(p.dueDate, today);
              const done = p.status === "COMPLETED" || p.status === "CANCELLED";
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-border-strong">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{p.name}</p>
                    <StatusBadge kind="project" value={p.status} />
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <ProgressBar value={p.progress} label={`${p.name} progress`} tone={p.status === "COMPLETED" ? "success" : "brand"} />
                    <span className="tabular text-xs text-muted-foreground">{p.progress}%</span>
                  </div>
                  <p className={cn("mt-3 text-xs", !done && due.overdue ? "font-medium text-danger" : "text-muted-foreground")}>{done ? `Finished ${formatDate(p.completedAt ?? p.dueDate)}` : due.text}</p>
                </Link>
              );
            })}
          </div>
        ))}

      {tab === "invoices" && finance &&
        (data.clientInvoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices for this client yet" action={<Button asChild><Link href={`/invoices/new?client=${id}`}><Plus /> Create invoice</Link></Button>} />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <ul className="divide-y">
              {data.clientInvoices.map((inv) => (
                <li key={inv.id}>
                  <Link href={`/invoices/${inv.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 sm:px-5">
                    <span className="tabular w-24 font-medium">{inv.number}</span>
                    <span className="hidden flex-1 text-sm text-muted-foreground sm:block">Issued {formatDate(inv.issueDate)} · due {formatDate(inv.dueDate)}</span>
                    <StatusBadge kind="invoice" value={inv.status} />
                    <span className="tabular ml-auto w-32 text-right text-sm font-medium sm:ml-0">{formatMoney(inv.total, { currency: inv.currency })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

      {tab === "files" && (
        <FileList
          files={data.clientFiles}
          currentProfileId={ctx.profile.id}
          canOrganize
          canDeleteAny={isManagerRole(ctx.role)}
          emptyTitle="No files for this client"
          emptyAction={features.storage() && <FileUploader links={{ clientId: id }} />}
        />
      )}

      {tab === "messages" && (
        <Panel className="flex h-[min(70dvh,640px)] flex-col overflow-hidden">
          <MessageThread
            className="flex-1"
            messages={data.msgs}
            currentProfileId={ctx.profile.id}
            clientId={id}
            canPostInternal
            canModerate={isManagerRole(ctx.role)}
            emptyText="No messages with this client yet."
          />
        </Panel>
      )}

      {tab === "activity" && (
        <Panel className="p-4 sm:p-6">
          <ActivityFeed items={data.activity} emptyLabel="No activity for this client yet." />
        </Panel>
      )}
    </>
  );
}

function ContactLine({ icon: Icon, href, external, children }: { icon: typeof Mail; href?: string; external?: boolean; children: React.ReactNode }) {
  const content = (
    <>
      <Icon className="mt-0.5 size-4 shrink-0 text-subtle-foreground" aria-hidden />
      <span className="min-w-0 break-words whitespace-pre-line">{children}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <a href={href} className="flex gap-2.5 hover:text-primary" {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
          {content}
        </a>
      ) : (
        <span className="flex gap-2.5">{content}</span>
      )}
    </li>
  );
}
