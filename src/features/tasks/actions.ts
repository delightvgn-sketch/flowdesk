"use server";

import { and, eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { commentSchema, idSchema, labelSchema, taskMoveSchema, taskSchema } from "@/lib/validation";
import { createAction } from "@/server/actions/safe-action";
import type { AppContext } from "@/server/auth/session";
import type { Tx } from "@/server/db";
import { labels, projects, taskComments, taskLabels, tasks, workspaceMembers } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/errors";
import { logActivity, notify } from "@/server/services/activity";
import { recomputeProjectProgress } from "@/server/services/projects";

import { getTaskDetail } from "./queries";

function revalidateTaskViews(projectId?: string | null) {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

async function assertAssignable(tx: Tx, ctx: AppContext, assigneeId: string | null) {
  if (!assigneeId) return;
  const member = await tx.query.workspaceMembers.findFirst({
    where: and(eq(workspaceMembers.workspaceId, ctx.workspace.id), eq(workspaceMembers.profileId, assigneeId)),
  });
  if (!member || member.role === "CLIENT") throw new UserFacingError("Tasks can only be assigned to members of your team.");
}

async function setLabels(tx: Tx, ctx: AppContext, taskId: string, labelIds: string[]) {
  await tx.delete(taskLabels).where(eq(taskLabels.taskId, taskId));
  if (labelIds.length === 0) return;
  const valid = await tx
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.workspaceId, ctx.workspace.id), inArray(labels.id, labelIds)));
  if (valid.length)
    await tx.insert(taskLabels).values(valid.map((l) => ({ workspaceId: ctx.workspace.id, taskId, labelId: l.id })));
}

async function nextPosition(tx: Tx, workspaceId: string, status: string) {
  const [{ top }] = await tx
    .select({ top: max(tasks.position) })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.status, status as "TODO")));
  return (top ?? 0) + 1000;
}

export const createTask = createAction({ schema: taskSchema, permission: "task:create" }, async ({ labelIds, ...input }, ctx) => {
  const task = await ctx.db(async (tx) => {
    await assertAssignable(tx, ctx, input.assigneeId);
    const [row] = await tx
      .insert(tasks)
      .values({
        ...input,
        workspaceId: ctx.workspace.id,
        createdById: ctx.profile.id,
        position: await nextPosition(tx, ctx.workspace.id, input.status),
        completedAt: input.status === "DONE" ? new Date() : null,
      })
      .returning();
    await setLabels(tx, ctx, row.id, labelIds);
    const project = row.projectId ? await tx.query.projects.findFirst({ where: eq(projects.id, row.projectId) }) : null;
    await logActivity(tx, ctx, {
      action: "task.created",
      entityType: "task",
      entityId: row.id,
      entityLabel: row.title,
      projectId: row.projectId,
      clientId: project?.clientId,
    });
    await notify(tx, ctx, {
      recipientIds: [row.assigneeId],
      category: "taskAssigned",
      type: "task.assigned",
      title: `You were assigned “${row.title}”`,
      body: project ? project.name : undefined,
      href: `/tasks?task=${row.id}`,
    });
    await recomputeProjectProgress(tx, row.projectId);
    return row;
  });
  revalidateTaskViews(task.projectId);
  return { id: task.id };
});

export const updateTask = createAction(
  { schema: taskSchema.safeExtend({ id: z.uuid() }), permission: "task:update" },
  async ({ id, labelIds, ...input }, ctx) => {
    const projectIds = await ctx.db(async (tx) => {
      const before = await tx.query.tasks.findFirst({ where: and(eq(tasks.id, id), eq(tasks.workspaceId, ctx.workspace.id)) });
      if (!before) throw new NotFoundError("Task");
      await assertAssignable(tx, ctx, input.assigneeId);

      const statusChanged = before.status !== input.status;
      const [row] = await tx
        .update(tasks)
        .set({
          ...input,
          position: statusChanged ? await nextPosition(tx, ctx.workspace.id, input.status) : before.position,
          completedAt: input.status === "DONE" ? (before.completedAt ?? new Date()) : null,
        })
        .where(eq(tasks.id, id))
        .returning();
      if (!row) throw new UserFacingError("You can't edit this task.");
      await setLabels(tx, ctx, id, labelIds);

      if (statusChanged) {
        await logActivity(tx, ctx, {
          action: input.status === "DONE" ? "task.completed" : "task.status_changed",
          entityType: "task",
          entityId: id,
          entityLabel: row.title,
          projectId: row.projectId,
          metadata: { from: before.status, to: input.status },
        });
      }
      if (before.assigneeId !== row.assigneeId && row.assigneeId) {
        await notify(tx, ctx, {
          recipientIds: [row.assigneeId],
          category: "taskAssigned",
          type: "task.assigned",
          title: `You were assigned “${row.title}”`,
          href: `/tasks?task=${id}`,
        });
        await logActivity(tx, ctx, {
          action: "task.assigned",
          entityType: "task",
          entityId: id,
          entityLabel: row.title,
          projectId: row.projectId,
        });
      }
      await recomputeProjectProgress(tx, before.projectId);
      if (row.projectId !== before.projectId) await recomputeProjectProgress(tx, row.projectId);
      return [before.projectId, row.projectId];
    });
    projectIds.forEach((p) => revalidateTaskViews(p));
  },
);

