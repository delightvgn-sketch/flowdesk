"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAction } from "@/server/actions/safe-action";
import { WORKSPACE_COOKIE } from "@/server/auth/session";
import { notifications } from "@/server/db/schema";
import { UserFacingError } from "@/server/errors";

export const switchWorkspace = createAction({ schema: z.object({ workspaceId: z.uuid() }) }, async ({ workspaceId }, ctx) => {
  const target = ctx.memberships.find((m) => m.workspace.id === workspaceId);
  if (!target) throw new UserFacingError("You're not a member of that workspace.");
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { role: target.role };
});

export const listNotifications = createAction({ schema: z.object({}) }, async (_input, ctx) => {
  return ctx.db((tx) =>
    tx
      .select({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        type: notifications.type,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(eq(notifications.workspaceId, ctx.workspace.id), eq(notifications.recipientId, ctx.profile.id)))
      .orderBy(desc(notifications.createdAt))
      .limit(12),
  );
});

export const markNotificationRead = createAction({ schema: z.object({ id: z.uuid() }) }, async ({ id }, ctx) => {
  await ctx.db((tx) =>
    tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.recipientId, ctx.profile.id), isNull(notifications.readAt))),
  );
  revalidatePath("/", "layout");
});

export const markAllNotificationsRead = createAction({ schema: z.object({}) }, async (_input, ctx) => {
  await ctx.db((tx) =>
    tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.workspaceId, ctx.workspace.id),
          eq(notifications.recipientId, ctx.profile.id),
          isNull(notifications.readAt),
        ),
      ),
  );
  revalidatePath("/", "layout");
});
