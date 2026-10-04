import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";

import type { Tx } from "@/server/db";
import { activityLogs, notifications, profiles, workspaceMembers, type NotificationPrefs } from "@/server/db/schema";
import type { AppContext } from "@/server/auth/session";

type ActivityInput = {
  action: string;
  entityType: "client" | "project" | "task" | "invoice" | "payment" | "file" | "milestone" | "message" | "member" | "comment" | "event";
  entityId?: string | null;
  entityLabel?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

/** Append an entry to the workspace activity timeline. */
export async function logActivity(tx: Tx, ctx: AppContext, input: ActivityInput) {
  await tx.insert(activityLogs).values({
    workspaceId: ctx.workspace.id,
    actorId: ctx.profile.id,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    entityLabel: input.entityLabel ?? null,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    metadata: input.metadata ?? null,
  });
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  taskAssigned: true,
  comments: true,
  invoices: true,
  files: true,
  messages: true,
  deadlines: true,
};

type NotificationCategory = keyof NotificationPrefs;

type NotifyInput = {
  recipientIds: (string | null | undefined)[];
  category: NotificationCategory;
  type: string;
  title: string;
  body?: string;
  href?: string;
};

/**
 * Create in-app notifications. Skips the actor, de-duplicates recipients,
 * drops anyone who isn't a member of the workspace and honours each
 * recipient's notification preferences.
 */
export async function notify(tx: Tx, ctx: AppContext, input: NotifyInput) {
  const ids = [...new Set(input.recipientIds.filter((id): id is string => !!id && id !== ctx.profile.id))];
  if (ids.length === 0) return;

  const recipients = await tx
    .select({ id: profiles.id, prefs: profiles.notificationPrefs })
    .from(workspaceMembers)
    .innerJoin(profiles, eq(profiles.id, workspaceMembers.profileId))
    .where(and(eq(workspaceMembers.workspaceId, ctx.workspace.id), inArray(workspaceMembers.profileId, ids)));

  const wanted = recipients.filter((r) => ({ ...DEFAULT_NOTIFICATION_PREFS, ...r.prefs })[input.category]);
  if (wanted.length === 0) return;

  await tx.insert(notifications).values(
    wanted.map((r) => ({
      workspaceId: ctx.workspace.id,
      recipientId: r.id,
      actorId: ctx.profile.id,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
    })),
  );
}

/** Staff who manage the workspace — used for client-originated events. */
export async function managerIds(tx: Tx, ctx: AppContext): Promise<string[]> {
  const rows = await tx
    .select({ id: workspaceMembers.profileId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, ctx.workspace.id),
        inArray(workspaceMembers.role, ["OWNER", "ADMIN"]),
        ne(workspaceMembers.profileId, ctx.profile.id),
      ),
    );
  return rows.map((r) => r.id);
}
