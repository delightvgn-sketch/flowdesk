"use client";

import { Check, MessageSquareWarning } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { respondToMilestone } from "@/features/projects/actions";
import { useAction } from "@/hooks/use-action";

/** Client sign-off on a deliverable. */
export function MilestoneApproval({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [note, setNote] = useState("");
  const { execute, pending } = useAction(respondToMilestone, {
    success: (/* */) => (mode === "changes" ? "Feedback sent to the team." : `“${title}” approved. Thank you!`),
    onSuccess: () => {
      setMode("idle");
      router.refresh();
    },
  });

  if (mode === "changes") {
    return (
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          execute({ id, decision: "CHANGES_REQUESTED", note });
        }}
      >
        <label htmlFor={`note-${id}`} className="text-sm font-medium">
          What should change?
        </label>
        <Textarea
          id={`note-${id}`}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          required
          placeholder="Be as specific as you can…"
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending || !note.trim()}>
            Send feedback
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode("idle")}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" onClick={() => execute({ id, decision: "APPROVED" })} disabled={pending}>
        <Check /> Approve
      </Button>
      <Button size="sm" variant="outline" onClick={() => setMode("changes")} disabled={pending}>
        <MessageSquareWarning /> Request changes
      </Button>
    </div>
  );
}
