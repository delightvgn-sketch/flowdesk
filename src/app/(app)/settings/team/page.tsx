import type { Metadata } from "next";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";

import { clientOptions } from "@/features/clients/queries";
import { TeamManager } from "@/features/settings/components/team-manager";
import { assertCan, can } from "@/lib/permissions";
import { requireStaffContext } from "@/server/auth/session";
import { clients, profiles, workspaceInvitations, workspaceMembers } from "@/server/db/schema";

export const metadata: Metadata = { title: "Team" };

export default async function TeamSettingsPage() {
  const ctx = await requireStaffContext();
  assertCan(ctx.role, "team:view");
  const manage = can(ctx.role, "team:manage");

  const [members, invites, clientList] = await ctx.db((tx) =>
    Promise.all([
      tx
        .select({
          id: workspaceMembers.id,
          profileId: profiles.id,
          fullName: profiles.fullName,
          email: profiles.email,
          avatarUrl: profiles.avatarUrl,
          role: workspaceMembers.role,
          title: workspaceMembers.title,
          clientName: sql<string | null>`coalesce(${clients.company}, ${clients.name})`,
          createdAt: workspaceMembers.createdAt,
        })
        .from(workspaceMembers)
        .innerJoin(profiles, eq(profiles.id, workspaceMembers.profileId))
        .leftJoin(clients, eq(clients.id, workspaceMembers.clientId))
        .where(eq(workspaceMembers.workspaceId, ctx.workspace.id))
        .orderBy(sql`case ${workspaceMembers.role} when 'OWNER' then 0 when 'ADMIN' then 1 when 'MEMBER' then 2 else 3 end`, asc(profiles.fullName)),
      manage
        ? tx
            .select({ id: workspaceInvitations.id, email: workspaceInvitations.email, role: workspaceInvitations.role, expiresAt: workspaceInvitations.expiresAt, clientName: clients.company })
            .from(workspaceInvitations)
            .leftJoin(clients, eq(clients.id, workspaceInvitations.clientId))
            .where(and(eq(workspaceInvitations.workspaceId, ctx.workspace.id), isNull(workspaceInvitations.acceptedAt), isNull(workspaceInvitations.revokedAt), gt(workspaceInvitations.expiresAt, new Date())))
        : Promise.resolve([]),
      manage ? clientOptions(tx, ctx.workspace.id) : Promise.resolve([]),
    ]),
  );

  return <TeamManager members={members} invites={invites} role={ctx.role} currentProfileId={ctx.profile.id} clients={clientList} />;
}
