import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";

import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/shared/list-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { ProgressBar } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, param, parsePage } from "@/components/shared/pagination";
import { PriorityIndicator, StatusBadge } from "@/components/shared/status-badge";
import { AvatarStack } from "@/components/shared/user-avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clientOptions } from "@/features/clients/queries";
import { NewProjectButton } from "@/features/projects/components/project-buttons";
import { listProjects, type ProjectFilters } from "@/features/projects/queries";
import { staffOptions } from "@/features/team/queries";
import { PAGE_SIZE, PRIORITIES, PRIORITY_META, PROJECT_STATUSES, PROJECT_STATUS_META } from "@/lib/constants";
import { dueLabel, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { requireStaffContext } from "@/server/auth/session";
import type { Priority, ProjectStatus } from "@/server/db/schema";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const ctx = await requireStaffContext();
  const sp = await searchParams;
  const status = param(sp.status);
  const priority = param(sp.priority);
  const filters: ProjectFilters = {
    q: param(sp.q),
    status: status === "active" ? "active" : PROJECT_STATUSES.includes(status as ProjectStatus) ? (status as ProjectStatus) : undefined,
    priority: PRIORITIES.includes(priority as Priority) ? (priority as Priority) : undefined,
    clientId: param(sp.client),
    sort: (["due", "newest", "name", "progress"].find((s) => s === param(sp.sort)) ?? "due") as ProjectFilters["sort"],
    page: parsePage(sp.page),
  };
  const canCreate = can(ctx.role, "project:create");
  const showBudget = can(ctx.role, "invoice:view");
  const today = todayISO(ctx.workspace.timezone);

  const [{ rows, total }, clients, people] = await ctx.db((tx) =>
    Promise.all([
      listProjects(tx, ctx.workspace.id, filters),
      can(ctx.role, "client:view") ? clientOptions(tx, ctx.workspace.id) : Promise.resolve([]),
      staffOptions(tx, ctx.workspace.id),
    ]),
  );
  const options = { clients, people, currency: ctx.workspace.currency };
  const filtered = !!(filters.q || filters.status || filters.priority || filters.clientId);

  return (
    <>
      <PageHeader
        title="Projects"
        description={canCreate ? "Every piece of client work, from kickoff to launch." : "Projects you're staffed on."}
        actions={canCreate && <NewProjectButton options={options} />}
      />

      <Toolbar>
        <SearchInput placeholder="Search projects…" />
        <FilterSelect
          param="status"
          label="Status"
          options={[{ value: "active", label: "Active" }, ...PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_META[s].label }))]}
        />
        <FilterSelect param="priority" label="Priority" options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
        {clients.length > 0 && <FilterSelect param="client" label="Client" options={clients.map((c) => ({ value: c.id, label: c.label }))} />}
        <FilterSelect
          param="sort"
          label="Sort"
          allLabel="Due date"
          options={[
            { value: "newest", label: "Newest" },
            { value: "name", label: "Name" },
            { value: "progress", label: "Progress" },
          ]}
        />
        <ClearFilters keys={["q", "status", "priority", "client", "sort"]} />
      </Toolbar>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState icon={FolderKanban} title="No projects match your filters" description="Try a different search or clear the filters." />
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description={canCreate ? "Create your first project to start managing client work." : "You haven't been added to any projects yet."}
            action={canCreate && <NewProjectButton options={options} label="Create project" />}
          />
        )
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-44">Progress</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Team</TableHead>
                  {showBudget && <TableHead className="text-right">Budget</TableHead>}
                  <TableHead className="w-10 pr-4"><span className="sr-only">Priority</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const due = dueLabel(p.dueDate, today);
                  const done = p.status === "COMPLETED" || p.status === "CANCELLED";
                  return (
                    <TableRow key={p.id} className="group relative">
                      <TableCell className="max-w-72 pl-4">
                        <Link href={`/projects/${p.id}`} className="block after:absolute after:inset-0">
                          <span className="block truncate font-medium group-hover:underline">{p.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {p.clientName ?? "Internal"} · {p.openTasks} open {p.openTasks === 1 ? "task" : "tasks"}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell><StatusBadge kind="project" value={p.status} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ProgressBar value={p.progress} label={`${p.name} progress`} tone={p.status === "COMPLETED" ? "success" : !done && due.overdue ? "danger" : "brand"} />
                          <span className="tabular w-9 text-right text-xs text-muted-foreground">{p.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-sm", !done && due.overdue ? "font-medium text-danger" : "text-muted-foreground")}>
                        {done ? "—" : due.text}
                      </TableCell>
                      <TableCell><AvatarStack people={p.team} /></TableCell>
                      {showBudget && <TableCell className="tabular text-right">{p.budget ? formatMoney(p.budget) : "—"}</TableCell>}
                      <TableCell className="pr-4"><PriorityIndicator value={p.priority} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul className="grid gap-2 md:hidden">
            {rows.map((p) => {
              const due = dueLabel(p.dueDate, today);
              const done = p.status === "COMPLETED" || p.status === "CANCELLED";
              return (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="block rounded-xl border bg-card p-4 shadow-xs active:bg-muted/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.clientName ?? "Internal"}</p>
                      </div>
                      <StatusBadge kind="project" value={p.status} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <ProgressBar value={p.progress} label={`${p.name} progress`} />
                      <span className="tabular text-xs text-muted-foreground">{p.progress}%</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <AvatarStack people={p.team} />
                      <span className={cn("text-xs", !done && due.overdue ? "font-medium text-danger" : "text-muted-foreground")}>{done ? PROJECT_STATUS_META[p.status].label : due.text}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <Pagination page={filters.page} pageSize={PAGE_SIZE} total={total} searchParams={sp} basePath="/projects" />
        </>
      )}
    </>
  );
}
