"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteProject, setProjectStatus } from "@/features/projects/actions";
import { useAction } from "@/hooks/use-action";
import { PROJECT_STATUSES, PROJECT_STATUS_META } from "@/lib/constants";
import type { ProjectStatus } from "@/server/db/schema";

import { ProjectFormDialog, type ProjectFormOptions, type ProjectFormValues } from "./project-form-dialog";

export function NewProjectButton({ options, label = "New project", variant = "default" }: { options: ProjectFormOptions; label?: string; variant?: "default" | "outline" }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("new") === "1") {
      setClientId(params.get("client"));
      setOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [params, router, pathname]);

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
  const [value, setValue] = useState(status);
  const { execute, pending } = useAction(setProjectStatus, {
    success: (/* data */) => "Project status updated.",
    onSuccess: () => router.refresh(),
    onError: () => setValue(status),
  });
  useEffect(() => setValue(status), [status]);

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
