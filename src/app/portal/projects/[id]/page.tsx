import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Check, Circle, CircleDot } from "lucide-react";

import { Panel, PanelHeader, ProgressRing } from "@/components/shared/misc";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileList } from "@/features/files/components/file-list";
import { FileUploader } from "@/features/files/components/file-uploader";
import { listFiles } from "@/features/files/queries";
import { MessageThread } from "@/features/messages/components/message-thread";
import { listMessages } from "@/features/messages/queries";
import { MilestoneApproval } from "@/features/portal/milestone-approval";
import { listBoardTasks } from "@/features/tasks/queries";
import { TASK_STATUSES, TASK_STATUS_META } from "@/lib/constants";
import { dueLabel, formatDate, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { requireClientContext } from "@/server/auth/session";
import { milestones, projects } from "@/server/db/schema";
import { features } from "@/server/env";

export const metadata: Metadata = { title: "Project" };

export default async function PortalProjectPage({ params }: PageProps<"/portal/projects/[id]">) {
  const ctx = await requireClientContext();
  const { id } = await params;
  const today = todayISO(ctx.workspace.timezone);

  const data = await ctx.db(async (tx) => {
    const project = await tx.query.projects.findFirst({ where: and(eq(projects.id, id), eq(projects.workspaceId, ctx.workspace.id)) }).catch(() => undefined);
    if (!project) return null;
    const [ms, tasks, files, msgs] = await Promise.all([
      tx.select().from(milestones).where(eq(milestones.projectId, id)).orderBy(asc(milestones.position)),
      listBoardTasks(tx, ctx.workspace.id, { projectId: id }),
      listFiles(tx, ctx.workspace.id, { projectId: id }),
      listMessages(tx, ctx.workspace.id, { projectId: id }),
    ]);
    return { project, ms, tasks, files, msgs };
  });
  if (!data) notFound();
  const { project: p, ms } = data;
  const due = dueLabel(p.dueDate, today);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portal/projects" className="text-xs text-muted-foreground hover:text-foreground">← All projects</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
          <StatusBadge kind="project" value={p.status} />
        </div>
        {p.description && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{p.description}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel className="p-5">
            <div className="flex items-center gap-5">
              <ProgressRing value={p.progress} size={88} stroke={7} />
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-2xl font-semibold">{p.progress}% complete</p>
                {p.dueDate && <p className={cn("text-sm", p.status !== "COMPLETED" && due.overdue ? "text-danger" : "text-muted-foreground")}>Target date {formatDate(p.dueDate)}</p>}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Timeline" description="Where your project is at, step by step" />
            {ms.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">The team hasn&apos;t published a timeline yet.</p>
            ) : (
              <ol className="p-5">
                {ms.map((m, i) => {
                  const Icon = m.status === "COMPLETED" ? Check : m.status === "CURRENT" ? CircleDot : Circle;
                  return (
                    <li key={m.id} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < ms.length - 1 && <span aria-hidden className={cn("absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5", m.status === "COMPLETED" ? "bg-success/50" : "bg-border")} />}
                      <span
                        className={cn(
                          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                          m.status === "COMPLETED" && "border-success bg-success text-white",
                          m.status === "CURRENT" && "border-primary bg-brand-soft text-primary",
                          m.status === "UPCOMING" && "border-border-strong bg-card text-subtle-foreground",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={cn("font-medium", m.status === "UPCOMING" && "text-muted-foreground")}>{m.title}</p>
                          <span className="text-xs text-muted-foreground">{m.status === "COMPLETED" ? "Completed" : m.status === "CURRENT" ? "In progress" : "Upcoming"}</span>
                          {m.approvalStatus !== "NOT_REQUIRED" && <StatusBadge kind="approval" value={m.approvalStatus} />}
                        </div>
                        {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                        {m.dueDate && <p className="mt-1 text-xs text-subtle-foreground">{formatDate(m.dueDate)}</p>}
                        {m.approvalStatus === "PENDING" && <MilestoneApproval id={m.id} title={m.title} />}
                        {m.approvalNote && m.approvalStatus === "CHANGES_REQUESTED" && <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">Your feedback: {m.approvalNote}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <Panel className="flex h-[min(70dvh,560px)] flex-col overflow-hidden">
            <PanelHeader title="Messages" description="Talk to the team working on your project" />
            <MessageThread className="min-h-0 flex-1" messages={data.msgs} currentProfileId={ctx.profile.id} projectId={id} canPostInternal={false} canModerate={false} showInternalBadge={false} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Tasks" description="What the team is working on" />
            <div className="space-y-4 p-5">
              {TASK_STATUSES.map((s) => {
                const items = data.tasks.filter((t) => t.status === s);
                if (items.length === 0) return null;
                return (
                  <div key={s}>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {TASK_STATUS_META[s].label} · {items.length}
                    </p>
                    <ul className="space-y-1">
                      {items.slice(0, 6).map((t) => (
                        <li key={t.id} className={cn("text-sm", s === "DONE" && "text-muted-foreground line-through")}>{t.title}</li>
                      ))}
                      {items.length > 6 && <li className="text-xs text-muted-foreground">+{items.length - 6} more</li>}
                    </ul>
                  </div>
                );
              })}
              {data.tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
            </div>
          </Panel>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Files</h2>
              {features.storage() && <FileUploader links={{ projectId: id }} label="Upload" size="sm" variant="outline" />}
            </div>
            <FileList files={data.files} currentProfileId={ctx.profile.id} canOrganize={false} canDeleteAny={false} showProject={false} emptyTitle="No files yet" emptyDescription="Shared deliverables appear here. You can upload files for the team too." />
          </section>
        </div>
      </div>
    </div>
  );
}
