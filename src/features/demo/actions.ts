"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { WORKSPACE_COOKIE } from "@/server/auth/session";
import { adminDb } from "@/server/db";
import { profiles, workspaces } from "@/server/db/schema";
import { env } from "@/server/env";
import { DEMO_LOGIN_PERSONAS, DEMO_PEOPLE, DEMO_WORKSPACE } from "@/server/seed/demo-data";
import { seedDemo } from "@/server/seed/seed-demo";
import { storageAdmin } from "@/server/storage";

const personaSchema = z.enum(DEMO_LOGIN_PERSONAS.map((p) => p.key) as [string, ...string[]]);

/**
 * One-click demo access. Creates (or reuses) the persona's Clerk user, links it
 * to the seeded FlowDesk profile and returns a single-use sign-in token that
 * the browser exchanges for a real Clerk session. No passwords are stored or
 * shared, and only the fixed demo personas can be requested.
 */
export async function startDemoSession(raw: string): Promise<ActionResult<{ ticket: string; redirectTo: string }>> {
  if (!env.demoEnabled()) return { ok: false, error: "The demo is disabled on this deployment." };

  const parsed = personaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Unknown demo persona." };
  const person = DEMO_PEOPLE[parsed.data as keyof typeof DEMO_PEOPLE];

  try {
    // First visit on a fresh deployment: build the demo workspace on demand.
    let workspace = await adminDb.query.workspaces.findFirst({ where: eq(workspaces.slug, DEMO_WORKSPACE.slug) });
    if (!workspace) {
      await seedDemo(adminDb, { storage: storageAdmin() });
      workspace = await adminDb.query.workspaces.findFirst({ where: eq(workspaces.slug, DEMO_WORKSPACE.slug) });
    }

    const clerk = await clerkClient();
    const [firstName, ...rest] = person.fullName.split(" ");
    const existing = await clerk.users.getUserList({ emailAddress: [person.email], limit: 1 });
    const user =
      existing.data[0] ??
      (await clerk.users.createUser({
        emailAddress: [person.email],
        firstName,
        lastName: rest.join(" "),
        skipPasswordRequirement: true,
        publicMetadata: { demo: true },
      }));

    // Make sure the seeded profile points at this Clerk user.
    await adminDb
      .update(profiles)
      .set({ clerkUserId: user.id })
      .where(sql`lower(${profiles.email}) = ${person.email}`);

    const token = await clerk.signInTokens.createSignInToken({ userId: user.id, expiresInSeconds: 120 });

    if (workspace) {
      (await cookies()).set(WORKSPACE_COOKIE, workspace.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    }

    return { ok: true, data: { ticket: token.token, redirectTo: person.role === "CLIENT" ? "/portal" : "/dashboard" } };
  } catch (error) {
    console.error("[flowdesk] demo sign-in failed", error);
    return {
      ok: false,
      error: "The demo couldn't start. Check that Clerk and the database are configured (see README → Demo).",
    };
  }
}
