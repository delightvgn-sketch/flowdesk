"use server";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { onboardingSchema } from "@/lib/validation";
import { getSession, WORKSPACE_COOKIE } from "@/server/auth/session";
import { adminDb } from "@/server/db";
import { activityLogs, labels, profiles, workspaceInvitations, workspaceMembers, workspaces } from "@/server/db/schema";
import { toUserMessage } from "@/server/errors";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  );
}

/**
 * Create a workspace with the caller as OWNER. Runs on the privileged
 * connection because the caller has no membership yet for RLS to check; the
 * identity comes from the verified Clerk session, never from the request.
 */
export async function createWorkspace(raw: z.input<typeof onboardingSchema>): Promise<ActionResult<{ workspaceId: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    const workspaceId = await adminDb.transaction(async (tx) => {
      const base = slugify(parsed.data.workspaceName);
      const taken = await tx
        .select({ slug: workspaces.slug })
        .from(workspaces)
        .where(sql`${workspaces.slug} = ${base} or ${workspaces.slug} like ${`${base}-%`}`);
      const slug = taken.length === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 6)}`;

      const [ws] = await tx.insert(workspaces).values({ name: parsed.data.workspaceName, slug }).returning({ id: workspaces.id });
      await tx.insert(workspaceMembers).values({ workspaceId: ws.id, profileId: session.profile.id, role: "OWNER" });
      await tx.update(profiles).set({ fullName: parsed.data.fullName }).where(eq(profiles.id, session.profile.id));
      await tx.insert(labels).values(
        [
          ["Design", "pink"],
          ["Frontend", "blue"],
          ["Backend", "violet"],
          ["Bug", "red"],
          ["Content", "amber"],
        ].map(([name, color]) => ({ workspaceId: ws.id, name, color })),
      );
      return ws.id;
    });

    (await cookies()).set(WORKSPACE_COOKIE, workspaceId, COOKIE_OPTS);
    return { ok: true, data: { workspaceId } };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

/**
 * Accept an invitation. The token proves the invite was issued; the invite is
 * bound to an email address, which must match the signed-in user's verified
 * email so a leaked link can't be used by someone else.
 */
export async function acceptInvitation(token: string): Promise<ActionResult<{ redirectTo: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in to accept this invitation." };

  try {
    const invite = await adminDb.query.workspaceInvitations.findFirst({
      where: and(
        eq(workspaceInvitations.token, token),
        isNull(workspaceInvitations.acceptedAt),
        isNull(workspaceInvitations.revokedAt),
        gt(workspaceInvitations.expiresAt, new Date()),
      ),
    });
    if (!invite) return { ok: false, error: "This invitation is no longer valid. Ask for a new link." };
    if (invite.email.toLowerCase() !== session.profile.email.toLowerCase()) {
      return { ok: false, error: `This invitation was sent to ${invite.email}. Sign in with that address to accept it.` };
    }

    await adminDb.transaction(async (tx) => {
      await tx
        .insert(workspaceMembers)
        .values({ workspaceId: invite.workspaceId, profileId: session.profile.id, role: invite.role, clientId: invite.clientId })
        .onConflictDoNothing();
      await tx.update(workspaceInvitations).set({ acceptedAt: new Date() }).where(eq(workspaceInvitations.id, invite.id));
      await tx.insert(activityLogs).values({
        workspaceId: invite.workspaceId,
        actorId: session.profile.id,
        action: "member.joined",
        entityType: "member",
        entityLabel: session.profile.fullName,
        clientId: invite.clientId,
      });
    });

    (await cookies()).set(WORKSPACE_COOKIE, invite.workspaceId, COOKIE_OPTS);
    return { ok: true, data: { redirectTo: invite.role === "CLIENT" ? "/portal" : "/dashboard" } };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}
