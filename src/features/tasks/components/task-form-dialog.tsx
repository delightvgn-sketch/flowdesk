"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FormDialog, FormDialogBody, FormDialogFooter } from "@/components/shared/form-dialog";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/misc";
import { EnumSelect, OptionSelect } from "@/components/shared/option-select";
import type { Person } from "@/components/shared/people-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTask } from "@/features/tasks/actions";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { PRIORITIES, PRIORITY_META, TASK_STATUSES, TASK_STATUS_META } from "@/lib/constants";
import { taskSchema } from "@/lib/validation";
import type { TaskStatus } from "@/server/db/schema";

import type { TaskLabel } from "../types";
import { LabelPicker } from "./label-picker";

export type TaskFormOptions = {
  projects: { id: string; label: string }[];
  people: Person[];
  labels: TaskLabel[];
  /** Members must put tasks in a project they're on; managers may leave it empty. */
  allowNoProject: boolean;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  options,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: TaskFormOptions;
  defaults?: { status?: TaskStatus; projectId?: string | null; assigneeId?: string | null };
}) {
  const router = useRouter();
  const [labels, setLabels] = useState(options.labels);
  const form = useZodForm(taskSchema, { title: "", description: "", status: "TODO", priority: "MEDIUM", projectId: null, assigneeId: null, dueDate: "", labelIds: [] });

  useEffect(() => setLabels(options.labels), [options.labels]);
  useEffect(() => {
    if (!open) return;
    form.reset({
      title: "",
      description: "",
      status: defaults?.status ?? "TODO",
      priority: "MEDIUM",
      projectId: defaults?.projectId ?? (options.allowNoProject ? null : (options.projects[0]?.id ?? null)),
      assigneeId: defaults?.assigneeId ?? null,
      dueDate: "",
      labelIds: [],
    });
  }, [open, defaults, form, options.allowNoProject, options.projects]);

  const { execute, pending } = useAction(createTask, {
    success: "Task created.",
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
    onError: (r) => applyFieldErrors(form, r.fieldErrors),
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="New task">
      <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((v) => execute(v))}>
        <FormDialogBody>
          <FormField control={form.control} name="title" label="Title" required render={({ field, props }) => <Input {...field} {...props} placeholder="What needs doing?" autoFocus />} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="projectId"
              label="Project"
              required={!options.allowNoProject}
              render={({ field, props }) => (
                <OptionSelect options={options.projects} value={field.value} onChange={field.onChange} noneLabel={options.allowNoProject ? "No project (internal)" : undefined} placeholder="Choose a project" {...props} />
              )}
            />
            <FormField
              control={form.control}
              name="assigneeId"
              label="Assignee"
              render={({ field, props }) => (
                <OptionSelect options={options.people.map((p) => ({ id: p.id, label: p.fullName }))} value={field.value} onChange={field.onChange} noneLabel="Unassigned" {...props} />
              )}
            />
            <FormField
              control={form.control}
              name="status"
              label="Status"
              render={({ field, props }) => <EnumSelect values={TASK_STATUSES} labels={TASK_STATUS_META} value={field.value ?? "TODO"} onChange={field.onChange} {...props} />}
            />
            <FormField
              control={form.control}
              name="priority"
              label="Priority"
              render={({ field, props }) => <EnumSelect values={PRIORITIES} labels={PRIORITY_META} value={field.value ?? "MEDIUM"} onChange={field.onChange} {...props} />}
            />
            <FormField control={form.control} name="dueDate" label="Due date" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} type="date" />} />
            <FormField
              control={form.control}
              name="labelIds"
              label="Labels"
              render={({ field, props }) => (
                <LabelPicker id={props.id} labels={labels} value={field.value ?? []} onChange={field.onChange} onLabelCreated={(l) => setLabels((ls) => [...ls, l])} />
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="description"
            label="Description"
            render={({ field, props }) => <Textarea {...field} value={field.value ?? ""} {...props} rows={4} placeholder="Add details, links or acceptance criteria." />}
          />
        </FormDialogBody>
        <FormDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <SubmitButton pending={pending} pendingLabel="Creating…">
            Create task
          </SubmitButton>
        </FormDialogFooter>
      </form>
    </FormDialog>
  );
}
