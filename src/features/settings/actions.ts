"use server";

import { randomBytes } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { assignableRoles, canManageMember } from "@/lib/permissions";
import { idSchema, inviteSchema, memberRoleSchema, notificationPrefsSchema, profileSchema, workspaceSchema } from "@/lib/validation";
import { createAction } from "@/server/actions/safe-action";
import { WORKSPACE_COOKIE, type AppContext } from "@/server/auth/session";
import type { Tx } from "@/server/db";
import { clients, profiles, workspaceInvitations, workspaceMembers, workspaces } from "@/server/db/schema";
import { env } from "@/server/env";
import { NotFoundError, UserFacingError } from "@/server/errors";
import { DEMO_PEOPLE } from "@/server/seed/demo-data";
import { logActivity } from "@/server/services/activity";

export const updateProfile = createAction({ schema: profileSchema }, async ({ fullName }, ctx) => {
  await ctx.db((tx) => tx.update(profiles).set({ fullName }).where(eq(profiles.id, ctx.profile.id)));
  revalidatePath("/", "layout");
});

export const updateNotificationPrefs = createAction({ schema: notificationPrefsSchema }, async (prefs, ctx) => {
  await ctx.db((tx) => tx.update(profiles).set({ notificationPrefs: prefs }).where(eq(profiles.id, ctx.profile.id)));
  revalidatePath("/settings/preferences");
});

export const updateWorkspace = createAction({ schema: workspaceSchema, permission: "workspace:update" }, async (input, ctx) => {
  const [row] = await ctx.db((tx) => tx.update(workspaces).set(input).where(eq(workspaces.id, ctx.workspace.id)).returning());
  if (!row) throw new NotFoundError("Workspace");
  revalidatePath("/", "layout");
});

export const deleteWorkspace = createAction(
  { schema: z.object({ confirmName: z.string() }), permission: "workspace:delete" },
  async ({ confirmName }, ctx) => {
    if (ctx.workspace.isDemo) throw new UserFacingError("The shared demo workspace can't be deleted.");
    if (confirmName.trim() !== ctx.workspace.name) throw new UserFacingError("Type the workspace name exactly to confirm.");
    const deleted = await ctx.db((tx) => tx.delete(workspaces).where(eq(workspaces.id, ctx.workspace.id)).returning({ id: workspaces.id }));
    if (deleted.length === 0) throw new UserFacingError("Only the owner can delete the workspace.");
    (await cookies()).delete(WORKSPACE_COOKIE);
    return { remaining: ctx.memberships.length - 1 };
  },
);

/* ----------------------------------- Team ----------------------------------- */

/** Keep the shared demo usable: its seeded personas can't be removed or re-roled. */
async function assertNotDemoPersona(tx: Tx, ctx: AppContext, profileId: string) {
  if (!ctx.workspace.isDemo) return;
  const profile = await tx.query.profiles.findFirst({ where: eq(profiles.id, profileId) });
  if (profile && Object.values(DEMO_PEOPLE).some((p) => p.email === profile.email.toLowerCase())) {
    throw new UserFacingError("Demo personas can't be changed — invite someone new to try team management.");
  }
}

/**
 * Invitations are delivered by link in this portfolio build: the inviter copies
 * the link and sends it however they like. The link only works for a user who
 * signs in with the invited (verified) email address.
 */
export const inviteMember = createAction({ schema: inviteSchema, permission: "team:manage" }, async (input, ctx) => {
  if (!assignableRoles(ctx.role).includes(input.role)) throw new UserFacingError("You can't invite someone with that role.");
  const token = randomBytes(24).toString("base64url");

  await ctx.db(async (tx) => {
    const [existing] = await tx
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .innerJoin(profiles, eq(profiles.id, workspaceMembers.profileId))
      .where(and(eq(workspaceMembers.workspaceId, ctx.workspace.id), sql`lower(${profiles.email}) = ${input.email}`));
    if (existing) throw new UserFacingError("That person is already a member of this workspace.");
    if (input.clientId) {
      const client = await tx.query.clients.findFirst({ where: and(eq(clients.id, input.clientId), eq(clients.workspaceId, ctx.workspace.id)) });
      if (!client) throw new NotFoundError("Client");
    }
    // Replace any pending invitation for the same email.
    await tx
      .update(workspaceInvitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(workspaceInvitations.workspaceId, ctx.workspace.id), sql`lower(${workspaceInvitations.email}) = ${input.email}`, isNull(workspaceInvitations.acceptedAt), isNull(workspaceInvitations.revokedAt)));
    await tx.insert(workspaceInvitations).values({
      workspaceId: ctx.workspace.id,
      email: input.email,
      role: input.role,
      clientId: input.role === "CLIENT" ? input.clientId : null,
      token,
      invitedById: ctx.profile.id,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    });
    await logActivity(tx, ctx, { action: "member.invited", entityType: "member", entityLabel: input.email });
  });
  revalidatePath("/settings/team");
  return { url: `${env.appUrl()}/invite/${token}` };
});

