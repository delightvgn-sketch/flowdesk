"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteProject, setProjectStatus } from "@/features/projects/actions";
import { useAction } from "@/hooks/use-action";
import { useQueryDialog } from "@/hooks/use-query-dialog";
import { useSyncedState } from "@/hooks/use-synced-state";
import { PROJECT_STATUSES, PROJECT_STATUS_META } from "@/lib/constants";
import type { ProjectStatus } from "@/server/db/schema";

import { ProjectFormDialog, type ProjectFormOptions, type ProjectFormValues } from "./project-form-dialog";

export function NewProjectButton({
  options,
  label = "New project",
  variant = "default",
}: {
  options: ProjectFormOptions;
  label?: string;
  variant?: "default" | "outline";
}) {
  const { open, setOpen, fromQuery, params } = useQueryDialog("new", ["client"]);
  const clientId = fromQuery ? params.get("client") : null;

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <ProjectFormDialog open={open} onOpenChange={setOpen} options={options} defaultClientId={clientId} />
    </>
  );
}

export function ProjectActions({ project, options }: { project: ProjectFormValues; options: ProjectFormOptions }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useAction(deleteProject, {
    success: "Project deleted.",
    onSuccess: () => router.push("/projects"),
  });

  return (
    <>
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil /> Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More project actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil /> Edit details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 /> Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} options={options} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${project.name}?`}
        description="All tasks, milestones and messages in this project will be permanently deleted. Invoices and files are kept but unlinked."
        confirmLabel="Delete project"
        pending={remove.pending}
        onConfirm={() => remove.execute({ id: project.id })}
      />
    </>
  );
}

/** Inline status control, usable by staffed members. */
export function ProjectStatusSelect({ id, status }: { id: string; status: ProjectStatus }) {
  const router = useRouter();
  const [value, setValue] = useSyncedState(status);
  const { execute, pending } = useAction(setProjectStatus, {
    success: "Project status updated.",
    onSuccess: () => router.refresh(),
    onError: () => setValue(status),
  });

  return (
    <Select
      value={value}
      disabled={pending}
      onValueChange={(v) => {
        setValue(v as ProjectStatus);
        execute({ id, status: v as ProjectStatus });
      }}
    >
      <SelectTrigger size="sm" aria-label="Project status" className="min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROJECT_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {PROJECT_STATUS_META[s].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
