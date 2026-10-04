import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { asc, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { adminDb, withRls, type Tx } from "@/server/db";
import { profiles, workspaceMembers, workspaces, type Profile, type Workspace, type WorkspaceRole } from "@/server/db/schema";

export const WORKSPACE_COOKIE = "fd_workspace";

export class UnauthorizedError extends Error {
  constructor() {
    super("You need to be signed in to do that.");
    this.name = "UnauthorizedError";
  }
}

export class NoWorkspaceError extends Error {
  constructor() {
    super("You're not a member of any workspace yet.");
    this.name = "NoWorkspaceError";
  }
}

/**
 * Resolve the signed-in Clerk user to a FlowDesk profile, creating or linking one
 * on first sign-in. Cached for the lifetime of a single request.
 */
export const getSession = cache(async (): Promise<{ clerkUserId: string; profile: Profile } | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await adminDb.query.profiles.findFirst({ where: eq(profiles.clerkUserId, userId) });
  if (existing) return { clerkUserId: userId, profile: existing };

  const profile = await linkOrCreateProfile(userId);
  return profile ? { clerkUserId: userId, profile } : null;
});

/**
 * First sign-in: adopt a pre-existing profile with the same *verified* email
 * (seeded demo users, invited teammates) or create a fresh one. Clerk only
 * reports an address as verified once the user has proven ownership, so this
 * can't be used to take over somebody else's profile.
 */
async function linkOrCreateProfile(clerkUserId: string): Promise<Profile | null> {
  const user = await currentUser();
  if (!user) return null;

  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
  if (!primary || primary.verification?.status !== "verified") return null;

  const email = primary.emailAddress.toLowerCase();
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || email.split("@")[0];

  const [linked] = await adminDb
    .update(profiles)
    .set({ clerkUserId, avatarUrl: user.hasImage ? user.imageUrl : undefined })
    .where(sql`lower(${profiles.email}) = ${email}`)
    .returning();
  if (linked) return linked;

  const [created] = await adminDb
    .insert(profiles)
    .values({ clerkUserId, email, fullName, avatarUrl: user.hasImage ? user.imageUrl : null })
    .onConflictDoNothing()
    .returning();
  return created ?? (await adminDb.query.profiles.findFirst({ where: eq(profiles.clerkUserId, clerkUserId) })) ?? null;
}

export type Membership = {
  workspace: Workspace;
  role: WorkspaceRole;
  clientId: string | null;
};

export const getMemberships = cache(async (profileId: string): Promise<Membership[]> => {
  const rows = await adminDb
    .select({ workspace: workspaces, role: workspaceMembers.role, clientId: workspaceMembers.clientId })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.profileId, profileId))
    .orderBy(asc(workspaceMembers.createdAt));
  return rows;
});

export type AppContext = {
  clerkUserId: string;
  profile: Profile;
  workspace: Workspace;
  role: WorkspaceRole;
  /** The CRM client a CLIENT user represents. */
  clientId: string | null;
  memberships: Membership[];
  /** Run queries as this user, with row level security enforced. */
  db: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;
};

/** Resolve the active workspace, or throw. Used by server actions and route handlers. */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();

  const memberships = await getMemberships(session.profile.id);
  if (memberships.length === 0) throw new NoWorkspaceError();

  const preferred = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const active = memberships.find((m) => m.workspace.id === preferred) ?? memberships[0];

  return {
    clerkUserId: session.clerkUserId,
    profile: session.profile,
    workspace: active.workspace,
    role: active.role,
    clientId: active.clientId,
    memberships,
    db: (fn) => withRls(session.clerkUserId, fn),
  };
});

/** For pages: redirect to sign-in / onboarding instead of throwing. */
export async function requireAppContext(): Promise<AppContext> {
  try {
    return await getAppContext();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    if (error instanceof NoWorkspaceError) redirect("/onboarding");
    throw error;
  }
}

/** Internal app pages. Client users are sent to their portal. */
export async function requireStaffContext(): Promise<AppContext> {
  const ctx = await requireAppContext();
  if (ctx.role === "CLIENT") redirect("/portal");
  return ctx;
}

/** Client portal pages. Staff are sent to the dashboard. */
export async function requireClientContext(): Promise<AppContext & { clientId: string }> {
  const ctx = await requireAppContext();
  if (ctx.role !== "CLIENT" || !ctx.clientId) redirect("/dashboard");
  return ctx as AppContext & { clientId: string };
}
