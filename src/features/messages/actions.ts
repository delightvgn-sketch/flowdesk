"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { can } from "@/lib/permissions";
import { idSchema, messageSchema } from "@/lib/validation";
import { createAction } from "@/server/actions/safe-action";
import { clients, messages, projectMembers, projects, workspaceMembers } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/errors";
import { logActivity, managerIds, notify } from "@/server/services/activity";

function revalidateThread(projectId: string | null, clientId: string | null) {
  revalidatePath("/messages");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/portal/projects/${projectId}`);
  }
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/portal/messages");
}

export const sendMessage = createAction({ schema: messageSchema, permission: "message:send" }, async (input, ctx) => {
  if (input.internal && !can(ctx.role, "message:internal")) throw new UserFacingError("Clients can't post internal notes.");
  const isClient = ctx.role === "CLIENT";
  if (isClient && !input.projectId && !input.clientId) input.clientId = ctx.clientId;

  const row = await ctx.db(async (tx) => {
    let threadName = "General";
    let clientId = input.clientId;
    if (input.projectId) {
      const project = await tx.query.projects.findFirst({
        where: and(eq(projects.id, input.projectId), eq(projects.workspaceId, ctx.workspace.id)),
      });
      if (!project) throw new NotFoundError("Project");
      threadName = project.name;
      clientId = project.clientId;
    } else if (input.clientId) {
      const client = await tx.query.clients.findFirst({
        where: and(eq(clients.id, input.clientId), eq(clients.workspaceId, ctx.workspace.id)),
      });
      if (!client) throw new NotFoundError("Client");
      threadName = client.company ?? client.name;
    }

    const [msg] = await tx
      .insert(messages)
      .values({
        workspaceId: ctx.workspace.id,
        projectId: input.projectId,
        clientId: input.projectId ? null : input.clientId,
        authorId: ctx.profile.id,
        body: input.body,
        internal: input.internal,
      })
      .returning();

    // Recipients: project team (or managers), plus the client's portal users unless internal.
    const team = input.projectId
      ? (
          await tx
            .select({ id: projectMembers.profileId })
            .from(projectMembers)
            .where(eq(projectMembers.projectId, input.projectId))
        ).map((r) => r.id)
      : [];
    const clientUsers =
      clientId && !input.internal
        ? (
            await tx
              .select({ id: workspaceMembers.profileId })
              .from(workspaceMembers)
              .where(and(eq(workspaceMembers.workspaceId, ctx.workspace.id), eq(workspaceMembers.clientId, clientId)))
          ).map((r) => r.id)
        : [];
    // The general channel is a lightweight team chat and doesn't notify.
    await notify(tx, ctx, {
      recipientIds: [...team, ...clientUsers, ...(isClient ? await managerIds(tx, ctx) : [])],
      category: "messages",
      type: "message.created",
      title: `${ctx.profile.fullName} ${input.internal ? "left an internal note" : "sent a message"} in ${threadName}`,
      body: input.body.slice(0, 140),
      href: input.projectId
        ? `/projects/${input.projectId}?tab=messages`
        : input.clientId
          ? `/messages?client=${input.clientId}`
          : "/messages",
    });
    if (isClient) {
      await logActivity(tx, ctx, {
        action: "message.posted",
        entityType: "message",
        entityId: msg.id,
        entityLabel: threadName,
        projectId: input.projectId,
        clientId,
      });
    }
    return msg;
  });

  revalidateThread(row.projectId, row.clientId);
  return { id: row.id };
});

export const deleteMessage = createAction({ schema: idSchema, permission: "message:send" }, async ({ id }, ctx) => {
  const [row] = await ctx.db((tx) =>
    tx
      .delete(messages)
      .where(and(eq(messages.id, id), eq(messages.workspaceId, ctx.workspace.id)))
      .returning(),
  );
  if (!row) throw new UserFacingError("You can only delete your own messages.");
  revalidateThread(row.projectId, row.clientId);
});