/**
 * Drag & drop / "Move to…". Position is a float between the neighbours in the
 * destination column, so a move only ever touches one row.
 */
export const moveTask = createAction(
  { schema: taskMoveSchema, permission: "task:update" },
  async ({ id, status, beforeId, afterId }, ctx) => {
    const projectId = await ctx.db(async (tx) => {
      const before = await tx.query.tasks.findFirst({ where: and(eq(tasks.id, id), eq(tasks.workspaceId, ctx.workspace.id)) });
      if (!before) throw new NotFoundError("Task");

      const neighbours = await tx
        .select({ id: tasks.id, position: tasks.position })
        .from(tasks)
        .where(
          and(
            eq(tasks.workspaceId, ctx.workspace.id),
            inArray(
              tasks.id,
              [beforeId, afterId].filter((x): x is string => !!x),
            ),
          ),
        );
      const prev = neighbours.find((n) => n.id === beforeId)?.position;
      const next = neighbours.find((n) => n.id === afterId)?.position;
      const position =
        prev !== undefined && next !== undefined
          ? (prev + next) / 2
          : prev !== undefined
            ? prev + 1000
            : next !== undefined
              ? next - 1000
              : await nextPosition(tx, ctx.workspace.id, status);

      const [row] = await tx
        .update(tasks)
        .set({ status, position, completedAt: status === "DONE" ? (before.completedAt ?? new Date()) : null })
        .where(eq(tasks.id, id))
        .returning();
      if (!row) throw new UserFacingError("You can't move this task.");

      if (before.status !== status) {
        await logActivity(tx, ctx, {
          action: status === "DONE" ? "task.completed" : "task.status_changed",
          entityType: "task",
          entityId: id,
          entityLabel: row.title,
          projectId: row.projectId,
          metadata: { from: before.status, to: status },
        });
        await recomputeProjectProgress(tx, row.projectId);
      }
      return row.projectId;
    });
    revalidateTaskViews(projectId);
  },
);

export const deleteTask = createAction({ schema: idSchema, permission: "task:delete" }, async ({ id }, ctx) => {
  const projectId = await ctx.db(async (tx) => {
    const [row] = await tx
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ctx.workspace.id)))
      .returning();
    if (!row) throw new UserFacingError("Only managers or the task's creator can delete it.");
    await recomputeProjectProgress(tx, row.projectId);
    return row.projectId;
  });
  revalidateTaskViews(projectId);
});

export const fetchTaskDetail = createAction({ schema: idSchema, permission: "task:view" }, async ({ id }, ctx) => {
  const task = await ctx.db((tx) => getTaskDetail(tx, ctx.workspace.id, id));
  if (!task) throw new NotFoundError("Task");
  return task;
});

export const addComment = createAction({ schema: commentSchema, permission: "task:comment" }, async ({ taskId, body }, ctx) => {
  const comment = await ctx.db(async (tx) => {
    const task = await tx.query.tasks.findFirst({ where: and(eq(tasks.id, taskId), eq(tasks.workspaceId, ctx.workspace.id)) });
    if (!task) throw new NotFoundError("Task");
    const [row] = await tx
      .insert(taskComments)
      .values({ workspaceId: ctx.workspace.id, taskId, authorId: ctx.profile.id, body })
      .returning();
    await logActivity(tx, ctx, {
      action: "comment.posted",
      entityType: "task",
      entityId: taskId,
      entityLabel: task.title,
      projectId: task.projectId,
    });

    // Notify the assignee, the creator and anyone else in the thread.
    const participants = await tx
      .selectDistinct({ id: taskComments.authorId })
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId));
    await notify(tx, ctx, {
      recipientIds: [task.assigneeId, task.createdById, ...participants.map((p) => p.id)],
      category: "comments",
      type: "comment.created",
      title: `${ctx.profile.fullName} commented on “${task.title}”`,
      body: body.slice(0, 140),
      href: `/tasks?task=${taskId}`,
    });
    return row;
  });
  revalidatePath("/tasks");
  return { id: comment.id, createdAt: comment.createdAt.toISOString() };
});

export const deleteComment = createAction({ schema: idSchema, permission: "task:comment" }, async ({ id }, ctx) => {
  const [row] = await ctx.db((tx) =>
    tx
      .delete(taskComments)
      .where(and(eq(taskComments.id, id), eq(taskComments.workspaceId, ctx.workspace.id)))
      .returning(),
  );
  if (!row) throw new UserFacingError("You can only delete your own comments.");
});

export const createLabel = createAction({ schema: labelSchema, permission: "task:create" }, async (input, ctx) => {
  const [row] = await ctx.db((tx) =>
    tx
      .insert(labels)
      .values({ ...input, workspaceId: ctx.workspace.id })
      .returning(),
  );
  revalidatePath("/tasks");
  return { id: row.id, name: row.name, color: row.color };
});
