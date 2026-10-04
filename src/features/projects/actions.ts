"use server";

import { and, eq, inArray, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MILESTONE_STATUSES, PROJECT_STATUSES, PROJECT_STATUS_META } from "@/lib/constants";
import { idSchema, milestoneSchema, projectSchema } from "@/lib/validation";
import { createAction } from "@/server/actions/safe-action";
import type { AppContext } from "@/server/auth/session";
import type { Tx } from "@/server/db";
import { milestones, projectMembers, projects, workspaceMembers } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/errors";
import { logActivity, managerIds, notify } from "@/server/services/activity";

/** Only accept member ids that really are staff of this workspace. */
async function validStaffIds(tx: Tx, ctx: AppContext, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await tx
    .select({ id: workspaceMembers.profileId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, ctx.workspace.id),
        inArray(workspaceMembers.profileId, ids),
        inArray(workspaceMembers.role, ["OWNER", "ADMIN", "MEMBER"]),
      ),
    );
  return rows.map((r) => r.id);
}

async function clientUserIds(tx: Tx, ctx: AppContext, clientId: string | null) {
  if (!clientId) return [];
  const rows = await tx
    .select({ id: workspaceMembers.profileId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, ctx.workspace.id), eq(workspaceMembers.clientId, clientId)));
  return rows.map((r) => r.id);
}

export const createProject = createAction({ schema: projectSchema, permission: "project:create" }, async ({ memberIds, ...input }, ctx) => {
  const project = await ctx.db(async (tx) => {
    const [row] = await tx
      .insert(projects)
      .values({ ...input, workspaceId: ctx.workspace.id, createdById: ctx.profile.id })
      .returning();
    const team = await validStaffIds(tx, ctx, memberIds);
    if (team.length) {
      await tx.insert(projectMembers).values(team.map((profileId) => ({ workspaceId: ctx.workspace.id, projectId: row.id, profileId })));
    }
    await logActivity(tx, ctx, { action: "project.created", entityType: "project", entityId: row.id, entityLabel: row.name, projectId: row.id, clientId: row.clientId });
    await notify(tx, ctx, {
      recipientIds: team,
      category: "taskAssigned",
      type: "project.member_added",
      title: `You were added to ${row.name}`,
      href: `/projects/${row.id}`,
    });
    return row;
  });
  revalidatePath("/projects");
  return { id: project.id };
});

export const updateProject = createAction(
  { schema: projectSchema.safeExtend({ id: z.uuid(), progress: z.number().int().min(0).max(100).optional() }), permission: "project:create" },
  async ({ id, memberIds, ...input }, ctx) => {
    await ctx.db(async (tx) => {
      const before = await tx.query.projects.findFirst({ where: and(eq(projects.id, id), eq(projects.workspaceId, ctx.workspace.id)) });
      if (!before) throw new NotFoundError("Project");

      const [row] = await tx
        .update(projects)
        .set({
          ...input,
          completedAt: input.status === "COMPLETED" ? (before.completedAt ?? new Date()) : null,
        })
        .where(eq(projects.id, id))
        .returning();

      // Sync the team.
      const team = await validStaffIds(tx, ctx, memberIds);
      const existing = await tx.select({ id: projectMembers.profileId }).from(projectMembers).where(eq(projectMembers.projectId, id));
      const existingIds = existing.map((e) => e.id);
      const added = team.filter((m) => !existingIds.includes(m));
      const removed = existingIds.filter((m) => !team.includes(m));
      if (removed.length) await tx.delete(projectMembers).where(and(eq(projectMembers.projectId, id), inArray(projectMembers.profileId, removed)));
      if (added.length) await tx.insert(projectMembers).values(added.map((profileId) => ({ workspaceId: ctx.workspace.id, projectId: id, profileId })));

      await logActivity(tx, ctx, {
        action: before.status !== row.status ? "project.status_changed" : "project.updated",
        entityType: "project",
        entityId: id,
        entityLabel: row.name,
        projectId: id,
        clientId: row.clientId,
        metadata: before.status !== row.status ? { from: before.status, to: row.status } : undefined,
      });
      await notify(tx, ctx, { recipientIds: added, category: "taskAssigned", type: "project.member_added", title: `You were added to ${row.name}`, href: `/projects/${id}` });
    });
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
  },
);

/** Status-only change, available to staffed members as well as managers (RLS enforces membership). */
export const setProjectStatus = createAction(
  { schema: idSchema.extend({ status: z.enum(PROJECT_STATUSES) }), permission: "project:update" },
  async ({ id, status }, ctx) => {
    await ctx.db(async (tx) => {
      const before = await tx.query.projects.findFirst({ where: and(eq(projects.id, id), eq(projects.workspaceId, ctx.workspace.id)) });
      if (!before) throw new NotFoundError("Project");
      if (before.status === status) return;
      const [row] = await tx
        .update(projects)
        .set({ status, completedAt: status === "COMPLETED" ? new Date() : null })
        .where(eq(projects.id, id))
        .returning();
      if (!row) throw new UserFacingError("You can only change the status of projects you're working on.");
      await logActivity(tx, ctx, { action: "project.status_changed", entityType: "project", entityId: id, entityLabel: row.name, projectId: id, clientId: row.clientId, metadata: { from: before.status, to: status } });
      const clients = await clientUserIds(tx, ctx, row.clientId);
      await notify(tx, ctx, {
        recipientIds: [...clients, ...(await managerIds(tx, ctx))],
        category: "deadlines",
        type: "project.status_changed",
        title: `${row.name} is now ${PROJECT_STATUS_META[status].label.toLowerCase()}`,
        href: `/projects/${id}`,
      });
    });
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
  },
);

