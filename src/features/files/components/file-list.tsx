"use client";

import { Download, Eye, EyeOff, FolderInput, MoreHorizontal, Paperclip, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteFile, updateFile } from "@/features/files/actions";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/dates";
import { cn, formatBytes } from "@/lib/utils";

import { FileIcon, fileKind } from "./file-icon";

export type FileListItem = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date | string;
  sharedWithClient: boolean;
  projectId?: string | null;
  projectName?: string | null;
  uploadedById?: string | null;
  uploadedByName?: string | null;
};

/**
 * File table used on the files page, project and client tabs and the portal.
 * Actions shown depend on what the viewer may do; the server re-checks each one.
 */
export function FileList({
  files,
  currentProfileId,
  canOrganize,
  canDeleteAny,
  folders,
  highlightId,
  showProject = true,
  emptyTitle = "No files yet",
  emptyDescription = "Upload briefs, designs, contracts and deliverables to keep everything in one place.",
  emptyAction,
}: {
  files: FileListItem[];
  currentProfileId: string;
  canOrganize: boolean;
  canDeleteAny: boolean;
  folders?: { id: string; name: string }[];
  highlightId?: string;
  showProject?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  if (files.length === 0) {
    return <EmptyState icon={Paperclip} title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <ul className="divide-y" aria-label="Files">
        {files.map((file) => (
          <FileRowItem
            key={file.id}
            file={file}
            showProject={showProject}
            highlighted={file.id === highlightId}
            canOrganize={canOrganize}
            canDelete={canDeleteAny || file.uploadedById === currentProfileId}
            folders={folders}
          />
        ))}
      </ul>
    </div>
  );
}

function FileRowItem({
  file,
  showProject,
  highlighted,
  canOrganize,
  canDelete,
  folders,
}: {
  file: FileListItem;
  showProject: boolean;
  highlighted: boolean;
  canOrganize: boolean;
  canDelete: boolean;
  folders?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const update = useAction(updateFile, { onSuccess: () => router.refresh() });
  const remove = useAction(deleteFile, {
    success: "File deleted.",
    onSuccess: () => {
      setConfirmOpen(false);
      router.refresh();
    },
  });
  const href = `/api/files/${file.id}`;

  return (
    <li className={cn("flex items-center gap-3 px-3 py-2.5 sm:px-4", highlighted && "bg-brand-soft/50")}>
      <FileIcon mime={file.mimeType} />
      <div className="min-w-0 flex-1">
        <a href={href} className="block truncate text-sm font-medium hover:underline" download>
          {file.name}
        </a>
        <p className="truncate text-xs text-muted-foreground">
          {fileKind(file.mimeType)} · {formatBytes(file.sizeBytes)}
          {file.uploadedByName && <> · {file.uploadedByName}</>}
          <span className="sm:hidden"> · {formatDate(file.createdAt, "d MMM")}</span>
        </p>
      </div>
      {showProject && file.projectName && file.projectId && (
        <Link
          href={`/projects/${file.projectId}?tab=files`}
          className="hidden max-w-44 truncate text-xs text-muted-foreground hover:text-foreground lg:block"
        >
          {file.projectName}
        </Link>
      )}
      {canOrganize && file.sharedWithClient && (
        <Badge tone="info" className="hidden sm:inline-flex">
          Client can see
        </Badge>
      )}
      <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">{formatDate(file.createdAt)}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${file.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={href} download>
              <Download /> Download
            </a>
          </DropdownMenuItem>
          {(file.mimeType.startsWith("image/") || file.mimeType === "application/pdf" || file.mimeType.startsWith("text/")) && (
            <DropdownMenuItem asChild>
              <a href={`${href}?inline=1`} target="_blank" rel="noreferrer">
                <Eye /> Open in new tab
              </a>
            </DropdownMenuItem>
          )}
          {canOrganize && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => update.execute({ id: file.id, sharedWithClient: !file.sharedWithClient })}>
                {file.sharedWithClient ? <EyeOff /> : <Eye />}
                {file.sharedWithClient ? "Hide from client" : "Share with client"}
              </DropdownMenuItem>
              {folders && folders.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderInput /> Move to folder
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onSelect={() => update.execute({ id: file.id, folderId: null })}>
                      All files (root)
                    </DropdownMenuItem>
                    {folders.map((f) => (
                      <DropdownMenuItem key={f.id} onSelect={() => update.execute({ id: file.id, folderId: f.id })}>
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
            </>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${file.name}?`}
        description="The file will be permanently removed from storage."
        confirmLabel="Delete file"
        pending={remove.pending}
        onConfirm={() => remove.execute({ id: file.id })}
      />
    </li>
  );
}
