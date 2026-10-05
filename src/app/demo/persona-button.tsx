"use client";

import { useClerk, useSignIn } from "@clerk/nextjs";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { startDemoSession } from "@/features/demo/actions";

export function DemoPersonaButton({
  persona,
  name,
  title,
  roleLabel,
  blurb,
}: {
  persona: string;
  name: string;
  title: string;
  roleLabel: string;
  blurb: string;
}) {
  const clerk = useClerk();
  // Clerk must be loaded before a ticket can be exchanged; until then the
  // button stays disabled (it also isn't interactive before hydration).
  const ready = clerk.loaded;
  const { signIn } = useSignIn();
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    try {
      const result = await startDemoSession(persona);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Switching personas: end the current session first.
      if (clerk.isSignedIn) await clerk.signOut();

      const { error } = await signIn.ticket({ ticket: result.data.ticket });
      if (error) throw error;
      const finalized = await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl(result.data.redirectTo);
          window.location.href = url;
        },
      });
      if (finalized.error) throw finalized.error;
    } catch (error) {
      console.error(error);
      toast.error("Couldn't start the demo session. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={pending || !ready}
      aria-busy={pending || !ready}
      className="group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-xs transition-all hover:border-primary/40 hover:shadow-md disabled:opacity-70"
    >
      <UserAvatar name={name} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{name}</span>
          <Badge tone="brand">{roleLabel}</Badge>
        </span>
        <span className="block text-sm text-muted-foreground">{title}</span>
        <span className="mt-1 block text-sm">{blurb}</span>
      </span>
      {pending ? (
        <Loader2 className="size-5 animate-spin text-primary" aria-label="Signing in" />
      ) : (
        <ArrowRight
          className="size-5 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden
        />
      )}
    </button>
  );
}
