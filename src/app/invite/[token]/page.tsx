import type { Metadata } from "next";
import { and, eq, gt, isNull } from "drizzle-orm";
import { UserPlus } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { ROLE_META } from "@/lib/constants";
import { getSession } from "@/server/auth/session";
import { adminDb } from "@/server/db";
import { profiles, workspaceInvitations, workspaces } from "@/server/db/schema";

import { AcceptInviteButton } from "./accept-button";

export const metadata: Metadata = { title: "Join workspace" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const session = await getSession();

  const [invite] = await adminDb
    .select({
      email: workspaceInvitations.email,
      role: workspaceInvitations.role,
      workspaceName: workspaces.name,
      invitedBy: profiles.fullName,
    })
    .from(workspaceInvitations)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvitations.workspaceId))
    .leftJoin(profiles, eq(profiles.id, workspaceInvitations.invitedById))
    .where(
      and(
        eq(workspaceInvitations.token, token),
        isNull(workspaceInvitations.acceptedAt),
        isNull(workspaceInvitations.revokedAt),
        gt(workspaceInvitations.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-16 pb-16 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <UserPlus className="size-6" aria-hidden />
        </div>
        {invite ? (
          <>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">Join {invite.workspaceName}</h1>
            <p className="mt-2 text-muted-foreground">
              {invite.invitedBy ?? "A teammate"} invited <span className="font-medium text-foreground">{invite.email}</span> to join as{" "}
              {ROLE_META[invite.role].label.toLowerCase()}.
            </p>
            <div className="mt-8">
              <AcceptInviteButton token={token} signedInEmail={session?.profile.email ?? null} inviteEmail={invite.email} />
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">This invitation has expired</h1>
            <p className="mt-2 text-muted-foreground">Invitations are valid for 7 days. Ask the person who invited you for a new link.</p>
          </>
        )}
      </main>
    </div>
  );
}
