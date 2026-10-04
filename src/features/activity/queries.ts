import "server-only";

import { and, desc, eq, type SQL } from "drizzle-orm";

import type { Tx } from "@/server/db";
import { activityLogs, profiles } from "@/server/db/schema";

import type { ActivityItem } from "./describe";

export async function listActivity(
  tx: Tx,
  workspaceId: string,
  filter: { projectId?: string; clientId?: string; limit?: number } = {},
): Promise<ActivityItem[]> {
  const conditions: SQL[] = [eq(activityLogs.workspaceId, workspaceId)];
  if (filter.projectId) conditions.push(eq(activityLogs.projectId, filter.projectId));
  if (filter.clientId) conditions.push(eq(activityLogs.clientId, filter.clientId));

  return tx
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      entityLabel: activityLogs.entityLabel,
      projectId: activityLogs.projectId,
      metadata: activityLogs.metadata,
      createdAt: activityLogs.createdAt,
      actorName: profiles.fullName,
      actorAvatar: profiles.avatarUrl,
    })
    .from(activityLogs)
    .leftJoin(profiles, eq(profiles.id, activityLogs.actorId))
    .where(and(...conditions))
    .orderBy(desc(activityLogs.createdAt))
    .limit(filter.limit ?? 15);
}
