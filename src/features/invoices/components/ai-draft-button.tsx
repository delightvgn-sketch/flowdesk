"use client";

import { Loader2, Sparkles } from "lucide-react";

import { draftInvoiceDescription } from "@/features/ai/actions";
import { useAction } from "@/hooks/use-action";

/** Ask FlowDesk AI to write or polish a line-item description. */
export function AiDraftButton({
  getContext,
  onDraft,
}: {
  getContext: () => { draft?: string; client?: string; project?: string };
  onDraft: (text: string) => void;
}) {
  const { execute, pending } = useAction(draftInvoiceDescription, { onSuccess: ({ text }) => onDraft(text) });
  return (
    <button
      type="button"
      onClick={() => execute(getContext())}
      disabled={pending}
      className="mt-1 inline-flex items-center gap-1 rounded text-xs font-medium text-primary hover:underline disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
      {pending ? "Writing…" : "Write with AI"}
    </button>
  );
}
