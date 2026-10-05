import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { Tx } from "@/server/db";
import { notifications } from "@/server/db/schema";

export async function listNotificationsFor(tx: Tx, workspaceId: string, profileId: string, limit = 100) {
  return tx
    .select({ id: notifications.id, title: notifications.title, body: notifications.body, href: notifications.href, readAt: notifications.readAt, createdAt: notifications.createdAt })
    .from(notifications)
    .where(and(eq(notifications.workspaceId, workspaceId), eq(notifications.recipientId, profileId)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
