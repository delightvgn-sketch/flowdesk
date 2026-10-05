import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { MailOpen } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { getMemberships, getSession } from "@/server/auth/session";
import { adminDb } from "@/server/db";
import { workspaceInvitations, workspaces } from "@/server/db/schema";

import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const session = await getSession();
  if (!session) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold tracking-tight">Verify your email to continue</h1>
        <p className="mt-2 text-muted-foreground">
          FlowDesk links your account by verified email address. Please verify your email in your account settings, then come
          back.
        </p>
        <Button asChild className="mt-6">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </Shell>
    );
  }

  const { new: creatingAnother } = await searchParams;
  const memberships = await getMemberships(session.profile.id);
  if (memberships.length > 0 && !creatingAnother) redirect("/dashboard");

  const invites = await adminDb
    .select({ token: workspaceInvitations.token, workspaceName: workspaces.name, role: workspaceInvitations.role })
    .from(workspaceInvitations)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvitations.workspaceId))
    .where(
      and(
        sql`lower(${workspaceInvitations.email}) = ${session.profile.email.toLowerCase()}`,
        isNull(workspaceInvitations.acceptedAt),
        isNull(workspaceInvitations.revokedAt),
        gt(workspaceInvitations.expiresAt, new Date()),
      ),
    );

  return (
    <Shell>
      <p className="font-display text-lg text-primary italic">Welcome to FlowDesk</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        {creatingAnother ? "Create another workspace" : "Set up your workspace"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        A workspace holds your clients, projects, invoices and team. You can invite people once it&apos;s ready.
      </p>

      {invites.length > 0 && (
        <div className="mt-6 space-y-2">
          {invites.map((invite) => (
            <div key={invite.token} className="flex items-center gap-3 rounded-lg border bg-brand-soft/60 p-3">
              <MailOpen className="size-5 text-primary" aria-hidden />
              <p className="flex-1 text-sm">
                You&apos;ve been invited to <span className="font-medium">{invite.workspaceName}</span>.
              </p>
              <Button size="sm" asChild>
                <Link href={`/invite/${invite.token}`}>View invite</Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      <OnboardingForm defaultName={session.profile.fullName} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-10 pb-16 sm:pt-20">{children}</main>
    </div>
  );
}
