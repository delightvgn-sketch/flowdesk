"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import { SubmitButton } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/features/onboarding/actions";
import { useAction } from "@/hooks/use-action";

export function AcceptInviteButton({
  token,
  signedInEmail,
  inviteEmail,
}: {
  token: string;
  signedInEmail: string | null;
  inviteEmail: string;
}) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { execute, pending } = useAction(acceptInvitation, {
    success: "You've joined the workspace.",
    onSuccess: ({ redirectTo }) => router.push(redirectTo),
  });

  if (signedInEmail && signedInEmail.toLowerCase() !== inviteEmail.toLowerCase()) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          You&apos;re signed in as <span className="font-medium text-foreground">{signedInEmail}</span>.
        </p>
        <Button variant="outline" onClick={() => signOut({ redirectUrl: `/sign-in?redirect_url=/invite/${token}` })}>
          Switch account
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        execute(token);
      }}
    >
      <SubmitButton pending={pending} pendingLabel="Joining…" size="lg">
        Accept invitation
      </SubmitButton>
    </form>
  );
}
