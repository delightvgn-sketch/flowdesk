import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import { PAGE_SIZE } from "@/lib/constants";
import type { Tx } from "@/server/db";
import { clients, milestones, profiles, projectMembers, projects, tasks, type Priority, type ProjectStatus } from "@/server/db/schema";

export type ProjectFilters = {
  q?: string;
  status?: ProjectStatus | "active";
  priority?: Priority;
  clientId?: string;
  sort?: "due" | "newest" | "name" | "progress";
  page: number;
};

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listProjects(tx: Tx, workspaceId: string, f: ProjectFilters) {
  const where: SQL[] = [eq(projects.workspaceId, workspaceId)];
  if (f.q) where.push(or(ilike(projects.name, like(f.q)), ilike(clients.company, like(f.q)))!);
  if (f.status === "active") where.push(inArray(projects.status, ["PLANNING", "IN_PROGRESS", "REVIEW"]));
  else if (f.status) where.push(eq(projects.status, f.status));
  if (f.priority) where.push(eq(projects.priority, f.priority));
  if (f.clientId) where.push(eq(projects.clientId, f.clientId));

  const order =
    f.sort === "newest"
      ? [desc(projects.createdAt)]
      : f.sort === "name"
        ? [asc(projects.name)]
        : f.sort === "progress"
          ? [desc(projects.progress)]
          : [sql`case when ${projects.status} in ('COMPLETED', 'CANCELLED') then 1 else 0 end`, sql`${projects.dueDate} asc nulls last`];

  const [rows, [{ total }]] = await Promise.all([
    tx
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        priority: projects.priority,
        progress: projects.progress,
        dueDate: projects.dueDate,
        startDate: projects.startDate,
        budget: projects.budget,
        clientId: projects.clientId,
        clientName: sql<string | null>`coalesce(${clients.company}, ${clients.name})`,
        openTasks: sql<number>`(select count(*) from tasks t where t.project_id = "projects"."id" and t.status <> 'DONE')`.mapWith(Number),
      })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.clientId))
      .where(and(...where))
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    tx
      .select({ total: count() })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.clientId))
      .where(and(...where)),
  ]);

  const members = await projectTeams(tx, rows.map((r) => r.id));
  return { rows: rows.map((r) => ({ ...r, team: members[r.id] ?? [] })), total };
}

export async function projectTeams(tx: Tx, projectIds: string[]) {
  if (projectIds.length === 0) return {} as Record<string, { id: string; fullName: string; avatarUrl: string | null }[]>;
  const rows = await tx
    .select({ projectId: projectMembers.projectId, id: profiles.id, fullName: profiles.fullName, avatarUrl: profiles.avatarUrl })
    .from(projectMembers)
    .innerJoin(profiles, eq(profiles.id, projectMembers.profileId))
    .where(inArray(projectMembers.projectId, projectIds))
    .orderBy(asc(profiles.fullName));
  const map: Record<string, { id: string; fullName: string; avatarUrl: string | null }[]> = {};
  for (const r of rows) (map[r.projectId] ??= []).push({ id: r.id, fullName: r.fullName, avatarUrl: r.avatarUrl });
  return map;
}

export async function getProject(tx: Tx, workspaceId: string, id: string) {
  const [project] = await tx
    .select({
      project: projects,
      clientName: sql<string | null>`coalesce(${clients.company}, ${clients.name})`,
      clientContact: clients.name,
      clientEmail: clients.email,
    })
    .from(projects)
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  if (!project) return null;

  const [team, projectMilestones, [taskStats]] = await Promise.all([
    projectTeams(tx, [id]).then((m) => m[id] ?? []),
    tx.select().from(milestones).where(eq(milestones.projectId, id)).orderBy(asc(milestones.position), asc(milestones.dueDate)),
    tx
      .select({
        total: count(),
        done: sql<number>`count(*) filter (where ${tasks.status} = 'DONE')`.mapWith(Number),
        overdue: sql<number>`count(*) filter (where ${tasks.status} <> 'DONE' and ${tasks.dueDate} < current_date)`.mapWith(Number),
      })
      .from(tasks)
      .where(eq(tasks.projectId, id)),
  ]);

  return { ...project.project, clientName: project.clientName, clientContact: project.clientContact, clientEmail: project.clientEmail, team, milestones: projectMilestones, taskStats };
}

/** Projects for <select> inputs (RLS limits members to their own). */
export async function projectOptions(tx: Tx, workspaceId: string) {
  return tx
    .select({ id: projects.id, label: projects.name, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), inArray(projects.status, ["PLANNING", "IN_PROGRESS", "REVIEW", "ON_HOLD"])))
    .orderBy(asc(projects.name));
}