export const revokeInvitation = createAction({ schema: idSchema, permission: "team:manage" }, async ({ id }, ctx) => {
  await ctx.db((tx) =>
    tx.update(workspaceInvitations).set({ revokedAt: new Date() }).where(and(eq(workspaceInvitations.id, id), eq(workspaceInvitations.workspaceId, ctx.workspace.id))),
  );
  revalidatePath("/settings/team");
});

export const changeMemberRole = createAction({ schema: memberRoleSchema, permission: "team:manage" }, async ({ memberId, role }, ctx) => {
  await ctx.db(async (tx) => {
    const member = await tx.query.workspaceMembers.findFirst({ where: and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, ctx.workspace.id)) });
    if (!member) throw new NotFoundError("Member");
    if (member.profileId === ctx.profile.id) throw new UserFacingError("You can't change your own role.");
    if (!canManageMember(ctx.role, member.role) || member.role === "CLIENT") throw new UserFacingError("You can't change this member's role.");
    await assertNotDemoPersona(tx, ctx, member.profileId);
    const updated = await tx.update(workspaceMembers).set({ role }).where(eq(workspaceMembers.id, memberId)).returning();
    if (updated.length === 0) throw new UserFacingError("You can't change this member's role.");
  });
  revalidatePath("/settings/team");
});

export const removeMember = createAction({ schema: z.object({ memberId: z.uuid() }), permission: "team:manage" }, async ({ memberId }, ctx) => {
  await ctx.db(async (tx) => {
    const member = await tx.query.workspaceMembers.findFirst({ where: and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, ctx.workspace.id)) });
    if (!member) throw new NotFoundError("Member");
    if (member.profileId === ctx.profile.id) throw new UserFacingError("You can't remove yourself.");
    if (!canManageMember(ctx.role, member.role)) throw new UserFacingError("You can't remove the workspace owner.");
    await assertNotDemoPersona(tx, ctx, member.profileId);
    const deleted = await tx.delete(workspaceMembers).where(eq(workspaceMembers.id, memberId)).returning();
    if (deleted.length === 0) throw new UserFacingError("You can't remove this member.");
  });
  revalidatePath("/settings/team");
});

/** Only the owner can hand over ownership; they become an admin. */
export const transferOwnership = createAction({ schema: z.object({ memberId: z.uuid() }), permission: "team:transfer-ownership" }, async ({ memberId }, ctx) => {
  await ctx.db(async (tx) => {
    const member = await tx.query.workspaceMembers.findFirst({ where: and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, ctx.workspace.id)) });
    if (!member || member.role === "CLIENT" || member.profileId === ctx.profile.id) throw new UserFacingError("Choose another staff member.");
    if (ctx.workspace.isDemo) throw new UserFacingError("Ownership of the shared demo workspace can't be transferred.");
    await tx.update(workspaceMembers).set({ role: "OWNER" }).where(eq(workspaceMembers.id, memberId));
    await tx.update(workspaceMembers).set({ role: "ADMIN" }).where(and(eq(workspaceMembers.workspaceId, ctx.workspace.id), eq(workspaceMembers.profileId, ctx.profile.id)));
  });
  revalidatePath("/", "layout");
});

export const updateMemberTitle = createAction(
  { schema: z.object({ memberId: z.uuid(), title: z.string().trim().max(80) }), permission: "team:manage" },
  async ({ memberId, title }, ctx) => {
    await ctx.db((tx) => tx.update(workspaceMembers).set({ title: title || null }).where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, ctx.workspace.id))));
    revalidatePath("/settings/team");
  },
);
