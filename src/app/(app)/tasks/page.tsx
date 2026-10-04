import type { Metadata } from "next";
import Link from "next/link";
import { KanbanSquare, List } from "lucide-react";

import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { param } from "@/components/shared/pagination";
import { projectOptions } from "@/features/projects/queries";
import { NewTaskButton, TaskWorkspace } from "@/features/tasks/components/task-workspace";
import { TaskList } from "@/features/tasks/components/task-list";
import { listBoardTasks, listLabels, type TaskFilters } from "@/features/tasks/queries";
import { staffOptions } from "@/features/team/queries";
import { PRIORITIES, PRIORITY_META } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { isManagerRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { requireStaffContext } from "@/server/auth/session";
import type { Priority } from "@/server/db/schema";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const ctx = await requireStaffContext();
  const sp = await searchParams;
  const view = param(sp.view) === "list" ? "list" : "board";
  const assignee = param(sp.assignee);
  const priority = param(sp.priority);
  const filters: TaskFilters = {
    q: param(sp.q),
    projectId: param(sp.project),
    assigneeId: assignee === "me" ? ctx.profile.id : assignee,
    priority: PRIORITIES.includes(priority as Priority) ? (priority as Priority) : undefined,
    labelId: param(sp.label),
  };

  const [tasks, projects, people, labels] = await ctx.db((tx) =>
    Promise.all([listBoardTasks(tx, ctx.workspace.id, filters), projectOptions(tx, ctx.workspace.id), staffOptions(tx, ctx.workspace.id), listLabels(tx, ctx.workspace.id)]),
  );
  const manager = isManagerRole(ctx.role);
  const formOptions = { projects, people, labels, allowNoProject: true };
  const sheetOptions = { ...formOptions, currentProfileId: ctx.profile.id, canDeleteAny: manager };
  const today = todayISO(ctx.workspace.timezone);

  const viewHref = (v: string) => {
    const next = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string" && e[0] !== "task"));
    if (v === "list") next.set("view", "list");
    else next.delete("view");
    const qs = next.toString();
    return qs ? `/tasks?${qs}` : "/tasks";
  };

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Drag cards between columns, or use a card's menu to move it."
        actions={
          <>
            <div className="flex rounded-md border bg-card p-0.5 shadow-xs" role="group" aria-label="View">
              {[
                { key: "board", label: "Board", icon: KanbanSquare },
                { key: "list", label: "List", icon: List },
              ].map((v) => (
                <Link
                  key={v.key}
                  href={viewHref(v.key)}
                  aria-current={view === v.key ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-[5px] px-2.5 text-[13px] font-medium",
                    view === v.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <v.icon className="size-4" /> {v.label}
                </Link>
              ))}
            </div>
            <NewTaskButton formOptions={formOptions} />
          </>
        }
      />

      <Toolbar>
        <SearchInput placeholder="Search tasks…" />
        <FilterSelect param="assignee" label="Assignee" options={[{ value: "me", label: "Me" }, ...people.map((p) => ({ value: p.id, label: p.fullName }))]} allLabel="Anyone" />
        <FilterSelect param="project" label="Project" options={[{ value: "none", label: "No project" }, ...projects.map((p) => ({ value: p.id, label: p.label }))]} />
        <FilterSelect param="priority" label="Priority" options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
        {labels.length > 0 && <FilterSelect param="label" label="Label" options={labels.map((l) => ({ value: l.id, label: l.name }))} />}
        <ClearFilters keys={["q", "assignee", "project", "priority", "label"]} />
      </Toolbar>

      <TaskWorkspace tasks={tasks} today={today} formOptions={formOptions} sheetOptions={sheetOptions} view={view}>
        <TaskList tasks={tasks} today={today} />
      </TaskWorkspace>
    </>
  );
}
