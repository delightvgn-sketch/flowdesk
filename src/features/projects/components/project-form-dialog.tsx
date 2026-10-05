"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { FormDialog, FormDialogBody, FormDialogFooter } from "@/components/shared/form-dialog";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/misc";
import { EnumSelect, OptionSelect } from "@/components/shared/option-select";
import { PeoplePicker, type Person } from "@/components/shared/people-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createProject, updateProject } from "@/features/projects/actions";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { PRIORITIES, PRIORITY_META, PROJECT_STATUSES, PROJECT_STATUS_META } from "@/lib/constants";
import { currencySymbol } from "@/lib/money";
import { projectSchema, type ProjectInput } from "@/lib/validation";
import type { Priority, ProjectStatus } from "@/server/db/schema";

export type ProjectFormValues = {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  status: ProjectStatus;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  budget: number | null;
  memberIds: string[];
};

export type ProjectFormOptions = { clients: { id: string; label: string }[]; people: Person[]; currency: string };

const EMPTY: ProjectInput = {
  name: "",
  description: "",
  clientId: null,
  status: "PLANNING",
  priority: "MEDIUM",
  startDate: "",
  dueDate: "",
  budget: null,
  memberIds: [],
};

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  options,
  defaultClientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectFormValues;
  options: ProjectFormOptions;
  defaultClientId?: string | null;
}) {
  const router = useRouter();
  const editing = !!project;
  const form = useZodForm(projectSchema, EMPTY);

  useEffect(() => {
    if (!open) return;
    form.reset(
      project
        ? {
            ...project,
            description: project.description ?? "",
            startDate: project.startDate ?? "",
            dueDate: project.dueDate ?? "",
          }
        : { ...EMPTY, clientId: defaultClientId ?? null },
    );
  }, [open, project, defaultClientId, form]);

  const onError = (r: { fieldErrors?: Record<string, string[] | undefined> }) => applyFieldErrors(form, r.fieldErrors);
  const create = useAction(createProject, {
    success: "Project created.",
    onSuccess: ({ id }) => {
      onOpenChange(false);
      router.push(`/projects/${id}`);
    },
    onError,
  });
  const update = useAction(updateProject, {
    success: "Project updated.",
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
    onError,
  });
  const pending = create.pending || update.pending;

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={editing ? "Edit project" : "New project"} className="sm:max-w-xl">
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit((v) => (editing ? update.execute({ ...v, id: project!.id }) : create.execute(v)))}
      >
        <FormDialogBody>
          <FormField
            control={form.control}
            name="name"
            label="Project name"
            required
            render={({ field, props }) => <Input {...field} {...props} placeholder="Brand Website" autoFocus />}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="clientId"
              label="Client"
              render={({ field, props }) => (
                <OptionSelect
                  options={options.clients}
                  value={field.value}
                  onChange={field.onChange}
                  noneLabel="Internal project"
                  {...props}
                />
              )}
            />
            <FormField
              control={form.control}
              name="budget"
              label={`Budget (${currencySymbol(options.currency)})`}
              render={({ field, props }) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={field.value === null || field.value === undefined ? "" : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
            <FormField
              control={form.control}
              name="status"
              label="Status"
              render={({ field, props }) => (
                <EnumSelect
                  values={PROJECT_STATUSES}
                  labels={PROJECT_STATUS_META}
                  value={field.value}
                  onChange={field.onChange}
                  {...props}
                />
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              label="Priority"
              render={({ field, props }) => (
                <EnumSelect values={PRIORITIES} labels={PRIORITY_META} value={field.value} onChange={field.onChange} {...props} />
              )}
            />
            <FormField
              control={form.control}
              name="startDate"
              label="Start date"
              render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} type="date" />}
            />
            <FormField
              control={form.control}
              name="dueDate"
              label="Due date"
              render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} type="date" />}
            />
          </div>
          <FormField
            control={form.control}
            name="memberIds"
            label="Team"
            description="Members only see projects they're on."
            render={({ field, props }) => (
              <PeoplePicker people={options.people} value={field.value ?? []} onChange={field.onChange} {...props} />
            )}
          />
          <FormField
            control={form.control}
            name="description"
            label="Description"
            render={({ field, props }) => (
              <Textarea
                {...field}
                value={field.value ?? ""}
                {...props}
                rows={4}
                placeholder="Goals, scope and anything the team should know."
              />
            )}
          />
        </FormDialogBody>
        <FormDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <SubmitButton pending={pending} pendingLabel="Saving…">
            {editing ? "Save changes" : "Create project"}
          </SubmitButton>
        </FormDialogFooter>
      </form>
    </FormDialog>
  );
}
