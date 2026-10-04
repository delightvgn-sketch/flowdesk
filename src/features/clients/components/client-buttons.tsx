"use client";

import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteClient, setClientArchived } from "@/features/clients/actions";
import { useAction } from "@/hooks/use-action";

import { ClientFormDialog, type ClientFormValues } from "./client-form-dialog";

/** "New client" button; also opens when the URL has ?new=1 (from ⌘K). */
export function NewClientButton() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get("new") === "1") {
      setOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [params, router, pathname]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> New client
      </Button>
      <ClientFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function EditClientButton({ client }: { client: ClientFormValues }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil /> Edit
      </Button>
      <ClientFormDialog open={open} onOpenChange={setOpen} client={client} />
    </>
  );
}

export function ClientRowActions({ client, redirectOnDelete }: { client: ClientFormValues & { id: string }; redirectOnDelete?: boolean }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const archived = client.status === "ARCHIVED";
  const displayName = client.company ?? client.name;

  const archive = useAction(setClientArchived, {
    success: archived ? "Client restored." : "Client archived.",
    onSuccess: () => {
      setConfirm(null);
      router.refresh();
    },
  });
  const remove = useAction(deleteClient, {
    success: "Client deleted.",
    onSuccess: () => {
      setConfirm(null);
      if (redirectOnDelete) router.push("/clients");
      else router.refresh();
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${displayName}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {archived ? (
            <DropdownMenuItem onSelect={() => archive.execute({ id: client.id, archived: false })}>
              <ArchiveRestore /> Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setConfirm("archive")}>
              <Archive /> Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={client} />
      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Archive ${displayName}?`}
        description="Archived clients are hidden from lists and pickers. Their projects, invoices and history are kept, and you can restore them any time."
        confirmLabel="Archive client"
        destructive={false}
        pending={archive.pending}
        onConfirm={() => archive.execute({ id: client.id, archived: true })}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${displayName}?`}
        description="This permanently removes the client and its contacts. Clients with invoices can't be deleted — archive them instead."
        confirmLabel="Delete client"
        pending={remove.pending}
        onConfirm={() => remove.execute({ id: client.id })}
      />
    </>
  );
}
