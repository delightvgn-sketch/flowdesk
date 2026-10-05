"use client";

import { CheckCircle2, ClipboardCopy, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { summarizeMeeting, type MeetingSummary } from "@/features/ai/actions";
import { useAction } from "@/hooks/use-action";

const SAMPLE = `Call with Greenline Café — Peter, Victor, Brian
- Pilot at Kilimani moves to the 14th, Peter wants staff trained the day before
- Kitchen display: SSE works on their tablets now, Brian to stress test with 30 orders
- Delivery fees: flat 150 within 3km, 300 beyond. Peter to confirm zones by Friday
- Victor will send the revised timeline and the milestone invoice tomorrow
- Decided to postpone loyalty points to phase 2`;

export function MeetingSummarizer() {
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<MeetingSummary | null>(null);
  const { execute, pending } = useAction(summarizeMeeting, { onSuccess: setResult });

  function copy() {
    if (!result) return;
    const text = [
      "Summary",
      result.summary,
      "",
      "Decisions",
      ...result.decisions.map((d) => `- ${d}`),
      "",
      "Action items",
      ...result.actionItems.map((a) => `- ${a.task}${a.owner ? ` (${a.owner})` : ""}${a.due ? ` — ${a.due}` : ""}`),
    ].join("\n");
    void navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard."));
  }

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2">
      <div className="space-y-3">
        <Field label="Meeting notes" description="Paste raw notes or a transcript. Nothing is stored.">
          {(p) => (
            <Textarea
              {...p}
              rows={14}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste your notes here…"
              className="font-mono text-xs"
            />
          )}
        </Field>
        <div className="flex gap-2">
          <Button onClick={() => execute({ notes })} disabled={pending || notes.trim().length < 20}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? "Summarizing…" : "Summarize"}
          </Button>
          {!notes && (
            <Button variant="ghost" onClick={() => setNotes(SAMPLE)}>
              Try a sample
            </Button>
          )}
        </div>
      </div>
      <div className="rounded-xl border bg-muted/30 p-4 sm:p-5">
        {result ? (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold">Summary</h3>
              <Button variant="ghost" size="xs" onClick={copy}>
                <ClipboardCopy /> Copy
              </Button>
            </div>
            <p className="-mt-3 text-sm leading-relaxed">{result.summary}</p>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Decisions</h3>
              {result.decisions.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {result.decisions.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No decisions recorded.</p>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Action items</h3>
              <ul className="space-y-2">
                {result.actionItems.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span>
                      {a.task}
                      {(a.owner || a.due) && (
                        <span className="block text-xs text-muted-foreground">
                          {[a.owner, a.due].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <Sparkles className="mb-2 size-5" aria-hidden />
            The summary, decisions and action items will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