export const deleteProject = createAction({ schema: idSchema, permission: "project:delete" }, async ({ id }, ctx) => {
  await ctx.db(async (tx) => {
    const [row] = await tx.delete(projects).where(and(eq(projects.id, id), eq(projects.workspaceId, ctx.workspace.id))).returning();
    if (!row) throw new NotFoundError("Project");
    await logActivity(tx, ctx, { action: "project.deleted", entityType: "project", entityLabel: row.name, clientId: row.clientId });
  });
  revalidatePath("/projects");
});

/* -------------------------------- Milestones -------------------------------- */

export const createMilestone = createAction({ schema: milestoneSchema, permission: "project:update" }, async ({ requiresApproval, ...input }, ctx) => {
  await ctx.db(async (tx) => {
    const [{ last }] = await tx.select({ last: max(milestones.position) }).from(milestones).where(eq(milestones.projectId, input.projectId));
    const [row] = await tx
      .insert(milestones)
      .values({
        ...input,
        workspaceId: ctx.workspace.id,
        position: (last ?? -1) + 1,
        approvalStatus: requiresApproval ? "PENDING" : "NOT_REQUIRED",
      })
      .returning();
    await logActivity(tx, ctx, { action: "milestone.created", entityType: "milestone", entityId: row.id, entityLabel: row.title, projectId: input.projectId });
  });
  revalidatePath(`/projects/${input.projectId}`);
});

export const updateMilestoneStatus = createAction(
  { schema: idSchema.extend({ status: z.enum(MILESTONE_STATUSES) }), permission: "project:update" },
  async ({ id, status }, ctx) => {
    const [row] = await ctx.db((tx) =>
      tx.update(milestones).set({ status }).where(and(eq(milestones.id, id), eq(milestones.workspaceId, ctx.workspace.id))).returning(),
    );
    if (!row) throw new NotFoundError("Milestone");
    revalidatePath(`/projects/${row.projectId}`);
  },
);

/** Ask the client to sign off a deliverable; notifies the client's portal users. */
export const requestMilestoneApproval = createAction({ schema: idSchema, permission: "project:update" }, async ({ id }, ctx) => {
  const projectId = await ctx.db(async (tx) => {
    const [row] = await tx
      .update(milestones)
      .set({ approvalStatus: "PENDING", approvalNote: null, approvedAt: null, approvedById: null })
      .where(and(eq(milestones.id, id), eq(milestones.workspaceId, ctx.workspace.id)))
      .returning();
    if (!row) throw new NotFoundError("Milestone");
    const project = await tx.query.projects.findFirst({ where: eq(projects.id, row.projectId) });
    await notify(tx, ctx, {
      recipientIds: await clientUserIds(tx, ctx, project?.clientId ?? null),
      category: "deadlines",
      type: "milestone.pending",
      title: `“${row.title}” is ready for your approval`,
      href: `/portal/projects/${row.projectId}`,
    });
    return row.projectId;
  });
  revalidatePath(`/projects/${projectId}`);
});

export const deleteMilestone = createAction({ schema: idSchema, permission: "project:update" }, async ({ id }, ctx) => {
  const [row] = await ctx.db((tx) => tx.delete(milestones).where(and(eq(milestones.id, id), eq(milestones.workspaceId, ctx.workspace.id))).returning());
  if (!row) throw new NotFoundError("Milestone");
  revalidatePath(`/projects/${row.projectId}`);
});

/** Client sign-off. Runs through the narrow `app.respond_to_milestone` definer function. */
export const respondToMilestone = createAction(
  {
    schema: idSchema.extend({ decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]), note: z.string().trim().max(1000).optional() }),
    permission: "milestone:approve",
  },
  async ({ id, decision, note }, ctx) => {
    const projectId = await ctx.db(async (tx) => {
      await tx.execute(sql`select app.respond_to_milestone(${id}::uuid, ${decision}::public.approval_status, ${note || null})`);
      const m = await tx.query.milestones.findFirst({ where: eq(milestones.id, id) });
      if (!m) throw new NotFoundError("Milestone");
      await logActivity(tx, ctx, {
        action: decision === "APPROVED" ? "milestone.approved" : "milestone.changes_requested",
        entityType: "milestone",
        entityId: id,
        entityLabel: m.title,
        projectId: m.projectId,
        clientId: ctx.clientId,
      });
      const team = await tx.select({ id: projectMembers.profileId }).from(projectMembers).where(eq(projectMembers.projectId, m.projectId));
      await notify(tx, ctx, {
        recipientIds: [...team.map((t) => t.id), ...(await managerIds(tx, ctx))],
        category: "comments",
        type: decision === "APPROVED" ? "milestone.approved" : "milestone.changes_requested",
        title: `${ctx.profile.fullName} ${decision === "APPROVED" ? "approved" : "requested changes on"} “${m.title}”`,
        body: note || undefined,
        href: `/projects/${m.projectId}?tab=timeline`,
      });
      return m.projectId;
    });
    revalidatePath(`/portal/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}`);
  },
);
