"use client";

import { Check, Circle, CircleDot, Flag, MoreHorizontal, Plus, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { FormDialog, FormDialogBody, FormDialogFooter } from "@/components/shared/form-dialog";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/misc";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createMilestone, deleteMilestone, requestMilestoneApproval, updateMilestoneStatus } from "@/features/projects/actions";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { MILESTONE_STATUSES, MILESTONE_STATUS_META } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { milestoneSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { Milestone } from "@/server/db/schema";

export function MilestoneTimeline({ projectId, milestones, canEdit, hasClient }: { projectId: string; milestones: Milestone[]; canEdit: boolean; hasClient: boolean }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const refresh = () => router.refresh();
  const setStatus = useAction(updateMilestoneStatus, { success: "Milestone updated.", onSuccess: refresh });
  const request = useAction(requestMilestoneApproval, { success: "Approval requested — the client has been notified.", onSuccess: refresh });
  const remove = useAction(deleteMilestone, { success: "Milestone removed.", onSuccess: refresh });

  return (
    <div>
      {milestones.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No milestones yet"
          description="Milestones show clients where the project is at, and let them approve deliverables."
          action={canEdit && <Button onClick={() => setAddOpen(true)}><Plus /> Add milestone</Button>}
        />
      ) : (
        <>
          <ol className="relative">
            {milestones.map((m, i) => {
              const Icon = m.status === "COMPLETED" ? Check : m.status === "CURRENT" ? CircleDot : Circle;
              return (
                <li key={m.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < milestones.length - 1 && (
                    <span aria-hidden className={cn("absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5", m.status === "COMPLETED" ? "bg-success/50" : "bg-border")} />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                      m.status === "COMPLETED" && "border-success bg-success text-white",
                      m.status === "CURRENT" && "border-primary bg-brand-soft text-primary",
                      m.status === "UPCOMING" && "border-border-strong bg-card text-subtle-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl border bg-card p-4 shadow-xs">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{m.dueDate ? `Due ${formatDate(m.dueDate)}` : "No date"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge kind="milestone" value={m.status} />
                        {m.approvalStatus !== "NOT_REQUIRED" && <StatusBadge kind="approval" value={m.approvalStatus} />}
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${m.title}`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel className="text-xs text-muted-foreground">Status</DropdownMenuLabel>
                              {MILESTONE_STATUSES.map((s) => (
                                <DropdownMenuItem key={s} disabled={s === m.status} onSelect={() => setStatus.execute({ id: m.id, status: s })}>
                                  {MILESTONE_STATUS_META[s].label}
                                </DropdownMenuItem>
                              ))}
                              {hasClient && m.approvalStatus !== "APPROVED" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onSelect={() => request.execute({ id: m.id })}>
                                    <Send /> {m.approvalStatus === "PENDING" ? "Remind client to approve" : "Request client approval"}
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => remove.execute({ id: m.id })}>
                                <Trash2 /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                    {m.description && <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>}
                    {m.approvalNote && (
                      <p className="mt-2 rounded-md border-l-2 border-danger/50 bg-danger-soft/40 px-3 py-1.5 text-sm">
                        <span className="font-medium">Client feedback:</span> {m.approvalNote}
                      </p>
                    )}
                    {m.approvedAt && m.approvalStatus === "APPROVED" && <p className="mt-2 text-xs text-success">Approved {formatDate(m.approvedAt)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          {canEdit && (
            <Button variant="outline" className="mt-6" onClick={() => setAddOpen(true)}>
              <Plus /> Add milestone
            </Button>
          )}
        </>
      )}
      <AddMilestoneDialog open={addOpen} onOpenChange={setAddOpen} projectId={projectId} hasClient={hasClient} />
    </div>
  );
}

function AddMilestoneDialog({ open, onOpenChange, projectId, hasClient }: { open: boolean; onOpenChange: (o: boolean) => void; projectId: string; hasClient: boolean }) {
  const router = useRouter();
  const empty = { projectId, title: "", description: "", dueDate: "", status: "UPCOMING" as const, requiresApproval: false };
  const form = useZodForm(milestoneSchema, empty);
  const { execute, pending } = useAction(createMilestone, {
    success: "Milestone added.",
    onSuccess: () => {
      onOpenChange(false);
      form.reset(empty);
      router.refresh();
    },
    onError: (r) => applyFieldErrors(form, r.fieldErrors),
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Add milestone" className="sm:max-w-md">
      <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((v) => execute(v))}>
        <FormDialogBody>
          <FormField control={form.control} name="title" label="Title" required render={({ field, props }) => <Input {...field} {...props} placeholder="e.g. Design sign-off" autoFocus />} />
          <FormField control={form.control} name="dueDate" label="Due date" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} type="date" />} />
          <FormField control={form.control} name="description" label="Description" render={({ field, props }) => <Textarea {...field} value={field.value ?? ""} {...props} rows={3} />} />
          {hasClient && (
            <FormField
              control={form.control}
              name="requiresApproval"
              label="Client approval"
              render={({ field, props }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox id={props.id} checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  Ask the client to approve this deliverable in their portal
                </label>
              )}
            />
          )}
        </FormDialogBody>
        <FormDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <SubmitButton pending={pending}>Add milestone</SubmitButton>
        </FormDialogFooter>
      </form>
    </FormDialog>
  );
}
