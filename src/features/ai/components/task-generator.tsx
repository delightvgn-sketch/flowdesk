"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field } from "@/components/shared/form-field";
import { FormDialog, FormDialogBody, FormDialogFooter } from "@/components/shared/form-dialog";
import { PriorityIndicator } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { addGeneratedTasks, generateProjectTasks, type GeneratedTask } from "@/features/ai/actions";
import { useAction } from "@/hooks/use-action";

/** "Break this project into tasks" — review AI suggestions, then add the ones you want. */
export function AiTaskGenerator({
  projectId,
  projectName,
  projects,
}: {
  projectId?: string;
  projectName?: string;
  projects?: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(projectId ?? projects?.[0]?.id ?? "");
  const [brief, setBrief] = useState("");
  const [suggestions, setSuggestions] = useState<GeneratedTask[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const generate = useAction(generateProjectTasks, {
    onSuccess: (tasks) => {
      setSuggestions(tasks);
      setSelected(new Set(tasks.map((_, i) => i)));
    },
  });
  const add = useAction(addGeneratedTasks, {
    success: ({ count }) => `${count} tasks added to the board.`,
    onSuccess: () => {
      setOpen(false);
      setSuggestions(null);
      setBrief("");
      router.refresh();
    },
  });

  const toggle = (i: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Sparkles /> Generate tasks
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Generate tasks with FlowDesk AI"
        description={projectName ? `Break “${projectName}” into development tasks.` : "Break a project into development tasks."}
        className="sm:max-w-2xl"
      >
        <FormDialogBody>
          {projects && !projectId && (
            <Field label="Project" required>
              {(p) => (
                <select
                  {...p}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-xs"
                >
                  {projects.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Extra context (optional)" description="Scope, tech stack, constraints — anything that helps.">
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. Next.js storefront, M-Pesa checkout, CMS for banners. Launch in 6 weeks."
              />
            )}
          </Field>

          {suggestions && (
            <div>
              <p className="mb-2 text-sm font-medium">
                Suggestions <span className="font-normal text-muted-foreground">— {selected.size} selected</span>
              </p>
              <ul className="divide-y rounded-lg border">
                {suggestions.map((t, i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer gap-3 px-3 py-2.5 hover:bg-muted/40">
                      <Checkbox
                        checked={selected.has(i)}
                        onCheckedChange={() => toggle(i)}
                        className="mt-0.5"
                        aria-label={`Include ${t.title}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {t.title}
                          <PriorityIndicator value={t.priority} />
                        </span>
                        <span className="block text-xs text-muted-foreground">{t.description}</span>
                      </span>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">~{t.estimateDays}d</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </FormDialogBody>
        <FormDialogFooter>
          <Button
            variant="outline"
            onClick={() => generate.execute({ projectId: projectId ?? target, brief: brief || undefined })}
            disabled={generate.pending || !(projectId ?? target)}
          >
            {generate.pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {generate.pending ? "Thinking…" : suggestions ? "Regenerate" : "Generate"}
          </Button>
          {suggestions && (
            <Button
              onClick={() =>
                add.execute({
                  projectId: projectId ?? target,
                  tasks: suggestions
                    .filter((_, i) => selected.has(i))
                    .map((t) => ({ title: t.title, description: t.description, priority: t.priority })),
                })
              }
              disabled={add.pending || selected.size === 0}
            >
              {add.pending && <Loader2 className="animate-spin" />}
              Add {selected.size} {selected.size === 1 ? "task" : "tasks"}
            </Button>
          )}
        </FormDialogFooter>
      </FormDialog>
    </>
  );
}
