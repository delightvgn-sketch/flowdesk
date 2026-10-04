"use client";

import { Folder, FolderPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field } from "@/components/shared/form-field";
import { FormDialog, FormDialogBody, FormDialogFooter } from "@/components/shared/form-dialog";
import { SubmitButton } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { createFolder, deleteFolder, renameFolder } from "@/features/files/actions";
import { useAction } from "@/hooks/use-action";

function FolderNameDialog({
  open,
  onOpenChange,
  title,
  initial = "",
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initial?: string;
  pending: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <FormDialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) setName(initial); }} title={title} className="sm:max-w-sm">
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); }}>
        <FormDialogBody>
          <Field label="Folder name" required>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />}
          </Field>
        </FormDialogBody>
        <FormDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <SubmitButton pending={pending} disabled={!name.trim()}>Save</SubmitButton>
        </FormDialogFooter>
      </form>
    </FormDialog>
  );
}

export function NewFolderButton({ parentId }: { parentId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { execute, pending } = useAction(createFolder, { success: "Folder created.", onSuccess: () => { setOpen(false); router.refresh(); } });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FolderPlus /> New folder
      </Button>
      <FolderNameDialog open={open} onOpenChange={setOpen} title="New folder" pending={pending} onSubmit={(name) => execute({ name, parentId })} />
    </>
  );
}

export function FolderCard({ folder, canManage }: { folder: { id: string; name: string }; canManage: boolean }) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const rename = useAction(renameFolder, { success: "Folder renamed.", onSuccess: () => { setRenameOpen(false); router.refresh(); } });
  const remove = useAction(deleteFolder, { success: "Folder deleted. Its files moved up a level.", onSuccess: () => { setDeleteOpen(false); router.refresh(); } });

  return (
    <div className="group relative flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-border-strong">
      <span className="flex size-9 items-center justify-center rounded-md bg-warning-soft text-warning">
        <Folder className="size-4" aria-hidden />
      </span>
      <Link href={`/files?folder=${folder.id}`} className="min-w-0 flex-1 truncate text-sm font-medium after:absolute after:inset-0">
        {folder.name}
      </Link>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="relative z-10" aria-label={`Actions for folder ${folder.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}><Pencil /> Rename</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <FolderNameDialog open={renameOpen} onOpenChange={setRenameOpen} title="Rename folder" initial={folder.name} pending={rename.pending} onSubmit={(name) => rename.execute({ id: folder.id, name })} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${folder.name}”?`}
        description="The folder is removed; files and subfolders inside it move up one level. Nothing is deleted from storage."
        confirmLabel="Delete folder"
        pending={remove.pending}
        onConfirm={() => remove.execute({ id: folder.id })}
      />
    </div>
  );
}
