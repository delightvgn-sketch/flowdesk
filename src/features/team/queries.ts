import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import type { Tx } from "@/server/db";
import { profiles, workspaceMembers } from "@/server/db/schema";

export type PersonOption = { id: string; fullName: string; avatarUrl: string | null; role: string; title: string | null };

/** Staff (non-client) members, for assignee and team pickers. */
export async function staffOptions(tx: Tx, workspaceId: string): Promise<PersonOption[]> {
  return tx
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      avatarUrl: profiles.avatarUrl,
      role: workspaceMembers.role,
      title: workspaceMembers.title,
    })
    .from(workspaceMembers)
    .innerJoin(profiles, eq(profiles.id, workspaceMembers.profileId))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), inArray(workspaceMembers.role, ["OWNER", "ADMIN", "MEMBER"])))
    .orderBy(asc(profiles.fullName));
}
