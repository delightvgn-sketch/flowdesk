import "server-only";

import { and, asc, desc, eq, gte, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";

import type { Tx } from "@/server/db";
import {
  activityLogs,
  files,
  labels,
  profiles,
  projects,
  taskComments,
  taskLabels,
  tasks,
  type Priority,
} from "@/server/db/schema";

import type { BoardTask, TaskDetail, TaskLabel } from "./types";

export type TaskFilters = {
  q?: string;
  projectId?: string | "none";
  assigneeId?: string;
  priority?: Priority;
  labelId?: string;
};

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Tasks for the board. Done tasks are limited to the last 30 days so the board
 * stays fast and focused; everything else is returned in position order.
 */
export async function listBoardTasks(tx: Tx, workspaceId: string, f: TaskFilters): Promise<BoardTask[]> {
  const where: SQL[] = [
    eq(tasks.workspaceId, workspaceId),
    or(ne(tasks.status, "DONE"), gte(tasks.completedAt, sql`now() - interval '30 days'`))!,
  ];
  if (f.q) where.push(ilike(tasks.title, like(f.q)));
  if (f.projectId === "none") where.push(isNull(tasks.projectId));
  else if (f.projectId) where.push(eq(tasks.projectId, f.projectId));
  if (f.assigneeId) where.push(eq(tasks.assigneeId, f.assigneeId));
  if (f.priority) where.push(eq(tasks.priority, f.priority));
  if (f.labelId)
    where.push(sql`exists (select 1 from task_labels tl where tl.task_id = ${tasks.id} and tl.label_id = ${f.labelId})`);

  const rows = await tx
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      position: tasks.position,
      dueDate: tasks.dueDate,
      projectId: tasks.projectId,
      projectName: projects.name,
      assigneeId: tasks.assigneeId,
      assigneeName: profiles.fullName,
      assigneeAvatar: profiles.avatarUrl,
      commentCount: sql<number>`(select count(*) from task_comments c where c.task_id = "tasks"."id")`.mapWith(Number),
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(profiles, eq(profiles.id, tasks.assigneeId))
    .where(and(...where))
    .orderBy(asc(tasks.position), desc(tasks.createdAt))
    .limit(500);

  const labelMap = await labelsForTasks(
    tx,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({ ...r, labels: labelMap[r.id] ?? [] }));
}

async function labelsForTasks(tx: Tx, taskIds: string[]) {
  const map: Record<string, TaskLabel[]> = {};
  if (taskIds.length === 0) return map;
  const rows = await tx
    .select({ taskId: taskLabels.taskId, id: labels.id, name: labels.name, color: labels.color })
    .from(taskLabels)
    .innerJoin(labels, eq(labels.id, taskLabels.labelId))
    .where(inArray(taskLabels.taskId, taskIds))
    .orderBy(asc(labels.name));
  for (const r of rows) (map[r.taskId] ??= []).push({ id: r.id, name: r.name, color: r.color });
  return map;
}

export async function listLabels(tx: Tx, workspaceId: string): Promise<TaskLabel[]> {
  return tx
    .select({ id: labels.id, name: labels.name, color: labels.color })
    .from(labels)
    .where(eq(labels.workspaceId, workspaceId))
    .orderBy(asc(labels.name));
}

export async function getTaskDetail(tx: Tx, workspaceId: string, id: string): Promise<TaskDetail | null> {
  const creator = sql<string | null>`(select full_name from profiles p where p.id = "tasks"."created_by_id")`;
  const [row] = await tx
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      position: tasks.position,
      dueDate: tasks.dueDate,
      projectId: tasks.projectId,
      projectName: projects.name,
      assigneeId: tasks.assigneeId,
      assigneeName: profiles.fullName,
      assigneeAvatar: profiles.avatarUrl,
      createdAt: tasks.createdAt,
      completedAt: tasks.completedAt,
      createdById: tasks.createdById,
      createdByName: creator,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(profiles, eq(profiles.id, tasks.assigneeId))
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, workspaceId)))
    .limit(1);
  if (!row) return null;

  const [comments, attachments, activity, labelMap] = await Promise.all([
    tx
      .select({
        id: taskComments.id,
        body: taskComments.body,
        createdAt: taskComments.createdAt,
        authorId: taskComments.authorId,
        authorName: profiles.fullName,
        authorAvatar: profiles.avatarUrl,
      })
      .from(taskComments)
      .leftJoin(profiles, eq(profiles.id, taskComments.authorId))
      .where(eq(taskComments.taskId, id))
      .orderBy(asc(taskComments.createdAt)),
    tx
      .select({
        id: files.id,
        name: files.name,
        sizeBytes: files.sizeBytes,
        mimeType: files.mimeType,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(eq(files.taskId, id))
      .orderBy(desc(files.createdAt)),
    tx
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        actorName: profiles.fullName,
        createdAt: activityLogs.createdAt,
        metadata: activityLogs.metadata,
      })
      .from(activityLogs)
      .leftJoin(profiles, eq(profiles.id, activityLogs.actorId))
      .where(and(eq(activityLogs.entityId, id), eq(activityLogs.entityType, "task")))
      .orderBy(desc(activityLogs.createdAt))
      .limit(20),
    labelsForTasks(tx, [id]),
  ]);

  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    commentCount: comments.length,
    labels: labelMap[id] ?? [],
    comments: comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    attachments: attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    activity: activity.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  };
}
