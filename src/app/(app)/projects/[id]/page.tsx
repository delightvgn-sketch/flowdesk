import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { CalendarDays, CheckSquare, Users, Wallet } from "lucide-react";

import { DetailRow, Panel, PanelHeader, ProgressRing } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { PriorityIndicator, StatusBadge } from "@/components/shared/status-badge";
import { UrlTabs } from "@/components/shared/url-tabs";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ActivityFeed } from "@/features/activity/activity-feed";
import { listActivity } from "@/features/activity/queries";
import { AiTaskGenerator } from "@/features/ai/components/task-generator";
import { clientOptions } from "@/features/clients/queries";
import { FileList } from "@/features/files/components/file-list";
import { FileUploader } from "@/features/files/components/file-uploader";
import { listFiles } from "@/features/files/queries";
import { MessageThread } from "@/features/messages/components/message-thread";
import { listMessages } from "@/features/messages/queries";
import { MilestoneTimeline } from "@/features/projects/components/milestone-timeline";
import { ProjectActions, ProjectStatusSelect } from "@/features/projects/components/project-buttons";
import { getProject, projectOptions } from "@/features/projects/queries";
import { NewTaskButton, TaskWorkspace } from "@/features/tasks/components/task-workspace";
import { listBoardTasks, listLabels } from "@/features/tasks/queries";
import { staffOptions } from "@/features/team/queries";
import { dueLabel, formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can, isManagerRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { requireStaffContext } from "@/server/auth/session";
import { invoices } from "@/server/db/schema";
import { features } from "@/server/env";

export const metadata: Metadata = { title: "Project" };

const TABS = ["overview", "tasks", "files", "team", "timeline", "messages"] as const;
type Tab = (typeof TABS)[number];

export default async function ProjectPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  const ctx = await requireStaffContext();
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "overview";
  const today = todayISO(ctx.workspace.timezone);
  const finance = can(ctx.role, "invoice:view");
  const manager = isManagerRole(ctx.role);

  const data = await ctx.db(async (tx) => {
    const project = await getProject(tx, ctx.workspace.id, id).catch(() => null);
    if (!project) return null;
    const [people, activity, tasks, projects, labels, files, msgs, invoiced, clients] = await Promise.all([
      staffOptions(tx, ctx.workspace.id),
      tab === "overview" ? listActivity(tx, ctx.workspace.id, { projectId: id, limit: 8 }) : Promise.resolve([]),
      tab === "tasks" ? listBoardTasks(tx, ctx.workspace.id, { projectId: id }) : Promise.resolve([]),
      projectOptions(tx, ctx.workspace.id),
      tab === "tasks" ? listLabels(tx, ctx.workspace.id) : Promise.resolve([]),
      tab === "files" ? listFiles(tx, ctx.workspace.id, { projectId: id }) : Promise.resolve([]),
      tab === "messages" ? listMessages(tx, ctx.workspace.id, { projectId: id }) : Promise.resolve([]),
      finance
        ? tx
            .select({
              total: sql<number>`coalesce(sum(${invoices.total}), 0)`.mapWith(Number),
              paid: sql<number>`coalesce(sum(${invoices.amountPaid}), 0)`.mapWith(Number),
            })
            .from(invoices)
            .where(and(eq(invoices.projectId, id), sql`${invoices.status} not in ('DRAFT', 'CANCELLED')`))
            .then((r) => r[0])
        : Promise.resolve(null),
      manager ? clientOptions(tx, ctx.workspace.id) : Promise.resolve([]),
    ]);
    return { project, people, activity, tasks, projects, labels, files, msgs, invoiced, clients };
  });
  if (!data) notFound();
  const { project: p } = data;
  const due = dueLabel(p.dueDate, today);
  const done = p.status === "COMPLETED" || p.status === "CANCELLED";
  const formOptions = { projects: data.projects, people: data.people, labels: data.labels, allowNoProject: false };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: p.name }]}
        title={p.name}
        meta={<StatusBadge kind="project" value={p.status} />}
        description={
          p.clientId ? (
            <>
              For{" "}
              {can(ctx.role, "client:view") ? (
                <Link href={`/clients/${p.clientId}`} className="font-medium text-foreground hover:underline">
                  {p.clientName}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{p.clientName}</span>
              )}
            </>
          ) : (
            "Internal project"
          )
        }
        actions={
          manager ? (
            <ProjectActions
              project={{
                id: p.id,
                name: p.name,
                description: p.description,
                clientId: p.clientId,
                status: p.status,
                priority: p.priority,
                startDate: p.startDate,
                dueDate: p.dueDate,
                budget: p.budget,
                memberIds: p.team.map((t) => t.id),
              }}
              options={{ clients: data.clients, people: data.people, currency: ctx.workspace.currency }}
            />
          ) : (
            <ProjectStatusSelect id={p.id} status={p.status} />
          )
        }
      />

      <UrlTabs
        basePath={`/projects/${id}`}
        active={tab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "tasks", label: "Tasks", count: p.taskStats.total },
          { key: "files", label: "Files" },
          { key: "team", label: "Team", count: p.team.length },
          { key: "timeline", label: "Timeline", count: p.milestones.length },
          { key: "messages", label: "Messages" },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <Panel className="p-4 sm:p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <ProgressRing value={p.progress} size={84} stroke={7} />
                <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
                  <Fact
                    icon={CheckSquare}
                    label="Tasks done"
                    value={`${p.taskStats.done} / ${p.taskStats.total}`}
                    hint={p.taskStats.overdue ? `${p.taskStats.overdue} overdue` : undefined}
                    danger={p.taskStats.overdue > 0}
                  />
                  <Fact
                    icon={CalendarDays}
                    label="Deadline"
                    value={p.dueDate ? formatDate(p.dueDate) : "—"}
                    hint={done ? undefined : due.text}
                    danger={!done && due.overdue}
                  />
                  {finance && (
                    <Fact
                      icon={Wallet}
                      label="Budget"
                      value={p.budget ? formatMoney(p.budget, { compact: p.budget >= 1_000_000 }) : "—"}
                      hint={data.invoiced ? `${formatMoney(data.invoiced.total, { compact: true })} invoiced` : undefined}
                    />
                  )}
                </div>
              </div>
              {p.description && (
                <p className="mt-5 border-t pt-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {p.description}
                </p>
              )}
            </Panel>

            <Panel>
              <PanelHeader
                title="Milestones"
                action={
                  <Link href={`/projects/${id}?tab=timeline`} className="text-xs font-medium text-primary hover:underline">
                    Timeline
                  </Link>
                }
              />
              {p.milestones.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">No milestones yet.</p>
              ) : (
                <ol className="flex gap-2 overflow-x-auto p-4 sm:p-5">
                  {p.milestones.map((m) => (
                    <li
                      key={m.id}
                      className={cn(
                        "min-w-36 flex-1 rounded-lg border p-3",
                        m.status === "CURRENT" && "border-primary/40 bg-brand-soft/40",
                      )}
                    >
                      <p className="truncate text-sm font-medium">{m.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{m.dueDate ? formatDate(m.dueDate, "d MMM") : "—"}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <StatusBadge kind="milestone" value={m.status} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel>
              <PanelHeader title="Recent activity" />
              <div className="p-4 sm:p-5">
                <ActivityFeed items={data.activity} />
              </div>
            </Panel>
          </div>

          <div className="min-w-0 space-y-6">
            <Panel className="p-4 sm:p-5">
              <p className="mb-1 text-sm font-semibold">Details</p>
              <dl className="divide-y">
                <DetailRow label="Status">
                  <StatusBadge kind="project" value={p.status} />
                </DetailRow>
                <DetailRow label="Priority">
                  <PriorityIndicator value={p.priority} showLabel />
                </DetailRow>
                <DetailRow label="Start">{formatDate(p.startDate)}</DetailRow>
                <DetailRow label="Due">{formatDate(p.dueDate)}</DetailRow>
                {p.clientName && <DetailRow label="Client">{p.clientName}</DetailRow>}
                {finance && data.invoiced && <DetailRow label="Collected">{formatMoney(data.invoiced.paid)}</DetailRow>}
              </dl>
            </Panel>
            <Panel className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Team</p>
                <Link href={`/projects/${id}?tab=team`} className="text-xs font-medium text-primary hover:underline">
                  Manage
                </Link>
              </div>
              <TeamList team={p.team} people={data.people} />
            </Panel>
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <>
          <div className="mb-4 flex flex-wrap justify-end gap-2">
            {features.ai() && <AiTaskGenerator projectId={id} projectName={p.name} />}
            <NewTaskButton formOptions={formOptions} defaultProjectId={id} />
          </div>
          <TaskWorkspace
            tasks={data.tasks}
            today={today}
            formOptions={formOptions}
            sheetOptions={{ ...formOptions, currentProfileId: ctx.profile.id, canDeleteAny: manager }}
            defaultProjectId={id}
          />
        </>
      )}

      {tab === "files" && (
        <>
          {features.storage() && (
            <div className="mb-4 flex justify-end">
              <FileUploader links={{ projectId: id }} />
            </div>
          )}
          <FileList
            files={data.files}
            currentProfileId={ctx.profile.id}
            canOrganize
            canDeleteAny={manager}
            showProject={false}
            emptyTitle="No files in this project"
          />
          {p.clientId && (
            <p className="mt-3 text-xs text-muted-foreground">
              Use a file&apos;s menu → “Share with client” to make it visible in the client portal.
            </p>
          )}
        </>
      )}

      {tab === "team" && (
        <Panel className="p-4 sm:p-5">
          <TeamList team={p.team} people={data.people} detailed />
          <p className="mt-4 text-xs text-muted-foreground">
            {manager ? "Change the team with “Edit” above." : "Only owners and admins can change the team."} Members only see
            projects they&apos;re on.
          </p>
        </Panel>
      )}

      {tab === "timeline" && <MilestoneTimeline projectId={id} milestones={p.milestones} canEdit hasClient={!!p.clientId} />}

      {tab === "messages" && (
        <Panel className="flex h-[min(70dvh,640px)] flex-col overflow-hidden">
          <MessageThread
            className="flex-1"
            messages={data.msgs}
            currentProfileId={ctx.profile.id}
            projectId={id}
            canPostInternal
            canModerate={manager}
          />
        </Panel>
      )}
    </>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  hint,
  danger,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {label}
      </p>
      <p className="tabular mt-1 text-lg font-semibold">{value}</p>
      {hint && <p className={cn("text-xs", danger ? "font-medium text-danger" : "text-muted-foreground")}>{hint}</p>}
    </div>
  );
}

function TeamList({
  team,
  people,
  detailed,
}: {
  team: { id: string; fullName: string; avatarUrl: string | null }[];
  people: { id: string; title: string | null; role: string }[];
  detailed?: boolean;
}) {
  if (team.length === 0) return <p className="text-sm text-muted-foreground">No one is on this project yet.</p>;
  return (
    <ul className={cn(detailed ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "space-y-2.5")}>
      {team.map((t) => {
        const person = people.find((x) => x.id === t.id);
        return (
          <li key={t.id} className={cn("flex items-center gap-3", detailed && "rounded-lg border p-3")}>
            <UserAvatar name={t.fullName} src={t.avatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{person?.title ?? person?.role.toLowerCase()}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
